import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getGenerationCost, getMotionCloneGenerationCost, getSegmentVideoGenerationCost, SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { recommendAvatarAdsSpokenLanguage } from '@/lib/avatar-ads-language-recommendation';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';
import {
  getAvatarPlannedSceneDurations,
  getAvatarAdsReferenceImageUrls,
  generateVideoWithKIE,
  getAvatarPlannedTotalDurationSeconds,
  getAvatarPromptScenes,
  getAvatarSceneDurationSeconds,
  processAvatarAdsProject,
  isAgentReferenceAvatarWorkflow,
  resolveAvatarAdsVideoModel,
} from '@/lib/avatar-ads-workflow';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildAvatarAdsStartPayload,
  buildMotionCloneStartPayload,
  buildVideoCloneStartPayload,
  createQueuedExecutionStatus,
  getExecutionTableForNodeType,
  getProjectAgentCanvasErrorInfo,
  normalizeExecutionStatus,
  type ProjectAgentConnectedFeatureInputs,
  type ProjectAgentCanvasExecutionStatus,
} from '@/lib/project-agent/node-execution';
import type {
  ProjectAgentCanvasAssetRef,
  ProjectAgentFeatureNodeConfig,
  ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import { signInternalUserRequest } from '@/lib/security/internal-request';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';
import { buildAvatarGeneratedPrompts } from '@/lib/project-agent/avatar-script-planning';
import {
  getProjectAgentVideoCloneDurationSeconds,
  getProjectAgentVideoCloneMode,
} from '@/lib/project-agent/video-clone-mode';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CanvasRunRequestBody = {
  nodeType?: ProjectAgentFeatureNodeType;
  mode?: 'start' | 'advance' | 'retry' | 'preflight';
  projectId?: string | null;
  runCount?: number | null;
  config?: ProjectAgentFeatureNodeConfig | null;
  connectedAssets?: ProjectAgentConnectedFeatureInputs | null;
};

type CanvasCreditPreflightResult = {
  requiredCredits: number;
  currentCredits: number;
  hasEnoughCredits: true;
};

const normalizeRunCount = (value: unknown) => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : 1;
  if (parsed === 2 || parsed === 3) return parsed;
  return 1;
};

const buildInternalHeaders = (userId: string) => {
  const timestamp = String(Date.now());
  return {
    'x-project-agent-internal': '1',
    'x-project-agent-user-id': userId,
    'x-project-agent-timestamp': timestamp,
    'x-project-agent-signature': signInternalUserRequest(userId, timestamp),
  };
};

const getOrigin = (request: NextRequest) => {
  const url = new URL(request.url);
  return url.origin;
};

class CanvasRunApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = 'CanvasRunApiError';
    this.status = status;
    this.code = code ?? null;
  }
}

class CanvasInsufficientCreditsError extends Error {
  status = 402;
  code = 'INSUFFICIENT_CREDITS';
  requiredCredits: number;
  currentCredits: number;

  constructor(requiredCredits: number, currentCredits: number) {
    super(`Insufficient credits. Need ${requiredCredits}, have ${currentCredits}.`);
    this.name = 'CanvasInsufficientCreditsError';
    this.requiredCredits = requiredCredits;
    this.currentCredits = currentCredits;
  }
}

const fetchJson = async (input: string, init?: RequestInit) => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `Request failed with status ${response.status}`;
    const code = typeof payload?.code === 'string' ? payload.code : null;
    throw new CanvasRunApiError(message, response.status, code);
  }
  return payload as Record<string, unknown>;
};

const toFormData = (payload: Record<string, string>) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.set(key, value);
  });
  return formData;
};

const ensureAsset = (
  value: ProjectAgentCanvasAssetRef | null | undefined,
  label: string
) => {
  if (!value?.id) {
    throw new Error(`${label} input is missing.`);
  }
  return value;
};

const getAvatarConfigLanguageOverride = (config?: ProjectAgentFeatureNodeConfig | null) => (
  config?.language && config.language !== 'en' ? config.language : null
);

const resolveAgentAvatarSpokenLanguage = async (
  scriptSource: string,
  config?: ProjectAgentFeatureNodeConfig | null,
): Promise<LanguageCode> => {
  const configuredLanguage = getAvatarConfigLanguageOverride(config);
  if (!scriptSource.trim()) {
    return resolveAvatarSpokenLanguage({
      scriptSource,
      configuredLanguage: configuredLanguage || config?.language || 'en',
    });
  }

  try {
    const recommendation = await recommendAvatarAdsSpokenLanguage({
      script: scriptSource,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    });
    return recommendation.language;
  } catch (error) {
    console.warn('[project-agent/canvas-run] Avatar Ads language recommendation failed, using fallback detection:', error);
    return resolveAvatarSpokenLanguage({
      scriptSource,
      configuredLanguage,
    });
  }
};

const ensureEnoughCredits = async (
  userId: string,
  requiredCredits: number
): Promise<CanvasCreditPreflightResult> => {
  const normalizedRequiredCredits = Math.max(0, Math.ceil(requiredCredits));

  const creditCheck = await checkCredits(userId, normalizedRequiredCredits);
  if (!creditCheck.success) {
    throw new Error(creditCheck.error || 'Failed to check credits.');
  }

  const currentCredits = creditCheck.currentCredits || 0;

  if (!creditCheck.hasEnoughCredits) {
    throw new CanvasInsufficientCreditsError(normalizedRequiredCredits, currentCredits);
  }

  await assertKieCreditsAvailable();

  return {
    requiredCredits: normalizedRequiredCredits,
    currentCredits,
    hasEnoughCredits: true,
  };
};

const chargeCredits = async (
  userId: string,
  amount: number,
  description: string,
  projectId: string,
) => {
  if (amount <= 0) {
    return false;
  }

  const creditCheck = await checkCredits(userId, amount);
  if (!creditCheck.success) {
    throw new Error(creditCheck.error || 'Failed to check credits.');
  }

  const currentCredits = creditCheck.currentCredits || 0;

  if (!creditCheck.hasEnoughCredits) {
    throw new CanvasInsufficientCreditsError(amount, currentCredits);
  }

  await assertKieCreditsAvailable();

  const deduction = await deductCredits(userId, amount);
  if (!deduction.success) {
    throw new Error(deduction.error || 'Failed to deduct credits.');
  }

  const transaction = await recordCreditTransaction(
    userId,
    'usage',
    amount,
    description,
    projectId,
    true,
  );

  if (!transaction.success) {
    await deductCredits(userId, -amount);
    throw new Error(transaction.error || 'Failed to record credit transaction.');
  }

  return true;
};

const assertAvatarCredits = async (userId: string, body: CanvasRunRequestBody, runCount = 1) => {
  const avatar = ensureAsset(body.connectedAssets?.avatar, 'Avatar');
  const product = body.connectedAssets?.product || null;
  const text = ensureAsset(body.connectedAssets?.text, 'Text');
  const customDialogue = text.content?.trim() || '';
  const resolvedSpokenLanguage = await resolveAgentAvatarSpokenLanguage(customDialogue, body.config);
  const payload = buildAvatarAdsStartPayload({
    avatar,
    product,
    text,
    config: body.config,
    resolvedSpokenLanguage,
  });

  const plannedDurationSeconds = payload.videoModel === 'kling_3' && payload.customDialogue
    ? buildAvatarGeneratedPrompts({
        imagePrompt: null,
        scriptSource: payload.customDialogue,
        language: payload.resolvedSpokenLanguage,
        avatarName: avatar.name,
        productName: product?.name || null,
      }).totalDurationSeconds
    : payload.videoDurationSeconds;

  const credits = await ensureEnoughCredits(
    userId,
    getGenerationCost(payload.videoModel, String(plannedDurationSeconds)) * runCount
  );

  return { resolvedSpokenLanguage, credits };
};

const assertVideoCloneCredits = async (userId: string, body: CanvasRunRequestBody, runCount = 1) => {
  const avatar = body.connectedAssets?.avatar || null;
  const product = body.connectedAssets?.product || null;
  const video = ensureAsset(body.connectedAssets?.video, 'Video');

  const cloneMode = getProjectAgentVideoCloneMode({
    avatar,
    product,
    video,
    text: body.connectedAssets?.text || null,
  });

  if (cloneMode === 'clone' && !avatar && !product) {
    throw new Error('Video Clone requires an avatar or product, or text for edit-video mode.');
  }

  const payload = buildVideoCloneStartPayload({
    avatar,
    product,
    video,
    text: body.connectedAssets?.text || null,
    config: body.config,
  });

  const duration = cloneMode === 'edit_video'
    ? String(getProjectAgentVideoCloneDurationSeconds({ video }) || '')
    : payload.videoDuration;

  return ensureEnoughCredits(
    userId,
    getGenerationCost(payload.videoModel, duration, body.config?.videoQuality, {
      hasVideoInput: cloneMode === 'edit_video',
    }) * runCount
  );
};

const assertMotionCloneCredits = async (userId: string, body: CanvasRunRequestBody, runCount = 1) => {
  const avatar = body.connectedAssets?.avatar || null;
  const product = body.connectedAssets?.product || null;
  const video = ensureAsset(body.connectedAssets?.video, 'Video');

  if (!avatar && !product) {
    throw new Error('Motion Clone requires an avatar or product.');
  }

  const payload = buildMotionCloneStartPayload({
    avatar,
    product,
    video,
    config: body.config,
  });

  // Schema verified via existing Motion Clone usage (2026-03-25):
  // creator_source_videos.duration_seconds is used by app/api/motion-clone/[id]/start/route.ts
  // to calculate generation cost for preview/video creation.
  const supabase = getSupabaseAdmin();
  const { data: referenceVideo, error } = await supabase
    .from('creator_source_videos')
    .select('duration_seconds')
    .eq('id', payload.referenceVideoId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !referenceVideo) {
    throw new Error('Reference video not found.');
  }

  if (
    typeof referenceVideo.duration_seconds !== 'number' ||
    !Number.isFinite(referenceVideo.duration_seconds) ||
    referenceVideo.duration_seconds <= 0
  ) {
    throw new Error('Reference video duration is missing.');
  }

  if (referenceVideo.duration_seconds < 3 || referenceVideo.duration_seconds > 30) {
    throw new Error(
      `Reference video must be 3-30s. Current: ${Math.round(referenceVideo.duration_seconds)}s.`
    );
  }

  const requiredCredits = getMotionCloneGenerationCost(
    referenceVideo.duration_seconds,
    payload.mode
  );

  return ensureEnoughCredits(userId, requiredCredits * runCount);
};

const buildFailedExecutionStatus = (
  nodeType: ProjectAgentFeatureNodeType,
  error: unknown
): ProjectAgentCanvasExecutionStatus => {
  const message = error instanceof Error ? error.message : 'Run failed.';
  const errorInfo = getProjectAgentCanvasErrorInfo(message, {
    code: error instanceof CanvasRunApiError ? error.code : null,
  });
  return {
    executionState: 'failed',
    phase: 'failed',
    progress: 0,
    outputUrl: null,
    previewUrl: null,
    error: message,
    userFacingError: errorInfo.userFacingError,
    retryable: errorInfo.retryable,
    statusLabel: errorInfo.maintenanceMode ? 'Maintenance' : 'Failed',
    projectId: '',
    table: getExecutionTableForNodeType(nodeType),
    nextAction: 'none',
    milestones: createQueuedExecutionStatus(nodeType).milestones.map((milestone, index) => ({
      ...milestone,
      state: index === 0 ? 'failed' : 'pending',
    })),
    currentMilestoneKey: 'preparing_prompt',
    raw: null,
  };
};

const checkNodeCreditsForStart = async (
  userId: string,
  nodeType: ProjectAgentFeatureNodeType,
  body: CanvasRunRequestBody,
  runCount: number
): Promise<{
  credits: CanvasCreditPreflightResult;
  avatarSpokenLanguage: LanguageCode | null;
}> => {
  if (nodeType === 'avatar_ads') {
    const result = await assertAvatarCredits(userId, body, runCount);
    return {
      credits: result.credits,
      avatarSpokenLanguage: result.resolvedSpokenLanguage,
    };
  }

  if (nodeType === 'video_clone') {
    return {
      credits: await assertVideoCloneCredits(userId, body, runCount),
      avatarSpokenLanguage: null,
    };
  }

  return {
    credits: await assertMotionCloneCredits(userId, body, runCount),
    avatarSpokenLanguage: null,
  };
};

const fetchAvatarStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('avatar_ads', payload);
};

const fetchCloneStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/video-clone/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('video_clone', payload);
};

const fetchMotionStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/motion-clone/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('motion_clone', payload);
};

const startAvatarAds = async (
  origin: string,
  userId: string,
  body: CanvasRunRequestBody,
  resolvedSpokenLanguage?: LanguageCode | null,
) => {
  const avatar = ensureAsset(body.connectedAssets?.avatar, 'Avatar');
  const product = body.connectedAssets?.product || null;
  const text = ensureAsset(body.connectedAssets?.text, 'Text');
  const customDialogue = text.content?.trim() || '';
  const spokenLanguage = resolvedSpokenLanguage
    || await resolveAgentAvatarSpokenLanguage(customDialogue, body.config);
  const payload = buildAvatarAdsStartPayload({
    avatar,
    product,
    text,
    config: body.config,
    resolvedSpokenLanguage: spokenLanguage,
  });

  const internalHeaders = buildInternalHeaders(userId);
  const formData = toFormData({
    user_id: userId,
    selected_person_photo_url: payload.selectedPersonPhotoUrl,
    video_duration_seconds: String(payload.videoDurationSeconds),
    video_aspect_ratio: payload.videoAspectRatio,
    language: payload.language,
    resolved_spoken_language: payload.resolvedSpokenLanguage,
    video_model: payload.videoModel,
    video_quality: payload.videoQuality,
  });

  if (payload.selectedProductId) {
    formData.set('selected_product_id', payload.selectedProductId);
  }
  if (payload.customDialogue) {
    formData.set('custom_dialogue', payload.customDialogue);
  }
  if (payload.talkingHeadMode) {
    formData.set('talking_head_mode', 'true');
  }

  const createPayload = await fetchJson(`${origin}/api/avatar-ads/create`, {
    method: 'POST',
    headers: internalHeaders,
    body: formData,
  });

  const projectId = typeof createPayload.id === 'string' ? createPayload.id : null;
  if (!projectId) {
    throw new Error('Avatar Ads project was created without an id.');
  }

  let status = await fetchAvatarStatus(origin, projectId, internalHeaders);
  if (status.nextAction !== 'none') {
    const statusPayload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
      cache: 'no-store',
      headers: internalHeaders,
    });
    const project = statusPayload.project as Record<string, unknown> | undefined;
    const totalDuration = getAvatarPlannedTotalDurationSeconds(
      project?.generated_prompts as Record<string, unknown> | null | undefined,
      payload.videoModel,
      typeof project?.video_duration_seconds === 'number'
        ? project.video_duration_seconds
        : Number(body.config?.videoDuration || '16')
    );

    if (status.nextAction === 'generate_avatar_cover') {
      await fetchJson(`${origin}/api/avatar-ads/${projectId}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...internalHeaders,
        },
        body: JSON.stringify({ step: 'generate_image' }),
      });
    } else if (status.nextAction === 'confirm_avatar' || status.nextAction === 'start_avatar_video') {
      await fetchJson(`${origin}/api/avatar-ads/${projectId}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...internalHeaders,
        },
        body: JSON.stringify({
          updatedPrompts: project?.generated_prompts || null,
          totalDurationSeconds: totalDuration,
        }),
      });
    }
    status = await fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  return status;
};

const startVideoClone = async (origin: string, userId: string, body: CanvasRunRequestBody) => {
  const avatar = body.connectedAssets?.avatar || null;
  const product = body.connectedAssets?.product || null;
  const video = ensureAsset(body.connectedAssets?.video, 'Video');

  const cloneMode = getProjectAgentVideoCloneMode({
    avatar,
    product,
    video,
    text: body.connectedAssets?.text || null,
  });

  if (cloneMode === 'clone' && !avatar && !product) {
    throw new Error('Video Clone requires an avatar or product, or text for edit-video mode.');
  }

  const payload = buildVideoCloneStartPayload({
    avatar,
    product,
    video,
    text: body.connectedAssets?.text || null,
    config: body.config,
  });

  const internalHeaders = buildInternalHeaders(userId);
  const createPayload = await fetchJson(`${origin}/api/video-clone/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({
      ...payload,
      userId,
    }),
  });

  const projectId = typeof createPayload.projectId === 'string'
    ? createPayload.projectId
    : typeof createPayload.historyId === 'string'
      ? createPayload.historyId
      : null;

  if (!projectId) {
    throw new Error('Video Clone project was created without an id.');
  }

  return fetchCloneStatus(origin, projectId, internalHeaders);
};

export const startMotionClone = async (origin: string, userId: string, body: CanvasRunRequestBody) => {
  const avatar = body.connectedAssets?.avatar || null;
  const product = body.connectedAssets?.product || null;
  const video = ensureAsset(body.connectedAssets?.video, 'Video');
  if (video.sourceType === 'reference_video') {
    throw new Error('Motion Clone requires a creator video, not a reference video.');
  }

  if (!avatar && !product) {
    throw new Error('Motion Clone requires an avatar or product.');
  }

  const internalHeaders = buildInternalHeaders(userId);
  const createPayload = await fetchJson(`${origin}/api/motion-clone/create`, {
    method: 'POST',
    headers: internalHeaders,
  });
  const project = createPayload.project as Record<string, unknown> | undefined;
  const projectId = typeof project?.id === 'string' ? project.id : null;
  if (!projectId) {
    throw new Error('Motion Clone project was created without an id.');
  }

  const payload = buildMotionCloneStartPayload({
    avatar,
    product,
    video,
    config: body.config,
  });

  await fetchJson(`${origin}/api/motion-clone/${projectId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({
      reference_video_id: payload.referenceVideoId,
      avatar_id: payload.avatarId,
      product_id: payload.productId,
      action: payload.action,
      mode: payload.mode,
    }),
  });

  return fetchMotionStatus(origin, projectId, internalHeaders);
};

const advanceVideoClone = async (origin: string, userId: string, projectId: string) => {
  const internalHeaders = buildInternalHeaders(userId);
  let status = await fetchCloneStatus(origin, projectId, internalHeaders);
  if (status.nextAction === 'start_clone_video') {
    await fetchJson(`${origin}/api/video-clone/${projectId}/start-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({}),
    });
    status = await fetchCloneStatus(origin, projectId, internalHeaders);
  }

  if (status.nextAction === 'merge_clone_video') {
    await fetchJson(`${origin}/api/video-clone/${projectId}/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({}),
    });
    status = await fetchCloneStatus(origin, projectId, internalHeaders);
  }

  return status;
};

const advanceAvatarAds = async (origin: string, userId: string, projectId: string) => {
  const internalHeaders = buildInternalHeaders(userId);
  const payload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
    cache: 'no-store',
    headers: internalHeaders,
  });
  const project = payload.project as Record<string, unknown> | undefined;
  const status = normalizeExecutionStatus('avatar_ads', payload);

  if (status.nextAction === 'generate_avatar_cover') {
    await fetchJson(`${origin}/api/avatar-ads/${projectId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({ step: 'generate_image' }),
    });
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  if (status.nextAction === 'confirm_avatar') {
    await fetchJson(`${origin}/api/avatar-ads/${projectId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({
        updatedPrompts: project?.generated_prompts || null,
        totalDurationSeconds: project?.video_duration_seconds || 16,
      }),
    });
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  if (status.nextAction === 'start_avatar_video') {
    await fetchJson(`${origin}/api/avatar-ads/${projectId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({
        updatedPrompts: project?.generated_prompts || null,
        totalDurationSeconds: project?.video_duration_seconds || 16,
      }),
    });
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  return status;
};

const retryAvatarAds = async (origin: string, userId: string, projectId: string) => {
  const internalHeaders = buildInternalHeaders(userId);
  const supabase = getSupabaseAdmin();
  const { data: project, error: projectError } = await supabase
    .from('avatar_ads_projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (projectError || !project) {
    throw new Error('Project not found.');
  }

  const isReferenceWorkflow = isAgentReferenceAvatarWorkflow(project);

  if (!isReferenceWorkflow && project.image_prompt && !project.generated_image_url) {
    await processAvatarAdsProject(project, 'generate_image');
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  const errorInfo = getProjectAgentCanvasErrorInfo(
    typeof project.error_message === 'string' ? project.error_message : null
  );

  if (!errorInfo.retryable) {
    throw new Error('This avatar project cannot be retried automatically.');
  }

  const { data: scenes } = await supabase
    .from('avatar_ads_scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_number', { ascending: true });

  const sceneRows = Array.isArray(scenes) ? scenes : [];
  const completedScenes = sceneRows.filter((scene) => scene.status === 'completed' && scene.video_url);
  const failedScenes = sceneRows.filter((scene) => scene.status === 'failed');

  if (
    sceneRows.length > 0 &&
    completedScenes.length === sceneRows.length &&
    !project.merged_video_url &&
    !project.fal_merge_task_id
  ) {
    await processAvatarAdsProject(project, 'merge_videos');
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  const referenceImageUrls = isReferenceWorkflow
    ? getAvatarAdsReferenceImageUrls(project)
    : project.generated_image_url
      ? [project.generated_image_url, project.generated_image_url]
      : [];

  if (failedScenes.length > 0 && referenceImageUrls.length > 0) {
    const resolvedVideoModel = resolveAvatarAdsVideoModel(project);
    const promptScenes = getAvatarPromptScenes(project.generated_prompts);
    const plannedSceneDurations = getAvatarPlannedSceneDurations(project.generated_prompts);
    const retryCost = failedScenes.reduce((sum, scene) => {
      const prompt = (
        scene.scene_prompt && typeof scene.scene_prompt === 'object'
          ? scene.scene_prompt
          : promptScenes[(scene.scene_number || 1) - 1]?.prompt
      ) as Record<string, unknown> | undefined;
      if (!prompt) return sum;
      return sum + getSegmentVideoGenerationCost(
        resolvedVideoModel,
        getAvatarSceneDurationSeconds(prompt, resolvedVideoModel, {
          plannedDurationSeconds: plannedSceneDurations[(scene.scene_number || 1) - 1],
          totalScenes: promptScenes.length,
          language: project.language
        })
      );
    }, 0);

    if (retryCost > 0) {
      await chargeCredits(
        userId,
        retryCost,
        `Avatar Ads - Retry failed video scenes (${resolvedVideoModel.toUpperCase()})`,
        project.id
      );
    }

    const nextTaskIds = Array.isArray(project.kie_video_task_ids)
      ? [...project.kie_video_task_ids]
      : [];

    let startedAnyTask = false;
    try {
      for (const scene of failedScenes) {
        const prompt = (
          scene.scene_prompt && typeof scene.scene_prompt === 'object'
            ? scene.scene_prompt
            : promptScenes[(scene.scene_number || 1) - 1]?.prompt
        ) as Record<string, unknown> | undefined;

        if (!prompt) {
          throw new Error(`Scene ${scene.scene_number} prompt is missing.`);
        }

        const { taskId } = await generateVideoWithKIE(
          prompt,
          referenceImageUrls,
          project.video_aspect_ratio as '16:9' | '9:16' | undefined,
          project.language,
          {
            hasProductContext: Boolean(project.product_context?.product_name || project.product_image_urls?.length),
            model: resolvedVideoModel,
            durationSeconds: getAvatarSceneDurationSeconds(prompt, resolvedVideoModel, {
              plannedDurationSeconds: plannedSceneDurations[(scene.scene_number || 1) - 1],
              totalScenes: promptScenes.length,
              language: project.language
            }),
            referenceWorkflow: isReferenceWorkflow,
            videoQuality: project.video_quality,
            moderationExternalId: `user_${userId}:avatar_ads_${project.id}:scene_${scene.scene_number || 1}:canvas_retry`,
          }
        );

        nextTaskIds[(scene.scene_number || 1) - 1] = taskId;
        startedAnyTask = true;

        await supabase
          .from('avatar_ads_scenes')
          .update({
            kie_video_task_id: taskId,
            status: 'generating',
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', scene.id);
      }
    } catch (error) {
      if (!startedAnyTask && retryCost > 0) {
        await deductCredits(userId, -retryCost);
        await recordCreditTransaction(
          userId,
          'refund',
          retryCost,
          'Avatar Ads - Retry failed video scenes refund',
          project.id,
          true,
        );
      }
      throw error;
    }

    await supabase
      .from('avatar_ads_projects')
      .update({
        kie_video_task_ids: nextTaskIds,
        generation_credits_used: Number(project.generation_credits_used || 0) + retryCost,
        status: 'generating_videos',
        current_step: 'generating_videos',
        progress_percentage: 70,
        error_message: null,
        fal_merge_task_id: null,
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  if (referenceImageUrls.length > 0 && project.generated_prompts) {
    const resolvedVideoModel = resolveAvatarAdsVideoModel(project);
    const totalDurationSeconds = getAvatarPlannedTotalDurationSeconds(
      project.generated_prompts,
      resolvedVideoModel,
      project.video_duration_seconds
    );
    const retryCost = getGenerationCost(resolvedVideoModel, String(totalDurationSeconds));

    if (retryCost > 0) {
      await chargeCredits(
        userId,
        retryCost,
        `Avatar Ads - Video regeneration (${resolvedVideoModel.toUpperCase()})`,
        project.id
      );

      await supabase
        .from('avatar_ads_projects')
        .update({
          generation_credits_used: Number(project.generation_credits_used || 0) + retryCost,
          last_processed_at: new Date().toISOString(),
        })
        .eq('id', project.id);
    }

    await fetchJson(`${origin}/api/avatar-ads/${projectId}/regenerate-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({
        updatedPrompts: project.generated_prompts,
        totalDurationSeconds,
      }),
    });

    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  throw new Error('This avatar project cannot continue with the current setup.');
};

const retryVideoClone = async (
  origin: string,
  userId: string,
  projectId: string,
) => {
  const internalHeaders = buildInternalHeaders(userId);
  const payload = await fetchJson(`${origin}/api/video-clone/${projectId}/status`, {
    cache: 'no-store',
    headers: internalHeaders,
  });
  const execution = normalizeExecutionStatus('video_clone', payload);

  if (!execution.retryable) {
    throw new Error('This clone project cannot be retried automatically.');
  }

  const data = (payload.data && typeof payload.data === 'object')
    ? payload.data as Record<string, unknown>
    : {};
  const segments = Array.isArray(data.segments)
    ? data.segments as Array<Record<string, unknown>>
    : [];

  const failedSegments = segments.filter((segment) => segment.status === 'failed');
  const failedFrameSegments = failedSegments.filter((segment) => !segment.firstFrameUrl);
  const failedVideoSegments = failedSegments.filter((segment) => Boolean(segment.firstFrameUrl));
  const allVideosReady = segments.length > 0 && segments.every((segment) => Boolean(segment.videoUrl));
  const awaitingMerge = Boolean(data.awaitingMerge);

  if (allVideosReady || awaitingMerge) {
    await fetchJson(`${origin}/api/video-clone/${projectId}/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({}),
    });
    return fetchCloneStatus(origin, projectId, internalHeaders);
  }

  if (failedFrameSegments.length > 0) {
    for (const segment of failedFrameSegments) {
      await fetchJson(
        `${origin}/api/video-clone/${projectId}/segments/${segment.index}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...internalHeaders,
          },
          body: JSON.stringify({ regenerate: 'photo' }),
        }
      );
    }

    return fetchCloneStatus(origin, projectId, internalHeaders);
  }

  if (failedVideoSegments.length > 0) {
    for (const segment of failedVideoSegments) {
      await fetchJson(
        `${origin}/api/video-clone/${projectId}/segments/${segment.index}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...internalHeaders,
          },
          body: JSON.stringify({ regenerate: 'video' }),
        }
      );
    }

    return fetchCloneStatus(origin, projectId, internalHeaders);
  }

  await fetchJson(`${origin}/api/video-clone/${projectId}/start-video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({}),
  });

  return fetchCloneStatus(origin, projectId, internalHeaders);
};

const retryMotionClone = async (
  origin: string,
  userId: string,
  projectId: string,
  body: CanvasRunRequestBody,
) => {
  const internalHeaders = buildInternalHeaders(userId);
  const payload = await fetchJson(`${origin}/api/motion-clone/${projectId}/status`, {
    cache: 'no-store',
    headers: internalHeaders,
  });
  const execution = normalizeExecutionStatus('motion_clone', payload);

  if (!execution.retryable) {
    throw new Error('This motion clone project cannot be retried automatically.');
  }

  const project = (payload.project && typeof payload.project === 'object')
    ? payload.project as Record<string, unknown>
    : {};

  const fallbackAvatarId = body.connectedAssets?.avatar?.id || null;
  const fallbackProductId = body.connectedAssets?.product?.id || null;
  const fallbackVideoId = body.connectedAssets?.video?.id || null;

  await fetchJson(`${origin}/api/motion-clone/${projectId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({
      reference_video_id: project.creator_source_video_id || fallbackVideoId,
      avatar_id: project.avatar_id || fallbackAvatarId,
      product_id: project.product_id || fallbackProductId,
      action: 'video',
      mode: typeof project.mode === 'string' ? project.mode : body.config?.videoQuality || '720p',
    }),
  });

  return fetchMotionStatus(origin, projectId, internalHeaders);
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CanvasRunRequestBody;
    const origin = getOrigin(request);
    const nodeType = body.nodeType;

    if (!nodeType) {
      return NextResponse.json({ error: 'nodeType is required' }, { status: 400 });
    }

    if (body.mode === 'advance') {
      if (!body.projectId) {
        return NextResponse.json({ error: 'projectId is required for advance' }, { status: 400 });
      }

      const advancedStatus = nodeType === 'avatar_ads'
        ? await advanceAvatarAds(origin, userId, body.projectId)
        : nodeType === 'video_clone'
          ? await advanceVideoClone(origin, userId, body.projectId)
          : await fetchMotionStatus(origin, body.projectId, buildInternalHeaders(userId));

      return NextResponse.json({ success: true, execution: advancedStatus });
    }

    const runCount = normalizeRunCount(body.runCount ?? body.config?.runCount);

    if (body.mode === 'preflight') {
      const preflight = await checkNodeCreditsForStart(userId, nodeType, body, runCount);
      return NextResponse.json({
        success: true,
        requiredCredits: preflight.credits.requiredCredits,
        currentCredits: preflight.credits.currentCredits,
        hasEnoughCredits: preflight.credits.hasEnoughCredits,
      });
    }

    if (body.mode === 'retry') {
      if (!body.projectId) {
        return NextResponse.json({ error: 'projectId is required for retry' }, { status: 400 });
      }

      const retriedStatus = nodeType === 'avatar_ads'
        ? await retryAvatarAds(origin, userId, body.projectId)
        : nodeType === 'video_clone'
          ? await retryVideoClone(origin, userId, body.projectId)
          : await retryMotionClone(origin, userId, body.projectId, body);

      return NextResponse.json({ success: true, execution: retriedStatus });
    }

    const creditPreflight = await checkNodeCreditsForStart(userId, nodeType, body, runCount);
    const avatarSpokenLanguage = creditPreflight.avatarSpokenLanguage;

    const startOne = () => (
      nodeType === 'avatar_ads'
        ? startAvatarAds(origin, userId, body, avatarSpokenLanguage)
        : nodeType === 'video_clone'
          ? startVideoClone(origin, userId, body)
          : startMotionClone(origin, userId, body)
    );
    const results = await Promise.allSettled(
      Array.from({ length: runCount }, () => startOne())
    );
    const executions = results.map((result) => (
      result.status === 'fulfilled'
        ? result.value
        : buildFailedExecutionStatus(nodeType, result.reason)
    ));
    const execution = executions.find((item) => item.executionState !== 'failed') || executions[0];

    return NextResponse.json({ success: true, execution, executions });
  } catch (error) {
    console.error('[Project Agent Canvas Run] Error:', error);
    if (error instanceof CanvasInsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          requiredCredits: error.requiredCredits,
          currentCredits: error.currentCredits,
          hasEnoughCredits: false,
        },
        { status: error.status }
      );
    }
    if (error instanceof CanvasRunApiError) {
      const errorInfo = getProjectAgentCanvasErrorInfo(error.message, {
        code: error.code,
      });
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          maintenanceMode: errorInfo.maintenanceMode,
        },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
