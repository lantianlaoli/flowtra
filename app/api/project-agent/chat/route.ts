import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseAdmin, normalizeAvatarPhotoSet } from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import {
  getMotionCloneGenerationCost,
  getVideoModelDisplayName,
  normalizeMotionCloneQuality,
  type VideoModel
} from '@/lib/constants';
import {
  getPrimaryCloneSelection,
  hasExplicitCloneAvatarSelectionState,
  hasExplicitCloneProductSelectionState,
  normalizeCloneSelections,
  normalizeSelectedIds,
  resolveCloneSelection
} from '@/lib/project-agent/clone-selection';
import {
  MERGE_CONFIRMATION_TOKEN,
  REPLACEMENT_CONFIRMATION_TOKEN,
  isMergeConfirmationCommand,
  isMergeIntentCommand,
  isReplacementConfirmationCommand,
  isRegenerateVideoCommand,
  isStartVideoGenerationCommand,
  mapClonePhaseFromStatusPayload as mapClonePhaseFromPayload
} from '@/lib/project-agent/clone-workflow-control';
import {
  buildCartesianSceneAssignments,
  hasExplicitAvatarIntent,
  isProductOnlyIntent,
  isSelectionContinueIntent,
  type ClonePlanStatus,
  type CloneSceneAssignment
} from '@/lib/project-agent/clone-replacement-plan';
import {
  getEffectiveProjectAgentVideoModel,
  normalizeProjectAgentVideoModel
} from '@/lib/project-agent/video-model';
import {
  decideNextCloneFollowup,
  getNextCloneCanonicalGuidance,
  getNextCloneClarificationReply,
  isNextCloneIntentMessage
} from '@/lib/project-agent/next-clone-intent';
import {
  cloneDraftSceneToSegmentPrompt,
  getProjectAgentSegmentPromptDurationSeconds,
} from '@/lib/project-agent/clone-segment-prompt';
import type { ProjectAgentCloneShot } from '@/lib/project-agent/clone-prompt-schema';
import { buildProjectAgentCloneDraftSeeds } from '@/lib/project-agent/clone-draft-planning';
import { resolveProjectAgentCloneMergedVideoUrl } from '@/lib/project-agent/clone-execution';
import {
  buildMotionClonePromptDrafts,
  inferMotionCloneStage,
  inferMotionCloneReferenceContext,
  mapMotionClonePhaseFromStatus,
  toMotionCloneExecutionFromProject,
  type ProjectAgentMotionCloneExecution,
  type ProjectAgentMotionCloneStage,
  type ProjectAgentMotionCloneReferenceVideo,
  type ProjectAgentMotionCloneSelection
} from '@/lib/project-agent/motion-clone-execution';
import {
  buildProjectAgentAvatarDraft,
  buildProjectAgentAvatarExecution,
  inferProjectAgentAvatarStage,
  type ProjectAgentAvatarDraft,
  type ProjectAgentAvatarExecution,
  type ProjectAgentAvatarStage
} from '@/lib/project-agent/avatar-agent';
import { draftProjectAgentAvatarPrompts } from '@/lib/project-agent/avatar-draft';
import {
  buildAvatarGeneratedPrompts,
  ensureAvatarImagePromptMentions
} from '@/lib/project-agent/avatar-script-planning';
import { signInternalUserRequest } from '@/lib/security/internal-request';
import { buildTypedMentionToken } from '@/lib/prompt-mention-tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const model = openrouter.chat(process.env.OPENROUTER_MODEL || 'bytedance-seed/seed-1.6-flash');

const emptySchema = jsonSchema({ type: 'object', properties: {}, required: [] });
const CHINESE_SCENE_NUMERALS: Record<string, number> = {
  '一': 1,
  '二': 2,
  '两': 2,
  '三': 3,
  '四': 4,
  '五': 5,
  '六': 6,
  '七': 7,
  '八': 8,
  '九': 9,
  '十': 10
};

type SessionState = {
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_clone';
  step?: 'collecting' | 'creating' | 'awaiting_review' | 'regenerating_image' | 'generating_videos' | 'completed';
  avatarStage?: ProjectAgentAvatarStage;
  avatarSelection?: {
    avatar?: { id: string; name: string; photoUrl: string } | null;
    product?: { id: string; name: string; photoUrl?: string | null } | null;
    durationSeconds?: number;
    aspectRatio?: '16:9' | '9:16';
    language?: string;
  } | null;
  avatarDraft?: ProjectAgentAvatarDraft | null;
  avatarExecution?: ProjectAgentAvatarExecution | null;
  cloneReferenceVideo?: {
    id: string;
    name?: string | null;
    sourceType?: 'creator' | 'competitor_ad';
    sourceId?: string | null;
    videoUrl?: string | null;
    cdnUrl?: string | null;
    language?: string | null;
    analysisSummary?: string | null;
    keyShots?: string[] | null;
    detectedCharacter?: string | null;
    detectedProduct?: string | null;
  };
  cloneReplacementDraft?: {
    status: 'idle' | 'generating' | 'ready' | 'awaiting_confirmation' | 'failed';
    planStatus?: ClonePlanStatus;
    confirmation?: {
      requiredToken: string;
      confirmedAt?: string | null;
      confirmedByMessageId?: string | null;
    } | null;
    sceneAssignments?: CloneSceneAssignment[];
    error?: string | null;
    selectedAvatars?: Array<{ id: string; name: string; photoUrl?: string | null }>;
    selectedAvatar?: { id: string; name: string; photoUrl?: string | null };
    selectedProducts?: Array<{ id: string; name: string; photoUrl?: string | null }>;
    selectedProduct?: { id: string; name: string; photoUrl?: string | null };
    scenes: Array<{
      sceneIndex: number;
      imagePrompt: string;
      isContinuation?: boolean;
      videoPrompt: {
        shots: ProjectAgentCloneShot[];
      };
      sourceSummary?: string | null;
      sourceShotIds?: number[];
    }>;
  };
  cloneExecution?: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    model?: VideoModel;
    duration?: string;
    creditsCost?: number;
    error?: string | null;
    mergedVideoUrl?: string | null;
    segments?: Array<{
      segmentIndex: number;
      status: string;
      firstFrameUrl?: string | null;
      videoUrl?: string | null;
      errorMessage?: string | null;
      prompt?: Record<string, unknown>;
    }>;
  } | null;
  motionClone?: ProjectAgentMotionCloneExecution | null;
  avatar?: { id: string; name: string; photoUrl: string } | null;
  product?: { id: string; name: string } | null;
  customDialogue?: string;
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  videoModel?: VideoModel;
  projectId?: string;
  generatedPrompts?: Record<string, unknown> | null;
  imagePrompt?: string | null;
  generatedImageUrl?: string | null;
  pendingUpdatedPrompts?: Record<string, unknown> | null;
  pendingMergeConfirmation?: {
    projectId: string;
    requestedAt: string;
    token: string;
  } | null;
};

const DEFAULT_STATE: SessionState = {
  intent: 'avatar_ads',
  step: 'collecting',
  avatarStage: 'avatar_asset_selection',
  avatarSelection: {
    avatar: null,
    product: null,
    durationSeconds: 16,
    aspectRatio: '9:16',
    language: 'en'
  },
  language: 'en',
  videoDurationSeconds: 16,
  videoAspectRatio: '9:16',
  videoModel: 'kling_3'
};

type CloneDraftScene = NonNullable<SessionState['cloneReplacementDraft']>['scenes'][number];

type ProductRow = {
  id: string;
  product_name: string;
};

type AvatarOption = {
  id: string;
  avatar_name: string;
  photo_url: string | null;
};

type AvatarRow = {
  id: string;
  avatar_name: string | null;
  photo_url: string | null;
  file_name?: string | null;
  photo_set_json?: unknown;
};

const parseSceneIndexFromUserTurn = (text: string): number | undefined => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return undefined;

  const explicitDigitMatch = normalized.match(
    /(?:scene|shot|segment)\s*#?\s*(\d{1,2})|(?:第\s*(\d{1,2})\s*(?:个|场|段|张|幕)?)/i
  );
  if (explicitDigitMatch) {
    const value = Number(explicitDigitMatch[1] || explicitDigitMatch[2]);
    if (Number.isFinite(value) && value >= 1) return value;
  }

  const ordinalMatch = normalized.match(/(\d{1,2})(?:st|nd|rd|th)/i);
  if (ordinalMatch) {
    const value = Number(ordinalMatch[1]);
    if (Number.isFinite(value) && value >= 1) return value;
  }

  const chineseMatch = normalized.match(/第\s*([一二两三四五六七八九十])\s*(?:个|场|段|张|幕)?/);
  if (chineseMatch) {
    const mapped = CHINESE_SCENE_NUMERALS[chineseMatch[1]];
    if (mapped) return mapped;
  }

  return undefined;
};

const isSceneScopedVideoStartCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return /\b(start|begin|run|generate|render)\b[\s\w-]{0,18}\b(scene|shot|segment)\s*#?\s*\d+[\s\w-]{0,12}\bvideo\b/.test(normalized);
};

const isStartFrameGenerationCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === 'generate this clone now.' ||
    /^start\s+generation/.test(normalized) ||
    /^start\s+generate/.test(normalized) ||
    /^start\s+frame/.test(normalized)
  );
};

const isRegenerateFrameCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return /regenerate\s+(scene|shot|frame)\s*#?\s*\d+|regenerate\s*#?\s*\d+\s*(scene|shot|frame)/i.test(normalized);
};

const CLONE_WORKSPACE_STATUS_KEYWORD_REGEX = /\b(frame|frames|image|images|photo|photos|video|videos|scene|scenes|shot|shots|prompt|prompts|timing|preview|regenerate|retry|render|ready|start)\b/i;

const shouldSyncCloneWorkspaceStatus = (state: SessionState, text: string) => {
  if (state.intent !== 'competitor_ugc_replication') {
    return false;
  }

  const hasWorkspaceContext = Boolean(
    state.cloneExecution?.projectId ||
    (state.cloneReplacementDraft?.status === 'ready' &&
      Array.isArray(state.cloneReplacementDraft?.scenes) &&
      state.cloneReplacementDraft.scenes.length > 0)
  );
  if (!hasWorkspaceContext) {
    return false;
  }

  return (
    CLONE_WORKSPACE_STATUS_KEYWORD_REGEX.test(text) ||
    isStartFrameGenerationCommand(text) ||
    isStartVideoGenerationCommand(text) ||
    isRegenerateFrameCommand(text) ||
    isRegenerateVideoCommand(text) ||
    isMergeIntentCommand(text)
  );
};

const summarizeCloneExecutionSegments = (state: SessionState) => {
  const segments = Array.isArray(state.cloneExecution?.segments) ? state.cloneExecution.segments : [];
  if (segments.length === 0) {
    return 'none';
  }

  return segments.map((segment) => {
    const frameState = segment.firstFrameUrl ? 'ready' : 'missing';
    const videoState = segment.videoUrl ? 'ready' : 'missing';
    const errorState = segment.errorMessage ? `, error=${segment.errorMessage}` : '';
    return `scene ${segment.segmentIndex + 1}: status=${segment.status}, frame=${frameState}, video=${videoState}${errorState}`;
  }).join(' | ');
};

const isReferenceSelectionMessage = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return /^i selected ".*" as the reference video for clone\.$/i.test(normalized);
};

const hasVideoGenerationSignal = (state: SessionState) => {
  const execution = state.cloneExecution;
  if (!execution) return false;
  if (execution.phase === 'generating_videos' || execution.phase === 'awaiting_merge' || execution.phase === 'merging' || execution.phase === 'completed') {
    return true;
  }
  return Boolean(
    execution.segments?.some((segment) => (
      segment.status === 'generating_video' ||
      segment.status === 'video_ready' ||
      Boolean(segment.videoUrl)
    ))
  );
};

const shouldGenerateWorkflowFallback = (latestUserTurnText: string, state: SessionState) => {
  const raw = latestUserTurnText.trim();
  if (!raw) return false;

  if (isSceneScopedVideoStartCommand(raw)) {
    return true;
  }

  if (isStartVideoGenerationCommand(raw)) {
    return true;
  }

  if (isStartFrameGenerationCommand(raw)) {
    return true;
  }

  if (isRegenerateFrameCommand(raw)) {
    return true;
  }

  if (isRegenerateVideoCommand(raw)) {
    return true;
  }

  if (isReplacementConfirmationCommand(raw)) {
    return true;
  }

  return state.intent === 'competitor_ugc_replication';
};

const isCloneDraftPreviewIntent = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return /\b(scene\s+)?assignment(s)?\b/i.test(normalized) || /\b(prompt\s+)?draft(s)?\b/i.test(normalized);
};

const isCloneDraftProgressIntent = (text: string) => {
  return (
    isReferenceSelectionMessage(text) ||
    isSelectionContinueIntent(text) ||
    isCloneDraftPreviewIntent(text) ||
    isReplacementConfirmationCommand(text) ||
    isStartFrameGenerationCommand(text) ||
    isStartVideoGenerationCommand(text)
  );
};

const hasAnyCloneReplacementSelection = (state: SessionState) => {
  const selectedAvatars = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedAvatars,
    state.cloneReplacementDraft?.selectedAvatar
  );
  const selectedProducts = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedProducts,
    state.cloneReplacementDraft?.selectedProduct
  );

  return (
    selectedAvatars.length > 0 ||
    selectedProducts.length > 0 ||
    Boolean(state.avatar?.id) ||
    Boolean(state.product?.id)
  );
};

const hasAvatarOnlyCloneSelection = (state: SessionState) => {
  const selectedAvatars = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedAvatars,
    state.cloneReplacementDraft?.selectedAvatar
  );
  const selectedProducts = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedProducts,
    state.cloneReplacementDraft?.selectedProduct
  );

  const hasAvatarSelection = selectedAvatars.length > 0 || Boolean(state.avatar?.id);
  const hasProductSelection = selectedProducts.length > 0 || Boolean(state.product?.id);

  return hasAvatarSelection && !hasProductSelection;
};

const buildWorkflowFallbackReply = async (input: {
  latestUserTurnText: string;
  state: SessionState;
  model: ReturnType<typeof openrouter.chat>;
}) => {
  if (!shouldGenerateWorkflowFallback(input.latestUserTurnText, input.state)) {
    return null;
  }

  if (input.state.intent === 'avatar_ads') {
    const hasCover = Boolean(
      input.state.avatarDraft?.coverImageUrl ||
      input.state.generatedImageUrl ||
      input.state.avatarExecution?.coverImageUrl
    );
    const hasFinalVideo = Boolean(input.state.avatarExecution?.finalVideoUrl);
    const isGeneratingCover = Boolean(
      input.state.avatarExecution?.phase === 'generating_cover' ||
      input.state.avatarStage === 'avatar_generating_cover' ||
      input.state.step === 'creating' ||
      input.state.step === 'regenerating_image'
    );
    const isGeneratingVideo = Boolean(
      input.state.avatarExecution?.phase === 'generating_videos' ||
      input.state.avatarStage === 'avatar_generating_video' ||
      input.state.step === 'generating_videos'
    );
    const isReviewingCover = Boolean(
      input.state.avatarStage === 'avatar_reviewing_cover' ||
      input.state.step === 'awaiting_review'
    );

    if (hasFinalVideo) {
      return 'Your avatar video is ready on the left. Review it in the Final Video panel whenever you want.';
    }

    if (isGeneratingVideo || (isStartVideoGenerationCommand(input.latestUserTurnText) && hasCover)) {
      return 'Avatar video generation is already running. I will keep the Final Video panel on the left updated as soon as the render finishes.';
    }

    if (isStartVideoGenerationCommand(input.latestUserTurnText) && !hasCover) {
      return 'Generate the cover first, then I can start the avatar video.';
    }

    if (isGeneratingCover) {
      return 'Cover generation is in progress. I will update the Generated Cover panel on the left as soon as it is ready.';
    }

    if (isReviewingCover || hasCover) {
      return 'The cover is ready for review. If it looks good, say "Generate the video" and I will start rendering the avatar video.';
    }

    return 'Select the avatar and finish the draft first, then I can generate the cover and video from this workspace.';
  }

  if (input.state.intent === 'motion_clone') {
    if (input.state.motionClone?.outputVideoUrl) {
      return 'Your motion clone video is ready on the left. Review the final video when you are ready.';
    }
    if (input.state.motionClone?.phase === 'generating_video') {
      return 'Motion clone video generation is already running. I will update the Final Video panel on the left when it finishes.';
    }
    if (input.state.motionClone?.phase === 'preview_ready') {
      return 'The preview image is ready. Review it on the left, then say "Generate the final video" when you want to continue.';
    }
    if (input.state.motionClone?.phase === 'generating_preview') {
      return 'Preview generation is in progress. I will update the preview panel on the left as soon as it is ready.';
    }
  }

  if (isRegenerateFrameCommand(input.latestUserTurnText)) {
    const sceneIndex = parseSceneIndexFromUserTurn(input.latestUserTurnText);
    const sceneLabel = typeof sceneIndex === 'number' ? `scene ${sceneIndex}` : 'that scene';
    if (hasVideoGenerationSignal(input.state)) {
      return `I started regenerating the frame for ${sceneLabel} only. This does not start a new video generation run. Some scene videos were already in progress from your earlier run, so those may keep processing in parallel. Once the new frame is ready, regenerate ${sceneLabel} video if you want that scene's clip to use the updated frame.`;
    }

    return `I started regenerating the frame for ${sceneLabel} only. This does not start video generation. No need to run "start frame generation" again for this refresh. Once the new frame is ready, review it first, then start video generation when you are ready to continue.`;
  }

  const selectedAvatars = normalizeCloneSelections(
    input.state.cloneReplacementDraft?.selectedAvatars,
    input.state.cloneReplacementDraft?.selectedAvatar
  );
  const selectedProducts = normalizeCloneSelections(
    input.state.cloneReplacementDraft?.selectedProducts,
    input.state.cloneReplacementDraft?.selectedProduct
  );
  const clonePhase = input.state.cloneExecution?.phase || 'idle';
  const draftStatus = input.state.cloneReplacementDraft?.status || 'idle';
  const planStatus = input.state.cloneReplacementDraft?.planStatus || 'collecting';
  const segments = Array.isArray(input.state.cloneExecution?.segments) ? input.state.cloneExecution?.segments : [];
  const framesReady = segments.filter((segment) => Boolean(segment.firstFrameUrl)).length;
  const videosReady = segments.filter((segment) => Boolean(segment.videoUrl)).length;

  if (
    input.state.intent === 'competitor_ugc_replication' &&
    input.state.cloneReferenceVideo?.id &&
    draftStatus !== 'generating' &&
    draftStatus !== 'ready' &&
    !hasAnyCloneReplacementSelection(input.state)
  ) {
    return `${formatCloneReferenceGrounding(input.state)} Draft generation has not started yet because no replacement is selected. Choose an avatar, a product, or both in Step 2 first.`;
  }

  const { text } = await generateText({
    model: input.model,
    system: [
      'You are Flowgen writing one contextual assistant reply.',
      'Do not use canned or template wording.',
      'Always provide clear next actions.',
      'Reply in English only.',
      'Never mention Export buttons, Rerun buttons, or any removed controls.',
      'If no replacement avatar or product is selected yet, explicitly say draft generation has not started and ask for at least one replacement next.',
      'If only avatars are selected, make it clear avatar-only replacement can continue and product replacement is optional.',
      'If no products are available in Assets, do not treat that as a blocker; tell the user they can continue with avatar-only replacement or import a product if they also want product replacement.',
      'Never say you are building scene assignments or preparing drafts unless draftStatus is "generating" or "ready".',
      'If only avatars are selected and the user asks to continue, keep going, go ahead, or show the draft, do not ask for a product. Avatar-only replacement can continue as-is.',
      'When replacements are confirmed and draft/scene workspace is available, tell the user exactly what to do next:',
      'review/edit scene prompts on the left, then say "start frame generation", then after frame review say "start video generation".',
      'If generation is already running, summarize progress and the next valid command.',
      `If scene videos are generating or partially ready, explicitly tell the user that once all scene videos are ready, the next chat command is "${MERGE_CONFIRMATION_TOKEN}" to create the final video.`,
      `If all scene videos are ready, explicitly tell the user to reply "${MERGE_CONFIRMATION_TOKEN}" so you can create the final video.`,
      `If the final video is already created or being created, always add this guidance: ${getNextCloneCanonicalGuidance()}`
    ].join(' '),
    prompt: JSON.stringify({
      latestUserTurn: input.latestUserTurnText,
      state: {
        intent: input.state.intent || 'unknown',
        referenceSelected: Boolean(input.state.cloneReferenceVideo?.id),
        selectedAvatars: selectedAvatars.map((item) => item.name),
        selectedProducts: selectedProducts.map((item) => item.name),
        draftStatus,
        planStatus,
        clonePhase,
        totalSegments: segments.length,
        framesReady,
        videosReady,
        hasVideoSignal: hasVideoGenerationSignal(input.state)
      }
    })
  });

  const reply = text.trim();
  return reply.length > 0 ? reply : null;
};

const getClonePlanStatus = (state: SessionState): ClonePlanStatus => {
  return state.cloneReplacementDraft?.planStatus || 'collecting';
};

const formatCloneReferenceGrounding = (state: SessionState) => {
  const summary = state.cloneReferenceVideo?.analysisSummary?.trim();
  const keyShots = Array.isArray(state.cloneReferenceVideo?.keyShots)
    ? state.cloneReferenceVideo.keyShots
        .filter((shot): shot is string => typeof shot === 'string' && shot.trim().length > 0)
        .slice(0, 2)
    : [];

  if (summary && keyShots.length >= 2) {
    return `I understand the reference structure: ${summary} Key shots include ${keyShots[0]} and ${keyShots[1]}.`;
  }
  if (summary && keyShots.length === 1) {
    return `I understand the reference structure: ${summary} One key shot is ${keyShots[0]}.`;
  }
  if (summary) {
    return `I understand the reference structure: ${summary}.`;
  }
  if (keyShots.length >= 2) {
    return `I understand the reference structure. Key shots include ${keyShots[0]} and ${keyShots[1]}.`;
  }
  if (keyShots.length === 1) {
    return `I understand the reference structure. One key shot is ${keyShots[0]}.`;
  }

  return 'I understand the reference structure, but the saved summary details are limited right now.';
};

const resolveCloneDraftSelections = (state: SessionState) => {
  const draft = state.cloneReplacementDraft;
  const fallbackAvatar = state.avatar
    ? {
        id: state.avatar.id,
        name: state.avatar.name,
        photoUrl: state.avatar.photoUrl
      }
    : null;
  const fallbackProduct = state.product
    ? {
        id: state.product.id,
        name: state.product.name,
        photoUrl: null
      }
    : null;

  const avatarSelection = resolveCloneSelection({
    selectedItems: draft?.selectedAvatars,
    selectedItem: draft?.selectedAvatar,
    fallbackSelection: fallbackAvatar,
    allowFallback: !hasExplicitCloneAvatarSelectionState(draft),
    limit: 8
  });
  const productSelection = resolveCloneSelection({
    selectedItems: draft?.selectedProducts,
    selectedItem: draft?.selectedProduct,
    fallbackSelection: fallbackProduct,
    allowFallback: !hasExplicitCloneProductSelectionState(draft),
    limit: 8
  });

  return {
    selectedAvatars: avatarSelection.selections,
    selectedAvatarIds: avatarSelection.selectedIds,
    primaryAvatar: avatarSelection.primarySelection,
    selectedProducts: productSelection.selections,
    selectedProductIds: productSelection.selectedIds,
    primaryProduct: productSelection.primarySelection
  };
};

const isCloneSelectionConfirmed = (state: SessionState, latestUserText: string) => {
  const draft = state.cloneReplacementDraft;
  if (!draft) return false;
  if (isReplacementConfirmationCommand(latestUserText)) return true;
  return Boolean(
    draft.planStatus === 'confirmed' &&
    draft.confirmation?.confirmedAt &&
    draft.confirmation?.requiredToken === REPLACEMENT_CONFIRMATION_TOKEN
  );
};

type ForcedToolChoice = {
  type: 'tool';
  toolName:
    | 'startAvatarCoverGeneration'
    | 'regenerateAvatarCover'
    | 'startAvatarVideoGeneration'
    | 'regenerateAvatarVideo'
    | 'syncAvatarProjectStatus'
    | 'startCloneVideoGeneration'
    | 'mergeCloneVideos'
    | 'regenerateCloneVideos'
    | 'confirmCloneSelections'
    | 'generateCloneReplacementDraft'
    | 'startMotionClonePreviewGeneration'
    | 'startMotionCloneVideoGeneration'
    | 'syncMotionCloneStatus';
} | undefined;

const isMotionClonePreviewGenerationCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /\b(generate|start|create|make|regenerate|retry)\b[\s\w-]{0,24}\b(preview|image|first frame)\b/.test(normalized) ||
    /\b(preview image|generate image|regenerate image|generate the preview image|regenerate the preview image)\b/.test(normalized)
  );
};

const isMotionCloneStatusCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /\b(show|check|get|ping|refresh|sync)\b[\s\w-]{0,24}\b(progress|status)\b/.test(normalized) ||
    /\b(latest progress|latest status|show me the latest progress|show me the status|what'?s the status|how'?s it going)\b/.test(normalized)
  );
};

const isAvatarCoverGenerationCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /\b(generate|start|create|make|regenerate|retry)\b[\s\w-]{0,24}\b(cover|image)\b/.test(normalized) ||
    /\b(generate the cover|regenerate the cover|generate cover|regenerate cover)\b/.test(normalized)
  );
};

const isAvatarStatusCommand = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /\b(show|check|get|ping|refresh|sync)\b[\s\w-]{0,24}\b(progress|status|cover|video)\b/.test(normalized) ||
    /\b(show me the cover|is the cover ready|is the video ready|show me the latest progress|show me the status|what'?s the status|how'?s it going)\b/.test(normalized)
  );
};

const tryParseJsonObject = (raw: string): Record<string, unknown> | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] || trimmed;

  const objectStart = candidate.indexOf('{');
  const objectEnd = candidate.lastIndexOf('}');
  if (objectStart < 0 || objectEnd <= objectStart) return null;

  const jsonSlice = candidate.slice(objectStart, objectEnd + 1);
  try {
    const parsed = JSON.parse(jsonSlice);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const classifyToolIntent = async (input: {
  model: ReturnType<typeof openrouter.chat>;
  latestUserTurnText: string;
  currentIntent?: SessionState['intent'];
  avatarHasCover: boolean;
  clonePhase?: SessionState['cloneExecution'] extends { phase: infer P } ? P : string;
  hasCloneProject: boolean;
  hasSelectedReplacements: boolean;
  cloneDraftStatus?: SessionState['cloneReplacementDraft'] extends { status: infer S } ? S : string;
  pendingMergeConfirmation?: SessionState['pendingMergeConfirmation'] | null;
}): Promise<ForcedToolChoice> => {
  const userText = input.latestUserTurnText.trim();
  if (!userText) return undefined;

  if (input.currentIntent === 'motion_clone') {
    if (isMotionCloneStatusCommand(userText)) {
      return { type: 'tool', toolName: 'syncMotionCloneStatus' };
    }
    if (isMotionClonePreviewGenerationCommand(userText)) {
      return { type: 'tool', toolName: 'startMotionClonePreviewGeneration' };
    }
    if (isStartVideoGenerationCommand(userText)) {
      return { type: 'tool', toolName: 'startMotionCloneVideoGeneration' };
    }
  }

  if (input.currentIntent === 'avatar_ads') {
    if (isAvatarStatusCommand(userText)) {
      return { type: 'tool', toolName: 'syncAvatarProjectStatus' };
    }
    if (isAvatarCoverGenerationCommand(userText)) {
      return {
        type: 'tool',
        toolName: input.avatarHasCover ? 'regenerateAvatarCover' : 'startAvatarCoverGeneration'
      };
    }
    if (isStartVideoGenerationCommand(userText)) {
      return { type: 'tool', toolName: 'startAvatarVideoGeneration' };
    }
    if (isRegenerateVideoCommand(userText)) {
      return { type: 'tool', toolName: 'regenerateAvatarVideo' };
    }
  }

  if (
    (isSelectionContinueIntent(userText) || isCloneDraftPreviewIntent(userText)) &&
    input.hasSelectedReplacements &&
    input.cloneDraftStatus !== 'generating' &&
    input.cloneDraftStatus !== 'ready'
  ) {
    return { type: 'tool', toolName: 'generateCloneReplacementDraft' };
  }

  if (isReplacementConfirmationCommand(userText)) {
    return { type: 'tool', toolName: 'confirmCloneSelections' };
  }
  if (!input.hasCloneProject) return undefined;

  const hasPendingMerge = Boolean(input.pendingMergeConfirmation?.projectId);
  if (hasPendingMerge && isMergeConfirmationCommand(userText)) {
    return { type: 'tool', toolName: 'mergeCloneVideos' };
  }

  if (isMergeIntentCommand(userText)) {
    return { type: 'tool', toolName: 'mergeCloneVideos' };
  }

  const normalized = userText.toLowerCase();
  // Deterministic routing for explicit workflow commands to avoid LLM-confidence misses.
  if (isStartVideoGenerationCommand(userText)) {
    return { type: 'tool', toolName: 'startCloneVideoGeneration' };
  }
  if (isRegenerateVideoCommand(userText)) {
    return { type: 'tool', toolName: 'regenerateCloneVideos' };
  }

  const { text } = await generateText({
    model: input.model,
    system: [
      'You are an intent router for clone video workflow.',
      'Detect whether the user is explicitly asking to start video generation or merge/finalize videos.',
      'Do NOT route frame/image/photo regeneration requests.',
      'Support any language.',
      'Return JSON only: {"tool":"startCloneVideoGeneration"|"mergeCloneVideos"|"regenerateCloneVideos"|"none","confidence":0..1}'
    ].join(' '),
    prompt: [
      `User message: ${userText}`,
      `Clone phase: ${input.clonePhase || 'unknown'}`,
      'Choose "startCloneVideoGeneration" only when user asks to begin/render/generate videos.',
      'Choose "mergeCloneVideos" only when user asks to merge/stitch/finalize completed segment videos.',
      'Choose "regenerateCloneVideos" only when user asks to regenerate one specific scene video.',
      'Otherwise choose "none".'
    ].join('\n')
  });

  const parsed = tryParseJsonObject(text);
  if (!parsed) return undefined;

  const tool = typeof parsed.tool === 'string' ? parsed.tool : 'none';
  const confidenceRaw = parsed.confidence;
  const confidence = typeof confidenceRaw === 'number' ? confidenceRaw : Number(confidenceRaw);

  if (!Number.isFinite(confidence) || confidence < 0.7) {
    return undefined;
  }

  if (tool === 'startCloneVideoGeneration' || tool === 'mergeCloneVideos' || tool === 'regenerateCloneVideos') {
    return { type: 'tool', toolName: tool };
  }
  return undefined;
};

const buildSystemPrompt = (state: SessionState) => {
  const selectedAvatars = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedAvatars,
    state.cloneReplacementDraft?.selectedAvatar
  );
  const selectedProducts = normalizeCloneSelections(
    state.cloneReplacementDraft?.selectedProducts,
    state.cloneReplacementDraft?.selectedProduct
  );
  const avatarLabel = selectedAvatars.length > 0
    ? selectedAvatars.map((avatar) => avatar.name).join(', ')
    : (state.avatar?.name || 'not selected');
  const productLabel = selectedProducts.length > 0
    ? selectedProducts.map((product) => product.name).join(', ')
    : (state.product?.name || 'not selected');
  const dialogueLabel = state.customDialogue?.trim() ? 'provided' : 'not provided';
  const referenceVideoLabel = state.cloneReferenceVideo
    ? (state.cloneReferenceVideo.name || 'selected video')
    : 'not selected';
  const referenceVideoSummary = state.cloneReferenceVideo?.analysisSummary || 'not available';
  const referenceVideoShots = Array.isArray(state.cloneReferenceVideo?.keyShots) && state.cloneReferenceVideo?.keyShots.length > 0
    ? state.cloneReferenceVideo?.keyShots.join(' | ')
    : 'not available';
  const referenceDetectedCharacter = state.cloneReferenceVideo?.detectedCharacter || 'not available';
  const referenceDetectedProduct = state.cloneReferenceVideo?.detectedProduct || 'not available';
  const cloneDraftStatus = state.cloneReplacementDraft?.status || 'idle';
  const clonePlanStatus = getClonePlanStatus(state);
  const cloneDraftSceneCount = Array.isArray(state.cloneReplacementDraft?.scenes) ? state.cloneReplacementDraft.scenes.length : 0;
  const cloneAssignmentCount = Array.isArray(state.cloneReplacementDraft?.sceneAssignments) ? state.cloneReplacementDraft.sceneAssignments.length : 0;
  const cloneDraftSelection = [
    selectedAvatars.length > 0 ? `avatars=${selectedAvatars.map((avatar) => avatar.name).join(', ')}` : null,
    selectedProducts.length > 0 ? `products=${selectedProducts.map((product) => product.name).join(', ')}` : null
  ].filter(Boolean).join(', ') || 'none';
  const replacementConfirmation = state.cloneReplacementDraft?.confirmation?.confirmedAt
    ? `confirmed at ${state.cloneReplacementDraft.confirmation.confirmedAt}`
    : 'not confirmed';
  const cloneExecutionPhase = state.cloneExecution?.phase || 'idle';
  const cloneExecutionSegments = Array.isArray(state.cloneExecution?.segments) ? state.cloneExecution?.segments.length : 0;
  const cloneExecutionMergedVideo = state.cloneExecution?.mergedVideoUrl || 'not ready';
  const cloneExecutionSegmentSummary = summarizeCloneExecutionSegments(state);
  const pendingMergeConfirmation = state.pendingMergeConfirmation?.projectId
    ? `${state.pendingMergeConfirmation.token} (${state.pendingMergeConfirmation.projectId})`
    : 'none';
  const motionReferenceLabel = state.motionClone?.referenceVideo?.description || 'not selected';
  const motionCloneStage = state.motionClone?.stage || 'reference_selection';
  const motionClonePhase = state.motionClone?.phase || 'idle';
  const motionClonePreview = state.motionClone?.previewImageUrl || 'not ready';
  const motionCloneOutput = state.motionClone?.outputVideoUrl || 'not ready';
  const motionCloneQuality = state.motionClone?.videoQuality || '720p';
  const motionCloneCredits = typeof state.motionClone?.creditsCost === 'number' ? state.motionClone.creditsCost : 'unset';
  const motionCloneError = state.motionClone?.error || 'none';
  const selectedVideoModel = normalizeProjectAgentVideoModel(state.videoModel, 'kling_3', state.intent);
  const effectiveVideoModel = getEffectiveProjectAgentVideoModel(state.intent, state.videoModel);

  return `You are Flowgen, the Flowtra growth agent. Core mission: "Make virality accessible."

Identity and brand voice (strict):
- You are named Flowgen.
- When asked your name, always answer directly: "I am Flowgen."
- Never say you do not have a name.
- Mission: give everyday sellers the power to create viral content.
- Audience: dropshippers, affiliates, small sellers, and TikTok ad operators.
- Emotional core: not "AI technology", but "practical viral execution power for normal people."
- One-line value proposition: "Flowgen gives everyone the power to create viral content."
- Personality: TikTok Growth Hacker + AI Creator.
- Personality keywords: Bold, Fast, Creator-first, Growth-driven.
- Tone: direct, practical, action-oriented, and concise.

Supported workflows:
- avatar_ads (create spokesperson-style avatar videos)
- competitor_ugc_replication (primary use case: clone viral videos with your product)
- motion_clone (replace avatar and/or product inside an existing creator video and run the workflow end-to-end in chat)

Domain model (strict):
- First-class user objects are ONLY: avatar and product.
- Brand is deprecated/removed in this project and must not be treated as an object.

Current configured required inputs for avatar_ads:
- Character (avatar)
- Optional product
- A spoken script or enough guidance for Flowgen to author one
- Aspect ratio (16:9 or 9:16)
- Language (default en)

Workflow rules:
- Always identify/confirm the target workflow intent first.
- If the user is just chatting (greeting, Q&A, small talk), answer naturally and do not force workflow steps.
- In small-talk turns, do NOT append workflow menus or call-to-action lists unless the user explicitly asks about capabilities or creating videos.
- Every turn must end with a natural-language assistant reply to the user (never stay silent).
- Never expose technical identifiers or internal fields in user-facing text (e.g. UUIDs, database ids, session ids, project ids, tool payload keys).
- Style rule: avoid fixed/canned templates. Each reply must be generated from the current conversation context and latest state, with wording adapted to the specific user turn.
- Language rule (strict): all user-facing replies and guidance must be in English only.
- Terminology rule (strict): never use "brand", "your brand", "branding", or "brand identity" in user-facing copy for this flow.
- Terminology rule (strict): frame replacements as avatar/person and/or product based on user intent.
- Terminology rule (strict): avoid technical words like "merge" in user-facing replies; use "create final video" or "finish video" instead.
- UI guidance rule (strict): never tell the user to click "Export", "Rerun", or any removed clone controls. Clone execution commands must be chat-based.
- Billing rule (strict): in project-agent clone flow, frame generation is free and must never be blocked for insufficient user credits. Video generation is the paid step; when video generation or scene-video regeneration starts, clearly state the exact credits required if the tool result includes that amount.
- Tool result rule (strict): never claim an action has started, completed, or succeeded when the tool result says success=false.
- Tool result rule (strict): if a clone video tool fails because credits are insufficient, explicitly say video generation did not start, then state the exact required credits and current credits from the tool result.
- Tool result rule (strict): if startCloneVideoGeneration returns success=false, your first sentence must restate that failure plainly and must not contain phrases like "started", "is generating", or "now running".
- Next-clone rule (strict): after a clone is finished, only start a new clone when the user clearly asks for a new one, such as "clone another video" or "show more reference videos".
- Next-clone rule (strict): vague follow-ups like "again", "another one", or "next" must not reset the current case automatically. Ask a short clarification instead.
- Positioning rule: speak like a growth operator who helps users ship viral ads quickly, not like a generic tech support bot.
- If the user uses "brand" in their input, reinterpret it to product/avatar intent and confirm that selection using product/avatar wording.
- Collect missing required inputs before execution.
- For avatar_ads, the sequence is:
  - Step 1: select avatar first, optionally select product.
  - Step 2: ask what the avatar should say.
  - Step 3: if user says "you decide" or only gives product selling points, use draftAvatarAdsPrompts.
  - Step 4: if there is no product and no explicit script, ask one short follow-up about the topic or angle before drafting.
  - Step 5: once the draft workspace is ready, the right side only edits image prompt and script; Flowgen auto-splits the script into Kling 3.0 clips between 3 and 15 seconds each.
  - Step 6: use chat commands only for start/restart actions.
- For avatar_ads, do not start cover generation until avatar is selected and a draft exists.
- For avatar_ads, prefer these tools:
  - setCustomDialogue
  - draftAvatarAdsPrompts
  - startAvatarCoverGeneration
  - regenerateAvatarCover
  - updatePromptEdits
  - startAvatarVideoGeneration
  - regenerateAvatarVideo
  - syncAvatarProjectStatus
- For avatar_ads, never instruct the user to open the old inspector modal or leave the agent to continue.
- For motion_clone, execute in chat with the existing motion clone APIs:
  - Step 1: choose one eligible reference video.
  - Step 2: choose the replacement avatar first, then optionally choose a product.
  - Step 3: once the current reference and replacement selections are confirmed in chat, create the project and move into the workspace using those existing selections.
  - Step 4: start preview generation first when needed, or start video generation directly if a preview is already ready.
  - Step 5: use syncMotionCloneStatus whenever you need the latest state.
- For motion_clone, prefer these tools:
  - listMotionCloneReferenceVideos
  - selectMotionCloneReferenceVideo
  - setMotionCloneSelections
  - setMotionClonePrompts
  - createMotionCloneProject
  - startMotionClonePreviewGeneration
  - startMotionCloneVideoGeneration
  - syncMotionCloneStatus
- For motion_clone, never say the user must leave the agent to continue.
- For motion_clone, image generation is free and video generation is paid. If a video-generation tool returns insufficient credits, state that generation did not start and include required/current credits.
- For motion_clone, selection priority rule (strict): if current state already contains a selected reference video and selected avatar/product from the left panel, treat those selections as authoritative user intent.
- For motion_clone, continue rule (strict): if the current state already has the selected reference video plus a selected avatar, and the user says continue / set it up / create the project / use these selections, do not ask for names again. Create the motion clone project from the existing state and move into the workspace.
- For motion_clone, never invent avatar option names. If you need to mention available avatars, either call listAvatars first or tell the user to choose from the avatars shown on the left.
- For motion_clone, immediately after a reference video is selected, do not enumerate avatar names in prose. Just confirm the selected reference and direct the user to choose the replacement avatar from the left panel; product remains optional.
- If the user picks competitor_ugc_replication, run the executable clone flow end-to-end in chat:
  - Step 1: choose reference video.
  - Step 2: collect replacement selections. Avatar and product are both optional individually, but at least one replacement is required before confirmation or draft generation.
  - Step 3: prepare and review the replacement draft workspace. If product replacement is selected, include deterministic scene assignments preview too.
  - Step 4: wait for explicit replacement confirmation token "${REPLACEMENT_CONFIRMATION_TOKEN}".
  - Step 5: after replacement confirmation, start frame generation and continue execution phases.
  - Step 6: after all scene videos are ready, allow frame/video regeneration before creating the final video; final-video creation requires explicit chat confirmation token.
  - Keep replies progress-aware and concise at each phase.
- For competitor_ugc_replication, the sequence must follow the existing manual flow:
  1) First ask user to select ONE reference video.
  2) Do not ask for product before a reference video is selected.
  3) Ask for product only as a later step.
  4) Before a reference video is selected, do not mention product requirements yet.
  6) If Reference Video is already selected in current state, do not ask for reference video again; continue to the next required step.
  7) After Reference Video is selected, your first sentence must explicitly confirm you understood the video structure using the provided summary and key shots.
  8) In the same reply, naturally recommend replacement directions and ask the user to choose replacement avatars and/or products. Avatar-only or product-only replacement is allowed, but at least one replacement must be selected before draft generation can start.
  9) Keep this as a normal conversational reply; do not rely on UI labels or step headers in the wording.
  10) If cloneReplacementDraft.status is "ready", reply naturally that replacement prompts are prepared from the reference structure, briefly summarize selected replacements, and ask the user to review/edit Scene and shot-level fields (subject, background, action, style, camera, composition, lighting, SFX, ambient noise, dialogue, timing) in Step 3.
  11) If cloneReplacementDraft.status is "generating", tell the user you are preparing prompt drafts now and to wait briefly.
  12) If cloneReplacementDraft.status is "failed", explain the failure briefly and ask whether to retry draft generation.
  13) If user asks to regenerate this step, acknowledge you are re-running the same replacement step with current selections and respond as a normal assistant turn (no technical wording like "draft schema").
  14) Grounding rule (strict): when replying about a selected reference video, you must use ONLY "Reference Summary", "Reference Key Shots", "Reference Detected Character", and "Reference Detected Product" from current state. If details are missing, say they are unavailable; do not invent scene details.
  15) In the first response after reference selection, cite at least two concrete shot cues from "Reference Key Shots" verbatim or near-verbatim when available.
  16) Context rule (strict): for every reply, incorporate the latest user request plus relevant prior chat context; do not answer with generic fallback copy.
  17) Step 2 auto-match rule: when reference video is selected and user describes replacements in natural language (including multiple avatars/products), resolve matches from existing options by calling listAvatars and listProducts, then apply selection tools.
  18) You may only claim something is "preselected" after a successful selectAvatar/selectProduct tool call in this turn (tool result must be success=true). If a tool returns success=false, do not claim any preselection and ask a short clarification instead.
  19) Selection priority rule: if current state already contains selected avatars/products from the left panel, treat those selections as authoritative user intent.
  20) After successful auto-match, only ask the user to review scene assignments when at least one replacement avatar or product is selected. If no replacement is selected yet, ask for a replacement next.
  20.1) Use planCloneAssignments to build deterministic cartesian scene assignments preview.
  20.2) Allow updateSceneAssignment for per-scene manual overrides before confirmation.
  20.3) If user requests to clear or replace current selections, call clearCloneSelections or setCloneSelections instead of silently keeping previous values.
  21) Continue rule: if the user says done/selected/continue/next and state already has selections, do not ask for names again. Read back selected avatars/products + assignment summary, then proceed to draft generation.
  21.1) Only ask for an explicit avatar/product name when the user wants that replacement type and none is selected in current state.
  21.1.1) If only avatars are selected and the user says things like "yes, keep going", "go ahead", "continue", or asks to see the draft, treat that as valid avatar-only continuation and proceed without asking for a product.
  21.2) Do not infer execution confirmation from vague wording like "continue" or "looks good". Execution confirmation is valid only when user sends "${REPLACEMENT_CONFIRMATION_TOKEN}" and confirmCloneSelections succeeds.
  21.3) If there is no selected replacement avatar or product, explicitly say draft generation has not started yet and ask for at least one replacement next.
  22) Until selection confirmation is complete, do not call execution tools. Respond with concise guidance and expected next command.
  22.1) Never say product replacement is mandatory. Avatar-only or product-only replacement is allowed, but at least one replacement selection is required before draft generation can begin.
  22.2) Never say you are building scene assignments, preparing drafts, or moving to Step 3 unless cloneReplacementDraft.status is "generating" or "ready", or a relevant generation tool in this turn returned success=true.
  22.3) If the user has no products in Assets, explicitly tell them product replacement is optional and they can continue with avatar-only replacement or import a product if they want product replacement too.
  22.4) If only avatars are selected, summarize the selected avatars and treat that as a valid replacement set for draft preparation.
  23) In confirmed state, guide the user to review/edit Scene and shot fields (subject, context/background, action, style, camera, composition, lighting, SFX, ambient noise, dialogue, timing), then tell them to send a chat command to start frame generation.
  24) If cloneReplacementDraft.status is ready and cloneExecutionPhase is still idle, never tell the user to start video generation yet. At this stage, always guide them to start frame generation first.
  25) Never instruct clicking any "confirm" control on the left panel. Replacement confirmation is chat-only via token "${REPLACEMENT_CONFIRMATION_TOKEN}". During clone execution phases, never instruct clicking removed buttons. Use command-style guidance.
  26) If cloneReplacementDraft.status is ready and user asks to start generation, call startCloneGenerationFromDraft only after confirmation gate passes. If user asks to regenerate frames, call regenerateCloneFrames. If user asks to regenerate scene videos, call regenerateCloneVideos. If user asks to start video generation after frame review, call startCloneVideoGeneration.
  25.1) For final-video requests in clone flow: first ask for confirmation token "${MERGE_CONFIRMATION_TOKEN}" and do not start final-video creation immediately. Only call mergeCloneVideos after the user sends the confirmation token.
  26.1) If cloneExecutionPhase is "generating_videos", "reviewing_frames", or "awaiting_merge", always make the final step explicit: after all scene videos are ready, the user must send "${MERGE_CONFIRMATION_TOKEN}" in chat so you can create the final video.
  26.2) If a single scene video is regenerated while others are already ready, explain that once the regenerated scene finishes and all scene videos look good, the next chat command is "${MERGE_CONFIRMATION_TOKEN}" to create the final video.
  27) Download guidance rule: after final-video creation starts or when cloneExecutionPhase is "completed", explicitly tell the user to check "My Ads" to view/download the final video.
  27.1) When final-video creation starts for a clone project, say it has started, ask the user to wait about 10-20 seconds, send them to "My Ads" for details/download, and add this exact guidance: "${getNextCloneCanonicalGuidance()}"
  28) If user asks where to download the finished clone video, answer directly: "Please go to My Ads to view and download it." Then add: "${getNextCloneCanonicalGuidance()}"
  29) If matching is uncertain, present top likely candidates and ask a short clarification question; do not proceed to generation.
- When user asks what workflows are available, always list ALL three:
  1) Avatar Ads
  2) Clone Viral Videos (Competitor UGC Replication)
  3) Motion Clone

Current state:
- Avatar: ${avatarLabel}
- Product: ${productLabel}
- Reference Video: ${referenceVideoLabel}
- Reference Summary: ${referenceVideoSummary}
- Reference Key Shots: ${referenceVideoShots}
- Reference Detected Character: ${referenceDetectedCharacter}
- Reference Detected Product: ${referenceDetectedProduct}
- Clone Draft Status: ${cloneDraftStatus}
- Clone Plan Status: ${clonePlanStatus}
- Clone Draft Selections: ${cloneDraftSelection}
- Clone Draft Scenes: ${cloneDraftSceneCount}
- Clone Assignment Count: ${cloneAssignmentCount}
- Replacement Confirmation: ${replacementConfirmation}
- Replacement Confirmation Token: ${REPLACEMENT_CONFIRMATION_TOKEN}
- Clone Execution Phase: ${cloneExecutionPhase}
- Clone Execution Segments: ${cloneExecutionSegments}
- Clone Execution Segment Summary: ${cloneExecutionSegmentSummary}
- Clone Execution Merged Video URL: ${cloneExecutionMergedVideo}
- Pending Merge Confirmation: ${pendingMergeConfirmation}
- Motion Clone Reference Video: ${motionReferenceLabel}
- Motion Clone Stage: ${motionCloneStage}
- Motion Clone Phase: ${motionClonePhase}
- Motion Clone Preview Image: ${motionClonePreview}
- Motion Clone Output Video: ${motionCloneOutput}
- Motion Clone Quality: ${motionCloneQuality}
- Motion Clone Credits: ${motionCloneCredits}
- Motion Clone Error: ${motionCloneError}
- Avatar Agent Stage: ${state.avatarStage ?? 'unset'}
- Avatar Draft Status: ${state.avatarDraft?.status ?? 'unset'}
- Avatar Execution Phase: ${state.avatarExecution?.phase ?? 'unset'}
- Custom Dialogue: ${dialogueLabel}
- Selected Video Model: ${getVideoModelDisplayName(selectedVideoModel)} (${selectedVideoModel})
- Effective Video Model For Current Flow: ${getVideoModelDisplayName(effectiveVideoModel)} (${effectiveVideoModel})
- Duration: ${state.videoDurationSeconds ?? 'unset'}
- Aspect: ${state.videoAspectRatio ?? 'unset'}
- Language: ${state.language ?? 'unset'}
- Step: ${state.step ?? 'unknown'}

Stay concise, ask one clarification at a time, and prefer explicit confirmations before running generation tools.
`;
};

const getOrigin = (request: Request) => new URL(request.url).origin;

const syncAvatarSelectionFromState = (state: SessionState | null | undefined): SessionState['avatarSelection'] => ({
  avatar: state?.avatarSelection?.avatar ?? state?.avatar ?? null,
  product: state?.avatarSelection?.product ?? (
    state?.product ? { ...state.product } : null
  ),
  durationSeconds: state?.avatarSelection?.durationSeconds ?? state?.videoDurationSeconds ?? 16,
  aspectRatio: state?.avatarSelection?.aspectRatio ?? state?.videoAspectRatio ?? '9:16',
  language: state?.avatarSelection?.language ?? state?.language ?? 'en'
});

const deriveAvatarPromptState = (state: SessionState, draft: ProjectAgentAvatarDraft) => {
  const promptState = buildAvatarGeneratedPrompts({
    imagePrompt: draft.imagePrompt,
    scriptSource: draft.scriptSource,
    existingScenes: draft.scenes,
    language: state.avatarSelection?.language ?? state.language ?? 'en',
    avatarName: state.avatarSelection?.avatar?.name ?? state.avatar?.name ?? null,
    productName: state.avatarSelection?.product?.name ?? state.product?.name ?? null
  });

  return {
    promptState,
    nextDraft: {
      ...draft,
      scenes: promptState.scenes
    }
  };
};

const mergeState = (state: SessionState, patch: Partial<SessionState>) => {
  const nextState = {
    ...state,
    ...patch
  };

  nextState.avatarSelection = syncAvatarSelectionFromState(nextState);
  if (nextState.intent === 'avatar_ads') {
    nextState.avatarStage = inferProjectAgentAvatarStage({
      explicitStage: nextState.avatarStage,
      hasAvatar: Boolean(nextState.avatarSelection?.avatar?.id),
      hasDraft: Boolean(nextState.avatarDraft?.scenes?.length),
      hasCover: Boolean(nextState.avatarDraft?.coverImageUrl || nextState.generatedImageUrl),
      projectStatus: nextState.avatarExecution?.phase === 'completed'
        ? 'completed'
        : nextState.step,
      currentStep: nextState.step,
      hasExecution: Boolean(nextState.avatarExecution?.projectId)
    });
  }
  if (nextState.intent === 'motion_clone' && nextState.motionClone) {
    nextState.motionClone = buildMotionCloneExecutionUpdate(nextState.motionClone, {});
  }

  return {
    ...nextState,
    videoModel: normalizeProjectAgentVideoModel(nextState.videoModel, 'kling_3', nextState.intent)
  };
};

const buildFreshCloneState = (state: SessionState): SessionState => ({
  ...state,
  intent: 'competitor_ugc_replication',
  videoModel: 'kling_3',
  cloneReferenceVideo: undefined,
  cloneReplacementDraft: undefined,
  cloneExecution: null,
  motionClone: null,
  pendingMergeConfirmation: null,
  projectId: undefined,
  avatar: null,
  product: null
});

const mapClonePhaseFromStatusPayload = mapClonePhaseFromPayload;

const buildFreshAvatarState = (state: SessionState): SessionState => ({
  ...state,
  intent: 'avatar_ads',
  step: 'collecting',
  avatarStage: 'avatar_asset_selection',
  avatarDraft: null,
  avatarExecution: null,
  avatarSelection: {
    avatar: state.avatar ?? null,
    product: state.product ? { ...state.product } : null,
    durationSeconds: state.videoDurationSeconds ?? 16,
    aspectRatio: state.videoAspectRatio ?? '9:16',
    language: state.language ?? 'en'
  },
  cloneReferenceVideo: undefined,
  cloneReplacementDraft: undefined,
  cloneExecution: null,
  motionClone: null,
  pendingMergeConfirmation: null,
  projectId: undefined,
  generatedPrompts: null,
  generatedImageUrl: null,
  imagePrompt: null,
  pendingUpdatedPrompts: null
});

const buildFreshMotionCloneState = (state: SessionState): SessionState => ({
  ...state,
  intent: 'motion_clone',
  cloneReferenceVideo: undefined,
  cloneReplacementDraft: undefined,
  cloneExecution: null,
  motionClone: {
    stage: 'reference_selection',
    phase: 'idle'
  },
  pendingMergeConfirmation: null,
  projectId: undefined,
  avatar: null,
  product: null
});

const buildMotionCloneExecutionUpdate = (
  current: ProjectAgentMotionCloneExecution | null | undefined,
  patch: Partial<ProjectAgentMotionCloneExecution>
): ProjectAgentMotionCloneExecution => {
  const next = {
    ...(current ?? { phase: 'idle' as const, stage: 'reference_selection' as const }),
    ...patch
  };

  const stage = inferMotionCloneStage({
    explicitStage: patch.stage ?? next.stage ?? null,
    referenceVideo: patch.referenceVideo ?? next.referenceVideo ?? null,
    selectedAvatar: patch.selectedAvatar ?? next.selectedAvatar ?? null,
    phase: patch.phase ?? next.phase ?? null,
    previewImageUrl: patch.previewImageUrl ?? next.previewImageUrl ?? null,
    outputVideoUrl: patch.outputVideoUrl ?? next.outputVideoUrl ?? null,
  });

  const expectedAvatarToken = next.selectedAvatar?.name
    ? buildTypedMentionToken({ type: 'character', label: next.selectedAvatar.name })
    : '';
  const expectedProductToken = next.selectedProduct?.name
    ? buildTypedMentionToken({ type: 'product', label: next.selectedProduct.name })
    : '';
  const existingPhotoPrompt = next.photoPrompt || '';
  const existingVideoPrompt = next.videoPrompt || '';
  const promptsUseLegacyMotionCloneTemplate = (
    /appears in place of|match the original creator-video structure|preserve the same shot logic and beats|preserve the exact motion,\s*pacing,\s*rhythm,\s*and camera movement from the reference video/i.test(existingPhotoPrompt) ||
    /appears in place of|match the original creator-video structure|preserve the same shot logic and beats|preserve the exact motion,\s*pacing,\s*rhythm,\s*and camera movement from the reference video/i.test(existingVideoPrompt)
  );
  const promptsNeedMentionRefresh = (
    (expectedAvatarToken && (!existingPhotoPrompt.includes(expectedAvatarToken) || !existingVideoPrompt.includes(expectedAvatarToken))) ||
    (expectedProductToken && (!existingPhotoPrompt.includes(expectedProductToken) || !existingVideoPrompt.includes(expectedProductToken)))
  );

  const shouldRefreshPrompts = (
    Boolean(next.selectedAvatar?.name) &&
    (
      patch.selectedAvatar !== undefined ||
      patch.selectedProduct !== undefined ||
      !Boolean(next.promptsInitialized) ||
      !next.photoPrompt ||
      !next.videoPrompt ||
      promptsUseLegacyMotionCloneTemplate ||
      promptsNeedMentionRefresh
    )
  );

  if (shouldRefreshPrompts) {
    const drafts = buildMotionClonePromptDrafts({
      avatarName: next.selectedAvatar?.name,
      productName: next.selectedProduct?.name,
      referenceVideo: next.referenceVideo ?? null,
    });
    next.photoPrompt = drafts.photoPrompt;
    next.videoPrompt = drafts.videoPrompt;
    next.promptsInitialized = true;
  } else if (patch.selectedAvatar !== undefined && !next.selectedAvatar?.name) {
    next.photoPrompt = null;
    next.videoPrompt = null;
    next.promptsInitialized = false;
  }

  next.stage = stage;

  return next;
};

const detectWorkflowIntentSwitch = (userText: string): SessionState['intent'] | null => {
  const normalized = userText.trim().toLowerCase();
  if (!normalized) return null;

  if (/\bmotion clone\b/.test(normalized)) {
    return 'motion_clone';
  }

  if (/\bavatar ad\b|\bavatar ads\b|\bspokesperson\b/.test(normalized)) {
    return 'avatar_ads';
  }

  if (isNextCloneIntentMessage(userText)) {
    return 'competitor_ugc_replication';
  }

  return null;
};

const toCloneExecutionFromStatusPayload = (projectId: string, payload: Record<string, unknown>): NonNullable<SessionState['cloneExecution']> => {
  const data = (payload.data && typeof payload.data === 'object') ? payload.data as Record<string, unknown> : {};
  const segmentStatus = (data.segmentStatus && typeof data.segmentStatus === 'object')
    ? data.segmentStatus as Record<string, unknown>
    : null;
  const segmentsRaw = Array.isArray(data.segments) ? data.segments as Array<Record<string, unknown>> : [];
  const segments = segmentsRaw.map((segment) => ({
    segmentIndex: Number(segment.index ?? 0),
    status: typeof segment.status === 'string' ? segment.status : 'queued',
    firstFrameUrl: typeof segment.firstFrameUrl === 'string' ? segment.firstFrameUrl : null,
    videoUrl: typeof segment.videoUrl === 'string' ? segment.videoUrl : null,
    errorMessage: typeof segment.errorMessage === 'string' ? segment.errorMessage : null,
    prompt: (segment.prompt && typeof segment.prompt === 'object')
      ? segment.prompt as Record<string, unknown>
      : undefined
  }));

  const videoModel = data.videoModel;
  const normalizedModel = normalizeProjectAgentVideoModel(videoModel, 'kling_3', 'competitor_ugc_replication');

  return {
    projectId,
    phase: mapClonePhaseFromStatusPayload(payload),
    model: normalizedModel,
    duration: typeof data.videoDuration === 'string' ? data.videoDuration : undefined,
    creditsCost: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
    error: typeof data.errorMessage === 'string' ? data.errorMessage : null,
    mergedVideoUrl: resolveProjectAgentCloneMergedVideoUrl({
      videoUrl: typeof data.videoUrl === 'string' ? data.videoUrl : null,
      segmentStatusMergedVideoUrl: typeof segmentStatus?.mergedVideoUrl === 'string'
        ? segmentStatus.mergedVideoUrl
        : null,
      segments,
      model: normalizedModel,
    }),
    segments
  };
};

const normalizeUIMessage = (message: unknown, fallbackId: string): UIMessage => {
  const raw = (message ?? {}) as {
    id?: string;
    role?: UIMessage['role'];
    parts?: Array<{ type?: string; text?: string }>;
    content?: string;
  };

  const normalizedParts = Array.isArray(raw.parts)
    ? raw.parts
        .filter((part) => part?.type === 'text')
        .map((part) => ({ type: 'text' as const, text: part.text ?? '' }))
    : [];

  const parts = normalizedParts.length > 0
    ? normalizedParts
    : [{ type: 'text' as const, text: typeof raw.content === 'string' ? raw.content : '' }];

  return {
    id: (typeof raw.id === 'string' && raw.id.trim().length > 0) ? raw.id : fallbackId,
    role: raw.role ?? 'user',
    parts
  };
};

const messageText = (message: UIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();

const dedupeMessages = (messages: UIMessage[]) => {
  // Keep latest payload per id so streamed final chunks are not lost.
  const byIdMap = new Map<string, UIMessage>();
  for (const message of messages) {
    byIdMap.set(message.id, message);
  }
  const byId = Array.from(byIdMap.values());

  const collapsed: UIMessage[] = [];
  for (const message of byId) {
    const previous = collapsed[collapsed.length - 1];
    if (!previous) {
      collapsed.push(message);
      continue;
    }

    if (previous.role === 'assistant' && message.role === 'assistant') {
      const prevText = messageText(previous);
      const nextText = messageText(message);
      if (prevText && prevText === nextText) {
        continue;
      }
    }

    collapsed.push(message);
  }

  return collapsed;
};

const MODEL_CONTEXT_WINDOW_MESSAGES = 48;

const mergeAvatarOptions = (userAvatars: AvatarOption[]) => {
  const merged: AvatarOption[] = [
    ...SYSTEM_AVATARS.map((avatar) => ({
      id: avatar.id,
      avatar_name: avatar.avatar_name,
      photo_url: avatar.photo_url
    })),
    ...userAvatars
  ];

  const seen = new Set<string>();
  return merged.filter((avatar) => {
    if (seen.has(avatar.id)) return false;
    seen.add(avatar.id);
    return true;
  });
};

const resolveAvatarPrimaryPhotoUrl = (avatar: AvatarRow) => {
  const direct = typeof avatar.photo_url === 'string' ? avatar.photo_url.trim() : '';
  if (direct) return direct;

  const fallbackFileName = typeof avatar.file_name === 'string' && avatar.file_name.trim()
    ? avatar.file_name
    : 'avatar_primary';
  const normalizedPhotoSet = normalizeAvatarPhotoSet(
    avatar.photo_set_json ?? null,
    direct,
    fallbackFileName
  );
  const fromPhotoSet = typeof normalizedPhotoSet.primary?.photo_url === 'string'
    ? normalizedPhotoSet.primary.photo_url.trim()
    : '';
  return fromPhotoSet || null;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, sessionId, id, statePatch } = body as {
      message?: UIMessage;
      sessionId?: string;
      id?: string;
      statePatch?: Partial<SessionState>;
    };
    const resolvedSessionId = (sessionId && sessionId.trim()) || (id && id.trim()) || '';

    if (!resolvedSessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    // Schema verified via Supabase MCP (2026-01-13):
    // project_agent_sessions columns: id, user_id, project_id, intent, status, state, messages, created_at, updated_at
    const { data: existingSession, error: fetchError } = await supabase
      .from('project_agent_sessions')
      .select('*')
      .eq('id', resolvedSessionId)
      .maybeSingle();

    if (fetchError) {
      console.error('[Project Agent] Failed to load session:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load session', details: fetchError.message },
        { status: 500 }
      );
    }

    if (existingSession && existingSession.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let sessionState: SessionState = {
      ...DEFAULT_STATE,
      ...(existingSession?.state as SessionState | undefined)
    };
    if (statePatch && typeof statePatch === 'object') {
      sessionState = mergeState(sessionState, statePatch);
    } else {
      sessionState = mergeState(sessionState, {});
    }
    const storedMessagesRaw = Array.isArray(existingSession?.messages) ? existingSession.messages : [];
    const storedMessages = storedMessagesRaw.map((storedMessage: unknown, index: number) =>
      normalizeUIMessage(storedMessage, `stored-${index}`)
    );
    const normalizedIncomingMessage = normalizeUIMessage(message, `user-${Date.now()}`);
    const latestUserTurnText = messageText(normalizedIncomingMessage).toLowerCase();
    const conversationMessages = dedupeMessages([
      ...storedMessages,
      ...(
        storedMessages.some((storedMessage: UIMessage) => storedMessage.id === normalizedIncomingMessage.id)
          ? []
          : [normalizedIncomingMessage]
      )
    ]);

    const nextCloneFollowupDecision = (
      sessionState.intent === 'competitor_ugc_replication' &&
      Boolean(sessionState.cloneReferenceVideo?.id) &&
      !isReferenceSelectionMessage(messageText(normalizedIncomingMessage))
    )
      ? decideNextCloneFollowup(messageText(normalizedIncomingMessage), {
          phase: sessionState.cloneExecution?.phase,
          mergedVideoUrl: sessionState.cloneExecution?.mergedVideoUrl
        })
      : 'none';

    const shouldResetCloneSession = nextCloneFollowupDecision === 'reset';

    if (shouldResetCloneSession) {
      sessionState = buildFreshCloneState(sessionState);
    }

    const requestedWorkflowIntent = detectWorkflowIntentSwitch(messageText(normalizedIncomingMessage));
    if (requestedWorkflowIntent && requestedWorkflowIntent !== sessionState.intent) {
      if (requestedWorkflowIntent === 'motion_clone') {
        sessionState = buildFreshMotionCloneState(sessionState);
      } else if (requestedWorkflowIntent === 'competitor_ugc_replication') {
        sessionState = buildFreshCloneState(sessionState);
      } else {
        sessionState = buildFreshAvatarState(sessionState);
      }
    }

    const persistMessagesOnly = async (nextMessages: UIMessage[], nextState?: SessionState) => {
      const payload = {
        messages: nextMessages,
        ...(nextState ? { state: nextState } : {}),
        updated_at: new Date().toISOString()
      };

      const tryOnce = async () => (
        await supabase
          .from('project_agent_sessions')
          .update(payload)
          .eq('id', resolvedSessionId)
          .eq('user_id', userId)
      );

      try {
        const { error: updateError } = await tryOnce();
        if (!updateError) return;
        console.error('[Project Agent] Failed to persist session messages:', updateError);
      } catch (persistError) {
        console.error('[Project Agent] Failed to persist session messages:', persistError);
      }

      // Retry once for transient network failures (e.g. undici fetch failed).
      await new Promise((resolve) => setTimeout(resolve, 180));
      try {
        const { error: retryError } = await tryOnce();
        if (retryError) {
          console.error('[Project Agent] Retry persist session messages failed:', retryError);
        }
      } catch (retryPersistError) {
        console.error('[Project Agent] Retry persist session messages failed:', retryPersistError);
      }
    };

    const sendDirectAssistantReply = async (replyText: string, nextState?: SessionState) => {
      const assistantMessage: UIMessage = {
        id: `assistant-direct-${Date.now().toString(36)}`,
        role: 'assistant',
        parts: [{ type: 'text', text: replyText }]
      };
      const messagesToPersist = dedupeMessages([...conversationMessages, assistantMessage]);
      await persistMessagesOnly(messagesToPersist, nextState);

      const stream = createUIMessageStream<UIMessage>({
        execute: ({ writer }) => {
          writer.write({ type: 'text-start', id: assistantMessage.id });
          writer.write({ type: 'text-delta', id: assistantMessage.id, delta: replyText });
          writer.write({ type: 'text-end', id: assistantMessage.id });
        }
      });

      return createUIMessageStreamResponse({ stream });
    };

    if (!existingSession) {
      const insertPayload = {
        id: resolvedSessionId,
        user_id: userId,
        intent: sessionState.intent ?? 'avatar_ads',
        state: sessionState,
        messages: conversationMessages,
        status: 'active',
        updated_at: new Date().toISOString()
      };
      const { error: insertError } = await supabase
        .from('project_agent_sessions')
        .insert(insertPayload);

      if (insertError) {
        if (insertError.code !== '23505') {
          console.error('[Project Agent] Failed to create session:', insertError);
          return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

        const { data: racedSession, error: racedSessionError } = await supabase
          .from('project_agent_sessions')
          .select('id,user_id')
          .eq('id', resolvedSessionId)
          .maybeSingle();

        if (racedSessionError) {
          console.error('[Project Agent] Failed to resolve duplicate session race:', racedSessionError);
          return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
        }

        if (!racedSession || racedSession.user_id !== userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await persistMessagesOnly(
          conversationMessages,
          statePatch && typeof statePatch === 'object' ? sessionState : undefined
        );
      }
    } else {
      await persistMessagesOnly(
        conversationMessages,
        statePatch && typeof statePatch === 'object' ? sessionState : undefined
      );
    }

    if (nextCloneFollowupDecision === 'clarify-finished' || nextCloneFollowupDecision === 'clarify-in-progress') {
      return sendDirectAssistantReply(
        getNextCloneClarificationReply(nextCloneFollowupDecision)
      );
    }

    const persistSession = async (patch: Partial<SessionState>) => {
      try {
        const { data: latestSession, error: latestError } = await supabase
          .from('project_agent_sessions')
          .select('state')
          .eq('id', resolvedSessionId)
          .eq('user_id', userId)
          .maybeSingle();

        if (latestError) {
          console.error('[Project Agent] Failed to load latest session state before persist:', latestError);
        }

        const latestState = (latestSession?.state as SessionState | undefined) ?? {};
        sessionState = mergeState(
          mergeState(sessionState, latestState),
          patch
        );
        const { error: updateError } = await supabase
          .from('project_agent_sessions')
          .update({
            state: sessionState,
            project_id: sessionState.projectId ?? null,
            intent: sessionState.intent ?? 'avatar_ads',
            messages: conversationMessages,
            updated_at: new Date().toISOString()
          })
          .eq('id', resolvedSessionId)
          .eq('user_id', userId);

        if (updateError) {
          console.error('[Project Agent] Failed to persist session:', updateError);
        }
      } catch (persistError) {
        console.error('[Project Agent] Failed to persist session:', persistError);
      }
    };

    const maybeAdvanceAvatarSelectionContinue = async () => {
      if (sessionState.intent !== 'avatar_ads') return null;
      if (!isSelectionContinueIntent(latestUserTurnText)) return null;
      if (sessionState.avatarDraft?.scenes?.length || sessionState.generatedPrompts) return null;

      const selectedAvatar = sessionState.avatarSelection?.avatar ?? sessionState.avatar;
      if (!selectedAvatar?.photoUrl) {
        return sendDirectAssistantReply('Select an avatar first, then continue.');
      }

      let productSelection: { id: string; name: string; photoUrls: string[] } | null = null;
      const selectedProduct = sessionState.avatarSelection?.product ?? sessionState.product;
      if (selectedProduct?.id) {
        const { data: productRows, error: productError } = await supabase
          .from('user_products')
          .select('id, product_name, user_product_photos(photo_url,is_primary)')
          .eq('user_id', userId)
          .eq('id', selectedProduct.id)
          .limit(1);

        if (productError) {
          return sendDirectAssistantReply('I have the avatar, but I could not load the selected product. Please retry the product selection.');
        }

        const productRow = (productRows ?? [])[0] as
          | { id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }
          | undefined;
        if (productRow) {
          const photoUrls = (productRow.user_product_photos || [])
            .map((photo) => photo.photo_url || '')
            .filter((photoUrl) => photoUrl.trim().length > 0);
          productSelection = {
            id: productRow.id,
            name: productRow.product_name,
            photoUrls
          };
        }
      }

      const draft = await draftProjectAgentAvatarPrompts({
        avatar: selectedAvatar,
        product: productSelection,
        userIntentText: sessionState.customDialogue || '',
        durationSeconds: sessionState.avatarSelection?.durationSeconds ?? sessionState.videoDurationSeconds ?? 16,
        language: sessionState.avatarSelection?.language ?? sessionState.language ?? 'en',
        aspectRatio: sessionState.avatarSelection?.aspectRatio ?? sessionState.videoAspectRatio ?? '9:16'
      });

      const generatedPrompts = {
        image_prompt: draft.imagePrompt,
        scenes: draft.scenes.map((scene) => ({
          prompt: scene.prompt
        }))
      };

      await persistSession({
        customDialogue: draft.scriptSource,
        videoDurationSeconds: draft.totalDurationSeconds,
        generatedPrompts,
        imagePrompt: draft.imagePrompt,
        avatarDraft: {
          status: 'ready',
          scriptMode: sessionState.customDialogue?.trim() ? 'user_script' : 'agent_authored',
          scriptSource: draft.scriptSource,
          imagePrompt: draft.imagePrompt,
          scenes: draft.scenes,
          coverImageUrl: sessionState.avatarDraft?.coverImageUrl ?? null,
          error: null
        },
        avatarSelection: {
          ...syncAvatarSelectionFromState(sessionState),
          durationSeconds: draft.totalDurationSeconds
        },
        avatarStage: 'avatar_workspace'
      });

      const productLine = productSelection
        ? `I linked ${productSelection.name} as the product context.`
        : 'I kept this in talking-head mode with no product attached.';

      return sendDirectAssistantReply(
        `Perfect. I locked in ${selectedAvatar.name}. ${productLine} I also drafted the script and cover prompt, so the workspace is ready for review.`
      );
    };

    const maybeAcknowledgeMotionCloneReferenceSelection = async () => {
      if (sessionState.intent !== 'motion_clone') return null;

      const trimmedUserTurn = latestUserTurnText.trim();
      const matchedSelection = trimmedUserTurn.match(/^I selected "(.+)" as the reference video for motion clone\.?$/i);
      if (!matchedSelection) return null;

      const referenceVideo = sessionState.motionClone?.referenceVideo;
      const referenceLabel = referenceVideo?.description
        || matchedSelection[1]
        || 'the selected video';

      return sendDirectAssistantReply(
        `Done. "${referenceLabel}" is now set as your motion reference. Next, choose the replacement avatar from the options shown on the left. If you also want to swap the product, choose that too.`
      );
    };

    const maybeAdvanceMotionCloneSelectionContinue = async () => {
      if (sessionState.intent !== 'motion_clone') return null;

      const trimmedUserTurn = latestUserTurnText.trim();
      const isReferenceSelectionEcho = /^I selected ".+" as the reference video for motion clone\.?$/i.test(trimmedUserTurn);
      if (isReferenceSelectionEcho) return null;

      const referenceVideo = sessionState.motionClone?.referenceVideo;
      const selectedAvatar = sessionState.motionClone?.selectedAvatar;
      const selectedProduct = sessionState.motionClone?.selectedProduct ?? null;
      const alreadyHasProject = Boolean(sessionState.motionClone?.projectId);
      const wantsToContinue = (
        isSelectionContinueIntent(trimmedUserTurn) ||
        /\b(create|start|open|prepare|set up)\b.*\b(project|workspace|motion clone)\b/i.test(trimmedUserTurn) ||
        /\b(use|continue with)\b.*\b(selection|selections|current|these)\b/i.test(trimmedUserTurn)
      );

      if (!wantsToContinue) return null;
      if (!referenceVideo?.id) {
        return sendDirectAssistantReply('Select a reference video first, then continue.');
      }
      if (!selectedAvatar?.id) {
        return sendDirectAssistantReply('Select an avatar first, then continue.');
      }
      if (alreadyHasProject) {
        const nextMotionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
          stage: 'workspace'
        });
        await persistSession({
          intent: 'motion_clone',
          motionClone: nextMotionClone
        });

        const productLine = selectedProduct
          ? `I also kept ${selectedProduct.name} as the product swap.`
          : 'I kept the product unchanged.';
        return sendDirectAssistantReply(
          `Perfect. I locked in the selected reference video with ${selectedAvatar.name}. ${productLine} The workspace is ready with prompts generated from your current selections.`
        );
      }

      const internalTimestamp = String(Date.now());
      const response = await fetch(`${origin}/api/motion-clone/create`, {
        method: 'POST',
        headers: {
          Cookie: request.headers.get('cookie') || '',
          'x-project-agent-user-id': userId,
          'x-project-agent-timestamp': internalTimestamp,
          'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.project?.id) {
        return sendDirectAssistantReply(payload?.error || 'Failed to create the motion clone project.');
      }

      const motionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
        projectId: payload.project.id as string,
        phase: mapMotionClonePhaseFromStatus(payload.project.status),
        status: payload.project.status as string | null,
        stage: 'workspace'
      });
      await persistSession({
        intent: 'motion_clone',
        projectId: payload.project.id as string,
        motionClone
      });

      const productLine = selectedProduct
        ? `I also linked ${selectedProduct.name} as the product swap.`
        : 'I kept the product unchanged.';
      return sendDirectAssistantReply(
        `Perfect. I locked in the selected reference video with ${selectedAvatar.name}. ${productLine} The workspace is ready with prompts generated from your current selections.`
      );
    };

    const maybeHandleMotionCloneExplicitCommand = async () => {
      if (sessionState.intent !== 'motion_clone') return null;

      const userTurn = latestUserTurnText.trim();
      if (!userTurn) return null;

      const projectId = sessionState.motionClone?.projectId || await resolveMotionCloneProjectId();
      const referenceVideoId = sessionState.motionClone?.referenceVideo?.id;
      const selectedAvatar = sessionState.motionClone?.selectedAvatar;
      const selectedProduct = sessionState.motionClone?.selectedProduct ?? null;
      const internalTimestamp = String(Date.now());
      const internalHeaders = {
        'Content-Type': 'application/json',
        Cookie: request.headers.get('cookie') || '',
        'x-project-agent-user-id': userId,
        'x-project-agent-timestamp': internalTimestamp,
        'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
      };

      if (isMotionCloneStatusCommand(userTurn)) {
        if (!projectId) {
          return sendDirectAssistantReply('The motion clone project is not created yet. Generate the preview image first.');
        }

        const response = await fetch(`${origin}/api/motion-clone/${projectId}/status`, {
          cache: 'no-store',
          headers: internalHeaders
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.project) {
          return sendDirectAssistantReply(payload?.error || 'Failed to load the latest motion clone status.');
        }

        const execution = toMotionCloneExecutionFromProject(payload.project, {
          referenceVideo: sessionState.motionClone?.referenceVideo || null,
          selectedAvatar: selectedAvatar || null,
          selectedProduct: selectedProduct || null
        });
        await persistSession({
          intent: 'motion_clone',
          projectId,
          motionClone: execution
        });

        if (execution.phase === 'preview_ready') {
          return sendDirectAssistantReply('The preview image is ready on the left. You can start video generation now.');
        }
        if (execution.phase === 'generating_video') {
          return sendDirectAssistantReply('Video generation is running now. The generated video panel on the left will update when it is ready. When the full video is done, you can go to My Ads to view and download it.');
        }
        if (execution.phase === 'completed') {
          return sendDirectAssistantReply('The motion clone video is ready. You can review it on the left and open My Ads if you want the full result page.');
        }
        if (execution.phase === 'generating_preview') {
          return sendDirectAssistantReply('The preview image is still generating. I will show it on the left as soon as it is ready.');
        }
        if (execution.phase === 'failed') {
          return sendDirectAssistantReply(execution.error || 'Motion clone generation failed. You can retry from the current workspace.');
        }

        return sendDirectAssistantReply('The motion clone project is ready in the workspace.');
      }

      if (isMotionClonePreviewGenerationCommand(userTurn)) {
        if (!projectId) {
          return sendDirectAssistantReply('Create the motion clone project first.');
        }
        if (!referenceVideoId) {
          return sendDirectAssistantReply('Select a reference video first.');
        }
        if (!selectedAvatar) {
          return sendDirectAssistantReply('Select an avatar first.');
        }

        const response = await fetch(`${origin}/api/motion-clone/${projectId}/start`, {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({
            reference_video_id: referenceVideoId,
            avatar_id: selectedAvatar.id,
            product_id: selectedProduct?.id || undefined,
            photo_prompt: sessionState.motionClone?.photoPrompt || undefined,
            video_prompt: sessionState.motionClone?.videoPrompt || undefined,
            mode: normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality),
            action: 'image'
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.project) {
          return sendDirectAssistantReply(payload?.error || 'Failed to start preview generation.');
        }

        const execution = toMotionCloneExecutionFromProject(payload.project, {
          referenceVideo: sessionState.motionClone?.referenceVideo || null,
          selectedAvatar: selectedAvatar || null,
          selectedProduct: selectedProduct || null
        });
        await persistSession({
          intent: 'motion_clone',
          projectId,
          motionClone: execution
        });

        return sendDirectAssistantReply('Preview image generation has started. I will show the new first frame on the left as soon as it is ready.');
      }

      if (isStartVideoGenerationCommand(userTurn)) {
        if (!projectId) {
          return sendDirectAssistantReply('Create the motion clone project first.');
        }
        if (!referenceVideoId) {
          return sendDirectAssistantReply('Select a reference video first.');
        }
        if (!selectedAvatar) {
          return sendDirectAssistantReply('Select an avatar first.');
        }

        const estimatedCredits = getMotionCloneGenerationCost(
          sessionState.motionClone?.referenceVideo?.durationSeconds,
          normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality)
        );
        const response = await fetch(`${origin}/api/motion-clone/${projectId}/start`, {
          method: 'POST',
          headers: internalHeaders,
          body: JSON.stringify({
            reference_video_id: referenceVideoId,
            avatar_id: selectedAvatar.id,
            product_id: selectedProduct?.id || undefined,
            photo_prompt: sessionState.motionClone?.photoPrompt || undefined,
            video_prompt: sessionState.motionClone?.videoPrompt || undefined,
            mode: normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality),
            action: 'video'
          })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 402) {
          const requiredCredits = payload?.required ?? estimatedCredits ?? null;
          const remainingCredits = payload?.remaining ?? null;
          return sendDirectAssistantReply(
            remainingCredits == null
              ? `Video generation did not start. It needs ${requiredCredits} credits.`
              : `Video generation did not start. It needs ${requiredCredits} credits, and you currently have ${remainingCredits}.`
          );
        }
        if (!response.ok || !payload?.project) {
          return sendDirectAssistantReply(payload?.error || 'Failed to start motion clone video generation.');
        }

        const execution = toMotionCloneExecutionFromProject(payload.project, {
          referenceVideo: sessionState.motionClone?.referenceVideo || null,
          selectedAvatar: selectedAvatar || null,
          selectedProduct: selectedProduct || null
        });
        await persistSession({
          intent: 'motion_clone',
          projectId,
          motionClone: execution
        });

        if (execution.phase === 'generating_preview') {
          return sendDirectAssistantReply('I started by generating the preview image first. Once it is ready, the workspace will be ready for video generation.');
        }

        return sendDirectAssistantReply('Video generation has started. The generated video panel on the left is now rendering. When the full video is ready, you can go to My Ads to view and download it.');
      }

      return null;
    };

    const cloneDraftPrerequisiteGate = () => {
      if (sessionState.intent !== 'competitor_ugc_replication' || !sessionState.cloneReferenceVideo?.id) {
        return { ok: false as const, message: 'Reference video is not selected yet.' };
      }
      // Backward compatibility: allow legacy in-flight clone sessions that predate
      // replacement plan confirmation fields.
      if (
        sessionState.cloneExecution?.projectId &&
        !sessionState.cloneReplacementDraft?.confirmation &&
        !sessionState.cloneReplacementDraft?.planStatus
      ) {
        return { ok: true as const };
      }
      const selectedAvatars = normalizeCloneSelections(
        sessionState.cloneReplacementDraft?.selectedAvatars,
        sessionState.cloneReplacementDraft?.selectedAvatar
      );
      const selectedProducts = normalizeCloneSelections(
        sessionState.cloneReplacementDraft?.selectedProducts,
        sessionState.cloneReplacementDraft?.selectedProduct
      );
      if (
        selectedAvatars.length === 0 &&
        selectedProducts.length === 0 &&
        !sessionState.avatar?.id &&
        !sessionState.product?.id
      ) {
        return { ok: false as const, message: 'Draft generation has not started yet. Please select at least one replacement avatar or product first.' };
      }
      return { ok: true as const };
    };

    const cloneExecutionGate = () => {
      const draftGate = cloneDraftPrerequisiteGate();
      if (!draftGate.ok) return draftGate;
      if (!isCloneSelectionConfirmed(sessionState, latestUserTurnText)) {
        return {
          ok: false as const,
          message: `Replacement plan is not confirmed yet. Review scene assignments, then reply "${REPLACEMENT_CONFIRMATION_TOKEN}".`
        };
      }
      return { ok: true as const };
    };

    const resolveCloneProjectId = async (): Promise<string | null> => {
      const fromState = sessionState.cloneExecution?.projectId;
      if (fromState) {
        return fromState;
      }

      const { data: latestCloneProject, error: latestCloneProjectError } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestCloneProjectError) {
        console.error('[Project Agent] Failed to resolve latest clone project id:', latestCloneProjectError);
        return null;
      }

      return latestCloneProject?.id || null;
    };

    const fetchMotionCloneReferenceVideos = async (): Promise<ProjectAgentMotionCloneReferenceVideo[]> => {
      // Schema verified via Supabase MCP (2026-03-18):
      // creator_source_videos columns used here:
      // id, user_id, video_url, video_cdn_url, cover_url, description, duration_seconds, analysis_language, analysis_result, created_at
      const { data, error } = await supabase
        .from('creator_source_videos')
        .select('id, video_url, video_cdn_url, cover_url, description, duration_seconds, analysis_language, analysis_result')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error('Failed to load motion clone reference videos.');
      }

      return (data ?? [])
        .filter((video) => typeof video.id === 'string')
        .map((video) => {
          const analysisResult = (video.analysis_result && typeof video.analysis_result === 'object')
            ? video.analysis_result as Record<string, unknown>
            : null;
          const referenceContext = inferMotionCloneReferenceContext(analysisResult);

          return {
            id: video.id,
            description: typeof video.description === 'string' ? video.description : null,
            videoUrl: typeof video.video_url === 'string' ? video.video_url : null,
            videoCdnUrl: typeof video.video_cdn_url === 'string' ? video.video_cdn_url : null,
            coverUrl: typeof video.cover_url === 'string' ? video.cover_url : null,
            durationSeconds: typeof video.duration_seconds === 'number' ? video.duration_seconds : null,
            analysisLanguage: typeof video.analysis_language === 'string' ? video.analysis_language : null,
            analysisResult,
            analysisSummary: referenceContext.summary,
            keyShots: referenceContext.keyShots,
            detectedCharacter: referenceContext.detectedCharacter,
            detectedProduct: referenceContext.detectedProduct,
          };
        });
    };

    const findMotionCloneReferenceVideo = async (input: {
      referenceVideoId?: string;
      description?: string;
    }): Promise<ProjectAgentMotionCloneReferenceVideo | null> => {
      const videos = await fetchMotionCloneReferenceVideos();
      if (input.referenceVideoId) {
        return videos.find((video) => video.id === input.referenceVideoId) || null;
      }

      const needle = input.description?.toLowerCase().trim();
      if (!needle) return null;
      return videos.find((video) => (video.description || '').toLowerCase().includes(needle)) || null;
    };

    const resolveMotionCloneProjectId = async (): Promise<string | null> => {
      const fromState = sessionState.motionClone?.projectId;
      if (fromState) {
        return fromState;
      }

      const { data, error } = await supabase
        .from('motion_clone_projects')
        .select('id')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Project Agent] Failed to resolve latest motion clone project id:', error);
        return null;
      }

      return data?.id || null;
    };

    let plannedCloneSceneCountPromise: Promise<number> | null = null;
    const resolvePlannedCloneSceneCount = async (): Promise<number> => {
      if (Array.isArray(sessionState.cloneReplacementDraft?.scenes) && sessionState.cloneReplacementDraft.scenes.length > 0) {
        return Math.max(sessionState.cloneReplacementDraft.scenes.length, 1);
      }
      if (!sessionState.cloneReferenceVideo?.id) {
        return 1;
      }
      if (plannedCloneSceneCountPromise) {
        return plannedCloneSceneCountPromise;
      }

      plannedCloneSceneCountPromise = (async () => {
        const reference = sessionState.cloneReferenceVideo;
        if (!reference) return 1;

        try {
          // Schema verified via Supabase MCP (2026-03-11):
          // competitor_ads has id,user_id,analysis_result,video_duration_seconds.
          // creator_source_videos has id,user_id,source_id,analysis_result,duration_seconds.
          let analysisResult: Record<string, unknown> | null = null;
          let referenceDurationSeconds: number | null = null;

          if (reference.sourceType === 'competitor_ad') {
            const { data } = await supabase
              .from('competitor_ads')
              .select('id,analysis_result,video_duration_seconds')
              .eq('id', reference.sourceId || reference.id)
              .eq('user_id', userId)
              .maybeSingle();
            const competitorAd = data as {
              id: string;
              analysis_result: unknown;
              video_duration_seconds?: number | null;
            } | null;
            analysisResult = (competitorAd?.analysis_result as Record<string, unknown> | null) || null;
            referenceDurationSeconds = Number(competitorAd?.video_duration_seconds || 0) || null;
          } else {
            type CreatorSourceVideoRow = {
              id: string;
              analysis_result: unknown;
              duration_seconds?: number | null;
            };
            let creatorVideo: CreatorSourceVideoRow | null = null;
            const primaryId = reference.id;
            if (primaryId) {
              const { data } = await supabase
                .from('creator_source_videos')
                .select('id,analysis_result,duration_seconds')
                .eq('id', primaryId)
                .eq('user_id', userId)
                .maybeSingle();
              creatorVideo = data as CreatorSourceVideoRow | null;
            }
            if (!creatorVideo && reference.sourceId) {
              const { data } = await supabase
                .from('creator_source_videos')
                .select('id,analysis_result,duration_seconds')
                .eq('source_id', reference.sourceId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              creatorVideo = data as CreatorSourceVideoRow | null;
            }
            analysisResult = (creatorVideo?.analysis_result as Record<string, unknown> | null) || null;
            referenceDurationSeconds = Number(creatorVideo?.duration_seconds || 0) || null;
          }

          const plan = buildProjectAgentCloneDraftSeeds({
            analysisResult,
            fallbackSummary: reference.analysisSummary,
            fallbackShots: reference.keyShots,
            referenceDurationSeconds,
            language: sessionState.language || reference.language || 'en',
          });
          return Math.max(plan.scenes.length, 1);
        } catch {
          return Math.max(
            Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 0,
            1
          );
        }
      })();

      return plannedCloneSceneCountPromise;
    };

    const origin = getOrigin(request);
    let userProductCountPromise: Promise<number | null> | null = null;
    const resolveUserProductCount = async (): Promise<number | null> => {
      if (userProductCountPromise) {
        return userProductCountPromise;
      }

      userProductCountPromise = (async () => {
        const { count, error } = await supabase
          .from('user_products')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (error) {
          console.error('[Project Agent] Failed to count products for clone guard:', error);
          return null;
        }

        return typeof count === 'number' ? count : 0;
      })();

      return userProductCountPromise;
    };

    const buildCloneSelectionNeededReply = async (options?: { requireProgressTurn?: boolean }) => {
      if (sessionState.intent !== 'competitor_ugc_replication' || !sessionState.cloneReferenceVideo?.id) {
        return null;
      }

      if (sessionState.cloneExecution?.projectId) {
        return null;
      }

      const draftStatus = sessionState.cloneReplacementDraft?.status || 'idle';
      if (draftStatus === 'generating' || draftStatus === 'ready') {
        return null;
      }

      const selectedAvatars = normalizeCloneSelections(
        sessionState.cloneReplacementDraft?.selectedAvatars,
        sessionState.cloneReplacementDraft?.selectedAvatar
      );
      const selectedProducts = normalizeCloneSelections(
        sessionState.cloneReplacementDraft?.selectedProducts,
        sessionState.cloneReplacementDraft?.selectedProduct
      );

      if (selectedAvatars.length > 0 || selectedProducts.length > 0 || sessionState.avatar?.id || sessionState.product?.id) {
        return null;
      }

      const requireProgressTurn = options?.requireProgressTurn !== false;
      const isProgressTurn = isCloneDraftProgressIntent(latestUserTurnText);

      if (requireProgressTurn && !isProgressTurn) {
        return null;
      }

      const productCount = await resolveUserProductCount();
      const hasProductsInAssets = productCount === null ? true : productCount > 0;
      const blocker = 'Draft generation has not started yet because no replacement is selected.';

      if (!hasProductsInAssets) {
        return `${formatCloneReferenceGrounding(sessionState)} ${blocker} You can continue with an avatar only, or create or import a product if you also want product replacement.`;
      }

      return `${formatCloneReferenceGrounding(sessionState)} ${blocker} Choose an avatar, a product, or both in Step 2 next.`;
    };

    const fetchUserAvatarOptions = async (): Promise<AvatarOption[]> => {
      const extendedQuery = await supabase
        .from('user_avatars')
        .select('id, avatar_name, photo_url, file_name, photo_set_json')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      let avatarRows: AvatarRow[] | null = null;

      if (extendedQuery.error) {
        console.warn('[Project Agent] Avatar extended query failed; falling back to minimal fields:', extendedQuery.error.message);
        const fallbackQuery = await supabase
          .from('user_avatars')
          .select('id, avatar_name, photo_url')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (fallbackQuery.error) {
          throw new Error('Failed to load avatars');
        }
        avatarRows = (fallbackQuery.data ?? []) as AvatarRow[];
      } else {
        avatarRows = (extendedQuery.data ?? []) as AvatarRow[];
      }

      return avatarRows.map((avatar) => ({
        id: avatar.id,
        avatar_name: avatar.avatar_name || 'Unnamed Avatar',
        photo_url: resolveAvatarPrimaryPhotoUrl(avatar)
      }));
    };

    if (shouldSyncCloneWorkspaceStatus(sessionState, latestUserTurnText)) {
      const cloneProjectId = await resolveCloneProjectId();
      if (cloneProjectId) {
        const internalHeaders: HeadersInit = {
          'x-project-agent-internal': '1',
          'x-project-agent-user-id': userId
        };
        const workspaceStatusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${cloneProjectId}/status`, {
          cache: 'no-store',
          headers: internalHeaders
        });
        const workspaceStatusPayload = await workspaceStatusResponse.json().catch(() => ({}));
        if (workspaceStatusResponse.ok && workspaceStatusPayload?.data) {
          const syncedCloneExecution = toCloneExecutionFromStatusPayload(
            cloneProjectId,
            workspaceStatusPayload as Record<string, unknown>
          );
          sessionState = mergeState(sessionState, {
            cloneExecution: syncedCloneExecution
          });
          await persistSession({
            cloneExecution: syncedCloneExecution
          });
        }
      }
    }

    const modelContextMessages = conversationMessages.slice(-MODEL_CONTEXT_WINDOW_MESSAGES);
    const modelMessages = await convertToModelMessages(modelContextMessages);
    const inferredSceneIndexFromTurn = parseSceneIndexFromUserTurn(latestUserTurnText);
    let forcedToolChoice: ForcedToolChoice;
    try {
      forcedToolChoice = await classifyToolIntent({
        model,
        latestUserTurnText,
        currentIntent: sessionState.intent,
        avatarHasCover: Boolean(
          sessionState.avatarDraft?.coverImageUrl ||
          sessionState.generatedImageUrl ||
          sessionState.avatarExecution?.coverImageUrl
        ),
        clonePhase: sessionState.cloneExecution?.phase,
        hasCloneProject: Boolean(
          sessionState.cloneExecution?.projectId ||
          sessionState.projectId
        ),
        hasSelectedReplacements: hasAnyCloneReplacementSelection(sessionState),
        cloneDraftStatus: sessionState.cloneReplacementDraft?.status,
        pendingMergeConfirmation: sessionState.pendingMergeConfirmation ?? null
      });
    } catch (intentError) {
      console.warn('[Project Agent] Tool intent classification failed, falling back to model autonomy:', intentError);
      forcedToolChoice = undefined;
    }

    const cloneDraftStatus = sessionState.cloneReplacementDraft?.status || 'idle';
    const shouldForceAvatarOnlyDraft = (
      sessionState.intent === 'competitor_ugc_replication' &&
      Boolean(sessionState.cloneReferenceVideo?.id) &&
      !sessionState.cloneExecution?.projectId &&
      cloneDraftStatus !== 'generating' &&
      cloneDraftStatus !== 'ready' &&
      hasAvatarOnlyCloneSelection(sessionState) &&
      (isSelectionContinueIntent(latestUserTurnText) || isCloneDraftPreviewIntent(latestUserTurnText))
    );
    if (!forcedToolChoice && shouldForceAvatarOnlyDraft) {
      forcedToolChoice = { type: 'tool', toolName: 'generateCloneReplacementDraft' };
    }

    const cloneSelectionNeededReply = await buildCloneSelectionNeededReply({ requireProgressTurn: true });
    if (cloneSelectionNeededReply) {
      return sendDirectAssistantReply(cloneSelectionNeededReply);
    }

    const avatarSelectionContinueReply = await maybeAdvanceAvatarSelectionContinue();
    if (avatarSelectionContinueReply) {
      return avatarSelectionContinueReply;
    }

    const motionCloneReferenceSelectionReply = await maybeAcknowledgeMotionCloneReferenceSelection();
    if (motionCloneReferenceSelectionReply) {
      return motionCloneReferenceSelectionReply;
    }

    const motionCloneSelectionContinueReply = await maybeAdvanceMotionCloneSelectionContinue();
    if (motionCloneSelectionContinueReply) {
      return motionCloneSelectionContinueReply;
    }

    const motionCloneExplicitCommandReply = await maybeHandleMotionCloneExplicitCommand();
    if (motionCloneExplicitCommandReply) {
      return motionCloneExplicitCommandReply;
    }

    const result = await streamText({
      model,
      system: buildSystemPrompt(sessionState),
      messages: modelMessages,
      stopWhen: stepCountIs(5),
      ...(forcedToolChoice ? { toolChoice: forcedToolChoice } : {}),
      tools: {
        listAvatars: tool({
          description: 'List available avatars for the user',
          inputSchema: emptySchema,
          execute: async () => {
            // Schema verified via Supabase MCP (2026-01-13):
            // user_avatars columns include id, avatar_name, photo_url, file_name, photo_set_json
            const userAvatars = await fetchUserAvatarOptions();
            const avatars = mergeAvatarOptions(userAvatars);

            return { avatars };
          }
        }),
        listProducts: tool({
          description: 'List products for the user',
          inputSchema: emptySchema,
          execute: async () => {
            // Schema verified via Supabase MCP (2026-01-13):
            // user_products columns: id, user_id, product_name, created_at, updated_at
            const { data: products, error: productsError } = await supabase
              .from('user_products')
              .select('id, product_name')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (productsError) {
              throw new Error('Failed to load products');
            }

            return { products: products ?? [] };
          }
        }),
        selectAvatar: tool({
          description: 'Select an avatar by name or id',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              avatarId: { type: 'string' },
              avatarName: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ avatarId, avatarName }) => {
            if (
              sessionState.intent === 'competitor_ugc_replication' &&
              isProductOnlyIntent(latestUserTurnText) &&
              !hasExplicitAvatarIntent(latestUserTurnText)
            ) {
              return {
                success: false,
                message: 'You asked for product-only replacement. No avatar was selected. Say "use avatar <name>" if you also want person replacement.'
              };
            }

            const avatars = await fetchUserAvatarOptions();

            const normalizedName = avatarName?.toLowerCase().trim();
            const mergedAvatars = mergeAvatarOptions(avatars);
            const normalizedAvatarName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
            const avatarAlias = normalizedName ? normalizedAvatarName(normalizedName) : '';
            const maleAlias = new Set(['man', 'male', 'guy', 'boy']);
            const femaleAlias = new Set(['woman', 'female', 'girl']);
            const explicitAvatarIntent = hasExplicitAvatarIntent(latestUserTurnText);

            let match = mergedAvatars.find((avatar) => avatarId ? avatar.id === avatarId : false);
            if (!match && avatarAlias) {
              if (explicitAvatarIntent && maleAlias.has(avatarAlias)) {
                match = mergedAvatars.find((avatar) => normalizedAvatarName(avatar.avatar_name || '') === 'default male')
                  || mergedAvatars.find((avatar) => /male|man/.test(normalizedAvatarName(avatar.avatar_name || '')));
              } else if (explicitAvatarIntent && femaleAlias.has(avatarAlias)) {
                match = mergedAvatars.find((avatar) => normalizedAvatarName(avatar.avatar_name || '') === 'default female')
                  || mergedAvatars.find((avatar) => /female|woman/.test(normalizedAvatarName(avatar.avatar_name || '')));
              } else {
                match = mergedAvatars.find((avatar) => normalizedAvatarName(avatar.avatar_name || '').includes(avatarAlias));
              }
            }

            if (!match) {
              return { success: false, message: 'No matching avatar found.' };
            }
            if (!match.photo_url) {
              return { success: false, message: 'Selected avatar is missing a photo URL.' };
            }

            if (sessionState.intent === 'motion_clone') {
              const selectedAvatar = {
                id: match.id,
                name: match.avatar_name || 'Unnamed Avatar',
                photoUrl: match.photo_url ?? null
              };
              const nextMotionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
                selectedAvatar,
                error: null
              });
              await persistSession({
                avatar: {
                  id: selectedAvatar.id,
                  name: selectedAvatar.name,
                  photoUrl: selectedAvatar.photoUrl || ''
                },
                motionClone: nextMotionClone
              });

              return {
                success: true,
                avatar: match,
                message: nextMotionClone.selectedProduct?.id
                  ? 'Avatar selected for motion clone. Prompts were refreshed based on the current avatar and product selections.'
                  : 'Avatar selected for motion clone. Prompts were refreshed for the current selection.'
              };
            }

            if (sessionState.intent === 'avatar_ads') {
              await persistSession({
                avatar: {
                  id: match.id,
                  name: match.avatar_name || 'Unnamed Avatar',
                  photoUrl: match.photo_url
                },
                avatarSelection: {
                  ...syncAvatarSelectionFromState(sessionState),
                  avatar: {
                    id: match.id,
                    name: match.avatar_name || 'Unnamed Avatar',
                    photoUrl: match.photo_url
                  }
                },
                avatarStage: 'avatar_script_collection'
              });

              return {
                success: true,
                avatar: match,
                message: 'Avatar selected for avatar ads.'
              };
            }

            const nextPlanStatus: ClonePlanStatus = 'awaiting_confirmation';

            await persistSession({
              avatar: {
                id: match.id,
                name: match.avatar_name || 'Unnamed Avatar',
                photoUrl: match.photo_url
              },
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? {
                  status: 'idle',
                  error: null,
                  scenes: []
                }),
                selectedAvatars: normalizeCloneSelections([
                  ...normalizeCloneSelections(
                    sessionState.cloneReplacementDraft?.selectedAvatars,
                    sessionState.cloneReplacementDraft?.selectedAvatar
                  ),
                  {
                    id: match.id,
                    name: match.avatar_name || 'Unnamed Avatar',
                    photoUrl: match.photo_url ?? null
                  }
                ]),
                selectedAvatar: {
                  id: match.id,
                  name: match.avatar_name || 'Unnamed Avatar',
                  photoUrl: match.photo_url ?? null
                },
                planStatus: nextPlanStatus,
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });

            const productCount = await resolveUserProductCount();
            const hasProductsInAssets = productCount === null ? true : productCount > 0;

            return {
              success: true,
              avatar: match,
              message: hasProductsInAssets
                ? 'Avatar selected. You can continue with avatar-only replacement, or add a product if you also want product replacement.'
                : 'Avatar selected. You can continue with avatar-only replacement, or create or import a product if you also want product replacement.'
            };
          }
        }),
        selectProduct: tool({
          description: 'Select a product by name or id',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              productId: { type: 'string' },
              productName: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ productId, productName }) => {
            const { data, error } = await supabase
              .from('user_products')
              .select('id, product_name')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            if (error || !data) {
              throw new Error('Failed to load products');
            }

            const products = data as ProductRow[];
            if (products.length === 0) {
              return { success: false, message: 'No products are available in Assets yet. Create or import a product first.' };
            }

            const normalizedProduct = productName?.toLowerCase().trim();

            const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
            const latestUserTextNormalized = normalize(latestUserTurnText || '');
            const normalizedProductNeedle = normalizedProduct ? normalize(normalizedProduct) : '';

            const match = products.find((product) => {
              if (productId) return product.id === productId;
              if (!normalizedProductNeedle) return false;

              const normalizedProductName = normalize(product.product_name || '');
              return normalizedProductName.includes(normalizedProductNeedle);
            });

            if (!match) {
              return { success: false, message: 'No matching product found.' };
            }

            if (sessionState.intent === 'motion_clone') {
              const { data: motionProductRows, error: motionProductError } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('user_id', userId)
                .eq('id', match.id)
                .limit(1);

              if (motionProductError) {
                return { success: false, message: 'Failed to load the selected product.' };
              }

              const motionProduct = (motionProductRows ?? [])[0] as
                | { id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }
                | undefined;
              const photos = Array.isArray(motionProduct?.user_product_photos)
                ? motionProduct.user_product_photos
                : [];
              const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
              const selectedProduct = {
                id: match.id,
                name: match.product_name,
                photoUrl: primaryPhoto?.photo_url || null
              };
              const nextMotionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
                selectedProduct,
                error: null
              });

              await persistSession({
                product: {
                  id: selectedProduct.id,
                  name: selectedProduct.name
                },
                motionClone: nextMotionClone
              });

              return {
                success: true,
                product: match,
                message: 'Product selected for motion clone.'
              };
            }

            if (sessionState.intent === 'avatar_ads') {
              const { data: avatarProductRows, error: avatarProductError } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('user_id', userId)
                .eq('id', match.id)
                .limit(1);

              if (avatarProductError) {
                return { success: false, message: 'Failed to load the selected product.' };
              }

              const avatarProduct = (avatarProductRows ?? [])[0] as
                | { id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }
                | undefined;
              const avatarPhotos = Array.isArray(avatarProduct?.user_product_photos)
                ? avatarProduct.user_product_photos
                : [];
              const avatarPrimaryPhoto = avatarPhotos.find((photo) => photo.is_primary) || avatarPhotos[0];

              await persistSession({
                product: {
                  id: match.id,
                  name: match.product_name
                },
                avatarSelection: {
                  ...syncAvatarSelectionFromState(sessionState),
                  product: {
                    id: match.id,
                    name: match.product_name,
                    photoUrl: avatarPrimaryPhoto?.photo_url || null
                  }
                }
              });

              return {
                success: true,
                product: match,
                message: 'Product selected for avatar ads.'
              };
            }

            const matchedProductNameNormalized = normalize(match.product_name || '');
            const hasSelectedProductInState = (
              normalizeCloneSelections(
                sessionState.cloneReplacementDraft?.selectedProducts,
                sessionState.cloneReplacementDraft?.selectedProduct
              ).length > 0 ||
              Boolean(sessionState.product?.id)
            );
            const allowImplicitByState = hasSelectedProductInState && isSelectionContinueIntent(latestUserTurnText);
            const hasExplicitByLatestTurn = Boolean(
              latestUserTextNormalized &&
              latestUserTextNormalized.includes(matchedProductNameNormalized)
            );
            if (!hasExplicitByLatestTurn && !allowImplicitByState && !productId) {
              return {
                success: false,
                message: 'User has not explicitly specified this replacement product in the latest message.'
              };
            }

            await persistSession({
              product: {
                id: match.id,
                name: match.product_name
              },
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? {
                  status: 'idle',
                  error: null,
                  scenes: []
                }),
                selectedProducts: normalizeCloneSelections([
                  ...normalizeCloneSelections(
                    sessionState.cloneReplacementDraft?.selectedProducts,
                    sessionState.cloneReplacementDraft?.selectedProduct
                  ),
                  {
                    id: match.id,
                    name: match.product_name,
                    photoUrl: null
                  }
                ]),
                selectedProduct: {
                  id: match.id,
                  name: match.product_name,
                  photoUrl: null
                },
                planStatus: 'awaiting_confirmation',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });

            return {
              success: true,
              product: match,
              message: 'Product selected. You can continue to draft planning.'
            };
          }
        }),
        setCloneSelections: tool({
          description: 'Bulk set replacement avatars/products for clone planning. Supports replace/add mode.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              avatarIds: { type: 'array', items: { type: 'string' } },
              productIds: { type: 'array', items: { type: 'string' } },
              mode: { type: 'string', enum: ['replace', 'add'] }
            },
            required: []
          }),
          execute: async ({ avatarIds, productIds, mode }) => {
            const mergeMode = mode === 'add' ? 'add' : 'replace';
            const nextAvatarIds = normalizeSelectedIds(undefined, avatarIds, 8);
            const nextProductIds = normalizeSelectedIds(undefined, productIds, 8);

            const currentSelectedAvatars = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedAvatars,
              sessionState.cloneReplacementDraft?.selectedAvatar
            );
            const currentSelectedProducts = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedProducts,
              sessionState.cloneReplacementDraft?.selectedProduct
            );

            const userAvatars = await fetchUserAvatarOptions();
            const avatarMap = new Map(
              mergeAvatarOptions(userAvatars).map((avatar) => [avatar.id, avatar] as const)
            );

            const resolvedAvatarSelections = nextAvatarIds.map((id) => {
              const avatar = avatarMap.get(id);
              if (!avatar) return null;
              return {
                id: avatar.id,
                name: avatar.avatar_name || 'Unnamed Avatar',
                photoUrl: avatar.photo_url ?? null
              };
            }).filter((item): item is NonNullable<typeof item> => Boolean(item));

            if (nextAvatarIds.length > 0 && resolvedAvatarSelections.length !== nextAvatarIds.length) {
              return { success: false, message: 'One or more avatars were not found.' };
            }

            let productRows: Array<{ id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }> = [];
            if (nextProductIds.length > 0) {
              const { data, error: productsError } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('user_id', userId)
                .in('id', nextProductIds);
              if (productsError) {
                return { success: false, message: 'Failed to load selected products.' };
              }
              productRows = (data ?? []) as typeof productRows;
            }

            const productMap = new Map(
              productRows.map((product) => [product.id, product] as const)
            );
            const resolvedProductSelections = nextProductIds.map((id) => {
              const product = productMap.get(id);
              if (!product) return null;
              const photos = Array.isArray(product.user_product_photos)
                ? product.user_product_photos as Array<{ photo_url?: string; is_primary?: boolean }>
                : [];
              const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
              return {
                id: product.id,
                name: product.product_name || 'Unnamed Product',
                photoUrl: primaryPhoto?.photo_url || null
              };
            }).filter((item): item is NonNullable<typeof item> => Boolean(item));

            if (nextProductIds.length > 0 && resolvedProductSelections.length !== nextProductIds.length) {
              return { success: false, message: 'One or more products were not found.' };
            }

            const selectedAvatars = mergeMode === 'add'
              ? normalizeCloneSelections([...currentSelectedAvatars, ...resolvedAvatarSelections])
              : normalizeCloneSelections(resolvedAvatarSelections);
            const selectedProducts = mergeMode === 'add'
              ? normalizeCloneSelections([...currentSelectedProducts, ...resolvedProductSelections])
              : normalizeCloneSelections(resolvedProductSelections);

            const sceneCount = await resolvePlannedCloneSceneCount();
            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });

            const primaryAvatar = getPrimaryCloneSelection(selectedAvatars);
            const primaryProduct = getPrimaryCloneSelection(selectedProducts);
            const nextPlanStatus: ClonePlanStatus = selectedAvatars.length > 0 || selectedProducts.length > 0 ? 'awaiting_confirmation' : 'collecting';
            await persistSession({
              avatar: primaryAvatar ? { id: primaryAvatar.id, name: primaryAvatar.name, photoUrl: primaryAvatar.photoUrl || '' } : null,
              product: primaryProduct ? { id: primaryProduct.id, name: primaryProduct.name } : null,
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                status: sessionState.cloneReplacementDraft?.status === 'ready' ? 'awaiting_confirmation' : (sessionState.cloneReplacementDraft?.status ?? 'idle'),
                error: null,
                selectedAvatars,
                selectedAvatar: primaryAvatar,
                selectedProducts,
                selectedProduct: primaryProduct,
                sceneAssignments,
                planStatus: nextPlanStatus,
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });

            return {
              success: true,
              selectedAvatarCount: selectedAvatars.length,
              selectedProductCount: selectedProducts.length,
              assignments: sceneAssignments,
              message: selectedAvatars.length > 0 || selectedProducts.length > 0
                ? 'Replacement selections updated. You can continue to draft review.'
                : 'Replacement selections cleared. Choose an avatar, a product, or both to continue.'
            };
          }
        }),
        clearCloneSelections: tool({
          description: 'Clear selected replacement avatars/products for clone planning.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              clearAvatars: { type: 'boolean' },
              clearProducts: { type: 'boolean' }
            },
            required: []
          }),
          execute: async ({ clearAvatars, clearProducts }) => {
            const shouldClearAvatars = clearAvatars !== false;
            const shouldClearProducts = clearProducts !== false;
            const selectedAvatars = shouldClearAvatars
              ? []
              : normalizeCloneSelections(
                  sessionState.cloneReplacementDraft?.selectedAvatars,
                  sessionState.cloneReplacementDraft?.selectedAvatar
                );
            const selectedProducts = shouldClearProducts
              ? []
              : normalizeCloneSelections(
                  sessionState.cloneReplacementDraft?.selectedProducts,
                  sessionState.cloneReplacementDraft?.selectedProduct
                );

            const sceneCount = await resolvePlannedCloneSceneCount();
            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });
            const primaryAvatar = getPrimaryCloneSelection(selectedAvatars);
            const primaryProduct = getPrimaryCloneSelection(selectedProducts);
            await persistSession({
              avatar: primaryAvatar ? { id: primaryAvatar.id, name: primaryAvatar.name, photoUrl: primaryAvatar.photoUrl || '' } : null,
              product: primaryProduct ? { id: primaryProduct.id, name: primaryProduct.name } : null,
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                status: sessionState.cloneReplacementDraft?.status === 'ready' ? 'awaiting_confirmation' : (sessionState.cloneReplacementDraft?.status ?? 'idle'),
                selectedAvatars,
                selectedAvatar: primaryAvatar,
                selectedProducts,
                selectedProduct: primaryProduct,
                sceneAssignments,
                planStatus: selectedAvatars.length > 0 || selectedProducts.length > 0 ? 'awaiting_confirmation' : 'collecting',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });
            return { success: true };
          }
        }),
        planCloneAssignments: tool({
          description: 'Build deterministic cartesian scene assignment preview using selected avatars/products.',
          inputSchema: emptySchema,
          execute: async () => {
            const selectedAvatars = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedAvatars,
              sessionState.cloneReplacementDraft?.selectedAvatar
            );
            const selectedProducts = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedProducts,
              sessionState.cloneReplacementDraft?.selectedProduct
            );
            if (
              selectedAvatars.length === 0 &&
              selectedProducts.length === 0 &&
              !sessionState.avatar?.id &&
              !sessionState.product?.id
            ) {
              return { success: false, message: 'Draft generation has not started yet. Please select at least one replacement avatar or product first.' };
            }

            const sceneCount = await resolvePlannedCloneSceneCount();
            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });
            await persistSession({
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                sceneAssignments,
                planStatus: 'awaiting_confirmation',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });
            return {
              success: true,
              assignments: sceneAssignments,
              message: selectedProducts.length === 0
                ? 'No product-specific scene assignments are needed for the current selections. You can continue to draft review.'
                : 'Scene assignments are ready to review.'
            };
          }
        }),
        updateSceneAssignment: tool({
          description: 'Update one scene assignment before confirmation when product replacement is part of the plan. Avatar override is optional.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              sceneIndex: { type: 'integer', minimum: 1 },
              avatarId: { type: 'string' },
              productId: { type: 'string' }
            },
            required: ['sceneIndex', 'productId']
          }),
          execute: async ({ sceneIndex, avatarId, productId }) => {
            const selectedAvatars = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedAvatars,
              sessionState.cloneReplacementDraft?.selectedAvatar
            );
            const selectedProducts = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedProducts,
              sessionState.cloneReplacementDraft?.selectedProduct
            );
            if (!selectedProducts.some((product) => product.id === productId)) {
              return { success: false, message: 'The selected product is not in the current replacement set.' };
            }
            if (avatarId && !selectedAvatars.some((avatar) => avatar.id === avatarId)) {
              return { success: false, message: 'The selected avatar is not in the current replacement set.' };
            }

            const sceneCount = await resolvePlannedCloneSceneCount();
            const autoAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });
            const assignmentMap = new Map(autoAssignments.map((assignment) => [assignment.sceneIndex, assignment] as const));
            assignmentMap.set(sceneIndex, {
              sceneIndex,
              avatarId: avatarId || null,
              productId,
              source: 'user_override'
            });
            const sceneAssignments = Array.from(assignmentMap.values()).sort((a, b) => a.sceneIndex - b.sceneIndex);

            await persistSession({
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                sceneAssignments,
                planStatus: 'awaiting_confirmation',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });
            return { success: true, assignments: sceneAssignments };
          }
        }),
        confirmCloneSelections: tool({
          description: 'Confirm replacement selections and lock plan using explicit confirmation token.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              token: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ token }) => {
            const confirmationText = (typeof token === 'string' && token.trim().length > 0) ? token : latestUserTurnText;
            if (!isReplacementConfirmationCommand(confirmationText)) {
              return {
                success: false,
                message: `Please confirm replacements by replying "${REPLACEMENT_CONFIRMATION_TOKEN}".`
              };
            }
            const selectedAvatars = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedAvatars,
              sessionState.cloneReplacementDraft?.selectedAvatar
            );
            const selectedProducts = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedProducts,
              sessionState.cloneReplacementDraft?.selectedProduct
            );
            if (
              selectedAvatars.length === 0 &&
              selectedProducts.length === 0 &&
              !sessionState.avatar?.id &&
              !sessionState.product?.id
            ) {
              return { success: false, message: 'Draft generation has not started yet. Please select at least one replacement avatar or product first.' };
            }
            const sceneCount = await resolvePlannedCloneSceneCount();
            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });
            const { selectedAvatarIds, selectedProductIds } = resolveCloneDraftSelections(sessionState);

            const confirmedAt = new Date().toISOString();
            await persistSession({
              cloneReplacementDraft: {
                ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                status: 'generating',
                sceneAssignments,
                planStatus: 'confirmed',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt,
                  confirmedByMessageId: normalizedIncomingMessage.id
                }
              }
            });

            const internalHeaders: HeadersInit = {
              'Content-Type': 'application/json',
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const draftResponse = await fetch(`${origin}/api/project-agent/clone-replacement-draft`, {
              method: 'POST',
              headers: internalHeaders,
              body: JSON.stringify({
                sessionId: resolvedSessionId,
                avatarId: selectedAvatarIds[0],
                productId: selectedProductIds[0],
                avatarIds: selectedAvatarIds,
                productIds: selectedProductIds,
                sceneAssignments
              })
            });
            const draftPayload = await draftResponse.json().catch(() => ({}));
            if (!draftResponse.ok || !draftPayload?.success || !draftPayload?.draft) {
              const errorMessage = draftPayload?.error || 'Replacement confirmation succeeded, but failed to prepare scene drafts.';
              await persistSession({
                cloneReplacementDraft: {
                  ...(sessionState.cloneReplacementDraft ?? { status: 'idle', error: null, scenes: [] }),
                  status: 'failed',
                  error: errorMessage,
                  sceneAssignments,
                  planStatus: 'confirmed',
                  confirmation: {
                    requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                    confirmedAt,
                    confirmedByMessageId: normalizedIncomingMessage.id
                  }
                }
              });
              return { success: false, message: errorMessage };
            }

            await persistSession({
              cloneReplacementDraft: draftPayload.draft as SessionState['cloneReplacementDraft']
            });
            return {
              success: true,
              assignments: sceneAssignments,
              scenes: Array.isArray(draftPayload.draft?.scenes) ? draftPayload.draft.scenes.length : 0
            };
          }
        }),
        generateCloneReplacementDraft: tool({
          description: 'Generate Step 3 replacement prompt draft from current selected avatar/product for clone workflow',
          inputSchema: emptySchema,
          execute: async () => {
            const gate = cloneDraftPrerequisiteGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }

            if (sessionState.cloneReplacementDraft?.status === 'generating') {
              return { success: true, message: 'Replacement draft generation is already in progress.' };
            }
            if (sessionState.cloneReplacementDraft?.status === 'ready' && (sessionState.cloneReplacementDraft?.scenes?.length || 0) > 0) {
              return { success: true, message: 'Replacement draft is already ready.' };
            }

            const {
              selectedAvatars,
              selectedAvatarIds,
              primaryAvatar,
              selectedProducts,
              selectedProductIds,
              primaryProduct
            } = resolveCloneDraftSelections(sessionState);

            if (selectedAvatarIds.length === 0 && selectedProductIds.length === 0) {
              return { success: false, message: 'Please select at least one replacement (avatar or product) first.' };
            }

            const generatingDraft = {
              status: 'generating' as const,
              planStatus: 'confirmed' as const,
              confirmation: sessionState.cloneReplacementDraft?.confirmation ?? {
                requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                confirmedAt: new Date().toISOString(),
                confirmedByMessageId: normalizedIncomingMessage.id
              },
              error: null,
              selectedAvatars,
              selectedAvatar: primaryAvatar,
              selectedProducts,
              selectedProduct: primaryProduct,
              sceneAssignments: sessionState.cloneReplacementDraft?.sceneAssignments ?? [],
              scenes: []
            };

            await persistSession({
              cloneReplacementDraft: generatingDraft
            });

            const internalHeaders: HeadersInit = {
              'Content-Type': 'application/json',
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const draftResponse = await fetch(`${origin}/api/project-agent/clone-replacement-draft`, {
              method: 'POST',
              headers: internalHeaders,
              body: JSON.stringify({
                sessionId: resolvedSessionId,
                avatarId: selectedAvatarIds[0],
                productId: selectedProductIds[0],
                avatarIds: selectedAvatarIds,
                productIds: selectedProductIds,
                sceneAssignments: sessionState.cloneReplacementDraft?.sceneAssignments ?? []
              })
            });

            const draftPayload = await draftResponse.json().catch(() => ({}));
            if (!draftResponse.ok || !draftPayload?.success || !draftPayload?.draft) {
              const errorMessage = draftPayload?.error || 'Failed to generate replacement prompts.';
              await persistSession({
                cloneReplacementDraft: {
                  ...generatingDraft,
                  status: 'failed',
                  error: errorMessage
                }
              });
              return { success: false, message: errorMessage };
            }

            await persistSession({
              cloneReplacementDraft: draftPayload.draft as SessionState['cloneReplacementDraft']
            });

            return {
              success: true,
              scenes: Array.isArray(draftPayload.draft?.scenes) ? draftPayload.draft.scenes.length : 0
            };
          }
        }),
        setPreferences: tool({
          description: 'Set language, duration, or aspect ratio',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              language: { type: 'string' },
              videoDurationSeconds: { type: 'integer' },
              videoAspectRatio: { type: 'string', enum: ['16:9', '9:16'] }
            },
            required: []
          }),
          execute: async ({ language, videoDurationSeconds, videoAspectRatio }) => {
            await persistSession({
              language: language ?? sessionState.language,
              videoDurationSeconds: videoDurationSeconds ?? sessionState.videoDurationSeconds,
              videoAspectRatio: videoAspectRatio ?? sessionState.videoAspectRatio,
              avatarSelection: {
                ...syncAvatarSelectionFromState(sessionState),
                durationSeconds: videoDurationSeconds ?? sessionState.videoDurationSeconds ?? 16,
                aspectRatio: videoAspectRatio ?? sessionState.videoAspectRatio ?? '9:16',
                language: language ?? sessionState.language ?? 'en'
              }
            });

            return { success: true };
          }
        }),
        setCustomDialogue: tool({
          description: 'Set or update custom dialogue/script for talking-head mode or guided ad script',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              customDialogue: { type: 'string' }
            },
            required: ['customDialogue']
          }),
          execute: async ({ customDialogue }) => {
            const trimmedDialogue = customDialogue.trim();
            const nextBaseDraft = sessionState.intent === 'avatar_ads'
              ? {
                  ...(sessionState.avatarDraft ?? {
                    status: 'ready' as const,
                    scenes: [],
                    imagePrompt: null,
                    scriptMode: 'user_script' as const,
                    scriptSource: '',
                    coverImageUrl: null,
                    error: null
                  }),
                  status: sessionState.avatarDraft?.status === 'failed' ? 'failed' as const : 'ready' as const,
                  scriptMode: 'user_script' as const,
                  scriptSource: trimmedDialogue
                }
              : sessionState.avatarDraft;
            const derivedAvatarState = sessionState.intent === 'avatar_ads' && nextBaseDraft
              ? deriveAvatarPromptState(sessionState, nextBaseDraft)
              : null;
            await persistSession({
              customDialogue: trimmedDialogue,
              videoDurationSeconds: derivedAvatarState?.promptState.totalDurationSeconds ?? sessionState.videoDurationSeconds,
              avatarDraft: sessionState.intent === 'avatar_ads'
                ? derivedAvatarState?.nextDraft ?? nextBaseDraft
                : sessionState.avatarDraft,
              generatedPrompts: derivedAvatarState?.promptState.generatedPrompts ?? sessionState.generatedPrompts,
              pendingUpdatedPrompts: derivedAvatarState?.promptState.generatedPrompts ?? sessionState.pendingUpdatedPrompts,
              avatarSelection: sessionState.intent === 'avatar_ads'
                ? {
                    ...syncAvatarSelectionFromState(sessionState),
                    durationSeconds: derivedAvatarState?.promptState.totalDurationSeconds ?? syncAvatarSelectionFromState(sessionState)?.durationSeconds
                  }
                : sessionState.avatarSelection,
              avatarStage: sessionState.intent === 'avatar_ads'
                ? 'avatar_workspace'
                : sessionState.avatarStage
            });

            return { success: true, customDialogue: trimmedDialogue };
          }
        }),
        draftAvatarAdsPrompts: tool({
          description: 'Draft avatar ad script and cover prompt from user guidance or multimodal product context, then auto-split the script into hidden Kling scenes.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              guidance: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ guidance }) => {
            if (sessionState.intent !== 'avatar_ads') {
              return { success: false, message: 'Avatar draft tooling is only available in avatar ads.' };
            }
            const avatar = sessionState.avatarSelection?.avatar ?? sessionState.avatar;
            if (!avatar?.photoUrl) {
              return { success: false, message: 'Select an avatar before drafting prompts.' };
            }

            let productSelection: { id: string; name: string; photoUrls: string[] } | null = null;
            const selectedProduct = sessionState.avatarSelection?.product ?? sessionState.product;
            if (selectedProduct?.id) {
              const { data: productRows, error: productError } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('user_id', userId)
                .eq('id', selectedProduct.id)
                .limit(1);

              if (productError) {
                return { success: false, message: 'Failed to load the selected product.' };
              }

              const productRow = (productRows ?? [])[0] as
                | { id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }
                | undefined;
              if (productRow) {
                const photoUrls = (productRow.user_product_photos || [])
                  .map((photo) => photo.photo_url || '')
                  .filter((photoUrl) => photoUrl.trim().length > 0);
                productSelection = {
                  id: productRow.id,
                  name: productRow.product_name,
                  photoUrls
                };
              }
            }

            const draft = await draftProjectAgentAvatarPrompts({
              avatar,
              product: productSelection,
              userIntentText: guidance || sessionState.customDialogue || '',
              durationSeconds: sessionState.avatarSelection?.durationSeconds ?? sessionState.videoDurationSeconds ?? 16,
              language: sessionState.avatarSelection?.language ?? sessionState.language ?? 'en',
              aspectRatio: sessionState.avatarSelection?.aspectRatio ?? sessionState.videoAspectRatio ?? '9:16'
            });

            const generatedPrompts = {
              image_prompt: draft.imagePrompt,
              scenes: draft.scenes.map((scene) => ({
                prompt: scene.prompt
              }))
            };

            await persistSession({
              customDialogue: draft.scriptSource,
              videoDurationSeconds: draft.totalDurationSeconds,
              generatedPrompts,
              pendingUpdatedPrompts: generatedPrompts,
              imagePrompt: draft.imagePrompt,
              avatarDraft: {
                status: 'ready',
                scriptMode: guidance?.trim() || sessionState.customDialogue?.trim() ? 'user_script' : 'agent_authored',
                scriptSource: draft.scriptSource,
                imagePrompt: draft.imagePrompt,
                scenes: draft.scenes,
                coverImageUrl: sessionState.avatarDraft?.coverImageUrl ?? null,
                error: null
              },
              avatarSelection: {
                ...syncAvatarSelectionFromState(sessionState),
                durationSeconds: draft.totalDurationSeconds
              },
              avatarStage: 'avatar_workspace'
            });

            return {
              success: true,
              scenes: draft.scenes.length,
              scriptSource: draft.scriptSource
            };
          }
        }),
        startAvatarCoverGeneration: tool({
          description: 'Create or reuse the avatar project and start cover generation from the current draft.',
          inputSchema: emptySchema,
          execute: async () => {
            if (sessionState.intent !== 'avatar_ads') {
              return { success: false, message: 'Avatar cover generation is only available in avatar ads.' };
            }
            const avatar = sessionState.avatarSelection?.avatar ?? sessionState.avatar;
            if (!avatar?.photoUrl) {
              return { success: false, message: 'Select an avatar before generating the cover.' };
            }
            const draft = sessionState.avatarDraft;
            if (!draft?.scenes?.length || !draft.imagePrompt) {
              return { success: false, message: 'Draft the script and prompts before generating the cover.' };
            }
            const { promptState, nextDraft } = deriveAvatarPromptState(sessionState, draft);

            const formData = new FormData();
            formData.set('user_id', userId);
            formData.set('video_duration_seconds', String(promptState.totalDurationSeconds));
            formData.set('image_size', (sessionState.avatarSelection?.aspectRatio ?? sessionState.videoAspectRatio) === '9:16' ? 'portrait_16_9' : 'landscape_16_9');
            formData.set('video_model', 'kling_3');
            formData.set('video_aspect_ratio', sessionState.avatarSelection?.aspectRatio ?? sessionState.videoAspectRatio ?? '9:16');
            formData.set('selected_person_photo_url', avatar.photoUrl);
            formData.set('language', sessionState.avatarSelection?.language ?? sessionState.language ?? 'en');
            formData.set('custom_dialogue', draft.scriptSource || sessionState.customDialogue || '');
            formData.set('prebuilt_prompts', JSON.stringify(promptState.generatedPrompts));
            formData.set('prebuilt_image_prompt', draft.imagePrompt);
            formData.set('start_at_step', 'generate_image');
            if (sessionState.projectId) {
              formData.set('project_id', sessionState.projectId);
            }
            const selectedProduct = sessionState.avatarSelection?.product ?? sessionState.product;
            if (selectedProduct?.id) {
              formData.set('selected_product_id', selectedProduct.id);
            } else {
              formData.set('talking_head_mode', 'true');
            }
            const internalTimestamp = String(Date.now());

            const response = await fetch(`${origin}/api/avatar-ads/create`, {
              method: 'POST',
              headers: {
                Cookie: request.headers.get('cookie') || '',
                'x-project-agent-internal': '1',
                'x-project-agent-user-id': userId,
                'x-project-agent-timestamp': internalTimestamp,
                'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
              },
              body: formData
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to start cover generation.' };
            }

            const nextProjectId = payload.id as string;
            await persistSession({
              projectId: nextProjectId,
              videoDurationSeconds: promptState.totalDurationSeconds,
              generatedPrompts: promptState.generatedPrompts,
              pendingUpdatedPrompts: promptState.generatedPrompts,
              avatarDraft: nextDraft,
              avatarSelection: {
                ...syncAvatarSelectionFromState(sessionState),
                durationSeconds: promptState.totalDurationSeconds
              },
              avatarStage: 'avatar_generating_cover',
              avatarExecution: {
                projectId: nextProjectId,
                phase: 'generating_cover',
                model: 'kling_3',
                finalVideoUrl: null,
                coverImageUrl: null,
                scenes: [],
                error: null
              }
            });

            return { success: true, projectId: nextProjectId };
          }
        }),
        regenerateAvatarCover: tool({
          description: 'Regenerate the avatar cover image from the current or updated image prompt.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              imagePrompt: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ imagePrompt }) => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Generate the first cover before regenerating it.' };
            }
            const nextImagePrompt = ensureAvatarImagePromptMentions({
              imagePrompt: imagePrompt?.trim() || sessionState.avatarDraft?.imagePrompt || sessionState.imagePrompt,
              avatarName: sessionState.avatarSelection?.avatar?.name ?? sessionState.avatar?.name ?? null,
              productName: sessionState.avatarSelection?.product?.name ?? sessionState.product?.name ?? null
            });
            if (!nextImagePrompt) {
              return { success: false, message: 'Image prompt is missing.' };
            }

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/regenerate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imagePrompt: nextImagePrompt })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to regenerate cover image.' };
            }

            await persistSession({
              imagePrompt: nextImagePrompt,
              avatarStage: 'avatar_generating_cover',
              avatarDraft: sessionState.avatarDraft ? {
                ...sessionState.avatarDraft,
                imagePrompt: nextImagePrompt
              } : sessionState.avatarDraft
            });

            return { success: true };
          }
        }),
        startAvatarVideoGeneration: tool({
          description: 'Start avatar video generation from the current workspace prompts.',
          inputSchema: emptySchema,
          execute: async () => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Generate the cover first before starting the video.' };
            }
            const promptState = sessionState.avatarDraft
              ? deriveAvatarPromptState(sessionState, sessionState.avatarDraft).promptState
              : null;
            const updatedPrompts = promptState?.generatedPrompts
              ?? sessionState.pendingUpdatedPrompts
              ?? sessionState.generatedPrompts
              ?? undefined;

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/confirm`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                updatedPrompts,
                totalDurationSeconds: promptState?.totalDurationSeconds ?? sessionState.videoDurationSeconds ?? 16
              })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to start avatar video generation.' };
            }

            await persistSession({
              videoDurationSeconds: promptState?.totalDurationSeconds ?? sessionState.videoDurationSeconds,
              pendingUpdatedPrompts: updatedPrompts,
              generatedPrompts: updatedPrompts,
              avatarSelection: promptState
                ? {
                    ...syncAvatarSelectionFromState(sessionState),
                    durationSeconds: promptState.totalDurationSeconds
                  }
                : sessionState.avatarSelection,
              avatarStage: 'avatar_generating_video'
            });

            return { success: true };
          }
        }),
        regenerateAvatarVideo: tool({
          description: 'Restart avatar video generation using the current workspace prompts.',
          inputSchema: emptySchema,
          execute: async () => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Avatar project is missing.' };
            }

            const promptState = sessionState.avatarDraft
              ? deriveAvatarPromptState(sessionState, sessionState.avatarDraft).promptState
              : null;
            const updatedPrompts = promptState?.generatedPrompts
              ?? sessionState.pendingUpdatedPrompts
              ?? sessionState.generatedPrompts
              ?? undefined;

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/regenerate-video`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                updatedPrompts,
                totalDurationSeconds: promptState?.totalDurationSeconds ?? sessionState.videoDurationSeconds ?? 16
              })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to regenerate avatar video.' };
            }

            await persistSession({
              videoDurationSeconds: promptState?.totalDurationSeconds ?? sessionState.videoDurationSeconds,
              pendingUpdatedPrompts: updatedPrompts,
              generatedPrompts: updatedPrompts,
              avatarSelection: promptState
                ? {
                    ...syncAvatarSelectionFromState(sessionState),
                    durationSeconds: promptState.totalDurationSeconds
                  }
                : sessionState.avatarSelection,
              avatarStage: 'avatar_generating_video'
            });

            return { success: true };
          }
        }),
        syncAvatarProjectStatus: tool({
          description: 'Fetch and persist the latest avatar agent project status.',
          inputSchema: emptySchema,
          execute: async () => {
            const projectId = sessionState.projectId || sessionState.avatarExecution?.projectId;
            if (!projectId) {
              return { success: false, message: 'Avatar project is missing.' };
            }

            const response = await fetch(`${origin}/api/avatar-ads/${projectId}/status`, {
              cache: 'no-store'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to load avatar project status.' };
            }

            const project = payload.project as Record<string, unknown>;
            const scenes = Array.isArray(payload.scenes) ? payload.scenes as Array<Record<string, unknown>> : [];
            const nextDraft = buildProjectAgentAvatarDraft(project as never, scenes as never, {
              avatarName: sessionState.avatarSelection?.avatar?.name ?? sessionState.avatar?.name ?? null,
              productName: sessionState.avatarSelection?.product?.name ?? sessionState.product?.name ?? null
            });
            const nextExecution = buildProjectAgentAvatarExecution(project as never, scenes as never);

            await persistSession({
              projectId,
              generatedPrompts: (project.generated_prompts as Record<string, unknown> | null) ?? null,
              imagePrompt: nextDraft?.imagePrompt ?? (typeof project.image_prompt === 'string' ? project.image_prompt : null),
              generatedImageUrl: typeof project.generated_image_url === 'string' ? project.generated_image_url : null,
              avatarDraft: nextDraft,
              avatarExecution: nextExecution,
              avatarStage: inferProjectAgentAvatarStage({
                hasAvatar: Boolean(syncAvatarSelectionFromState(sessionState)?.avatar?.id),
                hasDraft: Boolean(nextDraft?.scenes?.length),
                hasCover: Boolean(nextDraft?.coverImageUrl),
                projectStatus: typeof project.status === 'string' ? project.status : null,
                currentStep: typeof project.current_step === 'string' ? project.current_step : null,
                hasExecution: Boolean(nextExecution?.projectId)
              }),
              step: typeof project.status === 'string' ? project.status as SessionState['step'] : sessionState.step
            });

            return { success: true, status: project.status };
          }
        }),
        listMotionCloneReferenceVideos: tool({
          description: 'List eligible creator videos for motion clone reference selection',
          inputSchema: emptySchema,
          execute: async () => {
            const videos = await fetchMotionCloneReferenceVideos();
            return {
              success: true,
              videos: videos.filter((video) => Boolean(video.coverUrl))
            };
          }
        }),
        selectMotionCloneReferenceVideo: tool({
          description: 'Select one reference video for motion clone by id or description',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              referenceVideoId: { type: 'string' },
              description: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ referenceVideoId, description }) => {
            const match = await findMotionCloneReferenceVideo({ referenceVideoId, description });
            if (!match) {
              return { success: false, message: 'No matching reference video found.' };
            }
            if (!match.coverUrl) {
              return { success: false, message: 'This reference video is missing a first frame and cannot be used yet.' };
            }

            const baseState = buildFreshMotionCloneState(sessionState);
            await persistSession({
              ...baseState,
              motionClone: buildMotionCloneExecutionUpdate(baseState.motionClone, {
                phase: 'idle',
                referenceVideo: match,
                selectedAvatar: null,
                selectedProduct: null,
                photoPrompt: null,
                videoPrompt: null,
                previewImageUrl: null,
                outputVideoUrl: null,
                error: null,
                promptsInitialized: false,
                projectId: null
              })
            });

            return { success: true, referenceVideo: match };
          }
        }),
        setMotionCloneSelections: tool({
          description: 'Select the required avatar and optional product replacements for motion clone.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              avatarId: { type: 'string' },
              productId: { type: 'string' },
              clearAvatar: { type: 'boolean' },
              clearProduct: { type: 'boolean' }
            },
            required: []
          }),
          execute: async ({ avatarId, productId, clearAvatar, clearProduct }) => {
            const avatars = mergeAvatarOptions(await fetchUserAvatarOptions());
            const avatarMatch = avatarId
              ? avatars.find((avatar) => avatar.id === avatarId)
              : undefined;
            if (avatarId && (!avatarMatch || !avatarMatch.photo_url)) {
              return { success: false, message: 'The selected avatar was not found.' };
            }

            let productSelection: ProjectAgentMotionCloneSelection | null | undefined;
            if (productId) {
              const { data, error } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('user_id', userId)
                .eq('id', productId)
                .limit(1);
              if (error) {
                return { success: false, message: 'Failed to load the selected product.' };
              }
              const product = (data ?? [])[0] as
                | { id: string; product_name: string; user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }> }
                | undefined;
              if (!product) {
                return { success: false, message: 'The selected product was not found.' };
              }
              const photos = Array.isArray(product.user_product_photos) ? product.user_product_photos : [];
              const primaryPhoto = photos.find((photo) => photo.is_primary) || photos[0];
              productSelection = {
                id: product.id,
                name: product.product_name,
                photoUrl: primaryPhoto?.photo_url || null
              };
            }

            const selectedAvatar = clearAvatar
              ? null
              : avatarMatch
                ? {
                    id: avatarMatch.id,
                    name: avatarMatch.avatar_name || 'Unnamed Avatar',
                    photoUrl: avatarMatch.photo_url ?? null
                  }
                : (sessionState.motionClone?.selectedAvatar ?? null);
            const selectedProduct = clearProduct
              ? null
              : productSelection !== undefined
                ? productSelection
                : (sessionState.motionClone?.selectedProduct ?? null);
            const nextMotionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
              selectedAvatar,
              selectedProduct,
              error: null
            });

            await persistSession({
              avatar: selectedAvatar
                ? {
                    id: selectedAvatar.id,
                    name: selectedAvatar.name,
                    photoUrl: selectedAvatar.photoUrl || ''
                  }
                : null,
              product: selectedProduct
                ? {
                    id: selectedProduct.id,
                    name: selectedProduct.name
                  }
                : null,
              motionClone: nextMotionClone
            });

            return {
              success: true,
              selectedAvatar,
              selectedProduct,
              message: selectedAvatar || selectedProduct
                ? 'Motion clone selections updated. Prompts were refreshed based on the current avatar and product selections.'
                : 'Motion clone selections cleared.'
            };
          }
        }),
        setMotionClonePrompts: tool({
          description: 'Set or update image and video prompts for motion clone.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              photoPrompt: { type: 'string' },
              videoPrompt: { type: 'string' }
            },
            required: []
          }),
          execute: async ({ photoPrompt, videoPrompt }) => {
            await persistSession({
              motionClone: buildMotionCloneExecutionUpdate(sessionState.motionClone, {
                photoPrompt: typeof photoPrompt === 'string' ? photoPrompt.trim() : (sessionState.motionClone?.photoPrompt ?? null),
                videoPrompt: typeof videoPrompt === 'string' ? videoPrompt.trim() : (sessionState.motionClone?.videoPrompt ?? null),
                error: null,
                promptsInitialized: true
              })
            });
            return { success: true };
          }
        }),
        createMotionCloneProject: tool({
          description: 'Create an empty motion clone project after the reference and replacements are selected.',
          inputSchema: emptySchema,
          execute: async () => {
            if (!sessionState.motionClone?.referenceVideo?.id) {
              return { success: false, message: 'Reference video is required before creating a motion clone project.' };
            }
            if (!sessionState.motionClone?.selectedAvatar) {
              return { success: false, message: 'Select an avatar before creating the motion clone project.' };
            }
            if (sessionState.motionClone?.projectId) {
              const motionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
                stage: 'workspace'
              });
              await persistSession({
                intent: 'motion_clone',
                motionClone
              });
              return { success: true, projectId: sessionState.motionClone.projectId };
            }

            const internalTimestamp = String(Date.now());
            const response = await fetch(`${origin}/api/motion-clone/create`, {
              method: 'POST',
              headers: {
                Cookie: request.headers.get('cookie') || '',
                'x-project-agent-user-id': userId,
                'x-project-agent-timestamp': internalTimestamp,
                'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
              }
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.project?.id) {
              return { success: false, message: payload?.error || 'Failed to create motion clone project.' };
            }

            const motionClone = buildMotionCloneExecutionUpdate(sessionState.motionClone, {
              projectId: payload.project.id as string,
              phase: mapMotionClonePhaseFromStatus(payload.project.status),
              status: payload.project.status as string | null,
              stage: 'workspace'
            });
            await persistSession({
              intent: 'motion_clone',
              projectId: payload.project.id as string,
              motionClone
            });
            return { success: true, project: payload.project };
          }
        }),
        startMotionClonePreviewGeneration: tool({
          description: 'Start or regenerate the motion clone preview image.',
          inputSchema: emptySchema,
          execute: async () => {
            const projectId = sessionState.motionClone?.projectId || await resolveMotionCloneProjectId();
            const referenceVideoId = sessionState.motionClone?.referenceVideo?.id;
            const selectedAvatar = sessionState.motionClone?.selectedAvatar;
            const selectedProduct = sessionState.motionClone?.selectedProduct;
            if (!projectId) {
              return { success: false, message: 'Create the motion clone project first.' };
            }
            if (!referenceVideoId) {
              return { success: false, message: 'Reference video is missing.' };
            }
            if (!selectedAvatar) {
              return { success: false, message: 'Select an avatar before generation.' };
            }

            const internalTimestamp = String(Date.now());
            const response = await fetch(`${origin}/api/motion-clone/${projectId}/start`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: request.headers.get('cookie') || '',
                'x-project-agent-user-id': userId,
                'x-project-agent-timestamp': internalTimestamp,
                'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
              },
              body: JSON.stringify({
                reference_video_id: referenceVideoId,
                avatar_id: selectedAvatar?.id || undefined,
                product_id: selectedProduct?.id || undefined,
                photo_prompt: sessionState.motionClone?.photoPrompt || undefined,
                video_prompt: sessionState.motionClone?.videoPrompt || undefined,
                mode: normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality),
                action: 'image'
              })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to start preview generation.' };
            }

            const execution = toMotionCloneExecutionFromProject(payload.project, {
              referenceVideo: sessionState.motionClone?.referenceVideo || null,
              selectedAvatar: selectedAvatar || null,
              selectedProduct: selectedProduct || null
            });
            await persistSession({
              intent: 'motion_clone',
              projectId,
              motionClone: execution
            });

            return { success: true, project: payload.project };
          }
        }),
        startMotionCloneVideoGeneration: tool({
          description: 'Start motion clone video generation using the current preview or creating a new one if needed.',
          inputSchema: emptySchema,
          execute: async () => {
            const projectId = sessionState.motionClone?.projectId || await resolveMotionCloneProjectId();
            const referenceVideoId = sessionState.motionClone?.referenceVideo?.id;
            const selectedAvatar = sessionState.motionClone?.selectedAvatar;
            const selectedProduct = sessionState.motionClone?.selectedProduct;
            if (!projectId) {
              return { success: false, message: 'Create the motion clone project first.' };
            }
            if (!referenceVideoId) {
              return { success: false, message: 'Reference video is missing.' };
            }
            if (!selectedAvatar) {
              return { success: false, message: 'Select an avatar before generation.' };
            }

            const estimatedCredits = getMotionCloneGenerationCost(
              sessionState.motionClone?.referenceVideo?.durationSeconds,
              normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality)
            );
            const internalTimestamp = String(Date.now());
            const response = await fetch(`${origin}/api/motion-clone/${projectId}/start`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: request.headers.get('cookie') || '',
                'x-project-agent-user-id': userId,
                'x-project-agent-timestamp': internalTimestamp,
                'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
              },
              body: JSON.stringify({
                reference_video_id: referenceVideoId,
                avatar_id: selectedAvatar?.id || undefined,
                product_id: selectedProduct?.id || undefined,
                photo_prompt: sessionState.motionClone?.photoPrompt || undefined,
                video_prompt: sessionState.motionClone?.videoPrompt || undefined,
                mode: normalizeMotionCloneQuality(sessionState.motionClone?.videoQuality),
                action: 'video'
              })
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 402) {
              return {
                success: false,
                message: payload?.error || 'Insufficient credits.',
                required: payload?.required ?? estimatedCredits ?? null,
                remaining: payload?.remaining ?? null
              };
            }
            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to start motion clone video generation.' };
            }

            const execution = toMotionCloneExecutionFromProject(payload.project, {
              referenceVideo: sessionState.motionClone?.referenceVideo || null,
              selectedAvatar: selectedAvatar || null,
              selectedProduct: selectedProduct || null
            });
            await persistSession({
              intent: 'motion_clone',
              projectId,
              motionClone: execution
            });

            return { success: true, project: payload.project, requiredCredits: execution.creditsCost };
          }
        }),
        syncMotionCloneStatus: tool({
          description: 'Fetch and persist the latest motion clone status for the current project.',
          inputSchema: emptySchema,
          execute: async () => {
            const projectId = sessionState.motionClone?.projectId || await resolveMotionCloneProjectId();
            if (!projectId) {
              return { success: false, message: 'Motion clone project is missing.' };
            }

            const response = await fetch(`${origin}/api/motion-clone/${projectId}/status`, {
              cache: 'no-store'
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to load motion clone status.' };
            }

            const execution = toMotionCloneExecutionFromProject(payload.project, {
              referenceVideo: sessionState.motionClone?.referenceVideo || null,
              selectedAvatar: sessionState.motionClone?.selectedAvatar || null,
              selectedProduct: sessionState.motionClone?.selectedProduct || null
            });
            await persistSession({
              intent: 'motion_clone',
              projectId,
              motionClone: execution
            });
            return { success: true, project: payload.project };
          }
        }),
        createAvatarAdsProject: tool({
          description: 'Create the avatar ads project once all inputs are confirmed',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              confirm: { type: 'boolean' }
            },
            required: ['confirm']
          }),
          execute: async ({ confirm }) => {
            if (!confirm) {
              return { success: false, message: 'Awaiting confirmation.' };
            }

            if (!sessionState.avatar) {
              return { success: false, message: 'Avatar is required before creation.' };
            }

            const hasProduct = Boolean(sessionState.product);
            const hasCustomDialogue = Boolean(sessionState.customDialogue?.trim());
            if (!hasProduct && !hasCustomDialogue) {
              return {
                success: false,
                message: 'Provide a product or a custom dialogue script before creation.'
              };
            }

            const duration = sessionState.videoDurationSeconds ?? 16;
            const aspect = sessionState.videoAspectRatio ?? '9:16';
            const imageSize = aspect === '9:16' ? 'portrait_16_9' : 'landscape_16_9';

            const formData = new FormData();
            formData.set('user_id', userId);
            formData.set('video_duration_seconds', duration.toString());
            formData.set('image_size', imageSize);
            formData.set('video_model', getEffectiveProjectAgentVideoModel('avatar_ads', sessionState.videoModel));
            formData.set('video_aspect_ratio', aspect);
            formData.set('selected_person_photo_url', sessionState.avatar.photoUrl);
            formData.set('language', sessionState.language ?? 'en');
            if (sessionState.product?.id) {
              formData.set('selected_product_id', sessionState.product.id);
            }
            if (sessionState.customDialogue?.trim()) {
              formData.set('custom_dialogue', sessionState.customDialogue.trim());
            }
            if (!hasProduct && hasCustomDialogue) {
              formData.set('talking_head_mode', 'true');
            }

            const response = await fetch(`${origin}/api/avatar-ads/create`, {
              method: 'POST',
              body: formData
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to create project.' };
            }

            await persistSession({
              projectId: payload.id,
              step: 'creating'
            });

            return { success: true, project: payload };
          }
        }),
        updatePromptEdits: tool({
          description: 'Store updated prompts JSON for video generation confirmation',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              updatedPrompts: { type: 'object' }
            },
            required: ['updatedPrompts']
          }),
          execute: async ({ updatedPrompts }) => {
            await persistSession({
              pendingUpdatedPrompts: updatedPrompts
            });

            return { success: true };
          }
        }),
        regenerateImage: tool({
          description: 'Regenerate cover image with an updated image prompt',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              imagePrompt: { type: 'string' }
            },
            required: ['imagePrompt']
          }),
          execute: async ({ imagePrompt }) => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }
            const nextImagePrompt = ensureAvatarImagePromptMentions({
              imagePrompt,
              avatarName: sessionState.avatarSelection?.avatar?.name ?? sessionState.avatar?.name ?? null,
              productName: sessionState.avatarSelection?.product?.name ?? sessionState.product?.name ?? null
            });

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/regenerate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imagePrompt: nextImagePrompt })
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to regenerate image.' };
            }

            await persistSession({
              imagePrompt: nextImagePrompt,
              step: 'regenerating_image'
            });

            return { success: true, project: payload.project };
          }
        }),
        confirmVideoGeneration: tool({
          description: 'Confirm prompts and start video generation',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              confirm: { type: 'boolean' }
            },
            required: ['confirm']
          }),
          execute: async ({ confirm }) => {
            if (!confirm) {
              return { success: false, message: 'Awaiting confirmation.' };
            }

            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }

            const updatedPrompts = sessionState.pendingUpdatedPrompts ?? sessionState.generatedPrompts ?? undefined;

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/confirm`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ updatedPrompts })
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to start video generation.' };
            }

            await persistSession({
              step: 'generating_videos'
            });

            return { success: true, project: payload.project };
          }
        }),
        startCloneGenerationFromDraft: tool({
          description: 'Start clone generation from Step 3 draft (chat-driven, no UI button).',
          inputSchema: emptySchema,
          execute: async () => {
            const gate = cloneExecutionGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }

            const draft = sessionState.cloneReplacementDraft;
            if (!draft || draft.status !== 'ready' || !Array.isArray(draft.scenes) || draft.scenes.length === 0) {
              return { success: false, message: 'Replacement draft is not ready yet.' };
            }

            const selectedProducts = normalizeCloneSelections(
              draft.selectedProducts,
              draft.selectedProduct
            );
            const { selectedAvatarIds, selectedProductIds } = resolveCloneDraftSelections(sessionState);
            const selectedAvatarId = selectedAvatarIds[0] || undefined;
            const selectedProductId = selectedProductIds[0] || undefined;
            const primaryProduct = getPrimaryCloneSelection(selectedProducts);
            const selectedProductImageUrl = primaryProduct?.photoUrl || draft.selectedProduct?.photoUrl || undefined;

            const segmentPrompts = draft.scenes.map((scene) => (
              cloneDraftSceneToSegmentPrompt(scene, sessionState.language ?? 'en')
            ));
            const videoDuration = String(segmentPrompts.reduce(
              (total, segment) => total + getProjectAgentSegmentPromptDurationSeconds(segment),
              0
            ));
            const normalizedModel = 'kling_3' as const;
            const cloneReferenceVideo = sessionState.cloneReferenceVideo;
            if (!cloneReferenceVideo) {
              return { success: false, message: 'Reference video is missing.' };
            }

            const createPayload: Record<string, unknown> = {
              userId,
              imageUrl: selectedProductImageUrl,
              selectedAvatarId,
              selectedProductId,
              selectedAvatarIds,
              selectedProductIds,
              videoModel: normalizedModel,
              videoQuality: 'standard',
              videoAspectRatio: sessionState.videoAspectRatio || '9:16',
              videoDuration,
              language: sessionState.language || 'en',
              shouldGenerateVideo: true,
              segmentPrompts,
              requestSource: 'project_agent_clone'
            };
            if (cloneReferenceVideo.sourceType === 'competitor_ad') {
              createPayload.competitorAdId = cloneReferenceVideo.sourceId || cloneReferenceVideo.id;
            } else {
              createPayload.creatorSourceVideoId = cloneReferenceVideo.id || cloneReferenceVideo.sourceId;
            }

            await persistSession({
              pendingMergeConfirmation: null,
              cloneExecution: {
                projectId: '',
                phase: 'generating_frames',
                model: normalizedModel,
                duration: videoDuration,
                creditsCost: undefined,
                segments: segmentPrompts.map((prompt, index) => ({
                  segmentIndex: index,
                  status: 'queued',
                  prompt
                }))
              }
            });

            const internalTimestamp = String(Date.now());
            const createResponse = await fetch(`${origin}/api/competitor-ugc-replication/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Cookie: request.headers.get('cookie') || '',
                'x-project-agent-user-id': userId,
                'x-project-agent-timestamp': internalTimestamp,
                'x-project-agent-signature': signInternalUserRequest(userId, internalTimestamp),
              },
              body: JSON.stringify(createPayload)
            });
            const createPayloadResult = await createResponse.json();
            if (!createResponse.ok || !createPayloadResult?.success || !createPayloadResult?.projectId) {
              const errorMessage = createPayloadResult?.error || 'Failed to start clone generation.';
              await persistSession({
                cloneExecution: {
                  projectId: '',
                  phase: 'failed',
                  error: errorMessage,
                  segments: []
                }
              });
              return { success: false, message: errorMessage };
            }

            const projectId = createPayloadResult.projectId as string;
            const internalHeaders: HeadersInit = {
              'x-project-agent-internal': '1',
              'x-project-agent-user-id': userId
            };
            const statusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const statusPayload = await statusResponse.json().catch(() => ({}));

            if (statusResponse.ok && statusPayload?.data) {
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: toCloneExecutionFromStatusPayload(projectId, statusPayload as Record<string, unknown>)
              });
            } else {
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: {
                  projectId,
                  phase: 'generating_frames',
                  model: normalizedModel,
                  duration: videoDuration,
                  segments: []
                }
              });
            }

            return {
              success: true,
              projectId,
              message: 'Clone frame generation has started.'
            };
          }
        }),
        startCloneVideoGeneration: tool({
          description: 'Start clone video generation from reviewed first frames for the current competitor clone project',
          inputSchema: emptySchema,
          execute: async () => {
            const gate = cloneExecutionGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }
            const projectId = await resolveCloneProjectId();
            if (!projectId) {
              return { success: false, message: 'Clone project is not initialized yet.' };
            }

            const internalHeaders: HeadersInit = {
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const latestDraftScenes = Array.isArray(sessionState.cloneReplacementDraft?.scenes)
              ? sessionState.cloneReplacementDraft.scenes
              : [];
            if (latestDraftScenes.length > 0) {
              const syncFailures: string[] = [];
              for (let index = 0; index < latestDraftScenes.length; index += 1) {
                const promptOverride = cloneDraftSceneToSegmentPrompt(
                  latestDraftScenes[index],
                  sessionState.language ?? 'en'
                );
                const syncResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/segments/${index}`, {
                  method: 'PATCH',
                  headers: {
                    ...internalHeaders,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ prompt: promptOverride })
                });
                if (!syncResponse.ok) {
                  const syncPayload = await syncResponse.json().catch(() => ({}));
                  syncFailures.push(`Scene ${index + 1}: ${syncPayload?.error || 'Failed to sync prompt edits before video generation.'}`);
                }
              }

              if (syncFailures.length > 0) {
                return {
                  success: false,
                  message: syncFailures.join(' | ')
                };
              }
            }

            const precheckStatusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const precheckStatusPayload = await precheckStatusResponse.json().catch(() => ({}));
            if (precheckStatusResponse.ok && precheckStatusPayload?.data) {
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: toCloneExecutionFromStatusPayload(projectId, precheckStatusPayload as Record<string, unknown>)
              });

              const precheckData = precheckStatusPayload.data as Record<string, unknown>;
              const segmentStatus = (precheckData.segmentStatus && typeof precheckData.segmentStatus === 'object')
                ? precheckData.segmentStatus as Record<string, unknown>
                : null;
              const total = Number(segmentStatus?.total ?? 0);
              const framesReady = Number(segmentStatus?.framesReady ?? 0);

              if (total > 0 && framesReady < total) {
                return {
                  success: false,
                  message: `Frames are still generating (${framesReady}/${total} ready). Please wait until all frames are ready, then start video generation.`
                };
              }
            }

            const startResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/start-video`, {
              method: 'POST',
              headers: internalHeaders
            });
            const startPayload = await startResponse.json().catch(() => ({}));
            const generationCost = typeof startPayload?.generationCost === 'number'
              ? startPayload.generationCost
              : undefined;

            if (!startResponse.ok) {
              if (startResponse.status === 402) {
                const requiredCredits = typeof startPayload?.requiredCredits === 'number'
                  ? startPayload.requiredCredits
                  : generationCost;
                const currentCredits = typeof startPayload?.currentCredits === 'number'
                  ? startPayload.currentCredits
                  : undefined;
                if (typeof requiredCredits === 'number') {
                  const failureMessage = typeof currentCredits === 'number'
                    ? `Video generation did not start. It needs ${requiredCredits} credits, but you currently have ${currentCredits}. Please top up and then send "start video generation" again.`
                    : `Video generation did not start. It needs ${requiredCredits} credits. Please top up and then send "start video generation" again.`;
                  await persistSession({
                    pendingMergeConfirmation: null,
                    cloneExecution: {
                      ...(sessionState.cloneExecution ?? {
                        projectId,
                        phase: 'reviewing_frames' as const,
                        segments: []
                      }),
                      projectId,
                      error: failureMessage
                    }
                  });
                  return {
                    success: false,
                    message: failureMessage
                  };
                }
              }

              const failureMessage = startPayload?.error || 'Failed to start clone video generation.';
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: {
                  ...(sessionState.cloneExecution ?? {
                    projectId,
                    phase: 'reviewing_frames' as const,
                    segments: []
                  }),
                  projectId,
                  error: failureMessage
                }
              });
              return { success: false, message: failureMessage };
            }

            // Optimistic phase transition: backend may still report frame-phase for a short time
            // after queueing video generation. Keep UI aligned with user intent immediately.
            const previousExecution = sessionState.cloneExecution;
            await persistSession({
              pendingMergeConfirmation: null,
              cloneExecution: {
                projectId,
                phase: 'generating_videos',
                model: previousExecution?.model,
                duration: previousExecution?.duration,
                creditsCost: generationCost ?? previousExecution?.creditsCost,
                error: null,
                mergedVideoUrl: previousExecution?.mergedVideoUrl ?? null,
                segments: previousExecution?.segments ?? []
              }
            });

            const statusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const statusPayload = await statusResponse.json().catch(() => ({}));
            if (statusResponse.ok && statusPayload?.data) {
              const mapped = toCloneExecutionFromStatusPayload(projectId, statusPayload as Record<string, unknown>);
              const normalized = mapped.phase === 'generating_frames'
                ? { ...mapped, phase: 'generating_videos' as const }
                : mapped;
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: normalized
              });
            }

            return {
              success: true,
              generationCost,
              message: typeof generationCost === 'number'
                ? `Clone video generation has started. This run will use ${generationCost} credits.`
                : 'Clone video generation has started.'
            };
          }
        }),
        regenerateCloneFrames: tool({
          description: 'Regenerate clone frame for one specific scene number; sceneIndex is 1-based.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              sceneIndex: { type: 'integer', minimum: 1 }
            },
            required: []
          }),
          execute: async ({ sceneIndex }) => {
            const gate = cloneExecutionGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }
            const projectId = await resolveCloneProjectId();
            if (!projectId) {
              return { success: false, message: 'Clone project is not initialized yet.' };
            }

            const resolvedSceneIndex = typeof sceneIndex === 'number' ? sceneIndex : inferredSceneIndexFromTurn;
            if (typeof resolvedSceneIndex !== 'number' || !Number.isFinite(resolvedSceneIndex) || resolvedSceneIndex < 1) {
              return {
                success: false,
                message: 'Please specify exactly which scene to regenerate, for example: "regenerate scene 2 frame".'
              };
            }

            const internalHeaders: HeadersInit = {
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const statusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const statusPayload = await statusResponse.json().catch(() => ({}));
            if (!statusResponse.ok || !statusPayload?.data) {
              return { success: false, message: statusPayload?.error || 'Failed to load clone status before regeneration.' };
            }

            const segments = Array.isArray((statusPayload.data as Record<string, unknown>).segments)
              ? (statusPayload.data as Record<string, unknown>).segments as Array<Record<string, unknown>>
              : [];
            if (segments.length === 0) {
              return { success: false, message: 'No segments available to regenerate.' };
            }

            const targetIndex = Math.max(0, resolvedSceneIndex - 1);
            const segmentExists = segments.some((segment) => Number(segment.index ?? -1) === targetIndex);
            if (!segmentExists) {
              return {
                success: false,
                message: `Scene ${resolvedSceneIndex} does not exist in this project.`
              };
            }

            const targetIndices = [targetIndex];
            const latestDraftScenes = Array.isArray(sessionState.cloneReplacementDraft?.scenes)
              ? sessionState.cloneReplacementDraft.scenes
              : [];

            const failures: Array<{ index: number; error: string }> = [];
            const regeneratedIndices: number[] = [];
            const alreadyInProgressIndices: number[] = [];
            for (const index of targetIndices) {
              const draftScene = latestDraftScenes[index];
              const promptOverride = draftScene
                ? cloneDraftSceneToSegmentPrompt(draftScene, sessionState.language ?? 'en')
                : undefined;
              const regenerateResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/segments/${index}`, {
                method: 'PATCH',
                headers: {
                  ...internalHeaders,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  regenerate: 'photo',
                  ...(promptOverride ? { prompt: promptOverride } : {})
                })
              });
              const regeneratePayload = await regenerateResponse.json().catch(() => ({}));
              if (!regenerateResponse.ok) {
                const errorMessage = regeneratePayload?.error || 'Failed to regenerate frame.';
                const normalizedError = String(errorMessage).toLowerCase();
                // Treat in-progress 409 as non-fatal so we don't repeatedly retry the same scene.
                if (
                  regenerateResponse.status === 409 &&
                  (
                    normalizedError.includes('already in progress') ||
                    normalizedError.includes('already running')
                  )
                ) {
                  alreadyInProgressIndices.push(index);
                  continue;
                }
                failures.push({
                  index,
                  error: (
                    regenerateResponse.status === 409 &&
                    normalizedError.includes('previous segment frame not ready')
                  )
                    ? `Scene ${index + 1} depends on Scene ${index}. Please wait for Scene ${index} frame to be ready, then retry Scene ${index + 1}.`
                    : errorMessage
                });
                continue;
              }
              regeneratedIndices.push(index);
            }

            const refreshedStatusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const refreshedStatusPayload = await refreshedStatusResponse.json().catch(() => ({}));
            if (refreshedStatusResponse.ok && refreshedStatusPayload?.data) {
              const refreshedExecution = toCloneExecutionFromStatusPayload(projectId, refreshedStatusPayload as Record<string, unknown>);
              const targetSceneIndexes = new Set(targetIndices);
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: {
                  ...refreshedExecution,
                  phase: 'generating_frames',
                  segments: (refreshedExecution.segments ?? []).map((segment) => (
                    targetSceneIndexes.has(segment.segmentIndex)
                      ? {
                          ...segment,
                          status: 'generating_first_frame',
                          videoUrl: null,
                        }
                      : segment
                  ))
                }
              });
            }

            if (
              failures.length > 0 &&
              regeneratedIndices.length === 0 &&
              alreadyInProgressIndices.length === 0
            ) {
              return {
                success: false,
                message: failures.map((failure) => `Scene ${failure.index + 1}: ${failure.error}`).join(' | ')
              };
            }

            return {
              success: true,
              regeneratedScenes: regeneratedIndices.map((index) => index + 1),
              alreadyInProgressScenes: alreadyInProgressIndices.map((index) => index + 1),
              partialFailures: failures
            };
          }
        }),
        regenerateCloneVideos: tool({
          description: 'Regenerate clone video for one specific scene number; sceneIndex is 1-based.',
          inputSchema: jsonSchema({
            type: 'object',
            properties: {
              sceneIndex: { type: 'integer', minimum: 1 }
            },
            required: []
          }),
          execute: async ({ sceneIndex }) => {
            const gate = cloneExecutionGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }
            const projectId = await resolveCloneProjectId();
            if (!projectId) {
              return { success: false, message: 'Clone project is not initialized yet.' };
            }

            const resolvedSceneIndex = typeof sceneIndex === 'number' ? sceneIndex : inferredSceneIndexFromTurn;
            if (typeof resolvedSceneIndex !== 'number' || !Number.isFinite(resolvedSceneIndex) || resolvedSceneIndex < 1) {
              return {
                success: false,
                message: 'Please specify exactly which scene video to regenerate, for example: "regenerate scene 2 video".'
              };
            }

            const internalHeaders: HeadersInit = {
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const statusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const statusPayload = await statusResponse.json().catch(() => ({}));
            if (!statusResponse.ok || !statusPayload?.data) {
              return { success: false, message: statusPayload?.error || 'Failed to load clone status before video regeneration.' };
            }

            const segments = Array.isArray((statusPayload.data as Record<string, unknown>).segments)
              ? (statusPayload.data as Record<string, unknown>).segments as Array<Record<string, unknown>>
              : [];
            if (segments.length === 0) {
              return { success: false, message: 'No segments available to regenerate.' };
            }

            const targetIndex = Math.max(0, resolvedSceneIndex - 1);
            const segmentExists = segments.some((segment) => Number(segment.index ?? -1) === targetIndex);
            if (!segmentExists) {
              return {
                success: false,
                message: `Scene ${resolvedSceneIndex} does not exist in this project.`
              };
            }

            const regenerateResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/segments/${targetIndex}`, {
              method: 'PATCH',
              headers: {
                ...internalHeaders,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                regenerate: 'video',
                ...(
                  Array.isArray(sessionState.cloneReplacementDraft?.scenes) &&
                  sessionState.cloneReplacementDraft.scenes[targetIndex]
                    ? {
                        prompt: cloneDraftSceneToSegmentPrompt(
                          sessionState.cloneReplacementDraft.scenes[targetIndex],
                          sessionState.language ?? 'en'
                        )
                      }
                    : {}
                )
              })
            });
            const regeneratePayload = await regenerateResponse.json().catch(() => ({}));
            if (!regenerateResponse.ok) {
              return { success: false, message: regeneratePayload?.error || 'Failed to regenerate scene video.' };
            }

            const refreshedStatusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const refreshedStatusPayload = await refreshedStatusResponse.json().catch(() => ({}));
            if (refreshedStatusResponse.ok && refreshedStatusPayload?.data) {
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: toCloneExecutionFromStatusPayload(projectId, refreshedStatusPayload as Record<string, unknown>)
              });
            }

            return {
              success: true,
              regeneratedScenes: [targetIndex + 1],
              message: `Scene ${targetIndex + 1} video regeneration started.`
            };
          }
        }),
        mergeCloneVideos: tool({
          description: 'Create the final video from generated scene videos when the project is awaiting finalization',
          inputSchema: emptySchema,
          execute: async () => {
            const gate = cloneExecutionGate();
            if (!gate.ok) {
              return { success: false, message: gate.message };
            }
            const projectId = await resolveCloneProjectId();
            if (!projectId) {
              return { success: false, message: 'Clone project is not initialized yet.' };
            }

            const needsMergeConfirmation = (
              !sessionState.pendingMergeConfirmation ||
              sessionState.pendingMergeConfirmation.projectId !== projectId ||
              !isMergeConfirmationCommand(latestUserTurnText)
            );
            if (needsMergeConfirmation) {
              await persistSession({
                pendingMergeConfirmation: {
                  projectId,
                  requestedAt: new Date().toISOString(),
                  token: MERGE_CONFIRMATION_TOKEN
                }
              });
              return {
                success: false,
                message: `If all scene videos look good, reply "${MERGE_CONFIRMATION_TOKEN}" and I will create the final video for you.`
              };
            }

            const internalHeaders: HeadersInit = {
              'x-project-agent-internal': '1'
            };
            if (userId) {
              internalHeaders['x-project-agent-user-id'] = userId;
            }

            const precheckResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const precheckPayload = await precheckResponse.json().catch(() => ({}));
            if (!precheckResponse.ok || !precheckPayload?.data) {
              return { success: false, message: precheckPayload?.error || 'Failed to verify final-video readiness.' };
            }
            const precheckData = precheckPayload.data as Record<string, unknown>;
            const currentStep = typeof precheckPayload.current_step === 'string' ? precheckPayload.current_step : '';
            const workflowStatus = typeof precheckPayload.status === 'string' ? precheckPayload.status : '';
            const segments = Array.isArray(precheckData.segments) ? precheckData.segments as Array<Record<string, unknown>> : [];
            const allVideosReady = segments.length > 0 && segments.every((segment) => typeof segment.videoUrl === 'string' && segment.videoUrl.length > 0);
            const isAwaitingMerge = currentStep === 'awaiting_merge' || workflowStatus === 'awaiting_merge';
            if (!isAwaitingMerge || !allVideosReady) {
              return {
                success: false,
                message: 'Your final video is not ready yet. You can continue regenerating scene frames/videos, then create the final video once all scenes are ready.'
              };
            }

            const mergeResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/merge`, {
              method: 'POST',
              headers: internalHeaders
            });
            const mergePayload = await mergeResponse.json().catch(() => ({}));
            if (!mergeResponse.ok) {
              return { success: false, message: mergePayload?.error || 'Failed to start creating the final video.' };
            }

            const statusResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
              cache: 'no-store',
              headers: internalHeaders
            });
            const statusPayload = await statusResponse.json().catch(() => ({}));
            if (statusResponse.ok && statusPayload?.data) {
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: toCloneExecutionFromStatusPayload(projectId, statusPayload as Record<string, unknown>)
              });
            }

            return {
              success: true,
              message: `Final video creation has started. Please wait about 10-20 seconds, then go to My Ads to view details and download it. ${getNextCloneCanonicalGuidance()}`
            };
          }
        }),
        syncProjectStatus: tool({
          description: 'Fetch the latest project status and prompts for the current project',
          inputSchema: emptySchema,
          execute: async () => {
            if (!sessionState.projectId) {
              return { success: false, message: 'Project is missing.' };
            }

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/status`, {
              cache: 'no-store'
            });
            const payload = await response.json();

            if (!response.ok || !payload?.project) {
              return { success: false, message: payload?.error || 'Failed to fetch status.' };
            }

            const nextDraft = buildProjectAgentAvatarDraft(payload.project as never, payload.scenes as never, {
              avatarName: sessionState.avatarSelection?.avatar?.name ?? sessionState.avatar?.name ?? null,
              productName: sessionState.avatarSelection?.product?.name ?? sessionState.product?.name ?? null
            });
            const nextExecution = buildProjectAgentAvatarExecution(payload.project as never, payload.scenes as never);

            await persistSession({
              step: payload.project.status === 'awaiting_review' ? 'awaiting_review' : sessionState.step,
              generatedPrompts: payload.project.generated_prompts ?? null,
              imagePrompt: nextDraft?.imagePrompt ?? payload.project.image_prompt ?? null,
              generatedImageUrl: payload.project.generated_image_url ?? null,
              avatarDraft: nextDraft,
              avatarExecution: nextExecution,
              avatarStage: inferProjectAgentAvatarStage({
                hasAvatar: Boolean(syncAvatarSelectionFromState(sessionState)?.avatar?.id),
                hasDraft: Boolean(nextDraft?.scenes?.length),
                hasCover: Boolean(nextDraft?.coverImageUrl),
                projectStatus: payload.project.status,
                currentStep: payload.project.current_step,
                hasExecution: Boolean(nextExecution?.projectId)
              })
            });

            return { success: true, project: payload.project };
          }
        })
      }
    });

    const finalizeNonce = Date.now().toString(36);
    let finalMessagesFromStream: UIMessage[] = [];
    let streamedAssistantTextVisible = false;
    let resolveStreamFinish: (() => void) | null = null;
    const streamFinished = new Promise<void>((resolve) => {
      resolveStreamFinish = resolve;
    });

    const mergedStream = result.toUIMessageStream<UIMessage>({
      onFinish: ({ messages: finalMessages }) => {
        finalMessagesFromStream = dedupeMessages(
          finalMessages.map((message, index) => normalizeUIMessage(message, `final-${finalizeNonce}-${index}`))
        );
        resolveStreamFinish?.();
      }
    });

    const stream = createUIMessageStream<UIMessage>({
      execute: async ({ writer }) => {
        const reader = mergedStream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value.type === 'text-delta' && typeof value.delta === 'string' && value.delta.trim().length > 0) {
            streamedAssistantTextVisible = true;
          }

          writer.write(value);
        }

        await streamFinished;

        // Preserve existing timeline exactly as-is, and only append genuinely new
        // streamed messages. Never overwrite prior history by id.
        const existingIds = new Set(conversationMessages.map((message) => message.id));
        const messagesToPersist = [...conversationMessages];
        for (const message of finalMessagesFromStream) {
          if (existingIds.has(message.id)) {
            continue;
          }

          const previous = messagesToPersist[messagesToPersist.length - 1];
          const previousText = previous ? messageText(previous) : '';
          const nextText = messageText(message);
          if (previous && previous.role === message.role && previousText && previousText === nextText) {
            continue;
          }

          messagesToPersist.push(message);
          existingIds.add(message.id);
        }

        // Guardrail: certain tool-heavy turns may finish without a visible assistant text.
        // In that case we generate one contextual AI reply, stream it to the client,
        // and persist it so the UI never gets stuck waiting on a silent turn.
        const hasAssistantAfterLatestUser = (() => {
          let latestUserIndex = -1;
          let latestAssistantIndex = -1;
          messagesToPersist.forEach((msg, index) => {
            if (msg.role === 'user' && messageText(msg).length > 0) latestUserIndex = index;
            if (msg.role === 'assistant' && messageText(msg).length > 0) latestAssistantIndex = index;
          });
          return latestAssistantIndex > latestUserIndex;
        })();

        if (!hasAssistantAfterLatestUser && !streamedAssistantTextVisible) {
          const guardedReply = await buildCloneSelectionNeededReply({ requireProgressTurn: false });
          const fallbackReply = guardedReply || await buildWorkflowFallbackReply({
            latestUserTurnText,
            state: sessionState,
            model
          });
          if (fallbackReply) {
            const fallbackId = `assistant-fallback-${Date.now().toString(36)}`;
            writer.write({ type: 'text-start', id: fallbackId });
            writer.write({ type: 'text-delta', id: fallbackId, delta: fallbackReply });
            writer.write({ type: 'text-end', id: fallbackId });

            messagesToPersist.push({
              id: fallbackId,
              role: 'assistant',
              parts: [{ type: 'text', text: fallbackReply }]
            });
          }
        }

        await persistMessagesOnly(messagesToPersist);
      }
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error('[Project Agent] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
