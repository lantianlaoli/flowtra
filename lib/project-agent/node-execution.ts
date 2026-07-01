import type {
  ProjectAgentCanvasAssetRef,
  ProjectAgentCanvasMilestone,
  ProjectAgentCanvasMilestoneState,
  ProjectAgentFeatureNodeConfig,
  ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import type { LanguageCode } from '@/lib/constants';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';
import {
  getProjectAgentVideoCloneDurationSeconds,
  getProjectAgentVideoCloneMode,
  normalizeProjectAgentVideoCloneModel,
} from '@/lib/project-agent/video-clone-mode';
import { getEffectiveProjectAgentVideoModel } from '@/lib/project-agent/video-model';
import {
  getProjectAgentCloneExecutionMode,
  normalizeCloneDurationSeconds,
  type ProjectAgentCloneExecutionMode,
} from '@/lib/video-clone-billing';
import { normalizeAvatarAdsStoryboardDurationSeconds } from '@/lib/avatar-ads-storyboard';

const resolveVideoClonePayloadQuality = (input: {
  videoModel: ReturnType<typeof normalizeProjectAgentVideoCloneModel>;
  executionMode: ProjectAgentCloneExecutionMode;
  config?: ProjectAgentFeatureNodeConfig | null;
}) => {
  if (
    input.videoModel === 'seedance_2_mini' &&
    input.executionMode === 'clone_direct_reference' &&
    !input.config?.videoQualityManual
  ) {
    return '480p' as const;
  }

  return input.config?.videoQuality || (input.videoModel === 'seedance_2' ? '1080p' : '720p');
};

export type ProjectAgentConnectedFeatureInputs = {
  avatar?: ProjectAgentCanvasAssetRef | null;
  product?: ProjectAgentCanvasAssetRef | null;
  pet?: ProjectAgentCanvasAssetRef | null;
  video?: ProjectAgentCanvasAssetRef | null;
  text?: ProjectAgentCanvasAssetRef | null;
};

export type ProjectAgentCanvasExecutionAction =
  | 'none'
  | 'generate_avatar_cover'
  | 'confirm_avatar'
  | 'start_avatar_video'
  | 'start_clone_video'
  | 'merge_clone_video';

export type ProjectAgentCanvasExecutionStatus = {
  executionState: 'ready' | 'running' | 'completed' | 'failed';
  phase: string;
  progress: number;
  outputUrl?: string | null;
  previewUrl?: string | null;
  error?: string | null;
  userFacingError?: string | null;
  retryable: boolean;
  statusLabel: string;
  projectId: string;
  table: 'avatar_ads_projects' | 'video_clone_projects' | 'motion_clone_projects';
  nextAction: ProjectAgentCanvasExecutionAction;
  milestones: ProjectAgentCanvasMilestone[];
  currentMilestoneKey: string;
  raw?: Record<string, unknown> | null;
};

export const getReusableFeatureRuntimeAfterCompletion = (
  execution: ProjectAgentCanvasExecutionStatus,
) => ({
  executionState: 'ready' as const,
  projectId: execution.projectId,
  phase: 'ready',
  progress: 0,
  outputUrl: null,
  previewUrl: null,
  error: null,
  userFacingError: null,
  retryable: false,
  statusLabel: 'Ready',
  milestones: null,
  currentMilestoneKey: null,
});

const toProgress = (value: unknown, fallback: number) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

type CanvasErrorInfo = {
  retryable: boolean;
  userFacingError: string | null;
  maintenanceMode: boolean;
};

const RETRYABLE_ERROR_PATTERNS = [
  '500',
  '503',
  'provider_code=500',
  'server error',
  'failed after 3 retries',
  'failed after retries',
  'service temporarily unavailable',
  'provider busy',
  'provider unavailable',
  'temporarily unavailable',
  'temporarily busy',
  'timeout',
  'timed out',
  'fetch failed',
  'econnreset',
  'enotfound',
  'network error',
  'connection reset',
  'upstream',
];

const NON_RETRYABLE_INPUT_PATTERNS = [
  'insufficient credits',
  'missing',
  'not found',
  'forbidden',
  'unauthorized',
  'invalid',
  'unsupported',
  'policy',
  'safety check failed',
  'content policy',
  'violating content policies',
  'prompt validation',
];

export const getProjectAgentCanvasErrorInfo = (
  error: string | null | undefined,
  options?: { code?: string | null }
): CanvasErrorInfo => {
  if (options?.code === 'INSUFFICIENT_CREDITS') {
    return {
      retryable: false,
      userFacingError: error || 'Insufficient credits.',
      maintenanceMode: false,
    };
  }

  if (options?.code === 'MAINTENANCE_MODE') {
    return {
      retryable: false,
      userFacingError: 'System maintenance is in progress.',
      maintenanceMode: true,
    };
  }

  if (!error) {
    return {
      retryable: false,
      userFacingError: null,
      maintenanceMode: false,
    };
  }

  const normalized = error.toLowerCase();

  if (normalized.includes('insufficient credits')) {
    return {
      retryable: false,
      userFacingError: error,
      maintenanceMode: false,
    };
  }

  const isRetryable = RETRYABLE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
    && !NON_RETRYABLE_INPUT_PATTERNS.some((pattern) => normalized.includes(pattern));

  if (normalized.includes('merge')) {
    return {
      retryable: isRetryable,
      userFacingError: isRetryable
        ? "We couldn't finish combining the video clips right now. Please try again."
        : 'We could not combine the video clips with the current project setup.',
      maintenanceMode: false,
    };
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return {
      retryable: true,
      userFacingError: 'The generation took too long to respond. Please try again.',
      maintenanceMode: false,
    };
  }

  if (
    normalized.includes('fetch failed') ||
    normalized.includes('network error') ||
    normalized.includes('econnreset') ||
    normalized.includes('enotfound') ||
    normalized.includes('connection reset')
  ) {
    return {
      retryable: true,
      userFacingError: 'We lost connection to the video service. Please try again.',
      maintenanceMode: false,
    };
  }

  if (
    normalized.includes('maintenance_mode') ||
    normalized.includes('system maintenance') ||
    normalized.includes('under maintenance')
  ) {
    return {
      retryable: false,
      userFacingError: 'System maintenance is in progress.',
      maintenanceMode: true,
    };
  }

  if (
    normalized.includes('503') ||
    normalized.includes('service temporarily unavailable') ||
    normalized.includes('provider busy') ||
    normalized.includes('provider unavailable') ||
    normalized.includes('temporarily unavailable')
  ) {
    return {
      retryable: true,
      userFacingError: 'The video service is temporarily unavailable. Please try again.',
      maintenanceMode: false,
    };
  }

  if (
    normalized.includes('policy') ||
    normalized.includes('safety') ||
    normalized.includes('content policy') ||
    normalized.includes('sensitive information')
  ) {
    return {
      retryable: false,
      userFacingError: error,
      maintenanceMode: false,
    };
  }

  if (
    normalized.includes('missing') ||
    normalized.includes('not found') ||
    normalized.includes('invalid') ||
    normalized.includes('unsupported')
  ) {
    return {
      retryable: false,
      userFacingError: 'This run could not continue with the current media or settings.',
      maintenanceMode: false,
    };
  }

  return {
    retryable: isRetryable,
    userFacingError: isRetryable
      ? 'Something went wrong with the video service. Please try again.'
      : 'This run could not be completed. Please review the setup and try again.',
    maintenanceMode: false,
  };
};

const getMilestoneLabels = (
  nodeType: ProjectAgentFeatureNodeType,
  options?: { skipCloneFrames?: boolean; skipCloneMerge?: boolean; storyboardClone?: boolean }
) => {
  switch (nodeType) {
    case 'video_clone':
      if (options?.storyboardClone) {
        return [
          ['generating_storyboard', 'Generating storyboard'],
          ['generating_video', 'Generating video'],
          ['merging', 'Merging video'],
          ['completed', 'Completed'],
        ] as const;
      }

      if (options?.skipCloneFrames) {
        return [
          ['preparing_prompt', 'Preparing prompt'],
          ['generating_video', 'Generating video'],
          ...(options.skipCloneMerge ? [] : [['merging', 'Merging video']] as const),
          ['completed', 'Completed'],
        ] as const;
      }

      return [
        ['preparing_prompt', 'Preparing prompt'],
        ['generating_frames', 'Generating frames'],
        ['generating_video', 'Generating video'],
        ['merging', 'Merging video'],
        ['completed', 'Completed'],
      ] as const;
    case 'avatar_ads':
      if (options?.storyboardClone) {
        return [
          ['preparing_prompt', 'Preparing prompt'],
          ['generating_storyboard', 'Generating storyboard'],
          ['generating_video', 'Generating video'],
          ['completed', 'Completed'],
        ] as const;
      }
      return [
        ['preparing_prompt', 'Preparing prompt'],
        ['generating_cover', 'Generating cover'],
        ['generating_video', 'Generating video'],
        ['completed', 'Completed'],
      ] as const;
    case 'motion_clone':
      return [
        ['preparing_prompt', 'Preparing prompt'],
        ['generating_preview', 'Generating preview'],
        ['generating_video', 'Generating video'],
        ['completed', 'Completed'],
      ] as const;
    default:
      return [['preparing_prompt', 'Preparing prompt'], ['completed', 'Completed']] as const;
  }
};

const buildMilestones = (
  nodeType: ProjectAgentFeatureNodeType,
  currentMilestoneKey: string,
  executionState: 'ready' | 'running' | 'completed' | 'failed',
  options?: { skipCloneFrames?: boolean; skipCloneMerge?: boolean; storyboardClone?: boolean },
): ProjectAgentCanvasMilestone[] => {
  const labels = getMilestoneLabels(nodeType, options);
  const currentIndex = Math.max(0, labels.findIndex(([key]) => key === currentMilestoneKey));

  return labels.map(([key, label], index) => {
    let state: ProjectAgentCanvasMilestoneState = 'pending';
    if (executionState === 'completed') {
      state = 'completed';
    } else if (executionState === 'failed') {
      state = index < currentIndex ? 'completed' : index === currentIndex ? 'failed' : 'pending';
    } else if (executionState === 'running') {
      state = index < currentIndex ? 'completed' : index === currentIndex ? 'active' : 'pending';
    } else if (executionState === 'ready') {
      state = index === 0 ? 'active' : 'pending';
    }

    return { key, label, state };
  });
};

const getCurrentMilestoneForAvatar = (status: string, isReferenceWorkflow = false, isStoryboardWorkflow = false) => {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'generating_video';
  if (status === 'generating_videos') return 'generating_video';
  if (isReferenceWorkflow && status === 'awaiting_review') return 'generating_video';
  if (status === 'generating_image' || status === 'regenerating_image' || status === 'awaiting_review') {
    return isStoryboardWorkflow ? 'generating_storyboard' : 'generating_cover';
  }
  return 'preparing_prompt';
};

const getCurrentMilestoneForClone = (
  status: string,
  step: string,
  awaitingMerge: boolean,
  needsVideoStart: boolean,
  hasActiveVideoGeneration: boolean,
  isReferenceImageDirectMode = false,
  isStoryboardCloneMode = false,
) => {
  if (status === 'completed') return 'completed';
  if (awaitingMerge || step === 'merging' || status === 'merging') return 'merging';
  if (hasActiveVideoGeneration) {
    return 'generating_video';
  }
  if (
    isStoryboardCloneMode &&
    (
      step === 'generating_storyboard_image' ||
      step === 'generating_storyboard' ||
      status === 'pending_storyboard'
    )
  ) {
    return 'generating_storyboard';
  }
  if (
    isStoryboardCloneMode &&
    (
      step === 'generating_segment_frames' ||
      step === 'reviewing_segment_frames' ||
      step === 'ready_for_video' ||
      status === 'segment_frames_ready' ||
      status === 'ready_for_video'
    )
  ) {
    return 'generating_video';
  }
  if (
    isReferenceImageDirectMode &&
    (
      step === 'reviewing_segment_frames' ||
      step === 'ready_for_video' ||
      status === 'segment_frames_ready' ||
      status === 'ready_for_video'
    )
  ) {
    return 'generating_video';
  }
  if (
    step === 'generating_segment_frames' ||
    step === 'reviewing_segment_frames' ||
    step === 'ready_for_video' ||
    status === 'segment_frames_ready' ||
    status === 'ready_for_video'
  ) {
    return 'generating_frames';
  }
  return 'preparing_prompt';
};

const getCurrentMilestoneForMotionClone = (status: string) => {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'generating_video';
  if (status === 'generating_video') return 'generating_video';
  if (status === 'generating_preview' || status === 'preview_ready') return 'generating_preview';
  return 'preparing_prompt';
};

export const createQueuedExecutionStatus = (
  nodeType: ProjectAgentFeatureNodeType,
  options?: { skipCloneFrames?: boolean; skipCloneMerge?: boolean; storyboardClone?: boolean },
): Pick<ProjectAgentCanvasExecutionStatus, 'phase' | 'progress' | 'statusLabel' | 'milestones' | 'currentMilestoneKey'> => ({
  phase: 'queued',
  progress: 5,
  statusLabel: options?.storyboardClone ? 'Generating storyboard' : 'Preparing prompt',
  currentMilestoneKey: options?.storyboardClone ? 'generating_storyboard' : 'preparing_prompt',
  milestones: buildMilestones(nodeType, options?.storyboardClone ? 'generating_storyboard' : 'preparing_prompt', 'running', options),
});

export const getExecutionTableForNodeType = (
  nodeType: ProjectAgentFeatureNodeType
) => {
  switch (nodeType) {
    case 'avatar_ads':
      return 'avatar_ads_projects';
    case 'video_clone':
      return 'video_clone_projects';
    case 'motion_clone':
      return 'motion_clone_projects';
    default:
      return 'avatar_ads_projects';
  }
};

export const buildAvatarAdsStartPayload = (input: {
  avatar: ProjectAgentCanvasAssetRef;
  product?: ProjectAgentCanvasAssetRef | null;
  text?: ProjectAgentCanvasAssetRef | null;
  config?: ProjectAgentFeatureNodeConfig | null;
  resolvedSpokenLanguage?: LanguageCode | null;
}) => {
  const instructionText = input.text?.content?.trim() || '';
  const talkingHeadMode = !input.product?.id;
  const customDialogue = talkingHeadMode ? instructionText : '';
  const sellingRequirements = talkingHeadMode ? '' : instructionText;
  const configuredLanguage = input.config?.language && input.config.language !== 'en'
    ? input.config.language
    : null;
  const resolvedSpokenLanguage = resolveAvatarSpokenLanguage({
    scriptSource: customDialogue,
    configuredLanguage: input.resolvedSpokenLanguage || configuredLanguage,
  });

  const videoModel = getEffectiveProjectAgentVideoModel('avatar_ads', input.config?.videoModel);

  return {
    selectedPersonPhotoUrl: input.avatar.imageUrl || '',
    selectedProductId: input.product?.id || '',
    customDialogue,
    sellingRequirements,
    talkingHeadMode,
    videoDurationSeconds: normalizeAvatarAdsStoryboardDurationSeconds(
      videoModel,
      Number(input.config?.videoDuration || '15')
    ),
    videoAspectRatio: input.config?.aspectRatio || '9:16',
    language: resolvedSpokenLanguage,
    resolvedSpokenLanguage,
    videoModel,
    videoQuality: input.config?.videoQuality || '720p',
  };
};

export const buildVideoCloneStartPayload = (input: {
  avatar?: ProjectAgentCanvasAssetRef | null;
  product?: ProjectAgentCanvasAssetRef | null;
  pet?: ProjectAgentCanvasAssetRef | null;
  video: ProjectAgentCanvasAssetRef;
  text?: ProjectAgentCanvasAssetRef | null;
  config?: ProjectAgentFeatureNodeConfig | null;
}) => {
  const mode = getProjectAgentVideoCloneMode(input);
  const videoModel = normalizeProjectAgentVideoCloneModel(input.config?.videoModel, mode);
  const sourceDurationSeconds = getProjectAgentVideoCloneDurationSeconds(input);
  const executableEditVideoDurationSeconds = sourceDurationSeconds === null
    ? null
    : Math.ceil(sourceDurationSeconds);
  const playableVideoUrl = input.video.videoCdnUrl?.trim() || input.video.videoUrl?.trim() || undefined;
  const cloneDurationSeconds = mode === 'clone'
    ? normalizeCloneDurationSeconds(sourceDurationSeconds) || normalizeCloneDurationSeconds(input.config?.videoDuration) || 8
    : executableEditVideoDurationSeconds;
  const executionMode = mode === 'clone'
    ? getProjectAgentCloneExecutionMode({
        model: videoModel,
        durationSeconds: cloneDurationSeconds,
        hasReferenceVideoUrl: Boolean(playableVideoUrl),
      })
    : mode;
  const videoQuality = resolveVideoClonePayloadQuality({
    videoModel,
    executionMode,
    config: input.config,
  });

  return {
    executionMode,
    referenceVideoId: input.video.id,
    referenceSourceVideoUrl: mode === 'clone' ? playableVideoUrl : undefined,
    referenceSourceMediaDurationSeconds: mode === 'clone' ? sourceDurationSeconds : undefined,
    selectedAvatarIds: mode === 'clone' && input.avatar?.id ? [input.avatar.id] : [],
    selectedProductIds: mode === 'clone' && input.product?.id ? [input.product.id] : [],
    selectedPetIds: mode === 'clone' && input.pet?.id ? [input.pet.id] : [],
    supplementalText: mode === 'clone' ? input.text?.content?.trim() || undefined : undefined,
    editVideoPrompt: mode === 'edit_video' ? input.text?.content?.trim() || undefined : undefined,
    editVideoSourceUrl: mode === 'edit_video' ? playableVideoUrl : undefined,
    videoModel,
    videoAspectRatio: input.config?.aspectRatio || '9:16',
    videoDuration: mode === 'edit_video'
      ? String(executableEditVideoDurationSeconds || '')
      : String(cloneDurationSeconds || 8),
    videoQuality,
    videoQualityManual: Boolean(input.config?.videoQualityManual),
    language: input.config?.language || input.video.analysisLanguage || 'en',
    shouldGenerateVideo: true,
    photoOnly: false,
    requestSource: 'project_agent_clone' as const,
  };
};

export const buildMotionCloneStartPayload = (input: {
  avatar?: ProjectAgentCanvasAssetRef | null;
  video: ProjectAgentCanvasAssetRef;
  config?: ProjectAgentFeatureNodeConfig | null;
}) => {
  const videoModel = getEffectiveProjectAgentVideoModel('motion_clone', input.config?.videoModel);
  return {
    referenceVideoId: input.video.id,
    avatarId: input.avatar?.id || null,
    action: 'video' as const,
    mode: input.config?.videoQuality || (videoModel === 'seedance_2_mini' ? '480p' : '720p'),
    videoModel,
  };
};

export const normalizeAvatarExecutionStatus = (
  payload: Record<string, unknown>
): ProjectAgentCanvasExecutionStatus => {
  const project = (payload.project && typeof payload.project === 'object')
    ? payload.project as Record<string, unknown>
    : {};
  const status = typeof project.status === 'string' ? project.status : 'pending';
  const projectId = typeof project.id === 'string' ? project.id : '';
  const mergedVideoUrl = typeof project.merged_video_url === 'string' ? project.merged_video_url : null;
  const generatedImageUrl = typeof project.generated_image_url === 'string' ? project.generated_image_url : null;
  const workflowSource = (
    project.generated_prompts &&
    typeof project.generated_prompts === 'object' &&
    typeof (project.generated_prompts as Record<string, unknown>).workflow_source === 'string'
  )
    ? (project.generated_prompts as Record<string, unknown>).workflow_source
    : null;
  const isReferenceWorkflow = workflowSource === 'project_agent_reference_to_video';
  const isStoryboardWorkflow = Boolean(
    project.generated_prompts &&
    typeof project.generated_prompts === 'object' &&
    (project.generated_prompts as Record<string, unknown>).storyboard_mode
  );
  const progress = toProgress(project.progress_percentage, status === 'completed' ? 100 : 15);
  const failed = status === 'failed';
  const completed = status === 'completed';
  const awaitingReview = status === 'awaiting_review';
  const hasImagePrompt = typeof project.image_prompt === 'string' && project.image_prompt.trim().length > 0;
  const awaitingCoverGeneration = awaitingReview && !generatedImageUrl && hasImagePrompt;
  const awaitingCoverConfirmation = awaitingReview && Boolean(generatedImageUrl);
  const executionState = completed ? 'completed' : failed ? 'failed' : 'running';
  const currentMilestoneKey = getCurrentMilestoneForAvatar(status, isReferenceWorkflow, isStoryboardWorkflow);
  const error = typeof project.error_message === 'string' ? project.error_message : null;
  const { retryable, userFacingError } = getProjectAgentCanvasErrorInfo(error);

  return {
    executionState,
    phase: status,
    progress,
    outputUrl: mergedVideoUrl,
    previewUrl: isReferenceWorkflow ? null : generatedImageUrl,
    error,
    userFacingError,
    retryable,
    statusLabel: completed
      ? 'Completed'
      : failed
        ? 'Failed'
        : awaitingCoverGeneration
          ? isStoryboardWorkflow ? 'Generating storyboard' : 'Generating cover'
        : isReferenceWorkflow && awaitingReview
          ? 'Ready to generate video'
        : awaitingCoverConfirmation
          ? 'Auto confirming cover'
          : 'Running avatar workflow',
    projectId,
    table: 'avatar_ads_projects',
    nextAction: awaitingCoverGeneration
      ? 'generate_avatar_cover'
      : isReferenceWorkflow && awaitingReview
      ? 'start_avatar_video'
      : awaitingCoverConfirmation
        ? 'confirm_avatar'
        : 'none',
    milestones: buildMilestones('avatar_ads', currentMilestoneKey, executionState, {
      storyboardClone: isStoryboardWorkflow
    }),
    currentMilestoneKey,
    raw: payload,
  };
};

export const normalizeCloneExecutionStatus = (
  payload: Record<string, unknown>
): ProjectAgentCanvasExecutionStatus => {
  const data = (payload.data && typeof payload.data === 'object')
    ? payload.data as Record<string, unknown>
    : {};
  const status = typeof payload.status === 'string'
    ? payload.status
    : typeof payload.workflowStatus === 'string'
      ? payload.workflowStatus
      : 'processing';
  const projectId = typeof data.projectId === 'string'
    ? data.projectId
    : typeof payload.projectId === 'string'
      ? payload.projectId
      : '';
  const mergedVideo = typeof data.videoUrl === 'string' ? data.videoUrl : null;
  const coverImage = typeof data.coverImageUrl === 'string' ? data.coverImageUrl : null;
  const progress = toProgress(payload.progress_percentage, toProgress(payload.progress, status === 'completed' ? 100 : 20));
  const awaitingMerge = Boolean(data.awaitingMerge) || status === 'awaiting_merge';
  const videoGenerationRequested = data.videoGenerationRequested === true;
  const step = typeof payload.current_step === 'string' ? payload.current_step : '';
  const isStoryboardCloneMode = data.executionMode === 'clone_storyboard_reference';
  const skipsFrameGeneration = data.workflowSource === 'project_agent_edit_video' ||
    data.executionMode === 'clone_direct_reference';
  const skipsMerge = data.workflowSource === 'project_agent_edit_video' ||
    data.executionMode === 'clone_direct_reference';
  const segments = Array.isArray(data.segments)
    ? data.segments as Array<Record<string, unknown>>
    : [];
  const hasSegmentVideoTask = segments.some((segment) => (
    typeof segment.videoTaskId === 'string' ||
    typeof segment.video_task_id === 'string' ||
    typeof segment.videoUrl === 'string' ||
    typeof segment.video_url === 'string' ||
    segment.status === 'generating_video'
  ));
  const hasActiveVideoGeneration = (
    step === 'generating_segment_videos' ||
    step === 'generating_video' ||
    status === 'generating_video' ||
    status === 'video_generating' ||
    hasSegmentVideoTask
  );
  const isReadyForVideoStart = (
    step === 'ready_for_video' ||
    step === 'reviewing_segment_frames' ||
    status === 'segment_frames_ready' ||
    status === 'ready_for_video'
  );
  const hasStaleVideoStartLock = videoGenerationRequested &&
    !hasActiveVideoGeneration &&
    !mergedVideo &&
    isReadyForVideoStart;
  const awaitingManualVideoStart = !videoGenerationRequested &&
    !hasActiveVideoGeneration &&
    !mergedVideo &&
    isReadyForVideoStart;
  const needsVideoStart = hasStaleVideoStartLock && isReadyForVideoStart;
  const failed = status === 'failed';
  const completed = status === 'completed';
  const executionState = completed ? 'completed' : failed ? 'failed' : awaitingManualVideoStart ? 'ready' : 'running';
  const currentMilestoneKey = getCurrentMilestoneForClone(
    status,
    skipsFrameGeneration && needsVideoStart ? 'generating_video' : step,
    awaitingMerge,
    needsVideoStart,
    hasActiveVideoGeneration || (skipsFrameGeneration && needsVideoStart),
    skipsFrameGeneration,
    isStoryboardCloneMode,
  );
  const error = typeof data.errorMessage === 'string' ? data.errorMessage : null;
  const { retryable, userFacingError } = getProjectAgentCanvasErrorInfo(error);
  const milestones = buildMilestones('video_clone', currentMilestoneKey, executionState, {
    skipCloneFrames: skipsFrameGeneration,
    skipCloneMerge: skipsMerge,
    storyboardClone: isStoryboardCloneMode,
  }).map((milestone) => (
    awaitingManualVideoStart && milestone.state === 'active'
      ? { ...milestone, state: 'pending' as const }
      : milestone
  ));

  return {
    executionState,
    phase: step || status,
    progress,
    outputUrl: mergedVideo,
    previewUrl: coverImage,
    error,
    userFacingError,
    retryable,
    statusLabel: completed
      ? 'Completed'
      : failed
        ? 'Failed'
        : awaitingMerge
          ? 'Auto merging segments'
          : isStoryboardCloneMode && currentMilestoneKey === 'generating_storyboard'
            ? 'Generating storyboard'
          : hasActiveVideoGeneration
            ? 'Running clone workflow'
            : needsVideoStart
              ? 'Auto starting video generation'
              : awaitingManualVideoStart
                ? 'Ready for video'
                : 'Running clone workflow',
    projectId,
    table: 'video_clone_projects',
    nextAction: awaitingMerge
      ? 'merge_clone_video'
      : needsVideoStart
        ? 'start_clone_video'
        : 'none',
    milestones,
    currentMilestoneKey,
    raw: payload,
  };
};

export const normalizeMotionCloneExecutionStatus = (
  payload: Record<string, unknown>
): ProjectAgentCanvasExecutionStatus => {
  const project = (payload.project && typeof payload.project === 'object')
    ? payload.project as Record<string, unknown>
    : {};
  const status = typeof project.status === 'string' ? project.status : 'pending';
  const projectId = typeof project.id === 'string' ? project.id : '';
  const outputUrl = typeof project.output_video_url === 'string'
    ? project.output_video_url
    : null;
  const previewUrl = typeof project.preview_image_url === 'string'
    ? project.preview_image_url
    : null;
  const progress = toProgress(project.progress_percentage, status === 'completed' ? 100 : 20);
  const failed = status === 'failed';
  const completed = status === 'completed';
  const executionState = completed ? 'completed' : failed ? 'failed' : 'running';
  const currentMilestoneKey = getCurrentMilestoneForMotionClone(status);
  const error = typeof project.error_message === 'string' ? project.error_message : null;
  const { retryable, userFacingError } = getProjectAgentCanvasErrorInfo(error);

  return {
    executionState,
    phase: status,
    progress,
    outputUrl,
    previewUrl,
    error,
    userFacingError,
    retryable,
    statusLabel: completed ? 'Completed' : failed ? 'Failed' : 'Running motion clone',
    projectId,
    table: 'motion_clone_projects',
    nextAction: 'none',
    milestones: buildMilestones('motion_clone', currentMilestoneKey, executionState),
    currentMilestoneKey,
    raw: payload,
  };
};

export const normalizeExecutionStatus = (
  nodeType: ProjectAgentFeatureNodeType,
  payload: Record<string, unknown>
) => {
  switch (nodeType) {
    case 'avatar_ads':
      return normalizeAvatarExecutionStatus(payload);
    case 'video_clone':
      return normalizeCloneExecutionStatus(payload);
    case 'motion_clone':
      return normalizeMotionCloneExecutionStatus(payload);
    default:
      return normalizeAvatarExecutionStatus(payload);
  }
};

export const getFeatureInputsFromConnectedAssets = (
  connectedAssets: ProjectAgentConnectedFeatureInputs
) => ({
  avatar: connectedAssets.avatar || null,
  product: connectedAssets.product || null,
  pet: connectedAssets.pet || null,
  video: connectedAssets.video || null,
});
