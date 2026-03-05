import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { convertToModelMessages, generateText, jsonSchema, stepCountIs, streamText, tool, type UIMessage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getSupabaseAdmin, normalizeAvatarPhotoSet } from '@/lib/supabase';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import {
  getPrimaryCloneSelection,
  normalizeCloneSelections,
  normalizeSelectedIds
} from '@/lib/project-agent/clone-selection';
import {
  MERGE_CONFIRMATION_TOKEN,
  isMergeConfirmationCommand,
  isMergeIntentCommand,
  isRegenerateVideoCommand,
  isStartVideoGenerationCommand,
  mapClonePhaseFromStatusPayload as mapClonePhaseFromPayload
} from '@/lib/project-agent/clone-workflow-control';

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
    status: 'idle' | 'generating' | 'ready' | 'failed';
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
    token: '确认合并';
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

const buildWorkflowFallbackReply = (latestUserTurnText: string, state: SessionState) => {
  const raw = latestUserTurnText.trim();
  if (!raw) return null;

  if (isSceneScopedVideoStartCommand(raw)) {
    if (hasVideoGenerationSignal(state)) {
      return 'Video generation has started for the clone project. Flowgen currently renders scene videos as part of the project-level video pass, and you can still ask me to regenerate a specific scene video afterward.';
    }
    return 'I understood this as a scene-video request. Flowgen currently starts video generation for the whole clone project, or regenerates one specific scene video after review. Say "start video generation" to render all scenes, or "regenerate scene 1 video" to redo one scene.';
  }

  if (isStartVideoGenerationCommand(raw)) {
    if (hasVideoGenerationSignal(state)) {
      return 'Video generation has started. I am rendering each scene video now and will keep you posted as progress updates arrive.';
    }
    return 'I received your video-generation request. Frames still appear to be in review/generation, so I will start video generation as soon as all frames are ready.';
  }

  if (isStartFrameGenerationCommand(raw)) {
    return 'Frame generation has started. I am generating the first frames for all scenes now.';
  }

  if (isRegenerateFrameCommand(raw)) {
    const sceneIndex = parseSceneIndexFromUserTurn(raw);
    if (sceneIndex && Number.isFinite(sceneIndex)) {
      return `I am regenerating the frame for Scene ${sceneIndex} now.`;
    }
    return 'I am regenerating the requested frame now.';
  }

  if (isRegenerateVideoCommand(raw)) {
    const sceneIndex = parseSceneIndexFromUserTurn(raw);
    if (sceneIndex && Number.isFinite(sceneIndex)) {
      return `I am regenerating the video for Scene ${sceneIndex} now.`;
    }
    return 'I am regenerating the requested scene video now.';
  }

  return null;
};

type ForcedToolChoice = { type: 'tool'; toolName: 'startCloneVideoGeneration' | 'mergeCloneVideos' | 'regenerateCloneVideos' } | undefined;

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
  pendingMergeConfirmation?: SessionState['pendingMergeConfirmation'] | null;
}): Promise<ForcedToolChoice> => {
  const userText = input.latestUserTurnText.trim();
  if (!userText) return undefined;
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
  const cloneDraftSceneCount = Array.isArray(state.cloneReplacementDraft?.scenes) ? state.cloneReplacementDraft.scenes.length : 0;
  const cloneDraftSelection = [
    selectedAvatars.length > 0 ? `avatars=${selectedAvatars.map((avatar) => avatar.name).join(', ')}` : null,
    selectedProducts.length > 0 ? `products=${selectedProducts.map((product) => product.name).join(', ')}` : null
  ].filter(Boolean).join(', ') || 'none';
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
- Terminology rule (strict): always frame replacement choices as avatar/person + product.
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
  - Step 2: choose replacement avatar and/or product.
  - Step 3: review replaced prompts, then ask me in chat to start frame generation.
  - Step 4: review first frames per scene; if needed, ask me in chat to regenerate frame(s), then ask me in chat to start video generation.
  - Step 5: after all scene videos are ready, allow frame/video regeneration before merge; merge requires explicit chat confirmation token.
  - Keep replies progress-aware and concise at each phase.
- For competitor_ugc_replication, the sequence must follow the existing manual flow:
  1) First ask user to select ONE reference video.
  2) Do not ask for product before a reference video is selected.
  3) Ask for product only as a later step.
  4) In step 1 responses, never mention product requirements yet.
  6) If Reference Video is already selected in current state, do not ask for reference video again; continue to the next required step.
  7) After Reference Video is selected, your first sentence must explicitly confirm you understood the video structure using the provided summary and key shots.
  8) In the same reply, naturally recommend replacement directions and ask user to choose replacement avatar/person and replacement product.
  9) Keep this as a normal conversational reply; do not rely on UI labels or step headers in the wording.
  10) If cloneReplacementDraft.status is "ready", reply naturally that replacement prompts are prepared from the reference structure, briefly summarize selected replacements, and ask the user to review/edit Scene and shot-level fields (subject, background, action, style, camera, composition, lighting, audio, dialogue) in Step 3.
  11) If cloneReplacementDraft.status is "generating", tell the user you are preparing prompt drafts now and to wait briefly.
  12) If cloneReplacementDraft.status is "failed", explain the failure briefly and ask whether to retry draft generation.
  13) If user asks to regenerate this step, acknowledge you are re-running the same replacement step with current selections and respond as a normal assistant turn (no technical wording like "draft schema").
  14) Grounding rule (strict): when replying about a selected reference video, you must use ONLY "Reference Summary", "Reference Key Shots", "Reference Detected Character", and "Reference Detected Product" from current state. If details are missing, say they are unavailable; do not invent scene details.
  15) In the first response after reference selection, cite at least two concrete shot cues from "Reference Key Shots" verbatim or near-verbatim when available.
  16) Context rule (strict): for every reply, incorporate the latest user request plus relevant prior chat context; do not answer with generic fallback copy.
  17) Step 2 auto-match rule: when reference video is selected and user describes replacements in natural language (e.g. "replace with a man and LIEVEDA book"), you must try to resolve matches from existing options by calling listAvatars and listProducts, then call selectAvatar/selectProduct for best matches.
  18) You may only claim something is "preselected" after a successful selectAvatar/selectProduct tool call in this turn (tool result must be success=true). If a tool returns success=false, do not claim any preselection and ask a short clarification instead.
  19) Product guard: if the user did not explicitly specify a replacement product in the latest turn, do not call selectProduct and do not assume any product. Ask a short follow-up question instead.
  20) After successful auto-match, explicitly tell the user which avatar/product were preselected and ask if those choices are correct; instruct confirmation only via chat message.
  20.1) When the user confirms replacements in natural language (not limited to fixed phrases), call generateCloneReplacementDraft immediately to start Step 3 draft generation.
  20.2) Manual-selection rule: if current state already has selected avatar/product (from left panel) and user says they are done/selected/continue without repeating names, explicitly read back the selected avatar/product from state and ask whether to proceed to next step.
  20.3) If both selected avatar and selected product already exist in current state and user confirms to continue, call generateCloneReplacementDraft even when the latest message does not restate the names.
  21) If the latest user message indicates they already confirmed replacements (e.g. "I selected replacement ... Continue to the next step..."), do NOT ask for confirmation again. Instead, acknowledge the chosen avatar/product and say you are now applying those replacements to the original prompt structure.
  22) In that post-confirmation turn, guide the user to review/edit the generated Scene and shot fields in Step 3 (subject, context/background, action, style, camera, composition, lighting, audio, dialogue), then tell them to send a chat command to start frame generation.
  23) If cloneReplacementDraft.status is ready and cloneExecutionPhase is still idle, never tell the user to start video generation yet. At this stage, always guide them to start frame generation first.
  24) Never instruct clicking any "confirm" control on the left panel. Replacement confirmation is chat-only. During clone execution phases, never instruct clicking removed buttons. Use command-style guidance, e.g. "Say 'start frame generation'", "say 'regenerate scene 2 frame'", "say 'regenerate scene 2 video'" or, only after frame review, "say 'start video generation'".
  25) If cloneReplacementDraft.status is ready and user asks to start generation, call startCloneGenerationFromDraft. If user asks to regenerate frames, call regenerateCloneFrames. If user asks to regenerate scene videos, call regenerateCloneVideos. If user asks to start video generation after frame review, call startCloneVideoGeneration.
  25.1) For merge/finalize requests in clone flow: first ask for confirmation token "${MERGE_CONFIRMATION_TOKEN}" and do not merge immediately. Only call mergeCloneVideos after the user sends the confirmation token.
  26) Download guidance rule: after merge starts or when cloneExecutionPhase is "completed", explicitly tell the user to check "My Ads" to view/download the final video.
  27) If user asks where to download the finished clone video, answer directly: "Please go to My Ads to view and download it."
  28) If matching is uncertain, present top likely candidates and ask a short clarification question; do not proceed to generation.
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
- Clone Draft Selections: ${cloneDraftSelection}
- Clone Draft Scenes: ${cloneDraftSceneCount}
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
            const avatars = await fetchUserAvatarOptions();

            const normalizedName = avatarName?.toLowerCase().trim();
            const mergedAvatars = mergeAvatarOptions(avatars);
            const normalizedAvatarName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
            const avatarAlias = normalizedName ? normalizedAvatarName(normalizedName) : '';
            const maleAlias = new Set(['man', 'male', 'guy', 'boy']);
            const femaleAlias = new Set(['woman', 'female', 'girl']);

            let match = mergedAvatars.find((avatar) => avatarId ? avatar.id === avatarId : false);
            if (!match && avatarAlias) {
              if (maleAlias.has(avatarAlias)) {
                match = mergedAvatars.find((avatar) => normalizedAvatarName(avatar.avatar_name || '') === 'default male')
                  || mergedAvatars.find((avatar) => /male|man/.test(normalizedAvatarName(avatar.avatar_name || '')));
              } else if (femaleAlias.has(avatarAlias)) {
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
                selectedAvatars: [{
                  id: match.id,
                  name: match.avatar_name || 'Unnamed Avatar',
                  photoUrl: match.photo_url ?? null
                }],
                selectedAvatar: {
                  id: match.id,
                  name: match.avatar_name || 'Unnamed Avatar',
                  photoUrl: match.photo_url ?? null
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
            if (!latestUserTextNormalized || !latestUserTextNormalized.includes(matchedProductNameNormalized)) {
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
                selectedProducts: [{
                  id: match.id,
                  name: match.product_name,
                  photoUrl: null
                }],
                selectedProduct: {
                  id: match.id,
                  name: match.product_name,
                  photoUrl: null
                }
              }
            });

            return { success: true, product: match };
          }
        }),
        generateCloneReplacementDraft: tool({
          description: 'Generate Step 3 replacement prompt draft from current selected avatar/product for clone workflow',
          inputSchema: emptySchema,
          execute: async () => {
            if (sessionState.intent !== 'competitor_ugc_replication' || !sessionState.cloneReferenceVideo?.id) {
              return { success: false, message: 'Reference video is not selected yet.' };
            }

            if (sessionState.cloneReplacementDraft?.status === 'generating') {
              return { success: true, message: 'Replacement draft generation is already in progress.' };
            }
            if (sessionState.cloneReplacementDraft?.status === 'ready' && (sessionState.cloneReplacementDraft?.scenes?.length || 0) > 0) {
              return { success: true, message: 'Replacement draft is already ready.' };
            }

            const selectedAvatars = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedAvatars,
              sessionState.cloneReplacementDraft?.selectedAvatar
            );
            const selectedProducts = normalizeCloneSelections(
              sessionState.cloneReplacementDraft?.selectedProducts,
              sessionState.cloneReplacementDraft?.selectedProduct
            );
            const selectedAvatarIds = normalizeSelectedIds(
              sessionState.avatar?.id ?? selectedAvatars[0]?.id,
              selectedAvatars.map((avatar) => avatar.id),
              8
            );
            const selectedProductIds = normalizeSelectedIds(
              sessionState.product?.id ?? selectedProducts[0]?.id,
              selectedProducts.map((product) => product.id),
              8
            );
            const primaryAvatar = getPrimaryCloneSelection(selectedAvatars) ?? (
              sessionState.avatar
                ? {
                    id: sessionState.avatar.id,
                    name: sessionState.avatar.name,
                    photoUrl: sessionState.avatar.photoUrl
                  }
                : null
            );
            const primaryProduct = getPrimaryCloneSelection(selectedProducts) ?? (
              sessionState.product
                ? {
                    id: sessionState.product.id,
                    name: sessionState.product.name,
                    photoUrl: null
                  }
                : null
            );

            if (selectedAvatarIds.length === 0 && selectedProductIds.length === 0) {
              return { success: false, message: 'Please select at least one replacement (avatar or product) first.' };
            }

            const generatingDraft = {
              status: 'generating' as const,
              error: null,
              selectedAvatars,
              selectedAvatar: primaryAvatar,
              selectedProducts,
              selectedProduct: primaryProduct,
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
                productIds: selectedProductIds
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
            if (sessionState.intent !== 'competitor_ugc_replication' || !sessionState.cloneReferenceVideo?.id) {
              return { success: false, message: 'Reference video is missing.' };
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
            const selectedAvatarIds = normalizeSelectedIds(
              sessionState.avatar?.id ?? selectedAvatars[0]?.id,
              selectedAvatars.map((avatar) => avatar.id),
              8
            );
            const selectedProductIds = normalizeSelectedIds(
              sessionState.product?.id ?? selectedProducts[0]?.id,
              selectedProducts.map((product) => product.id),
              8
            );
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
            if (sessionState.cloneReferenceVideo.sourceType === 'competitor_ad') {
              createPayload.competitorAdId = sessionState.cloneReferenceVideo.sourceId || sessionState.cloneReferenceVideo.id;
            } else {
              createPayload.creatorSourceVideoId = sessionState.cloneReferenceVideo.id || sessionState.cloneReferenceVideo.sourceId;
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
          description: 'Merge generated clone scene videos into the final output when the project is awaiting merge',
          inputSchema: emptySchema,
          execute: async () => {
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
                message: `If all scene videos look good, reply "${MERGE_CONFIRMATION_TOKEN}" and I will start the final merge.`
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
              return { success: false, message: precheckPayload?.error || 'Failed to verify merge readiness.' };
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
                message: 'Merge is not ready yet. You can continue regenerating scene frame/video and merge after all scene videos are ready.'
              };
            }

            const mergeResponse = await fetch(`${origin}/api/competitor-ugc-replication/${projectId}/merge`, {
              method: 'POST',
              headers: internalHeaders
            });
            const mergePayload = await mergeResponse.json().catch(() => ({}));
            if (!mergeResponse.ok) {
              return { success: false, message: mergePayload?.error || 'Failed to start merge.' };
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
              message: 'Final video merge has started. Once it finishes, please go to My Ads to view and download the final video.'
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
        // In that case we persist one deterministic assistant reply to prevent false "interrupted" UX.
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
          const fallbackReply = buildWorkflowFallbackReply(latestUserTurnText, sessionState);
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
