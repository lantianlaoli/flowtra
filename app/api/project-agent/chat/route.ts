import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, generateText, jsonSchema, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseAdmin, normalizeAvatarPhotoSet } from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
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
  intent?: 'avatar_ads' | 'competitor_ugc_replication' | 'motion_swap';
  step?: 'collecting' | 'creating' | 'awaiting_review' | 'regenerating_image' | 'generating_videos' | 'completed';
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
        shots: Array<{
          id: number;
          time_range: string;
          subject: string;
          context_environment: string;
          action: string;
          style: string;
          camera_motion_positioning: string;
          composition: string;
          ambiance_colour_lighting: string;
          audio: string;
          dialogue: string;
          language?: string;
        }>;
      };
      sourceSummary?: string | null;
    }>;
  };
  cloneExecution?: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    model?: 'veo3' | 'veo3_fast' | 'seedance_1_5_pro';
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
  avatar?: { id: string; name: string; photoUrl: string } | null;
  product?: { id: string; name: string } | null;
  customDialogue?: string;
  language?: string;
  videoDurationSeconds?: number;
  videoAspectRatio?: '16:9' | '9:16';
  videoModel?: 'veo3_fast';
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
  language: 'en',
  videoDurationSeconds: 16,
  videoAspectRatio: '9:16',
  videoModel: 'veo3_fast'
};

type CloneDraftScene = NonNullable<SessionState['cloneReplacementDraft']>['scenes'][number];

const cloneDraftSceneToSegmentPrompt = (
  scene: CloneDraftScene,
  fallbackLanguage: string
) => {
  const shots = Array.isArray(scene.videoPrompt?.shots)
    ? scene.videoPrompt.shots.map((shot, index) => ({
        id: Number.isFinite(Number(shot.id)) ? Number(shot.id) : index + 1,
        time_range: typeof shot.time_range === 'string' ? shot.time_range : '00:00 - 00:08',
        subject: shot.subject || '',
        context_environment: shot.context_environment || '',
        action: shot.action || '',
        style: shot.style || '',
        camera_motion_positioning: shot.camera_motion_positioning || '',
        composition: shot.composition || '',
        ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
        audio: shot.audio || '',
        dialogue: shot.dialogue || '',
        language: shot.language || fallbackLanguage
      }))
    : [];

  return {
    first_frame_description: scene.imagePrompt || '',
    shots,
    is_continuation_from_prev: (scene.sceneIndex ?? 1) > 1
      ? (typeof scene.isContinuation === 'boolean' ? scene.isContinuation : true)
      : false
  };
};

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

const isReferenceSelectionMessage = (text: string) => {
  const normalized = text.trim();
  if (!normalized) return false;
  return /^i selected ".*" as the reference video for clone\.$/i.test(normalized);
};

const isFreshCloneIntentMessage = (text: string) => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  if (isReferenceSelectionMessage(text)) return false;
  if (
    isMergeIntentCommand(text) ||
    isMergeConfirmationCommand(text) ||
    isReplacementConfirmationCommand(text) ||
    isRegenerateVideoCommand(text) ||
    isStartVideoGenerationCommand(text) ||
    isStartFrameGenerationCommand(text) ||
    isRegenerateFrameCommand(text)
  ) {
    return false;
  }

  return /\b(clone|viral|competitor|ugc)\b/i.test(normalized);
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

const buildWorkflowFallbackReply = async (input: {
  latestUserTurnText: string;
  state: SessionState;
  model: ReturnType<typeof openrouter.chat>;
}) => {
  if (!shouldGenerateWorkflowFallback(input.latestUserTurnText, input.state)) {
    return null;
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

  const { text } = await generateText({
    model: input.model,
    system: [
      'You are Flowgen writing one contextual assistant reply.',
      'Do not use canned or template wording.',
      'Always provide clear next actions.',
      'Reply in English only.',
      'When replacements are confirmed and draft/scene workspace is available, tell the user exactly what to do next:',
      'review/edit scene prompts on the left, then say "start frame generation", then after frame review say "start video generation".',
      'If generation is already running, summarize progress and the next valid command.'
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

type ForcedToolChoice = { type: 'tool'; toolName: 'startCloneVideoGeneration' | 'mergeCloneVideos' | 'regenerateCloneVideos' | 'confirmCloneSelections' | 'generateCloneReplacementDraft' } | undefined;

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
  clonePhase?: SessionState['cloneExecution'] extends { phase: infer P } ? P : string;
  hasCloneProject: boolean;
  hasSelectedProducts: boolean;
  cloneDraftStatus?: SessionState['cloneReplacementDraft'] extends { status: infer S } ? S : string;
  pendingMergeConfirmation?: SessionState['pendingMergeConfirmation'] | null;
}): Promise<ForcedToolChoice> => {
  const userText = input.latestUserTurnText.trim();
  if (!userText) return undefined;

  if (
    isSelectionContinueIntent(userText) &&
    input.hasSelectedProducts &&
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
  const pendingMergeConfirmation = state.pendingMergeConfirmation?.projectId
    ? `${state.pendingMergeConfirmation.token} (${state.pendingMergeConfirmation.projectId})`
    : 'none';

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
- motion_swap (collect requirements, then hand off to existing workflow entrypoints)

Domain model (strict):
- First-class user objects are ONLY: avatar and product.
- Brand is deprecated/removed in this project and must not be treated as an object.

Current configured required inputs for avatar_ads:
- Character (avatar)
- Either:
  - Product-based mode: product
  - Talking-head mode: custom dialogue/script (product not required)
- Video duration (8-80s, multiple of 8)
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
- Positioning rule: speak like a growth operator who helps users ship viral ads quickly, not like a generic tech support bot.
- If the user uses "brand" in their input, reinterpret it to product/avatar intent and confirm that selection using product/avatar wording.
- Collect missing required inputs before execution.
- Confirm collected inputs before project creation.
- For avatar_ads, use createAvatarAdsProject only after user confirmation.
- Use setCustomDialogue when user provides or updates a custom script.
- After project creation, wait for prompts/image to be ready (status awaiting_review) before edits.
- Use syncProjectStatus to fetch the latest project data.
- For image prompt edits, use regenerateImage with a new imagePrompt.
- For video prompt edits, use updatePromptEdits with a full updatedPrompts object.
- When the user confirms prompts, use confirmVideoGeneration.
- If the user picks competitor_ugc_replication, run the executable clone flow end-to-end in chat:
  - Step 1: choose reference video.
  - Step 2: collect multi-avatar and multi-product selections (avatar and product are both optional at planning stage).
  - Step 3: build and review deterministic scene assignments (cartesian preview).
  - Step 4: wait for explicit replacement confirmation token "${REPLACEMENT_CONFIRMATION_TOKEN}".
  - Step 5: after replacement confirmation, start frame generation and continue execution phases.
  - Step 6: after all scene videos are ready, allow frame/video regeneration before creating the final video; final-video creation requires explicit chat confirmation token.
  - Keep replies progress-aware and concise at each phase.
- For competitor_ugc_replication, the sequence must follow the existing manual flow:
  1) First ask user to select ONE reference video.
  2) Do not ask for product before a reference video is selected.
  3) Ask for product only as a later step.
  4) In step 1 responses, never mention product requirements yet.
  6) If Reference Video is already selected in current state, do not ask for reference video again; continue to the next required step.
  7) After Reference Video is selected, your first sentence must explicitly confirm you understood the video structure using the provided summary and key shots.
  8) In the same reply, naturally recommend replacement directions and ask user to choose replacement avatars and/or products.
  9) Keep this as a normal conversational reply; do not rely on UI labels or step headers in the wording.
  10) If cloneReplacementDraft.status is "ready", reply naturally that replacement prompts are prepared from the reference structure, briefly summarize selected replacements, and ask the user to review/edit Scene and shot-level fields (subject, background, action, style, camera, composition, lighting, audio, dialogue) in Step 3.
  11) If cloneReplacementDraft.status is "generating", tell the user you are preparing prompt drafts now and to wait briefly.
  12) If cloneReplacementDraft.status is "failed", explain the failure briefly and ask whether to retry draft generation.
  13) If user asks to regenerate this step, acknowledge you are re-running the same replacement step with current selections and respond as a normal assistant turn (no technical wording like "draft schema").
  14) Grounding rule (strict): when replying about a selected reference video, you must use ONLY "Reference Summary", "Reference Key Shots", "Reference Detected Character", and "Reference Detected Product" from current state. If details are missing, say they are unavailable; do not invent scene details.
  15) In the first response after reference selection, cite at least two concrete shot cues from "Reference Key Shots" verbatim or near-verbatim when available.
  16) Context rule (strict): for every reply, incorporate the latest user request plus relevant prior chat context; do not answer with generic fallback copy.
  17) Step 2 auto-match rule: when reference video is selected and user describes replacements in natural language (including multiple avatars/products), resolve matches from existing options by calling listAvatars and listProducts, then apply selection tools.
  18) You may only claim something is "preselected" after a successful selectAvatar/selectProduct tool call in this turn (tool result must be success=true). If a tool returns success=false, do not claim any preselection and ask a short clarification instead.
  19) Selection priority rule: if current state already contains selected avatars/products from the left panel, treat those selections as authoritative user intent.
  20) After successful auto-match, read back selected avatars/products and ask user to review scene assignments.
  20.1) Use planCloneAssignments to build deterministic cartesian scene assignments preview.
  20.2) Allow updateSceneAssignment for per-scene manual overrides before confirmation.
  20.3) If user requests to clear or replace current selections, call clearCloneSelections or setCloneSelections instead of silently keeping previous values.
  21) Continue rule: if the user says done/selected/continue/next and state already has selections, do not ask for names again. Read back selected avatars/products + assignment summary, then proceed to draft generation.
  21.1) Only ask for explicit product name if there is no selected product in current state.
  21.2) Do not infer execution confirmation from vague wording like "continue" or "looks good". Execution confirmation is valid only when user sends "${REPLACEMENT_CONFIRMATION_TOKEN}" and confirmCloneSelections succeeds.
  22) Until selection confirmation is complete, do not call execution tools. Respond with concise guidance and expected next command.
  23) In confirmed state, guide the user to review/edit Scene and shot fields (subject, context/background, action, style, camera, composition, lighting, audio, dialogue), then tell them to send a chat command to start frame generation.
  24) If cloneReplacementDraft.status is ready and cloneExecutionPhase is still idle, never tell the user to start video generation yet. At this stage, always guide them to start frame generation first.
  25) Never instruct clicking any "confirm" control on the left panel. Replacement confirmation is chat-only via token "${REPLACEMENT_CONFIRMATION_TOKEN}". During clone execution phases, never instruct clicking removed buttons. Use command-style guidance.
  26) If cloneReplacementDraft.status is ready and user asks to start generation, call startCloneGenerationFromDraft only after confirmation gate passes. If user asks to regenerate frames, call regenerateCloneFrames. If user asks to regenerate scene videos, call regenerateCloneVideos. If user asks to start video generation after frame review, call startCloneVideoGeneration.
  25.1) For final-video requests in clone flow: first ask for confirmation token "${MERGE_CONFIRMATION_TOKEN}" and do not start final-video creation immediately. Only call mergeCloneVideos after the user sends the confirmation token.
  27) Download guidance rule: after final-video creation starts or when cloneExecutionPhase is "completed", explicitly tell the user to check "My Ads" to view/download the final video.
  27.1) When final-video creation starts for a clone project, say it has started, ask the user to wait about 10-20 seconds, send them to "My Ads" for details/download, and invite them to start cloning the next video.
  28) If user asks where to download the finished clone video, answer directly: "Please go to My Ads to view and download it."
  29) If matching is uncertain, present top likely candidates and ask a short clarification question; do not proceed to generation.
- If the user picks motion_swap, collect requirements and guide to the existing workflow entrypoint.
- When user asks what workflows are available, always list ALL three:
  1) Avatar Ads
  2) Clone Viral Videos (Competitor UGC Replication)
  3) Motion Swap

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
- Clone Execution Merged Video URL: ${cloneExecutionMergedVideo}
- Pending Merge Confirmation: ${pendingMergeConfirmation}
- Custom Dialogue: ${dialogueLabel}
- Duration: ${state.videoDurationSeconds ?? 'unset'}
- Aspect: ${state.videoAspectRatio ?? 'unset'}
- Language: ${state.language ?? 'unset'}
- Step: ${state.step ?? 'unknown'}

Stay concise, ask one clarification at a time, and prefer explicit confirmations before running generation tools.
`;
};

const getOrigin = (request: Request) => new URL(request.url).origin;
const mergeState = (state: SessionState, patch: Partial<SessionState>) => ({
  ...state,
  ...patch
});

const buildFreshCloneState = (state: SessionState): SessionState => ({
  ...state,
  intent: 'competitor_ugc_replication',
  cloneReferenceVideo: undefined,
  cloneReplacementDraft: undefined,
  cloneExecution: null,
  pendingMergeConfirmation: null,
  projectId: undefined,
  avatar: null,
  product: null
});

const mapClonePhaseFromStatusPayload = mapClonePhaseFromPayload;

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
  const normalizedModel = (videoModel === 'veo3' || videoModel === 'seedance_1_5_pro' || videoModel === 'veo3_fast')
    ? videoModel
    : 'veo3_fast';

  return {
    projectId,
    phase: mapClonePhaseFromStatusPayload(payload),
    model: normalizedModel,
    duration: typeof data.videoDuration === 'string' ? data.videoDuration : undefined,
    creditsCost: typeof data.creditsUsed === 'number' ? data.creditsUsed : undefined,
    error: typeof data.errorMessage === 'string' ? data.errorMessage : null,
    mergedVideoUrl:
      (typeof data.videoUrl === 'string' && data.videoUrl) ||
      (typeof segmentStatus?.mergedVideoUrl === 'string' && segmentStatus.mergedVideoUrl) ||
      null,
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

    const shouldResetCloneSession = (
      sessionState.intent === 'competitor_ugc_replication' &&
      Boolean(sessionState.cloneReferenceVideo?.id) &&
      isFreshCloneIntentMessage(messageText(normalizedIncomingMessage))
    );

    if (shouldResetCloneSession) {
      sessionState = buildFreshCloneState(sessionState);
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

    if (!existingSession) {
      const { error: insertError } = await supabase
        .from('project_agent_sessions')
        .insert({
          id: resolvedSessionId,
          user_id: userId,
          intent: 'avatar_ads',
          state: sessionState,
          messages: conversationMessages,
          status: 'active',
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Project Agent] Failed to create session:', insertError);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
      }
    } else {
      await persistMessagesOnly(
        conversationMessages,
        statePatch && typeof statePatch === 'object' ? sessionState : undefined
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
      const selectedProducts = normalizeCloneSelections(
        sessionState.cloneReplacementDraft?.selectedProducts,
        sessionState.cloneReplacementDraft?.selectedProduct
      );
      if (selectedProducts.length === 0 && !sessionState.product?.id) {
        return { ok: false as const, message: 'Please select at least one replacement product first.' };
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

    const origin = getOrigin(request);

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

    const modelContextMessages = conversationMessages.slice(-MODEL_CONTEXT_WINDOW_MESSAGES);
    const modelMessages = await convertToModelMessages(modelContextMessages);
    const inferredSceneIndexFromTurn = parseSceneIndexFromUserTurn(latestUserTurnText);
    let forcedToolChoice: ForcedToolChoice;
    try {
      forcedToolChoice = await classifyToolIntent({
        model,
        latestUserTurnText,
        clonePhase: sessionState.cloneExecution?.phase,
        hasCloneProject: Boolean(
          sessionState.cloneExecution?.projectId ||
          sessionState.projectId
        ),
        hasSelectedProducts: normalizeCloneSelections(
          sessionState.cloneReplacementDraft?.selectedProducts,
          sessionState.cloneReplacementDraft?.selectedProduct
        ).length > 0 || Boolean(sessionState.product?.id),
        cloneDraftStatus: sessionState.cloneReplacementDraft?.status,
        pendingMergeConfirmation: sessionState.pendingMergeConfirmation ?? null
      });
    } catch (intentError) {
      console.warn('[Project Agent] Tool intent classification failed, falling back to model autonomy:', intentError);
      forcedToolChoice = undefined;
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
            if (isProductOnlyIntent(latestUserTurnText) && !hasExplicitAvatarIntent(latestUserTurnText)) {
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
                planStatus: 'awaiting_confirmation',
                confirmation: {
                  requiredToken: REPLACEMENT_CONFIRMATION_TOKEN,
                  confirmedAt: null,
                  confirmedByMessageId: null
                }
              }
            });

            return { success: true, avatar: match };
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

            return { success: true, product: match };
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

            const sceneCount = Math.max(
              Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 0,
              Array.isArray(sessionState.cloneReferenceVideo?.keyShots) ? sessionState.cloneReferenceVideo?.keyShots.length || 0 : 0,
              1
            );
            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount,
              avatarIds: selectedAvatars.map((avatar) => avatar.id),
              productIds: selectedProducts.map((product) => product.id),
              existingAssignments: sessionState.cloneReplacementDraft?.sceneAssignments
            });

            const primaryAvatar = getPrimaryCloneSelection(selectedAvatars);
            const primaryProduct = getPrimaryCloneSelection(selectedProducts);
            const nextPlanStatus: ClonePlanStatus = selectedProducts.length > 0 ? 'awaiting_confirmation' : 'collecting';
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
              assignments: sceneAssignments
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

            const sceneAssignments = buildCartesianSceneAssignments({
              sceneCount: Math.max(Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 1, 1),
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
                planStatus: selectedProducts.length > 0 ? 'awaiting_confirmation' : 'collecting',
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
            if (selectedProducts.length === 0) {
              return { success: false, message: 'Please select at least one replacement product first.' };
            }

            const sceneCount = Math.max(
              Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 0,
              Array.isArray(sessionState.cloneReferenceVideo?.keyShots) ? sessionState.cloneReferenceVideo?.keyShots.length || 0 : 0,
              1
            );
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
            return { success: true, assignments: sceneAssignments };
          }
        }),
        updateSceneAssignment: tool({
          description: 'Update one scene assignment (avatar optional, product required) before confirmation.',
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

            const sceneCount = Math.max(
              Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 1,
              1
            );
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
            if (selectedProducts.length === 0) {
              return { success: false, message: 'Please select at least one replacement product first.' };
            }
            const sceneCount = Math.max(
              Array.isArray(sessionState.cloneReplacementDraft?.scenes) ? sessionState.cloneReplacementDraft.scenes.length : 0,
              Array.isArray(sessionState.cloneReferenceVideo?.keyShots) ? sessionState.cloneReferenceVideo?.keyShots.length || 0 : 0,
              1
            );
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
              videoAspectRatio: videoAspectRatio ?? sessionState.videoAspectRatio
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
            await persistSession({
              customDialogue: trimmedDialogue
            });

            return { success: true, customDialogue: trimmedDialogue };
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
            formData.set('video_model', sessionState.videoModel ?? 'veo3_fast');
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

            const response = await fetch(`${origin}/api/avatar-ads/${sessionState.projectId}/regenerate-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imagePrompt })
            });

            const payload = await response.json();

            if (!response.ok) {
              return { success: false, message: payload?.error || 'Failed to regenerate image.' };
            }

            await persistSession({
              imagePrompt,
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

            const selectedAvatars = normalizeCloneSelections(
              draft.selectedAvatars,
              draft.selectedAvatar
            );
            const selectedProducts = normalizeCloneSelections(
              draft.selectedProducts,
              draft.selectedProduct
            );
            const { selectedAvatarIds, selectedProductIds } = resolveCloneDraftSelections(sessionState);
            const selectedAvatarId = selectedAvatarIds[0] || undefined;
            const selectedProductId = selectedProductIds[0] || undefined;
            const primaryProduct = getPrimaryCloneSelection(selectedProducts);
            if (!selectedProductId) {
              return { success: false, message: 'A replacement product is required before generation.' };
            }

            let selectedProductImageUrl = primaryProduct?.photoUrl || draft.selectedProduct?.photoUrl || null;
            if (!selectedProductImageUrl) {
              const { data: product, error: productError } = await supabase
                .from('user_products')
                .select('id, product_name, user_product_photos(photo_url,is_primary)')
                .eq('id', selectedProductId)
                .eq('user_id', userId)
                .maybeSingle();
              if (productError || !product) {
                return { success: false, message: 'Selected product could not be resolved.' };
              }
              const photos = Array.isArray(product.user_product_photos)
                ? product.user_product_photos as Array<{ photo_url?: string; is_primary?: boolean }>
                : [];
              const primary = photos.find((photo) => photo.is_primary) || photos[0];
              selectedProductImageUrl = primary?.photo_url || null;
            }

            if (!selectedProductImageUrl) {
              return { success: false, message: 'Selected product is missing an image.' };
            }

            const segmentPrompts = draft.scenes.map((scene) => (
              cloneDraftSceneToSegmentPrompt(scene, sessionState.language ?? 'en')
            ));
            const videoDuration = String(Math.max(1, draft.scenes.length) * 8);
            const normalizedModel: 'veo3_fast' = 'veo3_fast';
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

            const createResponse = await fetch(`${origin}/api/competitor-ugc-replication/create`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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

            if (!startResponse.ok) {
              return { success: false, message: startPayload?.error || 'Failed to start clone video generation.' };
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
                creditsCost: previousExecution?.creditsCost,
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

            return { success: true, message: 'Clone video generation has started.' };
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
              await persistSession({
                pendingMergeConfirmation: null,
                cloneExecution: toCloneExecutionFromStatusPayload(projectId, refreshedStatusPayload as Record<string, unknown>)
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
              message: 'Final video creation has started. Please wait about 10-20 seconds, then go to My Ads to view details and download it. If you want, you can start cloning the next video now.'
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

            await persistSession({
              step: payload.project.status === 'awaiting_review' ? 'awaiting_review' : sessionState.step,
              generatedPrompts: payload.project.generated_prompts ?? null,
              imagePrompt: payload.project.image_prompt ?? null,
              generatedImageUrl: payload.project.generated_image_url ?? null
            });

            return { success: true, project: payload.project };
          }
        })
      }
    });

    const finalizeNonce = Date.now().toString(36);

    return result.toUIMessageStreamResponse({
      onFinish: async ({ messages: finalMessages }) => {
        const normalizedFinalMessages = dedupeMessages(
          finalMessages.map((message, index) => normalizeUIMessage(message, `final-${finalizeNonce}-${index}`))
        );
        // Preserve existing timeline exactly as-is, and only append genuinely new
        // streamed messages. Never overwrite prior history by id.
        const existingIds = new Set(conversationMessages.map((message) => message.id));
        const messagesToPersist = [...conversationMessages];
        for (const message of normalizedFinalMessages) {
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
        // In that case we generate one contextual AI reply to avoid silent turns.
        const hasAssistantAfterLatestUser = (() => {
          let latestUserIndex = -1;
          let latestAssistantIndex = -1;
          messagesToPersist.forEach((msg, index) => {
            if (msg.role === 'user' && messageText(msg).length > 0) latestUserIndex = index;
            if (msg.role === 'assistant' && messageText(msg).length > 0) latestAssistantIndex = index;
          });
          return latestAssistantIndex > latestUserIndex;
        })();

        if (!hasAssistantAfterLatestUser) {
          const fallbackReply = await buildWorkflowFallbackReply({
            latestUserTurnText,
            state: sessionState,
            model
          });
          if (fallbackReply) {
            messagesToPersist.push({
              id: `assistant-fallback-${Date.now().toString(36)}`,
              role: 'assistant',
              parts: [{ type: 'text', text: fallbackReply }]
            });
          }
        }

        await persistMessagesOnly(messagesToPersist);
      }
    });
  } catch (error) {
    console.error('[Project Agent] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
