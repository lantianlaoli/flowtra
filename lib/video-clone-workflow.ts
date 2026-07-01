import { getSupabaseAdmin, type VideoCloneSegment, type SingleVideoProject } from '@/lib/supabase';
import type { VideoCloneSelectedInputs } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { buildKieGptImageTaskPayload, createKieGptImageTask } from '@/lib/kie-image-generation';
import { moderatePromptBeforeGeneration } from '@/lib/creem-moderation';
import { extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';
import {
  GENERATION_COSTS,
  getGenerationCost,
  getDefaultCloneVideoQuality,
  getSegmentCountFromDuration,
  getSegmentDurationForModel,
  getReplicaPhotoCredits,
  SEEDANCE_MIN_TASK_DURATION_SECONDS,
  mapCloneQualityToSeedanceResolution,
  normalizeCloneVideoQualityForModel,
  snapDurationToModel,
  SUPPORTED_LANGUAGE_CODES,
  type LanguageCode,
  type PersistedVideoQuality,
  type VideoDuration,
  type VideoModel
} from '@/lib/constants';
import {
  getProjectAgentCloneExecutionMode,
  getProjectAgentCloneGenerationCost,
  SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS,
  isSeedanceCloneModel,
  normalizeCloneDurationSeconds,
} from '@/lib/video-clone-billing';
import {
  parseReferenceVideoTimeline,
  sumShotDurations,
  parseTimecode,
  formatTimecode,
  type ReferenceVideoShot
} from '@/lib/reference-video-shots';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getAvatarPhotoUrls, SYSTEM_AVATARS } from '@/lib/default-avatars';
import { getSystemProductPhotoUrls, isSystemProductId, SYSTEM_PRODUCTS } from '@/lib/default-products';
import { getSystemReferenceVideoById, isSystemReferenceVideoId } from '@/lib/default-reference-videos';
import { compilePromptForExecution } from '@/lib/video-clone-prompt-compiler';
import { normalizeAnalysisToV2 } from '@/lib/video-analysis-schema';
import {
  removeOriginalAvatarReferences,
  removeOriginalPetReferences,
  removeOriginalProductReferences
} from '@/lib/project-agent/clone-product-replacement';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';

async function retryAsync<T>(fn: () => Promise<T>, options?: { maxAttempts?: number; baseDelayMs?: number; label?: string }): Promise<T> {
  const attempts = options?.maxAttempts && options.maxAttempts > 0 ? options.maxAttempts : 3;
  const baseDelay = options?.baseDelayMs && options.baseDelayMs > 0 ? options.baseDelayMs : 300;
  const label = options?.label || 'retryAsync';
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`[${label}] Attempt ${attempt}/${attempts} failed:`, error);
      if (attempt >= attempts) break;
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed after ${attempts} attempts`);
}

const KIE_PROMPT_LIMIT = 5000;
type SeedanceVideoModel = 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini';
const STORYBOARD_REFERENCE_PROMPT_VERSION = 1;
const SEEDANCE_STORYBOARD_SINGLE_TASK_SOURCE_MAX_SECONDS = 16;

const getSeedanceKieVideoModelId = (model: SeedanceVideoModel) => {
  if (model === 'seedance_2') return 'bytedance/seedance-2';
  if (model === 'seedance_2_mini') return 'bytedance/seedance-2-mini';
  return 'bytedance/seedance-2-fast';
};

const truncateText = (value: string | undefined | null, limit: number) => {
  if (!value) return '';
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};
const clampPromptLength = (value: string) => {
  if (value.length <= KIE_PROMPT_LIMIT) {
    return value;
  }
  return `${value.slice(0, KIE_PROMPT_LIMIT - 3)}...`;
};

// Callback URL configuration for event-driven architecture
const WEBHOOK_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://flowtra.ai';
const FRAME_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/video-clone/webhooks/frame`;
const VIDEO_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/video-clone/webhooks/video`;
const DIRECT_REFERENCE_PROMPT_VERSION = 2;

function buildSegmentVideoWebhookUrl(projectId: string, segmentIndex: number): string {
  const url = new URL(VIDEO_WEBHOOK_URL);
  url.searchParams.set('projectId', projectId);
  url.searchParams.set('segmentIndex', String(segmentIndex));
  return url.toString();
}

export interface StartWorkflowRequest {
  imageUrl?: string;
  referenceVideoId?: string; // Reference video for creative direction
  creatorSourceVideoId?: string; // Asset video reference
  selectedAvatarId?: string;
  selectedProductId?: string;
  selectedPetId?: string;
  selectedAvatarIds?: string[];
  selectedProductIds?: string[];
  selectedPetIds?: string[];
  userId: string;
  videoModel: VideoModel;
  imageSize?: string;
  elementsCount?: number;
  photoOnly?: boolean;
  shouldGenerateVideo?: boolean;
  videoAspectRatio?: '16:9' | '9:16';
  referenceImageUrls?: string[];
  photoAspectRatio?: string;
  photoResolution?: '1K' | '2K' | '4K';
  photoOutputFormat?: 'png' | 'jpg';
  replicaMode?: boolean;
  // Generic video params (applies to all models)
  videoDuration?: VideoDuration;
  videoQuality?: PersistedVideoQuality;
  videoQualityManual?: boolean;
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
  resolvedVideoModel?: VideoModel;
  requestSource?: 'project_agent_clone' | 'project_agent_edit_video' | 'default';
  executionMode?: 'clone' | 'clone_storyboard_reference' | 'clone_direct_reference' | 'clone_segmented_auto' | 'edit_video';
  referenceSourceVideoUrl?: string;
  referenceSourceMediaDurationSeconds?: number | null;
  editVideoPrompt?: string;
  editVideoSourceUrl?: string;
  supplementalText?: string;
  segmentPrompts?: Array<{
    first_frame_description?: string;
    is_continuation_from_prev?: boolean;
    shots?: Array<{
      id?: number;
      time_range?: string;
      subject?: string;
      context_environment?: string;
      action?: string;
      style?: string;
      camera_motion_positioning?: string;
      composition?: string;
      ambiance_colour_lighting?: string;
      audio?: string;
      sfx?: string;
      ambient?: string;
      dialogue?: string;
      language?: string;
    }>;
  }>;
}

const normalizeSupplementalText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const buildSupplementalTextPromptInstruction = (
  supplementalText: string | null | undefined,
): string => {
  const normalized = normalizeSupplementalText(supplementalText);
  if (!normalized) return '';

  return [
    'HIGH-PRIORITY SUPPLEMENTAL PRODUCT BEHAVIOR GUIDANCE:',
    normalized,
    'This guidance must be applied as a strong constraint for product motion, effect placement, and how the product behaves on screen. Preserve the storyboard structure unless this guidance is needed to correct product-specific behavior.',
  ].join('\n');
};

const SENTENCE_END_REGEX = /[.!?]$/;

const ensureSentence = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return SENTENCE_END_REGEX.test(trimmed) ? trimmed : `${trimmed}.`;
};

const appendConstraint = (base: string, constraint: string): string => {
  const normalizedBase = base.trim();
  if (!normalizedBase) return constraint;
  if (normalizedBase.includes(constraint)) return normalizedBase;
  return `${ensureSentence(normalizedBase)} ${constraint}`;
};

export const applySupplementalTextToSegments = (
  segments: SegmentPrompt[],
  supplementalText: string | null | undefined,
): SegmentPrompt[] => {
  const normalized = normalizeSupplementalText(supplementalText);
  if (!normalized) {
    return segments;
  }

  const frameConstraint = `Product behavior constraint: ${ensureSentence(normalized)}`;
  const shotConstraint = `Must visibly follow this exact product behavior: ${ensureSentence(normalized)}`;

  return segments.map((segment) => ({
    ...segment,
    first_frame_description: appendConstraint(segment.first_frame_description || '', frameConstraint),
    shots: Array.isArray(segment.shots)
      ? segment.shots.map((shot) => ({
          ...shot,
          action: appendConstraint(shot.action || '', shotConstraint),
        }))
      : segment.shots,
  }));
};

const removeOriginalReferenceEntitiesFromSegments = (
  segments: SegmentPrompt[],
  replacements: {
    avatarName?: string | null;
    productName?: string | null;
    petName?: string | null;
  }
): SegmentPrompt[] => {
  const normalizedAvatarName = replacements.avatarName?.trim();
  const normalizedProductName = replacements.productName?.trim();
  const normalizedPetName = replacements.petName?.trim();
  if (!normalizedAvatarName && !normalizedProductName && !normalizedPetName) return segments;

  const clean = (text: string | undefined) => {
    const avatarCleaned = removeOriginalAvatarReferences({
      text: text || '',
      avatarName: normalizedAvatarName
    });
    const productCleaned = removeOriginalProductReferences({
      text: avatarCleaned,
      productName: normalizedProductName
    });
    return removeOriginalPetReferences({
      text: productCleaned,
      petName: normalizedPetName
    });
  };

  return segments.map((segment) => ({
    ...segment,
    audio: clean(segment.audio),
    action: clean(segment.action),
    subject: clean(segment.subject),
    composition: clean(segment.composition),
    first_frame_description: clean(segment.first_frame_description),
    shots: Array.isArray(segment.shots)
      ? segment.shots.map((shot) => ({
          ...shot,
          audio: clean(shot.audio),
          ambient: clean(shot.ambient),
          action: clean(shot.action),
          subject: clean(shot.subject),
          composition: clean(shot.composition),
        }))
      : segment.shots,
  }));
};

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  remainingCredits?: number;
  creditsUsed?: number;
  error?: string;
  details?: string;
}

export type SegmentShot = {
  id: number;
  time_range: string;
  start_seconds?: number;
  end_seconds?: number;
  duration_seconds?: number;
  audio: string;
  sfx?: string;
  ambient?: string;
  style: string;
  action: string;
  subject: string;
  dialogue: string;
  language: string;
  composition: string;
  context_environment: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
};

export type SegmentPrompt = {
  audio: string;
  style: string;
  action: string;
  subject: string;
  composition: string;
  context_environment: string;
  first_frame_description: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
  dialogue: string;
  language: string;
  index: number;
  description?: string;
  first_frame_image_size?: string;
  is_continuation_from_prev?: boolean;
  shots?: SegmentShot[];
  firstChunkIndex?: number;
};

type CloneReferenceAssets = {
  selectedAvatarId?: string | null;
  selectedProductId?: string | null;
  selectedPetId?: string | null;
  selectedAvatarIds?: string[];
  selectedProductIds?: string[];
  selectedPetIds?: string[];
  avatarPhotoUrls: string[];
  productImageUrls: string[];
  petPhotoUrls: string[];
  avatarName?: string | null;
  productName?: string | null;
  petName?: string | null;
};

type CloneManualEditSeedInput = {
  projectId: string;
  request: StartWorkflowRequest & {
    imageUrl?: string;
    resolvedVideoModel: VideoModel;
  };
  prompts: SegmentPrompt[];
  metadataSource?: Record<string, unknown> | null;
};

export type StoryboardReferenceRow = {
  no: number;
  source_time_range: string;
  duration_seconds: number;
  scene_description: string;
  camera_movement: string;
  sound_bgm_voice_line: string;
  storyboard_panel_prompt: string;
  replacement_notes: string;
};

type StoryboardChunk = {
  sourceShot: ReferenceVideoShot;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  partIndex: number;
  partCount: number;
};

type StoryboardPlan = {
  rows: StoryboardReferenceRow[];
  segments: SegmentPrompt[];
  durationSeconds: number;
};

const clampSeedanceStoryboardDuration = (durationSeconds: number): number => (
  Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS, Math.round(durationSeconds)))
);

const cleanStoryboardText = (value: string | null | undefined, fallback = ''): string => {
  const cleaned = cleanSegmentText(value);
  return cleaned && cleaned.length > 0 ? cleaned : fallback;
};

const buildReplacementSummary = (assets: CloneReferenceAssets): string => {
  const parts: string[] = [];
  if (assets.avatarName || assets.avatarPhotoUrls.length > 0) {
    parts.push(
      `the person from the avatar reference photo (${assets.avatarName ?? 'connected avatar'}) — must match the full visible appearance exactly, not only the face: same gender presentation, facial structure, hair color, hair length, skin tone, eyewear, accessories, body proportions, posture cues, clothing color, clothing fabric, clothing cut, clothing fit, sleeves, neckline, visible pants/skirt, and overall styling`
    );
  }
  if (assets.productName || assets.productImageUrls.length > 0) {
    parts.push(
      `the product from the product reference photos (${assets.productName ?? 'connected product'}) — must match exactly: same packaging shape, label layout, brand colors, material cues`
    );
  }
  if (assets.petName || assets.petPhotoUrls.length > 0) {
    const petLabel = assets.petName ? `"${assets.petName}"` : 'connected pet';
    parts.push(
      `the pet named ${petLabel} from the pet reference photos (single pet only, never duplicate; match the same breed, color, fur markings, body shape, and face; treat its name as a label, not a count)`
    );
  }
  return parts.length > 0
    ? parts.join('; ')
    : 'connected replacement asset (no specific identity provided)';
};

const cleanReferenceTextForStoryboard = (text: string | null | undefined, assets: CloneReferenceAssets): string => {
  let cleaned = cleanStoryboardText(text);
  cleaned = removeOriginalAvatarReferences({ text: cleaned, avatarName: assets.avatarName });
  cleaned = removeOriginalProductReferences({ text: cleaned, productName: assets.productName });
  cleaned = removeOriginalPetReferences({ text: cleaned, petName: assets.petName });
  if (assets.petName) {
    const name = assets.petName.trim();
    if (name) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Collapse "orange tabby two fat" → "two fat", "small black two fat" → "two fat",
      // or any 0-4 words preceding the pet name, so GPT-Image-2 reads the name as a label
      // rather than a quantity.
      cleaned = cleaned.replace(
        new RegExp(`\\b(?:[\\w'-]+\\s+){0,4}${escapedName}\\b`, 'gi'),
        name
      );
    }
  }
  return cleaned;
};

const splitReferenceShotsForStoryboard = (
  shots: ReferenceVideoShot[],
  fallbackDurationSeconds: number,
  options?: { forceSingleSegment?: boolean }
): StoryboardChunk[] => {
  const sourceShots = shots.length > 0
    ? shots
    : [{
        id: 1,
        startTime: '00:00',
        endTime: formatTimecode(Math.max(8, fallbackDurationSeconds || 8)),
        durationSeconds: Math.max(8, fallbackDurationSeconds || 8),
        firstFrameDescription: 'Opening scene from the analyzed reference video.',
        subject: 'Replacement asset appears as the featured subject.',
        contextEnvironment: 'Environment follows the reference video.',
        action: 'Preserve the reference action beat.',
        style: 'Preserve the reference visual style.',
        cameraMotionPositioning: 'Preserve the reference camera movement.',
        composition: 'Preserve the reference composition.',
        ambianceColourLighting: 'Preserve the reference lighting.',
        audio: 'Preserve the reference audio intent.',
        dialogue: '',
        startTimeSeconds: 0,
        endTimeSeconds: Math.max(8, fallbackDurationSeconds || 8)
      } satisfies ReferenceVideoShot];

  if (options?.forceSingleSegment) {
    const totalDuration = clampSeedanceStoryboardDuration(fallbackDurationSeconds);
    const shotCount = Math.max(1, sourceShots.length);
    const baseDuration = Math.max(1, Math.floor(totalDuration / shotCount));
    let remainingSeconds = totalDuration - (baseDuration * shotCount);
    let cursor = 0;
    return sourceShots.map((shot, index) => {
      const startSeconds = cursor;
      const durationSeconds = index === sourceShots.length - 1
        ? Math.max(1, totalDuration - cursor)
        : baseDuration + (remainingSeconds > 0 ? 1 : 0);
      if (remainingSeconds > 0) {
        remainingSeconds -= 1;
      }
      const endSeconds = index === sourceShots.length - 1
        ? totalDuration
        : Math.min(totalDuration, startSeconds + durationSeconds);
      cursor = endSeconds;
      return {
        sourceShot: shot,
        startSeconds,
        endSeconds,
        durationSeconds: Math.max(1, endSeconds - startSeconds),
        partIndex: 0,
        partCount: 1
      };
    });
  }

  const chunks: StoryboardChunk[] = [];
  for (const shot of sourceShots) {
    const start = Number.isFinite(shot.startTimeSeconds) ? shot.startTimeSeconds : parseTimecode(shot.startTime) || 0;
    const duration = Math.max(1, Math.round(shot.durationSeconds || ((parseTimecode(shot.endTime) || start + 8) - start) || 8));
    const partCount = Math.max(1, Math.ceil(duration / SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS));
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      const partStart = start + Math.round((duration / partCount) * partIndex);
      const partEnd = partIndex === partCount - 1
        ? start + duration
        : start + Math.round((duration / partCount) * (partIndex + 1));
      chunks.push({
        sourceShot: shot,
        startSeconds: partStart,
        endSeconds: Math.max(partStart + 1, partEnd),
        durationSeconds: Math.max(1, Math.max(partStart + 1, partEnd) - partStart),
        partIndex,
        partCount
      });
    }
  }
  return chunks;
};

export function buildSeedanceStoryboardClonePlan(input: {
  shots: ReferenceVideoShot[];
  fallbackDurationSeconds?: number | null;
  sourceMediaDurationSeconds?: number | null;
  aspectRatio: '16:9' | '9:16';
  language?: string | null;
  assets: CloneReferenceAssets;
}): StoryboardPlan {
  const sourceMediaDurationSeconds = Number(input.sourceMediaDurationSeconds);
  const hasSingleTaskMediaDuration = Number.isFinite(sourceMediaDurationSeconds) &&
    sourceMediaDurationSeconds > 0 &&
    sourceMediaDurationSeconds <= SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS;
  const fallbackDurationSeconds = Math.max(
    8,
    normalizeCloneDurationSeconds(
      (hasSingleTaskMediaDuration ? sourceMediaDurationSeconds : null) ||
      input.fallbackDurationSeconds ||
      sumShotDurations(input.shots) ||
      8
    ) || 8
  );
  const chunks = splitReferenceShotsForStoryboard(input.shots, fallbackDurationSeconds, {
    forceSingleSegment: hasSingleTaskMediaDuration
  });
  const totalChunkDuration = chunks.reduce((sum, item) => sum + item.durationSeconds, 0);
  // One Seedance task (≤15s) when all chunks together fit inside a single task.
  // Otherwise pack greedily into 4-15s groups. Either way, rows are produced
  // one per source chunk so multi-cut references render one storyboard row each.
  const shouldForceSingleSegment = hasSingleTaskMediaDuration || totalChunkDuration <= SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS;
  const grouped: StoryboardChunk[][] = shouldForceSingleSegment && chunks.length > 0
    ? [chunks]
    : [];

  if (!shouldForceSingleSegment) {
    for (const chunk of chunks) {
      const current = grouped[grouped.length - 1];
      const currentDuration = current?.reduce((sum, item) => sum + item.durationSeconds, 0) || 0;
      if (current && currentDuration >= SEEDANCE_MIN_TASK_DURATION_SECONDS && currentDuration + chunk.durationSeconds <= SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS) {
        current.push(chunk);
      } else {
        grouped.push([chunk]);
      }
    }

    if (grouped.length > 1) {
      const last = grouped[grouped.length - 1];
      const lastDuration = last.reduce((sum, item) => sum + item.durationSeconds, 0);
      const previous = grouped[grouped.length - 2];
      const previousDuration = previous.reduce((sum, item) => sum + item.durationSeconds, 0);
      if (lastDuration < SEEDANCE_MIN_TASK_DURATION_SECONDS && previousDuration + lastDuration <= SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS) {
        previous.push(...last);
        grouped.pop();
      }
    }
  }

  const replacementSummary = buildReplacementSummary(input.assets);

  // Build one storyboard row per source chunk (i.e., per cut) so multi-shot
  // references produce one row each. A single Seedance task may carry multiple
  // rows when the source duration is short.
  const rows: StoryboardReferenceRow[] = chunks.map((chunk, chunkIndex): StoryboardReferenceRow => {
    const startSeconds = chunk.startSeconds;
    const chunkDuration = clampSeedanceStoryboardDuration(chunk.durationSeconds);
    const endSeconds = startSeconds + chunkDuration;
    const sourceTimeRange = `${formatTimecode(startSeconds)} - ${formatTimecode(endSeconds)}`;
    const shot = chunk.sourceShot;
    const sceneDescription = cleanReferenceTextForStoryboard(
      [
        shot?.firstFrameDescription,
        shot?.contextEnvironment,
        shot?.action
      ].filter(Boolean).join(' '),
      input.assets
    ) || `Row ${chunkIndex + 1} follows the reference timing and replaces source entities with ${replacementSummary}.`;
    const cameraMovement = cleanReferenceTextForStoryboard(shot?.cameraMotionPositioning, input.assets) || 'Preserve the reference camera movement and framing.';
    const soundBgmVoiceLine = cleanReferenceTextForStoryboard(
      [
        shot?.audio,
        shot?.sfx ? `SFX: ${shot.sfx}` : '',
        shot?.ambient ? `Ambient: ${shot.ambient}` : '',
        shot?.dialogue ? `Voice line: ${shot.dialogue}` : ''
      ].filter(Boolean).join(' '),
      input.assets
    ) || 'Preserve the source audio, BGM, and dialogue intent without naming original brands.';
    const storyboardPanelPrompt = [
      `Real TikTok UGC video still for storyboard row ${chunkIndex + 1} (vertical 9:16 phone-camera frame).`,
      `Time range: ${sourceTimeRange}.`,
      `Timing lock: this panel represents exactly ${chunkDuration}s of source-video rhythm; preserve the same action beat, cut timing, hand/object motion pace, and camera beat from this time range.`,
      `Show ${replacementSummary} replacing the original source entities.`,
      sceneDescription,
      `Camera rhythm lock: ${cameraMovement}. Match the original framing, focal distance, handheld shake, push-in/pan/tilt timing, and subject distance for this row.`,
      `Style: TikTok UGC, hand-held phone footage, real human skin, real pet fur, real product packaging, soft natural indoor lighting. NOT anime, NOT illustration, NOT 3D, NOT CGI, NOT storyboard art.`,
      `Identity lock / Full appearance lock: every person in this panel must match the connected avatar reference photo exactly across the full visible body and styling, including face, hair, skin tone, eyewear, accessories, body proportions, clothing color, fabric, cut, fit, sleeves, neckline, visible bottoms, and footwear if visible. Do not copy clothing or styling from the original source video unless it is also in the connected avatar reference.`,
      `Replacement override: ignore any clothing color, hairstyle, footwear, body-shape, age, gender-presentation, or appearance details in the scene description that contradict the avatar reference photo. Render only the connected avatar reference photo's visible attributes for every person in the panel.`,
      `Pet count: render EXACTLY ONE pet (the connected pet reference photo). Do not duplicate the pet even if the source video shows multiple animals.`
    ].join(' ');

    return {
      no: chunkIndex + 1,
      source_time_range: sourceTimeRange,
      duration_seconds: chunkDuration,
      scene_description: sceneDescription,
      camera_movement: cameraMovement,
      sound_bgm_voice_line: soundBgmVoiceLine,
      storyboard_panel_prompt: storyboardPanelPrompt,
      replacement_notes: `Use ${replacementSummary}. Lock identity to the connected reference photos — every person must match the connected avatar's full visible appearance and clothing, not only the face; every product and pet must match the corresponding reference photo. Preserve the source row's timing, action beat, cut order, and camera rhythm. Remove original source characters, products, pets, labels, logos, and brand-specific packaging unless they belong to the replacement asset.`
    };
  });

  const segments = grouped.map((group, index): SegmentPrompt => {
    const startSeconds = group[0]?.startSeconds || 0;
    const rawDuration = group.reduce((sum, item) => sum + item.durationSeconds, 0);
    const durationSeconds = clampSeedanceStoryboardDuration(rawDuration);
    // The storyboard sheet has one row per source chunk. The first chunk in
    // this Seedance task determines which row the per-segment video prompt
    // should reference (rows are indexed by chunk position, not segment position).
    const firstChunkIndex = chunks.indexOf(group[0]);
    const primaryShot = group[0]?.sourceShot;
    const sceneDescription = cleanReferenceTextForStoryboard(
      [
        primaryShot?.firstFrameDescription,
        primaryShot?.contextEnvironment,
        primaryShot?.action
      ].filter(Boolean).join(' '),
      input.assets
    ) || `Scene ${index + 1} follows the reference timing and replaces source entities with ${replacementSummary}.`;
    const cameraMovement = cleanReferenceTextForStoryboard(primaryShot?.cameraMotionPositioning, input.assets) || 'Preserve the reference camera movement and framing.';
    const soundBgmVoiceLine = cleanReferenceTextForStoryboard(
      [
        primaryShot?.audio,
        primaryShot?.sfx ? `SFX: ${primaryShot.sfx}` : '',
        primaryShot?.ambient ? `Ambient: ${primaryShot.ambient}` : '',
        primaryShot?.dialogue ? `Voice line: ${primaryShot.dialogue}` : ''
      ].filter(Boolean).join(' '),
      input.assets
    ) || 'Preserve the source audio, BGM, and dialogue intent without naming original brands.';

    const shots: SegmentShot[] = group.map((chunk, shotIndex) => {
      const localStart = Math.max(0, chunk.startSeconds - startSeconds);
      const localEnd = Math.min(durationSeconds, localStart + chunk.durationSeconds);
      const shot = chunk.sourceShot;
      return {
        id: shotIndex + 1,
        time_range: `${formatTimecode(localStart)} - ${formatTimecode(Math.max(localStart + 1, localEnd))}`,
        start_seconds: localStart,
        end_seconds: Math.max(localStart + 1, localEnd),
        duration_seconds: Math.max(1, Math.max(localStart + 1, localEnd) - localStart),
        audio: cleanReferenceTextForStoryboard(shot.audio, input.assets) || soundBgmVoiceLine,
        sfx: cleanReferenceTextForStoryboard(shot.sfx, input.assets),
        ambient: cleanReferenceTextForStoryboard(shot.ambient, input.assets),
        style: cleanReferenceTextForStoryboard(shot.style, input.assets),
        action: cleanReferenceTextForStoryboard(shot.action, input.assets) || sceneDescription,
        subject: `Replacement subject: ${replacementSummary}. Lock to the avatar/product/pet reference photos; for people, preserve the connected avatar's full visible outfit, styling, accessories, body proportions, hair, and face exactly, not only facial identity. Do not show the original source identity or source wardrobe.`,
        dialogue: cleanReferenceTextForStoryboard(shot.dialogue, input.assets),
        language: input.language || 'en',
        composition: cleanReferenceTextForStoryboard(shot.composition, input.assets),
        context_environment: cleanReferenceTextForStoryboard(shot.contextEnvironment, input.assets),
        ambiance_colour_lighting: cleanReferenceTextForStoryboard(shot.ambianceColourLighting, input.assets),
        camera_motion_positioning: cleanReferenceTextForStoryboard(shot.cameraMotionPositioning, input.assets) || cameraMovement
      };
    });

    return {
      index: index + 1,
      audio: soundBgmVoiceLine,
      style: cleanReferenceTextForStoryboard(primaryShot?.style, input.assets),
      action: sceneDescription,
      subject: `Replacement subject: ${replacementSummary}. Lock to the avatar/product/pet reference photos; for people, preserve the connected avatar's full visible outfit, styling, accessories, body proportions, hair, and face exactly, not only facial identity. Do not show the original source identity or source wardrobe.`,
      composition: cleanReferenceTextForStoryboard(primaryShot?.composition, input.assets),
      context_environment: cleanReferenceTextForStoryboard(primaryShot?.contextEnvironment, input.assets),
      first_frame_description: `Real TikTok UGC first frame for storyboard row ${(firstChunkIndex >= 0 ? firstChunkIndex : index) + 1} (vertical 9:16 phone-camera still). ${sceneDescription} Use ${replacementSummary}; preserve the connected avatar's full visible clothing and styling exactly; do not show the storyboard table layout.`,
      ambiance_colour_lighting: cleanReferenceTextForStoryboard(primaryShot?.ambianceColourLighting, input.assets),
      camera_motion_positioning: cameraMovement,
      dialogue: cleanReferenceTextForStoryboard(primaryShot?.dialogue, input.assets),
      language: input.language || 'en',
      first_frame_image_size: input.aspectRatio,
      is_continuation_from_prev: false,
      shots,
      firstChunkIndex: firstChunkIndex >= 0 ? firstChunkIndex : undefined
    };
  });

  return {
    rows,
    segments,
    durationSeconds: segments.reduce((sum, segment) => sum + getPromptSegmentDurationSeconds(segment), 0)
  };
}

const buildStoryboardSheetPrompt = (input: {
  rows: StoryboardReferenceRow[];
  aspectRatio: '16:9' | '9:16';
  assets: CloneReferenceAssets;
}) => {
  const rowBrief = input.rows.map(row => [
    `No. ${row.no}`,
    `Time: ${row.source_time_range}`,
    `Scene: ${row.scene_description}`,
    `Camera: ${row.camera_movement}`,
    `Sound/BGM/Voice: ${row.sound_bgm_voice_line}`,
    `Replacement: ${row.replacement_notes}`
  ].join('\n')).join('\n\n');

  return truncateText([
    'Create a TikTok UGC reference sheet showing real vertical phone-camera stills from a video.',
    'Use a clean black table border on a white page with numbered rows and columns: No., Storyboard, Scene Description, Camera Movement, Sound / BGM / Voice Line.',
    `Final video aspect ratio target: ${input.aspectRatio}. The sheet itself may be portrait so every row is readable.`,
    'Each artwork cell must look like a vertical 9:16 phone-camera photo / video still from a real TikTok UGC video clip. Hand-held phone footage, real human skin, real pet fur, real product packaging. Soft natural indoor lighting, no studio look, no over-stylized color grading.',
    'HARD EXCLUSIONS — do NOT render any of these in the artwork cells: NOT anime, NOT illustration, NOT 3D render, NOT CGI, NOT vector art, NOT painted panels, NOT commercial storyboard art, NOT drawn storyboards, NOT cartoons, NOT comics.',
    'Use the provided reference images as canonical replacement identity assets. Every person must match the avatar reference photo exactly across the full visible appearance, not only the face: same gender presentation, facial structure, hair, skin tone, eyewear, accessories, body proportions, clothing color, fabric, cut, fit, sleeves, neckline, visible bottoms, footwear if visible, and overall styling. Every product must match the product reference photos exactly: same packaging shape, label layout, brand colors. Every pet must match the pet reference photos exactly: same breed, color, markings.',
    'Replacement override: in every artwork cell, discard any clothing color, footwear, hairstyle, body-shape, age, gender-presentation, or appearance detail from the source video or scene description that contradicts the avatar/product/pet reference photos. The reference photos are the only source of truth for appearance and wardrobe; the source video is only a source of truth for action, shot order, timing, pacing, camera rhythm, and scene progression.',
    'Rhythm lock: preserve the original reference-video cut order, row duration, action timing, camera movement, handheld shake, push-in/pan/tilt speed, subject distance, and motion pacing exactly for each row.',
    'Pet count: each panel shows EXACTLY ONE pet. Do not duplicate or multiply the pet even if the source video shows multiple animals. Render only the connected pet reference photo.',
    `Replacement mapping: ${buildReplacementSummary(input.assets)}.`,
    'Remove original source characters, products, pets, labels, logos, and brand-specific packaging unless they belong to the replacement asset. Do not invent or substitute the original source identity.',
    'The table text must be concise, legible English. No watermarks, no extra commentary outside the sheet.',
    '',
    rowBrief
  ].join('\n'), 3800);
};

export type CloneModeResolution = {
  isCloneMode: boolean;
  mediaType: 'video' | null;
  sourceId: string | null;
};

const normalizeSelectedIds = (
  primaryId: string | null | undefined,
  ids: string[] | undefined,
  max = 8
): string[] => {
  const candidates = [
    ...(typeof primaryId === 'string' ? [primaryId] : []),
    ...(Array.isArray(ids) ? ids : [])
  ];
  const normalized: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed || normalized.includes(trimmed)) continue;
    normalized.push(trimmed);
    if (normalized.length >= max) break;
  }
  return normalized;
};

const normalizeReferenceMediaType = (value: unknown): 'video' | null => {
  return value === 'video' ? 'video' : null;
};

const normalizeReferenceSourceId = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

export function resolveCloneModeFromProject(project: SingleVideoProject | Record<string, unknown> | null | undefined): CloneModeResolution {
  const projectRecord = project && typeof project === 'object'
    ? project as Record<string, unknown>
    : null;
  const selectedInputs =
    projectRecord?.selected_inputs && typeof projectRecord.selected_inputs === 'object'
      ? projectRecord.selected_inputs as VideoCloneSelectedInputs
      : null;

  const mediaType = normalizeReferenceMediaType(selectedInputs?.referenceSourceMediaType);
  const sourceId = normalizeReferenceSourceId(selectedInputs?.referenceSourceId);
  const isCloneFlag = selectedInputs?.isCloneMode === true;

  if (isCloneFlag || mediaType === 'video') {
    return {
      isCloneMode: true,
      mediaType: 'video',
      sourceId
    };
  }

  const legacyProjectRecord = projectRecord as Record<string, unknown> | null | undefined;
  const legacyReferenceVideoId = typeof legacyProjectRecord?.reference_video_id === 'string' && legacyProjectRecord.reference_video_id.trim().length > 0
    ? legacyProjectRecord.reference_video_id.trim()
    : null;

  if (legacyReferenceVideoId) {
    return {
      isCloneMode: true,
      mediaType: 'video',
      sourceId: sourceId || legacyReferenceVideoId
    };
  }

  return {
    isCloneMode: false,
    mediaType,
    sourceId
  };
}

export type SerializedSegmentPlan = {
  segments: Array<SerializedSegmentPlanSegment>;
};

export type SerializedSegmentPlanSegment = {
  first_frame_description?: string;
  is_continuation_from_prev?: boolean;
  shots?: SegmentShot[];
};

type DerivedSegmentDetails = {
  description: string;
  setting: string;
  camera_type: string;
  camera_movement: string;
  action: string;
  lighting: string;
  dialogue: string;
  music: string;
  ending: string;
  other_details: string;
  language: string;
  first_frame_prompt: string;
};

const SEGMENT_DEFAULTS: DerivedSegmentDetails = {
  description: 'Cinematic hero moment highlighting the product',
  setting: 'Premium studio environment',
  camera_type: 'Wide cinematic shot',
  camera_movement: 'Slow push-in',
  action: 'Showcase the hero product in use',
  lighting: 'Soft commercial lighting with warm highlights',
  dialogue: 'Narrate the key benefit in a concise sentence',
  music: 'Tasteful cinematic underscore',
  ending: 'Hold on the hero product for a strong finish',
  other_details: 'Maintain polished advertising aesthetics and consistent color palette',
  language: 'English',
  first_frame_prompt: 'Hero product centered in frame with premium lighting'
};

const cleanSegmentText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value
    .replace(/(^|[\s(])'s\b/g, '$1')
    .replace(/\bof\s+'s\b/g, 'of')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

function buildProjectAgentFramePrompt(input: {
  segmentIndex: number;
  frameType: 'first' | 'closing';
  frameDescription: string;
  isBrandShot: boolean;
}): string {
  const { segmentIndex, frameType, frameDescription, isBrandShot } = input;
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const sanitizedDescription = cleanSegmentText(frameDescription) || 'Product-focused close-up frame.';

  return `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

Use the provided ${isBrandShot ? 'brand asset' : 'product image'} as the canonical reference. Maintain identical proportions, textures, materials, and branding.

Scene Focus:
- Description: ${sanitizedDescription}

Render Instructions:
- Follow the scene description exactly and prioritize the frame prompt over any earlier shot-planning wording
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;
}

const collectDistinctUrls = (values: Array<string | null | undefined>, max = 10): string[] => {
  const output: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || output.includes(trimmed)) continue;
    output.push(trimmed);
    if (output.length >= max) break;
  }
  return output;
};

export const isProjectAgentSeedanceReferenceImageMode = (input: {
  requestSource?: string | null;
  videoModel?: VideoModel | null;
  resolvedVideoModel?: VideoModel | null;
  executionMode?: string | null;
}) => (
  input.requestSource === 'project_agent_clone' &&
  ((input.resolvedVideoModel || input.videoModel) === 'seedance_2_fast' ||
    (input.resolvedVideoModel || input.videoModel) === 'seedance_2_mini') &&
  input.executionMode === 'clone_direct_reference'
);

export const isProjectAgentSeedanceReferenceImageProject = (
  project: Pick<SingleVideoProject, 'video_model' | 'selected_inputs'>
) => {
  const selectedInputs = project.selected_inputs && typeof project.selected_inputs === 'object'
    ? project.selected_inputs as Record<string, unknown>
    : null;
  return (project.video_model === 'seedance_2_fast' || project.video_model === 'seedance_2_mini') &&
    selectedInputs?.workflowSource === 'project_agent_clone' &&
    selectedInputs?.executionMode === 'clone_direct_reference';
};

export const isSeedanceStoryboardReferenceProject = (
  project: Pick<SingleVideoProject, 'video_model' | 'selected_inputs'>
) => {
  const selectedInputs = project.selected_inputs && typeof project.selected_inputs === 'object'
    ? project.selected_inputs as Record<string, unknown>
    : null;
  return isSeedanceCloneModel(project.video_model as VideoModel) &&
    selectedInputs?.executionMode === 'clone_storyboard_reference';
};

export const getProjectAgentSeedanceReferenceImageUrls = (
  project: Pick<SingleVideoProject, 'video_model' | 'selected_inputs' | 'video_prompts'>,
  max = 9
) => {
  const isLegacyDirectReference = isProjectAgentSeedanceReferenceImageProject(project);
  const isStoryboardReference = isSeedanceStoryboardReferenceProject(project);
  if (!isLegacyDirectReference && !isStoryboardReference) return [];

  const prompts = project.video_prompts && typeof project.video_prompts === 'object'
    ? project.video_prompts as Record<string, unknown>
    : {};
  const cloneAssets = prompts.clone_reference_assets && typeof prompts.clone_reference_assets === 'object'
    ? prompts.clone_reference_assets as Record<string, unknown>
    : {};
  const avatarPhotoUrls = Array.isArray(cloneAssets.avatarPhotoUrls)
    ? cloneAssets.avatarPhotoUrls
    : [];
  const productImageUrls = Array.isArray(cloneAssets.productImageUrls)
    ? cloneAssets.productImageUrls
    : [];
  const petPhotoUrls = Array.isArray(cloneAssets.petPhotoUrls)
    ? cloneAssets.petPhotoUrls
    : [];
  const storyboardMode = prompts.storyboard_mode && typeof prompts.storyboard_mode === 'object'
    ? prompts.storyboard_mode as Record<string, unknown>
    : null;
  const storyboardImageUrl = typeof storyboardMode?.storyboard_image_url === 'string'
    ? storyboardMode.storyboard_image_url
    : null;

  if (isStoryboardReference) {
    // Storyboard-reference mode: the rendered storyboard sheet already contains
    // the replacement identity baked in (avatar/product/pet are anchored at the
    // GPT-Image stage). The Seedance video task only needs the sheet itself.
    return collectDistinctUrls([storyboardImageUrl], 1);
  }

  return collectDistinctUrls(
    [
      ...avatarPhotoUrls,
      ...productImageUrls,
      ...petPhotoUrls
    ].map((url) => (
      typeof url === 'string' ? url : null
    )),
    max
  );
};

type DirectReferenceImagePlan = {
  referenceImageUrls: string[];
  promptDirectives: string[];
};

const buildDirectReferenceImagePlan = (assets: {
  avatarPhotoUrls?: string[] | null;
  productImageUrls?: string[] | null;
  petPhotoUrls?: string[] | null;
  avatarName?: string | null;
  productName?: string | null;
  petName?: string | null;
}): DirectReferenceImagePlan => {
  const avatarImages = Array.isArray(assets.avatarPhotoUrls)
    ? collectDistinctUrls(
        assets.avatarPhotoUrls.map((url) => (typeof url === 'string' ? url : null)),
        2
      )
    : [];
  const productImages = Array.isArray(assets.productImageUrls)
    ? collectDistinctUrls(
        assets.productImageUrls.map((url) => (typeof url === 'string' ? url : null)),
        2
      )
    : [];
  const petImages = Array.isArray(assets.petPhotoUrls)
    ? collectDistinctUrls(
        assets.petPhotoUrls.map((url) => (typeof url === 'string' ? url : null)),
        2
      )
    : [];

  const referenceImageUrls = [...avatarImages, ...productImages, ...petImages];
  const hasReplacementImages = referenceImageUrls.length > 0;
  const promptDirectives: string[] = [
    'Use the reference video as the primary source of truth for motion, timing, shot order, framing, pacing, camera movement, and scene progression.',
    'Do not open on a static portrait or isolated packshot unless the source video itself opens that way.',
    'Preserve the source video hand interactions, eyelines, object placement, and action beats.',
  ];

  if (hasReplacementImages) {
    promptDirectives.push(
      'Use the replacement images only as identity anchors for the featured person, product, or pet, not as independent storyboard frames, cutaways, or slideshow images.'
    );
  } else {
    promptDirectives.push(
      'No replacement images were provided. Recreate the reference video structure, pacing, camera motion, framing, and commercial style directly from the source video.'
    );
  }

  if (avatarImages.length > 0) {
    promptDirectives.push(
      'The featured person must match the replacement avatar reference images throughout the full video, including the opening shot, and should keep the clothing, hair, face, and overall styling shown in those reference images.'
    );
    promptDirectives.push(
      'Do not leave the original presenter identity visible in any presenter-focused shot. The original presenter must be fully replaced by the replacement person.'
    );
  }

  if (productImages.length > 0) {
    promptDirectives.push(
      'The featured product must match the replacement product reference images throughout the full video, including the opening shot, and should keep the packaging shape, label layout, brand colors, and material cues shown in those reference images.'
    );
    promptDirectives.push(
      'Do not leave the original source product or packaging visible in any product-focused shot. The original product must be fully replaced by the replacement product.'
    );
  }

  if (avatarImages.length > 0 || productImages.length > 0 || petImages.length > 0) {
    promptDirectives.push(
      'If there is any conflict between preserving the source subject identity and applying replacement identities, prioritize the replacement person, replacement product, and replacement pet.'
    );
  }

  if (petImages.length === 0) {
    promptDirectives.push(
      'If the source video includes an animal or pet interacting with the product, preserve that interaction while replacing only the intended person and product identities.'
    );
  } else {
    promptDirectives.push(
      'If the source video includes an animal or pet interacting with the product, preserve that interaction while replacing the intended person, product, and pet identities.'
    );
  }

  if (petImages.length > 0) {
    promptDirectives.push(
      'If the source video includes a featured pet or animal (e.g., a cat, dog, or other on-screen companion), replace it with the replacement pet shown in the pet reference images. Preserve breed identity, fur color, coat pattern, markings, body plan, and overall silhouette, but swap the face, distinct markings, and personality cues so the on-screen pet matches the replacement pet across every shot.'
    );
    promptDirectives.push(
      'Do not leave the original source pet visible in any pet-focused or co-star shot. Whenever the source video shows the original animal, the replacement pet must appear in the same position, with the same pose, action, and eyeline, but rendered with the replacement pet\'s identity.'
    );
  }

  const referenceSegments: string[] = [];
  let cursor = 0;
  if (avatarImages.length > 0) {
    const indexes = avatarImages.map((_, index) => `@Image ${cursor + index + 1}`).join(' and ');
    referenceSegments.push(
      `${indexes} show the same replacement featured person${assets.avatarName ? ` (${assets.avatarName})` : ''} from representative views.`
    );
    cursor += avatarImages.length;
  }
  if (productImages.length > 0) {
    const indexes = productImages.map((_, index) => `@Image ${cursor + index + 1}`).join(' and ');
    referenceSegments.push(
      `${indexes} show the same replacement product or packaging${assets.productName ? ` (${assets.productName})` : ''} from representative views.`
    );
    cursor += productImages.length;
  }
  if (petImages.length > 0) {
    const indexes = petImages.map((_, index) => `@Image ${cursor + index + 1}`).join(' and ');
    referenceSegments.push(
      `${indexes} show the same replacement featured pet or animal${assets.petName ? ` (${assets.petName})` : ''} from representative views.`
    );
    cursor += petImages.length;
  }
  if (referenceSegments.length > 0) {
    promptDirectives.push(`Reference mapping: ${referenceSegments.join(' ')}`);
  }

  return {
    referenceImageUrls,
    promptDirectives,
  };
};

async function resolveCloneReferenceAssets(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: StartWorkflowRequest
): Promise<CloneReferenceAssets> {
  const selectedAvatarIds = normalizeSelectedIds(request.selectedAvatarId, request.selectedAvatarIds, 8);
  const selectedProductIds = normalizeSelectedIds(request.selectedProductId, request.selectedProductIds, 8);
  const selectedPetIds = normalizeSelectedIds(request.selectedPetId, request.selectedPetIds, 8);
  const primaryAvatarId = selectedAvatarIds[0] || null;
  const primaryProductId = selectedProductIds[0] || null;
  const primaryPetId = selectedPetIds[0] || null;

  const assets: CloneReferenceAssets = {
    selectedAvatarId: primaryAvatarId,
    selectedProductId: primaryProductId,
    selectedPetId: primaryPetId,
    selectedAvatarIds,
    selectedProductIds,
    selectedPetIds,
    avatarPhotoUrls: [],
    productImageUrls: [],
    petPhotoUrls: []
  };

  if (selectedProductIds.length > 0) {
    const systemProductsById = new Map(
      SYSTEM_PRODUCTS.map((product) => [product.id, product])
    );
    const userProductIds = selectedProductIds.filter((id) => !isSystemProductId(id));

    let userProductsById = new Map<string, {
      id: string;
      product_name?: string | null;
      user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }>;
    }>();

    if (userProductIds.length > 0) {
      const { data: selectedProducts, error: productError } = await supabase
        .from('user_products')
        .select('id,product_name,user_product_photos(photo_url,is_primary)')
        .in('id', userProductIds)
        .eq('user_id', request.userId)
        .limit(16);

      if (productError) {
        console.warn('[Clone Assets] Failed to resolve selected product:', productError.message);
      } else {
        const productRows = Array.isArray(selectedProducts)
          ? selectedProducts as Array<{
              id: string;
              product_name?: string | null;
              user_product_photos?: Array<{ photo_url?: string; is_primary?: boolean }>;
            }>
          : [];
        userProductsById = new Map(productRows.map((product) => [product.id, product]));
      }
    }

    const mergedProductPhotoUrls: Array<string | null> = [];
    let primaryProductName: string | null = null;

    for (const selectedProductId of selectedProductIds) {
      const systemProduct = systemProductsById.get(selectedProductId) || null;
      if (systemProduct) {
        if (!primaryProductName) {
          primaryProductName = systemProduct.product_name || null;
        }
        const systemUrls = getSystemProductPhotoUrls(systemProduct, 8);
        mergedProductPhotoUrls.push(...systemUrls);
        continue;
      }

      const userProduct = userProductsById.get(selectedProductId);
      if (!userProduct) {
        continue;
      }

      if (!primaryProductName) {
        primaryProductName = userProduct.product_name || null;
      }

      const photos = Array.isArray(userProduct.user_product_photos)
        ? userProduct.user_product_photos
        : [];
      const orderedPhotos = [
        ...photos.filter((photo) => photo.is_primary),
        ...photos.filter((photo) => !photo.is_primary)
      ];
      for (const photo of orderedPhotos) {
        mergedProductPhotoUrls.push(photo.photo_url || null);
      }
    }

    if (mergedProductPhotoUrls.length === 0) {
      console.warn('[Clone Assets] Selected product ids not found for user:', selectedProductIds);
    } else {
      assets.productImageUrls = collectDistinctUrls(mergedProductPhotoUrls, 8);
      assets.productName = primaryProductName;
    }
  }

  if (selectedAvatarIds.length > 0) {
    const mergedAvatarUrls: Array<string | null> = [];
    let primaryAvatarName: string | null = null;

    for (let avatarIndex = 0; avatarIndex < selectedAvatarIds.length; avatarIndex++) {
      const avatarId = selectedAvatarIds[avatarIndex];
      const systemAvatar = SYSTEM_AVATARS.find((avatar) => avatar.id === avatarId);
      if (systemAvatar) {
        if (avatarIndex === 0) {
          primaryAvatarName = systemAvatar.avatar_name || null;
        }
        mergedAvatarUrls.push(...getAvatarPhotoUrls(systemAvatar));
        continue;
      }

      const queryWithPhotoSet = await supabase
        .from('user_avatars')
        .select('id,avatar_name,photo_url,photo_set_json')
        .eq('id', avatarId)
        .eq('user_id', request.userId)
        .maybeSingle();

      let avatarData = queryWithPhotoSet.data as Record<string, unknown> | null;
      let avatarError = queryWithPhotoSet.error as { code?: string; message?: string } | null;

      if (avatarError?.code === '42703') {
        const fallbackQuery = await supabase
          .from('user_avatars')
          .select('id,avatar_name,photo_url')
          .eq('id', avatarId)
          .eq('user_id', request.userId)
          .maybeSingle();
        avatarData = fallbackQuery.data as Record<string, unknown> | null;
        avatarError = fallbackQuery.error as { code?: string; message?: string } | null;
      }

      if (avatarError) {
        console.warn('[Clone Assets] Failed to resolve selected avatar:', avatarError.message || avatarError.code || 'unknown');
        continue;
      }
      if (!avatarData) {
        console.warn('[Clone Assets] Selected avatar id not found for user:', avatarId);
        continue;
      }

      const avatarName = typeof avatarData.avatar_name === 'string' ? avatarData.avatar_name : null;
      if (avatarIndex === 0) {
        primaryAvatarName = avatarName;
      }
      mergedAvatarUrls.push(...getAvatarPhotoUrls({
        photo_url: typeof avatarData.photo_url === 'string' ? avatarData.photo_url : null,
        photo_set_json:
          avatarData.photo_set_json && typeof avatarData.photo_set_json === 'object'
            ? (avatarData.photo_set_json as Record<string, unknown>)
            : null,
      }));
    }

    assets.avatarPhotoUrls = collectDistinctUrls(mergedAvatarUrls, 4);
    assets.avatarName = primaryAvatarName;
  }

  if (selectedPetIds.length > 0) {
    const mergedPetUrls: Array<string | null> = [];
    let primaryPetName: string | null = null;

    for (let petIndex = 0; petIndex < selectedPetIds.length; petIndex++) {
      const petId = selectedPetIds[petIndex];
      const { data: petRow, error: petError } = await supabase
        .from('user_pets')
        .select('id,pet_name,front_photo_url,side_photo_url,back_photo_url')
        .eq('id', petId)
        .eq('user_id', request.userId)
        .maybeSingle();

      if (petError) {
        console.warn('[Clone Assets] Failed to resolve selected pet:', petError.message || petError.code || 'unknown');
        continue;
      }
      if (!petRow) {
        console.warn('[Clone Assets] Selected pet id not found for user:', petId);
        continue;
      }

      const petName = typeof petRow.pet_name === 'string' ? petRow.pet_name : null;
      if (petIndex === 0) {
        primaryPetName = petName;
      }

      mergedPetUrls.push(
        typeof petRow.front_photo_url === 'string' ? petRow.front_photo_url : null,
        typeof petRow.side_photo_url === 'string' ? petRow.side_photo_url : null,
        typeof petRow.back_photo_url === 'string' ? petRow.back_photo_url : null,
      );
    }

    if (mergedPetUrls.length === 0) {
      console.warn('[Clone Assets] Selected pet ids not found for user:', selectedPetIds);
    } else {
      assets.petPhotoUrls = collectDistinctUrls(mergedPetUrls, 4);
      assets.petName = primaryPetName;
    }
  }

  return assets;
}

const normalizeShotTimeRange = (
  raw: unknown,
  fallbackStart: number,
  fallbackDuration: number
): { display: string; start: number; end: number; duration: number } => {
  if (typeof raw === 'string') {
    const parts = raw.split('-').map(part => part.trim());
    if (parts.length === 2) {
      const start = parseTimecode(parts[0]) ?? fallbackStart;
      const parsedEnd = parseTimecode(parts[1]);
      if (parsedEnd !== null && parsedEnd !== undefined && parsedEnd > start) {
        const duration = Math.max(1, Math.round(parsedEnd - start));
        return {
          display: `${formatTimecode(start)} - ${formatTimecode(parsedEnd)}`,
          start,
          end: parsedEnd,
          duration
        };
      }
      const end = fallbackStart + fallbackDuration;
      const duration = Math.max(1, Math.round(end - start));
      return {
        display: `${formatTimecode(start)} - ${formatTimecode(end)}`,
        start,
        end,
        duration
      };
    }
  }

  const start = fallbackStart;
  const end = fallbackStart + fallbackDuration;
  return {
    display: `${formatTimecode(start)} - ${formatTimecode(end)}`,
    start,
    end,
    duration: Math.max(1, Math.round(fallbackDuration))
  };
};

const buildFallbackShot = (
  id: number,
  language: string,
  segment: Partial<SegmentPrompt>,
  durationSeconds: number
): SegmentShot => {
  const { display, start, end, duration } = normalizeShotTimeRange(undefined, 0, durationSeconds);
  return {
    id,
    time_range: display,
    start_seconds: start,
    end_seconds: end,
    duration_seconds: duration,
    audio: cleanSegmentText(segment.audio) || '',
    style: cleanSegmentText(segment.style) || '',
    action: cleanSegmentText(segment.action) || '',
    subject: cleanSegmentText(segment.subject) || '',
    dialogue: cleanSegmentText(segment.dialogue) || '',
    language,
    composition: cleanSegmentText(segment.composition) || '',
    context_environment: cleanSegmentText(segment.context_environment) || '',
    ambiance_colour_lighting: cleanSegmentText(segment.ambiance_colour_lighting) || '',
    camera_motion_positioning: cleanSegmentText(segment.camera_motion_positioning) || ''
  };
};

const convertReferenceVideoShotToSegmentShot = (
  id: number,
  language: string,
  shot: ReferenceVideoShot,
  fallbackDuration: number
): SegmentShot => {
  // Each segment is independent with segment-relative timing, not source-video absolute timing.
  const startSeconds = 0;
  const durationSeconds = fallbackDuration; // Use segment duration directly (model-relative duration)
  const endSeconds = startSeconds + durationSeconds;
  return {
    id,
    time_range: `${formatTimecode(startSeconds)} - ${formatTimecode(endSeconds)}`,
    start_seconds: startSeconds,
    end_seconds: endSeconds,
    duration_seconds: durationSeconds,
    audio: shot.audio || '',
    sfx: shot.sfx || '',
    ambient: shot.ambient || '',
    style: shot.style || '',
    action: shot.action || '',
    subject: shot.subject || '',
    dialogue: shot.dialogue || '',
    language,
    composition: shot.composition || '',
    context_environment: shot.contextEnvironment || '',
    ambiance_colour_lighting: shot.ambianceColourLighting || '',
    camera_motion_positioning: shot.cameraMotionPositioning || ''
  };
};

const normalizeSegmentShots = (
  rawShots: unknown,
  segmentDurationSeconds: number,
  defaultLanguage: string,
  fallbackSegment: Partial<SegmentPrompt>,
  referenceVideoShot?: ReferenceVideoShot
): SegmentShot[] => {
  const duration = Number.isFinite(segmentDurationSeconds) && segmentDurationSeconds > 0
    ? segmentDurationSeconds
    : 0;
  if (duration <= 0) {
    throw new Error('Segment duration is required for shot normalization.');
  }

  // CRITICAL FIX: When a reference shot is provided, use ONLY that shot
  // Do NOT process rawShots which may contain all shots from the full timeline
  // This prevents data duplication and JSON Schema overflow
  if (referenceVideoShot) {
    console.log(`🔧 [NORMALIZATION] Using single reference shot (ID: ${referenceVideoShot.id}), ignoring rawShots array to prevent duplication`);
    return [convertReferenceVideoShotToSegmentShot(1, defaultLanguage, referenceVideoShot, duration)];
  }

  if (Array.isArray(rawShots) && rawShots.length > 0) {
    return rawShots.map((shot, index) => {
      const record = (shot && typeof shot === 'object') ? (shot as Record<string, unknown>) : {};
      const perShotDuration = duration / rawShots.length;
      // For segment-relative timing, always start from 0 and use segment duration
      const { display, start, end, duration: normalizedDuration } = normalizeShotTimeRange(
        undefined,  // Ignore existing time_range, force segment-relative timing
        Math.round(index * perShotDuration),  // Offset for this shot within segment
        perShotDuration  // Duration for this shot within segment
      );

      return {
        id: index + 1,
        time_range: display,
        start_seconds: start,
        end_seconds: end,
        duration_seconds: normalizedDuration,
        audio: cleanSegmentText(record.audio) || cleanSegmentText(fallbackSegment.audio) || '',
        sfx: cleanSegmentText(record.sfx) || '',
        ambient: cleanSegmentText(record.ambient) || '',
        style: cleanSegmentText(record.style) || cleanSegmentText(fallbackSegment.style) || '',
        action: cleanSegmentText(record.action) || cleanSegmentText(fallbackSegment.action) || '',
        subject: cleanSegmentText(record.subject) || cleanSegmentText(fallbackSegment.subject) || '',
        dialogue: cleanSegmentText(record.dialogue) || cleanSegmentText(fallbackSegment.dialogue) || '',
        language: cleanSegmentText(record.language) || defaultLanguage,
        composition: cleanSegmentText(record.composition) || cleanSegmentText(fallbackSegment.composition) || '',
        context_environment: cleanSegmentText(record.context_environment) || cleanSegmentText(fallbackSegment.context_environment) || '',
        ambiance_colour_lighting: cleanSegmentText(record.ambiance_colour_lighting) || cleanSegmentText(fallbackSegment.ambiance_colour_lighting) || '',
        camera_motion_positioning: cleanSegmentText(record.camera_motion_positioning) || cleanSegmentText(fallbackSegment.camera_motion_positioning) || ''
      };
    });
  }

  return [buildFallbackShot(1, defaultLanguage, fallbackSegment, duration)];
};

export function deriveSegmentDetails(segment: SegmentPrompt): DerivedSegmentDetails {
  const primaryShot = Array.isArray(segment.shots) && segment.shots.length > 0 ? segment.shots[0] : undefined;
  const subject = cleanSegmentText(primaryShot?.subject) || cleanSegmentText(segment.subject);
  const action = cleanSegmentText(primaryShot?.action) || cleanSegmentText(segment.action);
  const style = cleanSegmentText(primaryShot?.style) || cleanSegmentText(segment.style);
  const descriptionParts = [
    action,
    subject ? `Hero focus: ${subject}` : undefined,
    style ? `Style: ${style}` : undefined
  ].filter(Boolean);

  const description = descriptionParts.join('. ') || SEGMENT_DEFAULTS.description;
  const setting = cleanSegmentText(primaryShot?.context_environment) || cleanSegmentText(segment.context_environment) || SEGMENT_DEFAULTS.setting;
  const cameraType = cleanSegmentText(primaryShot?.composition) || cleanSegmentText(segment.composition) || SEGMENT_DEFAULTS.camera_type;
  const cameraMovement = cleanSegmentText(primaryShot?.camera_motion_positioning) || cleanSegmentText(segment.camera_motion_positioning) || SEGMENT_DEFAULTS.camera_movement;
  const lighting = cleanSegmentText(primaryShot?.ambiance_colour_lighting) || cleanSegmentText(segment.ambiance_colour_lighting) || SEGMENT_DEFAULTS.lighting;
  const dialogue = cleanSegmentText(primaryShot?.dialogue) || cleanSegmentText(segment.dialogue) || SEGMENT_DEFAULTS.dialogue;
  const music = cleanSegmentText(primaryShot?.audio) || cleanSegmentText(segment.audio) || SEGMENT_DEFAULTS.music;
  const otherDetails = style ? `Visual style: ${style}` : SEGMENT_DEFAULTS.other_details;
  const firstFrame = cleanSegmentText(segment.first_frame_description) || description;

  return {
    description,
    setting,
    camera_type: cameraType,
    camera_movement: cameraMovement,
    action: action || SEGMENT_DEFAULTS.action,
    lighting,
    dialogue,
    music,
    ending: action || SEGMENT_DEFAULTS.ending,
    other_details: otherDetails,
    language: cleanSegmentText(segment.language) || SEGMENT_DEFAULTS.language,
    first_frame_prompt: firstFrame
  };
}

export interface SegmentStatusPayload {
  total: number;
  framesReady: number;
  videosReady: number;
  segments: Array<{
    index: number;
    status: string;
    firstFrameUrl?: string | null;
    closingFrameUrl?: string | null;
    videoUrl?: string | null;
    errorMessage?: string | null;
  }>;
  mergedVideoUrl?: string | null;
}

export function isSegmentedVideoRequest(
  model: VideoModel,
  videoDuration?: string | null
): boolean {
  const duration = Number(videoDuration);
  if (!Number.isFinite(duration)) return false;
  return duration > getSegmentDurationForModel(model);
}

function resolvePerSegmentDurationSeconds(
  model: VideoModel,
  totalDuration: string | undefined,
  segmentCount: number
): number {
  const fallback = getSegmentDurationForModel(model);
  const normalizedSegmentCount = Math.max(1, segmentCount);
  const totalSeconds = Number(totalDuration);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return fallback;
  }

  const equalized = Math.ceil(totalSeconds / normalizedSegmentCount);
  return Math.max(1, equalized);
}

function normalizeRequestedDuration(
  model: VideoModel,
  rawDuration?: string | null
): VideoDuration | undefined {
  if (!rawDuration) return undefined;
  const seconds = Number(rawDuration);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return snapDurationToModel(model, Math.min(seconds, 64));
}

export function buildManualCloneSeedPrompts(options: {
  videoModel: VideoModel;
  segmentCount: number;
  videoDuration?: VideoDuration;
  language?: string;
  referenceVideoShots: ReferenceVideoShot[];
  referenceTotalDurationSeconds?: number;
}): SegmentPrompt[] {
  const {
    videoModel,
    segmentCount,
    videoDuration,
    language,
    referenceVideoShots,
    referenceTotalDurationSeconds
  } = options;

  if (segmentCount <= 0) {
    return [];
  }

  if (referenceVideoShots.length > 0) {
    return buildSegmentPlanFromReferenceVideoShots(segmentCount, referenceVideoShots);
  }

  return normalizeSegmentPrompts(
    { segments: Array.from({ length: segmentCount }, (_, index) => ({ index: index + 1 })) },
    segmentCount,
    undefined,
    resolvePerSegmentDurationSeconds(videoModel, videoDuration, segmentCount)
  );
}


export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

    if (request.executionMode === 'edit_video') {
      return startEditVideoWorkflow(request);
    }

    let imageUrl = request.imageUrl;
    const productContext = { product_name: '' };
    const cloneReferenceAssets = await resolveCloneReferenceAssets(supabase, request);

    if (!imageUrl && cloneReferenceAssets.productImageUrls.length > 0) {
      imageUrl = cloneReferenceAssets.productImageUrls[0];
    }

    if (!request.referenceVideoId && !request.creatorSourceVideoId) {
      return {
        success: false,
        error: 'Reference video required',
        details: 'Select a reference video or photo to clone before generating.'
      };
    }

    // imageUrl is optional when using reference-video mode
    // It will be used if available, otherwise Text-to-Image will be used

    // Load reference video if provided (optional reference for creative direction)
    // Reference videos store analysis data only (not original source files)
    // Extended type to include existing analysis and language for performance optimization
  let referenceVideoContext: {
    id?: string;
    reference_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  } | undefined;

    if (request.referenceVideoId) {
      console.log(`🎯 Loading reference video: ${request.referenceVideoId}`);
      const systemReferenceVideo = getSystemReferenceVideoById(request.referenceVideoId);
      if (systemReferenceVideo) {
        referenceVideoContext = {
          id: request.referenceVideoId,
          reference_name: systemReferenceVideo.reference_name,
          existing_analysis: systemReferenceVideo.analysis_result as unknown as Record<string, unknown>,
          analysis_status: systemReferenceVideo.analysis_status,
          language: systemReferenceVideo.language,
          video_duration_seconds: systemReferenceVideo.video_duration_seconds
        };
      } else {
        const fetchReferenceVideo = async () => {
          const { data: referenceVideo, error: referenceVideoError} = await supabase
            .from('reference_videos')
            .select('reference_name, analysis_result, analysis_status, language, video_duration_seconds')
            .eq('id', request.referenceVideoId)
            .eq('user_id', request.userId)
            .single();
          if (referenceVideoError) throw referenceVideoError;
          return referenceVideo;
        };

        try {
          const referenceVideo = await retryAsync(fetchReferenceVideo, { maxAttempts: 3, baseDelayMs: 500, label: 'Reference video fetch' });

          referenceVideoContext = {
            id: request.referenceVideoId,
            reference_name: referenceVideo.reference_name,
            existing_analysis: referenceVideo.analysis_result,
            analysis_status: referenceVideo.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
            language: referenceVideo.language,
            video_duration_seconds: referenceVideo.video_duration_seconds
          };
        } catch (referenceVideoError) {
          console.warn(`⚠️ Reference video not found or access denied: ${request.referenceVideoId}`, referenceVideoError);
          // Don't fail the workflow if reference video is not found, just proceed without it
        }
      }

      if (referenceVideoContext) {
        console.log(`✅ Reference video loaded: ${referenceVideoContext.reference_name}`);
        console.log(`📊 Analysis status: ${referenceVideoContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!referenceVideoContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${referenceVideoContext.language || 'none'}`);
      }
    }

    const creatorLookupId = request.creatorSourceVideoId || (!referenceVideoContext ? request.referenceVideoId : null);
    if (!referenceVideoContext && creatorLookupId) {
      console.log(`🎯 Loading reference video analysis: ${creatorLookupId}`);
      const fetchReferenceVideo = async () => {
        // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_result, analysis_language, duration_seconds
        const { data: referenceVideo, error: referenceError } = await supabase
          .from('creator_source_videos')
          .select('description, analysis_result, analysis_status, analysis_language, duration_seconds')
          .eq('id', creatorLookupId)
          .eq('user_id', request.userId)
          .single();
        if (referenceError) throw referenceError;
        return referenceVideo;
      };

      try {
        const referenceVideo = await retryAsync(fetchReferenceVideo, { maxAttempts: 3, baseDelayMs: 500, label: 'Reference video fetch' });
        referenceVideoContext = {
          id: creatorLookupId,
          reference_name: referenceVideo.description || 'Reference video',
          existing_analysis: referenceVideo.analysis_result,
          analysis_status: referenceVideo.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
          language: referenceVideo.analysis_language,
          video_duration_seconds: referenceVideo.duration_seconds
        };
        console.log(`✅ Reference video analysis loaded`);
        console.log(`📊 Analysis status: ${referenceVideoContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!referenceVideoContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${referenceVideoContext.language || 'none'}`);
      } catch (referenceError) {
        console.warn(`⚠️ Reference video not found or access denied: ${request.creatorSourceVideoId}`, referenceError);
      }
    }

    // Use the selected video model directly
    const actualVideoModel: VideoModel = request.videoModel;
    const referenceDurationSeconds = Number(referenceVideoContext?.video_duration_seconds || 0);
    const projectAgentCloneSourceDuration = request.requestSource === 'project_agent_clone'
      ? normalizeCloneDurationSeconds(request.videoDuration) || normalizeCloneDurationSeconds(referenceDurationSeconds)
      : null;
    if (projectAgentCloneSourceDuration) {
      request.videoDuration = String(projectAgentCloneSourceDuration) as VideoDuration;
    }
    const shouldPreserveStoryboardCloneDuration =
      request.executionMode === 'clone_storyboard_reference' ||
      (request.requestSource === 'project_agent_clone' && isSeedanceCloneModel(actualVideoModel));
    request.videoDuration = shouldPreserveStoryboardCloneDuration
      ? String(
          normalizeCloneDurationSeconds(request.videoDuration) ||
          normalizeCloneDurationSeconds(referenceDurationSeconds) ||
          8
        ) as VideoDuration
      : normalizeRequestedDuration(
          actualVideoModel,
          request.videoDuration
        );
    const projectAgentCloneExecutionMode = request.requestSource === 'project_agent_clone' && isSeedanceCloneModel(actualVideoModel)
      ? getProjectAgentCloneExecutionMode({
          model: actualVideoModel,
          durationSeconds: request.videoDuration,
          hasReferenceVideoUrl: Boolean(request.referenceSourceVideoUrl),
        })
      : request.executionMode;
    if (projectAgentCloneExecutionMode) {
      request.executionMode = projectAgentCloneExecutionMode as StartWorkflowRequest['executionMode'];
    }

    if (request.executionMode === 'clone_direct_reference') {
      const directDurationSeconds = normalizeCloneDurationSeconds(request.videoDuration);
      if (!isSeedanceCloneModel(actualVideoModel)) {
        return {
          success: false,
          error: 'Unsupported direct reference model',
          details: 'Direct reference clone is only available for Seedance 2 models.'
        };
      }
      if (!request.referenceSourceVideoUrl) {
        return {
          success: false,
          error: 'Reference source video required',
          details: 'Direct reference clone requires the original source video URL.'
        };
      }
      if (!directDurationSeconds) {
        return {
          success: false,
          error: 'Invalid reference duration',
          details: 'Direct reference clone requires a source video duration between 2 and 15 seconds.'
        };
      }
      const requestedQuality =
        actualVideoModel === 'seedance_2_mini' &&
        request.requestSource === 'project_agent_clone' &&
        !request.videoQualityManual
          ? '480p'
          : request.videoQuality || getDefaultCloneVideoQuality(actualVideoModel);
      const quality = normalizeCloneVideoQualityForModel(actualVideoModel, requestedQuality);
      return startDirectReferenceCloneWorkflow({
        request,
        model: actualVideoModel,
        quality,
        durationSeconds: directDurationSeconds,
        referenceSourceVideoUrl: request.referenceSourceVideoUrl,
        cloneReferenceAssets,
        referenceVideoContext
      });
    }
    if (Array.isArray(request.segmentPrompts) && request.segmentPrompts.length > 0) {
      const overrideTotalDurationSeconds = request.segmentPrompts.reduce((total, segment) => (
        total + getPromptSegmentDurationSeconds(segment)
      ), 0);
      if (overrideTotalDurationSeconds > 0) {
        request.videoDuration = snapDurationToModel(actualVideoModel, overrideTotalDurationSeconds);
      }
    }
    let referenceVideoShotTimeline: { shots: ReferenceVideoShot[]; totalDurationSeconds: number } | null = null;

    if (referenceVideoContext?.existing_analysis) {
      const timeline = parseReferenceVideoTimeline(
        referenceVideoContext.existing_analysis as Record<string, unknown>,
        referenceVideoContext.video_duration_seconds
      );
      if (timeline.shots.length > 0) {
        referenceVideoShotTimeline = {
          shots: timeline.shots,
          totalDurationSeconds: timeline.videoDurationSeconds || sumShotDurations(timeline.shots)
        };

        // Recommend duration based on reference shot count, but let user decide
        // If user hasn't chosen duration yet, recommend shot_count × segment_duration
        if (!request.videoDuration) {
          const segmentDuration = getSegmentDurationForModel(actualVideoModel);
          const recommendedDuration = referenceVideoShotTimeline.shots.length * segmentDuration;

          console.log(`🎯 [SEGMENT DEBUG] Reference shot analysis:`);
          console.log(`   - Model: ${actualVideoModel}`);
          console.log(`   - Reference shots: ${referenceVideoShotTimeline.shots.length}`);
          console.log(`   - Segment duration: ${segmentDuration}s per shot`);
          console.log(`   - Recommended duration: ${referenceVideoShotTimeline.shots.length} × ${segmentDuration} = ${recommendedDuration}s`);

          const snappedDuration = snapDurationToModel(actualVideoModel, recommendedDuration);
          console.log(`   - Snapped duration: ${snappedDuration}s`);

          if (snappedDuration) {
            console.log(
              `💡 Final recommended video duration: ${snappedDuration}s (${referenceVideoShotTimeline.shots.length} shots × ${segmentDuration}s per shot)`
            );
            request.videoDuration = snappedDuration;
          }
        }
      }
    }

    const isStoryboardReferenceClone = request.executionMode === 'clone_storyboard_reference';
    if (isStoryboardReferenceClone) {
      if (!isSeedanceCloneModel(actualVideoModel)) {
        return {
          success: false,
          error: 'Unsupported storyboard clone model',
          details: 'Storyboard clone mode is only available for Seedance 2 models.'
        };
      }
      if (!referenceVideoContext?.existing_analysis || referenceVideoContext.analysis_status !== 'completed') {
        return {
          success: false,
          error: 'Reference analysis required',
          details: 'Storyboard clone mode requires a completed reference-video analysis.'
        };
      }
      const hasReplacementAsset =
        cloneReferenceAssets.avatarPhotoUrls.length > 0 ||
        cloneReferenceAssets.productImageUrls.length > 0 ||
        cloneReferenceAssets.petPhotoUrls.length > 0;
      if (!hasReplacementAsset) {
        return {
          success: false,
          error: 'Replacement asset required',
          details: 'Connect at least one avatar, product, or pet before starting storyboard clone mode.'
        };
      }
    }

    const referenceSourceMediaDurationSeconds =
      typeof request.referenceSourceMediaDurationSeconds === 'number' &&
      Number.isFinite(request.referenceSourceMediaDurationSeconds) &&
      request.referenceSourceMediaDurationSeconds > 0
        ? request.referenceSourceMediaDurationSeconds
        : null;

    const storyboardPlan = isStoryboardReferenceClone
      ? buildSeedanceStoryboardClonePlan({
          shots: referenceVideoShotTimeline?.shots || [],
          fallbackDurationSeconds: normalizeCloneDurationSeconds(referenceSourceMediaDurationSeconds) || normalizeCloneDurationSeconds(request.videoDuration) || referenceVideoContext?.video_duration_seconds || referenceVideoShotTimeline?.totalDurationSeconds || null,
          sourceMediaDurationSeconds: referenceSourceMediaDurationSeconds,
          aspectRatio: request.videoAspectRatio === '9:16' ? '9:16' : '16:9',
          language: request.language || referenceVideoContext?.language || 'en',
          assets: cloneReferenceAssets
        })
      : null;
    if (storyboardPlan) {
      request.videoDuration = String(storyboardPlan.durationSeconds) as VideoDuration;
      console.log(`🎬 Storyboard clone plan prepared: ${storyboardPlan.segments.length} Seedance task(s), ${storyboardPlan.durationSeconds}s total`);
    }

    const segmentedByDuration = isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const isSegmented = segmentedByDuration;

    // Smart segment count calculation
    // Priority 1: If reference shots exist and match user's segment count → use 1:1 mapping
    // Priority 2: Use user's chosen duration
    console.log(`🎯 [SEGMENT DEBUG] Calculating segment count:`);
    console.log(`   - Video model: ${actualVideoModel}`);
    console.log(`   - Video duration: ${request.videoDuration}`);
    console.log(`   - Is segmented: ${isSegmented}`);

    let segmentCount: number;
    const referenceVideoShotCount = referenceVideoShotTimeline?.shots.length || 0;
    const userSegmentCount = segmentedByDuration
      ? getSegmentCountFromDuration(request.videoDuration, actualVideoModel)
      : 1;

    console.log(`   - Reference shot count: ${referenceVideoShotCount}`);
    console.log(`   - User segment count (from duration): ${userSegmentCount}`);

    if (storyboardPlan) {
      segmentCount = storyboardPlan.segments.length;
      console.log(`✅ Seedance storyboard segmentation planned: ${segmentCount} segments`);
    } else if (referenceVideoShotCount > 0 && userSegmentCount === referenceVideoShotCount) {
      segmentCount = referenceVideoShotCount;
      console.log(`✅ Perfect match: ${referenceVideoShotCount} reference shots = ${userSegmentCount} segments (1:1 mapping)`);
    } else {
      segmentCount = userSegmentCount;
      if (referenceVideoShotCount > 0 && referenceVideoShotCount !== userSegmentCount) {
        console.log(`⚠️ Mismatch: ${referenceVideoShotCount} reference shots ≠ ${userSegmentCount} segments. Using user's choice, AI will adapt.`);
      } else if (referenceVideoShotCount === 0) {
        console.log(`ℹ️ No reference shots, using segment count from duration: ${userSegmentCount}`);
      }
    }

    console.log(`🎬 [SEGMENT DEBUG] Final segment count: ${segmentCount}`);
    const resolvedSegmentDuration = resolvePerSegmentDurationSeconds(
      actualVideoModel,
      request.videoDuration,
      segmentCount
    );
    const hasSegmentFlow = segmentCount >= 1;

    // Precompute shot-to-segment mapping asap so we can persist plans even if prompt generation fails later
    let shotPlanForSegments: ReferenceVideoShot[] | undefined;
    let precomputedSegmentPlan: SegmentPrompt[] | undefined;
    if (storyboardPlan) {
      precomputedSegmentPlan = storyboardPlan.segments;
      shotPlanForSegments = undefined;
    } else if (segmentCount > 0 && referenceVideoShotTimeline?.shots.length) {
      if (referenceVideoShotTimeline.shots.length === segmentCount) {
        shotPlanForSegments = referenceVideoShotTimeline.shots;
        console.log('📐 Prepared 1:1 reference shot map for future recovery');
      } else {
        shotPlanForSegments = compressReferenceVideoShotsToSegments(referenceVideoShotTimeline.shots, segmentCount);
        console.log(
          `📐 Prepared compressed reference shot map (${referenceVideoShotTimeline.shots.length} shots → ${segmentCount} segments)`
        );
      }

      precomputedSegmentPlan = buildManualCloneSeedPrompts({
        videoModel: actualVideoModel,
        segmentCount,
        videoDuration: request.videoDuration,
        language: request.language || referenceVideoContext?.language || 'en',
        referenceVideoShots: shotPlanForSegments
      });
    }

    let remainingCreditsAfterDeduction: number | undefined;
    let creditsDeductedAtCreate = false;
    const isReplicaMode = Boolean(
      request.replicaMode &&
      request.photoOnly &&
      Array.isArray(request.referenceImageUrls) &&
      request.referenceImageUrls.length > 0
    );
    const isReferenceCloneCreate = Boolean(
      !isReplicaMode &&
      !request.useCustomScript &&
      request.requestSource !== 'project_agent_clone' &&
      (request.referenceVideoId || request.creatorSourceVideoId)
    );

    // ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
    // ALL models: PAID generation, FREE download
    let generationCost = 0;
    const duration = request.videoDuration;
    const requestedQuality = request.videoQuality || getDefaultCloneVideoQuality(actualVideoModel);
    const quality = normalizeCloneVideoQualityForModel(
      actualVideoModel,
      requestedQuality
    );

    console.log(`💳 [CREDITS DEBUG] Calculating generation cost:`, {
      model: actualVideoModel,
      duration,
      quality,
      requestedQuality,
      videoDuration: request.videoDuration
    });
    if (isReplicaMode) {
      const replicaResolution = request.photoResolution || '2K';
      generationCost = getReplicaPhotoCredits(replicaResolution);

      const creditCheck = await checkCredits(request.userId, generationCost);
      if (!creditCheck.success) {
        return {
          success: false,
          error: 'Failed to check credits',
          details: creditCheck.error || 'Credit check failed'
        };
      }

      if (!creditCheck.hasEnoughCredits) {
        return {
          success: false,
          error: 'Insufficient credits',
          details: `Need ${generationCost} credits for replica photo mode (${replicaResolution}), have ${creditCheck.currentCredits || 0}`
        };
      }

      await assertKieCreditsAvailable();

      const deductResult = await deductCredits(request.userId, generationCost);
      if (!deductResult.success) {
        return {
          success: false,
          error: 'Failed to deduct credits',
          details: deductResult.error || 'Credit deduction failed'
        };
      }
      remainingCreditsAfterDeduction = deductResult.remainingCredits;

      await recordCreditTransaction(
        request.userId,
        'usage',
        generationCost,
        `Video Clone - Replica photo generation (GPT Image 2, ${replicaResolution})`,
        undefined,
        true
      );
      creditsDeductedAtCreate = true;
    } else if (!request.photoOnly) {
      // Calculate generation cost based on model
      generationCost = request.requestSource === 'project_agent_clone'
        ? getProjectAgentCloneGenerationCost({
            model: actualVideoModel,
            durationSeconds: duration,
            videoQuality: quality,
            executionMode: request.executionMode || 'clone_segmented_auto',
            hasReferenceVideoUrl: Boolean(request.referenceSourceVideoUrl),
          })
        : getGenerationCost(
            actualVideoModel,
            duration,
            quality
          );

      console.log(`💳 [CREDITS DEBUG] Generation cost calculated:`, {
        model: actualVideoModel,
        duration,
        units: `${Math.ceil(Number(duration || '0') / getSegmentDurationForModel(actualVideoModel))} segments`,
        unitCost: GENERATION_COSTS[actualVideoModel],
        totalCost: generationCost
      });

      // Clone projects now seed prompts for manual editing first.
      // Defer billing until the user explicitly starts video generation.
      if (
        generationCost > 0 &&
        !isReferenceCloneCreate
      ) {
        // Check if user has enough credits
        const creditCheck = await checkCredits(request.userId, generationCost);
        if (!creditCheck.success) {
          return {
            success: false,
            error: 'Failed to check credits',
            details: creditCheck.error || 'Credit check failed'
          };
        }

        if (!creditCheck.hasEnoughCredits) {
          return {
            success: false,
            error: 'Insufficient credits',
            details: `Need ${generationCost} credits for ${actualVideoModel.toUpperCase()} model, have ${creditCheck.currentCredits || 0}`
          };
        }

        await assertKieCreditsAvailable();

        // Deduct credits UPFRONT for ALL models
        const deductResult = await deductCredits(request.userId, generationCost);
        if (!deductResult.success) {
          return {
            success: false,
            error: 'Failed to deduct credits',
            details: deductResult.error || 'Credit deduction failed'
          };
        }
        remainingCreditsAfterDeduction = deductResult.remainingCredits;

        // Record the transaction
        await recordCreditTransaction(
          request.userId,
          'usage',
          generationCost,
          `Video Clone - Video generation (${actualVideoModel.toUpperCase()})`,
          undefined,
          true
        );
        creditsDeductedAtCreate = true;
      }
    } else {
      generationCost = 0; // Photo-only mode is free
    }

    const persistableReferenceVideoId = request.referenceVideoId && !isSystemReferenceVideoId(request.referenceVideoId)
      ? request.referenceVideoId
      : null;

    const projectInsertBase = {
      user_id: request.userId,
      reference_video_id: persistableReferenceVideoId, // User reference videos only; system defaults use selected_inputs.referenceSourceId
      video_model: actualVideoModel,
      video_aspect_ratio: request.videoAspectRatio || '16:9',
      status: 'processing',
      current_step: request.useCustomScript
        ? 'ready_for_video'
        : isReferenceCloneCreate
          ? 'ready_for_video'
        : hasSegmentFlow
          ? 'generating_segment_frames'
          : 'generating_cover',
      progress_percentage: request.useCustomScript ? 50 : isReferenceCloneCreate ? 60 : hasSegmentFlow ? 25 : 20,
      credits_cost: generationCost, // Only generation cost (download cost charged separately)
      generation_credits_used: isReferenceCloneCreate
        ? 0
        : generationCost,
      language: request.language || 'en', // Language for AI-generated content
      // Generic video fields
      video_duration: duration,
      video_quality: quality,
      // DEPRECATED: download_credits_used (downloads are now free)
      download_credits_used: 0,
      is_segmented: hasSegmentFlow, // FIX: Use segmentCount instead of isSegmented to avoid data inconsistency
      segment_count: segmentCount,
      segment_duration_seconds: hasSegmentFlow && !storyboardPlan ? resolvedSegmentDuration : null,
      segment_status: hasSegmentFlow
        ? {
            total: segmentCount,
            framesReady: 0,
            videosReady: 0,
            segments: []
          }
        : null,
    };

    const cloneReferenceSource = request.referenceVideoId
      ? {
          referenceSourceMediaType: 'video' as const,
          referenceSourceId: request.referenceVideoId,
          isCloneMode: true
        }
      : request.creatorSourceVideoId
        ? {
            referenceSourceMediaType: 'video' as const,
            referenceSourceId: request.creatorSourceVideoId,
            isCloneMode: true
          }
        : {
            isCloneMode: false
          };

    const selectedInputs: VideoCloneSelectedInputs = {
      primaryAvatarId: cloneReferenceAssets.selectedAvatarId || null,
      primaryProductId: cloneReferenceAssets.selectedProductId || null,
      primaryPetId: cloneReferenceAssets.selectedPetId || null,
      avatarIds: cloneReferenceAssets.selectedAvatarIds || [],
      productIds: cloneReferenceAssets.selectedProductIds || [],
      petIds: cloneReferenceAssets.selectedPetIds || [],
      workflowSource: request.requestSource || 'default',
      mergePolicy: 'auto',
      executionMode: request.executionMode || (request.requestSource === 'project_agent_clone' ? 'clone_segmented_auto' : 'clone'),
      referenceSourceVideoUrl: request.referenceSourceVideoUrl || null,
      referenceSourceMediaDurationSeconds,
      supplementalText: normalizeSupplementalText(request.supplementalText),
      ...cloneReferenceSource
    };

    const projectInsertWithSelectedInputs = {
      ...projectInsertBase,
      selected_inputs: selectedInputs
    };

    // Create project record in video_clone_projects table.
    // Backward compatibility: if selected_inputs is missing in an older DB/schema cache, retry without it.
    let { data: project, error: insertError } = await supabase
      .from('video_clone_projects')
      .insert(projectInsertWithSelectedInputs)
      .select()
      .single();

    if (
      insertError &&
      insertError.code === 'PGRST204' &&
      typeof insertError.message === 'string' &&
      insertError.message.includes('selected_inputs')
    ) {
      console.warn('⚠️ selected_inputs column unavailable (schema cache lag or old migration). Retrying insert without selected_inputs.');
      const fallbackInsert = await supabase
        .from('video_clone_projects')
        .insert(projectInsertBase)
        .select()
        .single();
      project = fallbackInsert.data;
      insertError = fallbackInsert.error;
    }

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        success: false,
        error: 'Failed to create project record',
        details: insertError.message
      };
    }

    console.log(`✅ [CREDITS DEBUG] Project created with credits info:`, {
      projectId: project.id,
      videoDuration: duration,
      segmentCount,
      creditsDeducted: generationCost,
      savedInDB: project.credits_cost
    });

    if (precomputedSegmentPlan?.length === segmentCount) {
      const { error: planSeedError } = await supabase
        .from('video_clone_projects')
        .update({ segment_plan: serializeSegmentPlan(precomputedSegmentPlan) })
        .eq('id', project.id);
      if (planSeedError) {
        console.error('⚠️ Failed to seed segment plan with reference-video timeline:', planSeedError);
      } else {
        console.log('💾 Seeded segment_plan with reference-video timeline segments');
      }
    }

    // CRITICAL FIX: Must await workflow completion before returning
    // Vercel terminates serverless functions immediately after API response
    // Fire-and-forget IIFE would be killed before generateImageBasedPrompts executes
    try {
      if (isReplicaMode) {
        await startReplicaWorkflow(
          project.id,
          { ...request, imageUrl, resolvedVideoModel: actualVideoModel },
          productContext,
          referenceVideoContext
        );
      } else if (storyboardPlan) {
        await initializeStoryboardReferenceCloneProject({
          projectId: project.id,
          request: { ...request, imageUrl, resolvedVideoModel: actualVideoModel },
          storyboardPlan,
          cloneReferenceAssets
        });
      } else if (isReferenceCloneCreate) {
        const cloneSeedPrompts = precomputedSegmentPlan?.length === segmentCount
          ? precomputedSegmentPlan
          : normalizeSegmentPrompts(
              { segments: [] },
              segmentCount,
              shotPlanForSegments,
              resolvedSegmentDuration
            );

        await initializeCloneProjectForManualEditing({
          projectId: project.id,
          request: { ...request, imageUrl, resolvedVideoModel: actualVideoModel },
          prompts: cloneSeedPrompts,
          metadataSource: {
            clone_reference_assets: {
              selectedAvatarId: cloneReferenceAssets.selectedAvatarId || request.selectedAvatarId || null,
              selectedProductId: cloneReferenceAssets.selectedProductId || request.selectedProductId || null,
              selectedAvatarIds: cloneReferenceAssets.selectedAvatarIds || [],
              selectedProductIds: cloneReferenceAssets.selectedProductIds || [],
              selectedPetId: cloneReferenceAssets.selectedPetId || request.selectedPetId || null,
              selectedPetIds: cloneReferenceAssets.selectedPetIds || [],
              avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
              productImageUrls: cloneReferenceAssets.productImageUrls,
              petPhotoUrls: cloneReferenceAssets.petPhotoUrls
            }
          }
        });
      } else {
        await startAIWorkflow(
          project.id,
          { ...request, imageUrl, videoModel: actualVideoModel, resolvedVideoModel: actualVideoModel },
          productContext,
          referenceVideoContext, // Pass reference video context for reference
          shotPlanForSegments,
          cloneReferenceAssets
        );
      }
    } catch (workflowError) {
      console.error('❌ Workflow error:', workflowError);
      console.error('Stack trace:', workflowError instanceof Error ? workflowError.stack : 'No stack available');
      console.error('Context:', {
        projectId: project.id,
        userId: request.userId,
        videoModel: actualVideoModel,
        generationCost,
        photoOnly: request.photoOnly,
        isReplicaMode
      });

      // REFUND credits on failure (ALL models now charge at generation)
      if (creditsDeductedAtCreate && generationCost > 0) {
        console.log(`⚠️ Refunding ${generationCost} credits due to workflow failure`);
        try {
          await deductCredits(request.userId, -generationCost); // Negative = refund
          await recordCreditTransaction(
            request.userId,
            'refund',
            generationCost,
            isReplicaMode
              ? 'Video Clone - Refund for failed replica photo generation'
              : `Video Clone - Refund for failed ${actualVideoModel.toUpperCase()} generation`,
            project.id,
            true
          );
          console.log(`✅ Successfully refunded ${generationCost} credits to user ${request.userId}`);
        } catch (refundError) {
          console.error('❌ CRITICAL: Refund failed:', refundError);
          console.error('Refund error stack:', refundError instanceof Error ? refundError.stack : 'No stack available');
          // TODO: This should trigger alerting - user paid but didn't get service
        }
      }

      // Update project status to failed
      try {
        const { error: updateError } = await supabase
          .from('video_clone_projects')
          .update({
            generation_credits_used: creditsDeductedAtCreate ? 0 : project.generation_credits_used,
            status: 'failed',
            error_message: `Workflow failed: ${workflowError instanceof Error ? workflowError.message : 'Unknown error'}`,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id);

        if (updateError) {
          console.error('❌ CRITICAL: Failed to update project status to failed:', updateError);
          // TODO: This should trigger alerting - project stuck in processing state
        } else {
          console.log(`✅ Marked project ${project.id} as failed`);
        }
      } catch (dbError) {
        console.error('❌ CRITICAL: Database update exception:', dbError);
        console.error('DB error stack:', dbError instanceof Error ? dbError.stack : 'No stack available');
        // TODO: This should trigger alerting
      }
    }

    return {
      success: true,
      projectId: project.id,
      remainingCredits: remainingCreditsAfterDeduction,
      creditsUsed: creditsDeductedAtCreate ? generationCost : 0
    };

  } catch (error) {
    console.error('StartWorkflowProcess error:', error);
    return {
      success: false,
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function initializeCloneProjectForManualEditing({
  projectId,
  request,
  prompts,
  metadataSource
}: CloneManualEditSeedInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const normalizedSegments = normalizeSegmentPrompts(
    { segments: prompts },
    prompts.length,
    undefined,
    resolvePerSegmentDurationSeconds(
      request.resolvedVideoModel,
      request.videoDuration,
      prompts.length
    )
  ).map(segment => ({
    ...segment,
    first_frame_image_size: segment.first_frame_image_size || (request.videoAspectRatio === '9:16' ? '9:16' : '16:9')
  }));

  const serializedPlan = serializeSegmentPlan(normalizedSegments);
  const storedVideoPrompts = buildStoredVideoPromptsPayload(
    normalizedSegments,
    metadataSource || null
  );

  const { error: cleanupError } = await supabase
    .from('video_clone_segments')
    .delete()
    .eq('project_id', projectId);
  if (cleanupError) {
    console.error('Failed to clear old segments before manual clone initialization:', cleanupError);
    throw new Error('Failed to reset previous clone segments');
  }

  // Schema verified via Supabase MCP (2026-02-28):
  // video_clone_segments includes project_id, segment_index, status, prompt,
  // first_frame_task_id, first_frame_url, video_task_id, video_url, error_message.
  const segmentRows = normalizedSegments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: 'pending_first_frame',
    prompt: serializeSegmentPrompt(segmentPrompt),
    first_frame_task_id: null,
    first_frame_url: null,
    video_task_id: null,
    video_url: null,
    error_message: null
  }));

  const { data: insertedSegments, error: insertError } = await supabase
    .from('video_clone_segments')
    .insert(segmentRows)
    .select();

  if (insertError || !insertedSegments) {
    console.error('Failed to seed manual clone segments:', insertError);
    throw new Error('Failed to initialize clone segments');
  }

  const segments = insertedSegments as VideoCloneSegment[];
  const segmentStatus = buildSegmentStatusPayload(segments);
  const resolvedSegmentDurationSeconds = resolvePerSegmentDurationSeconds(
    request.resolvedVideoModel,
    request.videoDuration,
    normalizedSegments.length
  );

  const { error: projectUpdateError } = await supabase
    .from('video_clone_projects')
    .update({
      video_prompts: storedVideoPrompts,
      segment_plan: serializedPlan,
      is_segmented: normalizedSegments.length > 0,
      segment_count: normalizedSegments.length,
      segment_duration_seconds: normalizedSegments.length > 0 ? resolvedSegmentDurationSeconds : null,
      current_step: 'ready_for_video',
      status: 'processing',
      progress_percentage: 60,
      video_generation_requested: false,
      segment_status: segmentStatus,
      last_processed_at: now
    })
    .eq('id', projectId);

  if (projectUpdateError) {
    console.error('Failed to update clone project for manual editing:', projectUpdateError);
    throw new Error('Failed to finalize clone prompt seeding');
  }
}

async function startAIWorkflow(
  projectId: string,
  request: StartWorkflowRequest & {
    imageUrl?: string; // Optional when no product image is provided
    resolvedVideoModel: VideoModel;
  },
  productContext?: { product_name?: string },
  referenceVideoContext?: {
    id?: string;
    reference_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  },
  initialShotPlan?: ReferenceVideoShot[],
  cloneReferenceAssets?: CloneReferenceAssets
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let shotPlanForSegments = initialShotPlan;
  const hasSegmentPromptOverrides = Array.isArray(request.segmentPrompts) && request.segmentPrompts.length > 0;

  try {
    // Image-driven workflow with AI creative generation
    // Generate prompts based purely on visual analysis of the product image
    console.log('🤖 Generating creative video prompts from product image...');

    // Two-step process for reference-video mode with intelligent caching
    let referenceVideoDescription: Record<string, unknown> | undefined;
    if (referenceVideoContext) {
      // Check if we can reuse existing analysis from database
      if (referenceVideoContext.existing_analysis) {
        // Performance optimization: Reuse cached analysis
        console.log('✅ Using existing reference video analysis from database (cached)');
        console.log(`   - Reference video: ${referenceVideoContext.reference_name}`);
        console.log(`   - Language: ${referenceVideoContext.language || 'not detected'}`);
        console.log('   - Skipping AI Gateway analysis call (saving time & cost)');

        referenceVideoDescription = referenceVideoContext.existing_analysis as Record<string, unknown>;
      } else {
        // No existing analysis - reference videos no longer store files
        const statusReason = !referenceVideoContext.analysis_status
          ? 'no existing analysis found'
          : `status is ${referenceVideoContext.analysis_status}`;

        console.error(`❌ Cannot perform fresh analysis (${statusReason}): Files are no longer stored`);
        throw new Error(
          'Reference video analysis not found. ' +
          'Reference videos no longer store original files, so analysis must be completed before use. ' +
          'Please ensure the reference video has been analyzed via create-with-analysis endpoint.'
        );
      }
    }

    let referenceVideoTimelineShots: ReferenceVideoShot[] | undefined;
    if (referenceVideoDescription) {
      const parsedTimeline = parseReferenceVideoTimeline(
        referenceVideoDescription as Record<string, unknown>,
        referenceVideoContext?.video_duration_seconds
      );
      referenceVideoTimelineShots = parsedTimeline.shots;

      if (
        parsedTimeline.videoDurationSeconds &&
        (request.resolvedVideoModel === 'seedance_2' ||
          request.resolvedVideoModel === 'seedance_2_fast' ||
          request.resolvedVideoModel === 'seedance_2_mini')
      ) {
        const snappedDuration = snapDurationToModel(request.resolvedVideoModel, parsedTimeline.videoDurationSeconds);
        if (snappedDuration && request.videoDuration !== snappedDuration) {
          console.log(`⏱️ Aligning video duration to reference-video timeline (${snappedDuration}s)`);
          request.videoDuration = snappedDuration;
        }
      }
    }

    const overrideSegmentCount = hasSegmentPromptOverrides ? request.segmentPrompts!.length : 0;
    const overrideTotalDurationSeconds = hasSegmentPromptOverrides
      ? request.segmentPrompts!.reduce((total, segment) => (
          total + getPromptSegmentDurationSeconds(segment)
        ), 0)
      : 0;
    if (hasSegmentPromptOverrides && overrideTotalDurationSeconds >= SEEDANCE_MIN_TASK_DURATION_SECONDS) {
      request.videoDuration = String(overrideTotalDurationSeconds) as VideoDuration;
    }
    const totalDurationSeconds = parseInt(
      request.videoDuration || String(overrideTotalDurationSeconds || 0),
      10
    );
    if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds <= 0) {
      throw new Error('Video duration is required before starting generation.');
    }
    const segmentedFlow = isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const calculatedSegmentCount = segmentedFlow
      ? getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel)
      : 1;
    const segmentCount = hasSegmentPromptOverrides ? overrideSegmentCount : calculatedSegmentCount;
    const effectiveSegmentedFlow = segmentCount > 1;
    const resolvedSegmentDurationSeconds = resolvePerSegmentDurationSeconds(
      request.resolvedVideoModel,
      request.videoDuration,
      segmentCount
    );

    // Schema alignment for agent clone/manual segment overrides:
    // when segmentPrompts are provided, segmentCount may differ from duration-derived
    // segmentedFlow. Persist the effective multi-segment shape so webhooks can
    // correctly chain continuation frames.
    const { error: projectConfigUpdateError } = await supabase
      .from('video_clone_projects')
      .update({
        video_duration: request.videoDuration || null,
        is_segmented: effectiveSegmentedFlow,
        segment_count: Math.max(1, segmentCount),
        segment_duration_seconds: resolvedSegmentDurationSeconds
      })
      .eq('id', projectId);
    if (projectConfigUpdateError) {
      console.error('⚠️ Failed to sync project video settings with reference video analysis:', projectConfigUpdateError);
    }

    // Step 2: Generate prompts for our product
    console.log(referenceVideoDescription ? '🎯 Step 2: Generating prompts (reference-video mode)...' : '🎨 Generating prompts (traditional mode)...');
    const prompts = hasSegmentPromptOverrides
      ? {
          segments: request.segmentPrompts!.map((segment, index) => ({
            index: index + 1,
            first_frame_description: cleanSegmentText(segment.first_frame_description) || '',
            is_continuation_from_prev: Boolean(segment.is_continuation_from_prev),
            shots: Array.isArray(segment.shots)
              ? segment.shots.map((shot, shotIndex) => ({
                  id: typeof shot.id === 'number' ? shot.id : shotIndex + 1,
                  time_range: cleanSegmentText(shot.time_range) || '00:00 - 00:08',
                  subject: cleanSegmentText(shot.subject) || '',
                  context_environment: cleanSegmentText(shot.context_environment) || '',
                  action: cleanSegmentText(shot.action) || '',
                  style: cleanSegmentText(shot.style) || '',
                  camera_motion_positioning: cleanSegmentText(shot.camera_motion_positioning) || '',
                  composition: cleanSegmentText(shot.composition) || '',
                  ambiance_colour_lighting: cleanSegmentText(shot.ambiance_colour_lighting) || '',
                  audio: cleanSegmentText(shot.audio) || '',
                  dialogue: cleanSegmentText(shot.dialogue) || '',
                  language: cleanSegmentText(shot.language) || request.language || 'en'
                }))
              : []
          }))
        }
      : await generateImageBasedPrompts(
          request.imageUrl,
          request.language,
          totalDurationSeconds,
          segmentCount,
          request.resolvedVideoModel,
          productContext,
          cloneReferenceAssets?.petName ? { pet_name: cloneReferenceAssets.petName } : undefined,
          referenceVideoDescription, // Pass reference video analysis result (not raw context)
          request.supplementalText,
        );

    if (hasSegmentPromptOverrides) {
      console.log(`✅ Using ${segmentCount} segment prompt overrides from Step 3 (skipping AI prompt regeneration).`);
    }

    console.log('🎯 Generated creative prompts:', prompts);

    if (!shotPlanForSegments && segmentedFlow && referenceVideoTimelineShots && referenceVideoTimelineShots.length > 0) {
      if (referenceVideoTimelineShots.length === segmentCount) {
        shotPlanForSegments = referenceVideoTimelineShots;
        console.log(`✅ Using 1:1 shot-to-segment mapping (${segmentCount} shots)`);
      } else {
        console.log(
          `🤖 Reference video has ${referenceVideoTimelineShots.length} shots but user chose ${segmentCount} segments. Compressing timeline to preserve full narrative.`
        );
        shotPlanForSegments = compressReferenceVideoShotsToSegments(referenceVideoTimelineShots, segmentCount);
      }
    }

    // All workflows are segmented (even single 8s segment)
    console.log('🎬 Segmented workflow enabled - orchestrating multi-segment pipeline');
    await startSegmentedWorkflow(
      projectId,
      request,
      prompts,
      segmentCount,
      referenceVideoDescription,
      shotPlanForSegments,
      collectDistinctUrls([
        ...(request.imageUrl ? [request.imageUrl] : []),
        ...(cloneReferenceAssets?.productImageUrls || []),
        ...(cloneReferenceAssets?.petPhotoUrls || [])
      ], 8),
      productContext,
      referenceVideoContext ? 'video' : null, // Reference videos are video-only
      cloneReferenceAssets
    );
    return;

  } catch (error) {
    console.error('AI workflow error:', error);
    throw error;
  }
}

async function startReplicaWorkflow(
  projectId: string,
  request: StartWorkflowRequest & {
    imageUrl: string | undefined;
    resolvedVideoModel: VideoModel;
  },
  productContext?: { product_name?: string },
  referenceVideoContext?: {
    id?: string;
    reference_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!request.referenceImageUrls || request.referenceImageUrls.length === 0) {
    throw new Error('Replica workflow requires reference images');
  }

  let referenceVideoDescription: Record<string, unknown> | undefined;
  let detectedLanguage: LanguageCode = (request.language as LanguageCode) || 'en';

  if (referenceVideoContext) {
    if (referenceVideoContext.analysis_status === 'completed' && referenceVideoContext.existing_analysis) {
      referenceVideoDescription = referenceVideoContext.existing_analysis as Record<string, unknown>;
      detectedLanguage = (referenceVideoContext.language as LanguageCode | undefined) || detectedLanguage;
    } else {
      // Reference videos no longer store files, so analysis must exist
      // If analysis doesn't exist, the user must upload and analyze first
      throw new Error(
        'Reference video analysis not found. ' +
        'Reference videos no longer store original files, so analysis must be completed before use. ' +
        'Please upload and analyze the reference video first via create-with-analysis endpoint.'
      );
    }
  }

  const prompt = buildReplicaPrompt({
    referenceVideoDescription,
    productContext,
    language: detectedLanguage
  });

  const taskId = await generateReplicaPhoto({
    prompt,
    referenceImages: request.referenceImageUrls,
    aspectRatio: request.photoAspectRatio,
    moderationExternalId: `user_${request.userId}:video_clone_${projectId}:replica_photo`
  });

  const updateData = {
    cover_task_id: taskId,
    video_prompts: { replica_prompt: prompt },
    current_step: 'generating_cover' as const,
    progress_percentage: 35,
    last_processed_at: new Date().toISOString()
  };

  const { error: updateError } = await supabase
    .from('video_clone_projects')
    .update(updateData)
    .eq('id', projectId);

  if (updateError) {
    throw updateError;
  }
}

function buildReplicaPrompt({
  referenceVideoDescription,
  productContext,
  language
}: {
  referenceVideoDescription?: Record<string, unknown>;
  productContext?: { product_name?: string };
  language?: LanguageCode;
}): string {
  const productName = truncateText(productContext?.product_name, 120);
  const featuredProductName = productName || 'the featured product';
  const subject = typeof referenceVideoDescription?.subject === 'string' ? referenceVideoDescription.subject : '';
  const action = typeof referenceVideoDescription?.action === 'string' ? referenceVideoDescription.action : '';
  const ambiance = typeof referenceVideoDescription?.ambiance === 'string' ? referenceVideoDescription.ambiance : '';
  const style = typeof referenceVideoDescription?.style === 'string' ? referenceVideoDescription.style : '';
  const firstFrame = typeof referenceVideoDescription?.first_frame_composition === 'string'
    ? referenceVideoDescription.first_frame_composition
    : '';
  const sceneElements = Array.isArray((referenceVideoDescription as { scene_elements?: Array<{ element: string; position: string; details: string }> })?.scene_elements)
    ? ((referenceVideoDescription as { scene_elements: Array<{ element: string; position: string; details: string }> }).scene_elements)
    : [];
  const MAX_SCENE_ELEMENTS = 12;
  const visibleSceneElements = sceneElements.slice(0, MAX_SCENE_ELEMENTS);
  const hasTrimmedScene = sceneElements.length > MAX_SCENE_ELEMENTS;

  const sceneGuide = visibleSceneElements.length
    ? `${visibleSceneElements.map(el => `- ${el.element} (${el.position}): ${truncateText(el.details, 280)}`).join('\n')}${hasTrimmedScene ? '\n- ... (trimmed additional scene elements)' : ''}`
    : 'Match every visible background object, flooring, wall color, prop, and piece of furniture based on the source frame. Keep their placement and proportions identical.';

  const promptSections = [
    `Replica UGC mode: recreate the source scene exactly as analyzed, but swap the featured product with ${featuredProductName} using the provided reference images. Maintain identical framing, pose, lens, lighting, mood, and prop placement.`,
    subject && `Source subject focus: ${subject}`,
    action && `Action/motion cues: ${action}`,
    style && `Visual style: ${style}`,
    ambiance && `Ambiance & color palette: ${ambiance}`,
    firstFrame && `Spatial layout (match precisely): ${firstFrame}`,
    'Scene elements to reproduce verbatim:\n' + sceneGuide,
    productName && `Product name: ${productName}`,
    `Use only the supplied product reference images when replacing the featured item. Preserve the same number of toys, type of flooring, wall textures, and negative space. If people or children are present, keep their poses, clothing vibes, and camera depth identical.`,
    `Language for any visible text: ${(language || 'en').toUpperCase()}.`
  ].filter(Boolean);

  return clampPromptLength(promptSections.join('\n\n'));
}

async function generateReplicaPhoto({
  prompt,
  referenceImages,
  aspectRatio,
  moderationExternalId
}: {
  prompt: string;
  referenceImages: string[];
  aspectRatio?: string;
  moderationExternalId?: string;
}): Promise<string> {
  if (!referenceImages.length) {
    throw new Error('Replica photo generation requires reference images');
  }

  return createKieGptImageTask({
    prompt,
    referenceImageUrls: referenceImages,
    aspectRatio: aspectRatio || '9:16',
    moderationExternalId
  });
}

/**
 * Analyze a reference video with automatic language detection.
 *
 * @param referenceVideoContext - Reference video metadata including file URL
 * @returns Object with { analysis: {...}, language: 'en' }
 */
export async function analyzeReferenceVideoWithLanguage(
  referenceVideoContext: { file_url: string; reference_name?: string },
  options?: { model?: string }
): Promise<{ analysis: Record<string, unknown>; language: LanguageCode }> {
  console.log('[analyzeReferenceVideoWithLanguage] 🔍 Starting reference video analysis with language detection...');
  console.log('[analyzeReferenceVideoWithLanguage] File type: video (video-only mode)');
  console.log('[analyzeReferenceVideoWithLanguage] File URL:', referenceVideoContext.file_url);

  // Extended JSON schema with language detection + shot breakdown
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "reference_video_analysis_with_language_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          schema_version: {
            type: "number",
            description: "Must be 2"
          },
          name: {
            type: "string",
            description: "A concise, descriptive name for this reference video (e.g., 'lovevery-playkits-delivery', 'nike-running-motivation'). Use lowercase with hyphens, keep it under 40 characters, make it searchable and memorable."
          },
          video_duration_seconds: {
            type: "number",
            description: "Total runtime of the analyzed advertisement in seconds"
          },
          shots: {
            type: "array",
            minItems: 1,
            description: "Ordered breakdown of every shot/scene with timestamps and creative cues",
            items: {
              type: "object",
              properties: {
                shot_id: {
                  type: "number",
                  description: "Sequential shot number starting at 1"
                },
                timing: {
                  type: "object",
                  properties: {
                    start_time: { type: "string" },
                    end_time: { type: "string" },
                    duration_seconds: { type: "number" }
                  },
                  required: ["start_time", "end_time", "duration_seconds"],
                  additionalProperties: false
                },
                opening_frame: {
                  type: "object",
                  properties: {
                    description: { type: "string" }
                  },
                  required: ["description"],
                  additionalProperties: false
                },
                visual: {
                  type: "object",
                  properties: {
                    subject: { type: "string" },
                    action: { type: "string" },
                    environment: { type: "string" },
                    style: { type: "string" },
                    camera: { type: "string" },
                    composition: { type: "string" },
                    focus_lens_effects: { type: "string" },
                    ambiance: { type: "string" }
                  },
                  required: ["subject", "action", "environment", "style", "camera", "composition", "focus_lens_effects", "ambiance"],
                  additionalProperties: false
                },
                audio: {
                  type: "object",
                  properties: {
                    dialogue: { type: "string" },
                    sfx: { type: "string" },
                    ambient: { type: "string" },
                  },
                  required: ["dialogue", "sfx", "ambient"],
                  additionalProperties: false
                },
                flags: {
                  type: "object",
                  properties: {
                    contains_brand: { type: "boolean" },
                    contains_product: { type: "boolean" }
                  },
                  additionalProperties: false
                }
              },
              required: [
                "shot_id",
                "timing",
                "opening_frame",
                "visual",
                "audio"
              ],
              additionalProperties: false
            }
          },
          detected_language: {
            type: "string",
            description: "Detected primary language as a short code (e.g., 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa')"
          }
        },
        required: [
          "schema_version",
          "name",
          "video_duration_seconds",
          "shots",
          "detected_language"
        ],
        additionalProperties: false
      }
    }
  };

  const data = await sendOpenRouterChat({
    model: options?.model || process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
    response_format: responseFormat,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'video_url' as const,
            video_url: { url: referenceVideoContext.file_url }
          },
          {
            type: 'text',
            text: `📺 REFERENCE VIDEO MULTI-SHOT ANALYSIS

You are analyzing a reference video${referenceVideoContext.reference_name ? ` named "${referenceVideoContext.reference_name}"` : ''}.

TASK: Break down this ad into a structured shot-by-shot timeline with language detection. Return schema_version 2 only. This is a PURE ANALYSIS - do not consider any other product or make recommendations.

OUTPUT REQUIREMENTS:

1. **name** (广告名称): Generate a concise, descriptive name for this ad
   - Format: lowercase-with-hyphens (e.g., "lovevery-playkits-delivery", "nike-running-motivation")
   - Keep it under 40 characters
   - Make it searchable and memorable
   - Include product keywords if visible

2. **video_duration_seconds** (广告总时长): Return the precise total runtime in seconds
   - Use the video's metadata or calculate from timestamps
   - Round to nearest second

3. **shots** (多镜头拆解): Break down the ad into sequential shots/scenes
   - Each shot represents a distinct visual beat or narrative moment
   - Typical shot duration: 6-11 seconds
   - Cover the ENTIRE runtime with NO gaps

   For EACH shot, provide:
   - \`shot_id\`
   - \`timing.start_time\`, \`timing.end_time\`, \`timing.duration_seconds\`
   - \`opening_frame.description\` - Hyper-detailed 3-4 sentence description (minimum 45 words) of the opening frame, covering foreground, midground, background, lighting cues, and focal hierarchy. Mention left/center/right placement, props, wardrobe, and depth cues so another artist could recreate it perfectly.
   - \`visual.subject\`
   - \`visual.action\`
   - \`visual.environment\`
   - \`visual.style\`
   - \`visual.camera\`
   - \`visual.composition\`
   - \`visual.focus_lens_effects\` - Required, use empty string if not inferable
   - \`visual.ambiance\`
   - \`audio.dialogue\`
   - \`audio.sfx\`
   - \`audio.ambient\`

   Shot requirements:
   - Timestamps must be strictly increasing (no gaps, no overlaps)
   - Durations must sum to total video duration
   - Be extremely detailed and specific
   - Think like you're creating a storyboard for recreation

4. **detected_language** (检测语言): Detect the PRIMARY language
   - Check text overlays, subtitles, captions
   - Listen to voiceover, dialogue, or narration
   - Consider cultural and regional context
   - Return ONLY the short code: 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa'
   - Default to "en" if unclear or mostly visual

EXAMPLE OUTPUT STRUCTURE:
{
  "schema_version": 2,
  "name": "lovevery-playkits-delivery",
  "video_duration_seconds": 47,
  "shots": [
    {
      "shot_id": 1,
      "timing": {
        "start_time": "00:00",
        "end_time": "00:06",
        "duration_seconds": 6
      },
      "opening_frame": {
        "description": "Exterior of a modern apartment building with a package on the doorstep"
      },
      "visual": {
        "subject": "Young woman",
        "action": "Opens door, picks up package, walks inside",
        "environment": "Urban street entrance, brick building with glass door",
        "style": "Realism, candid lifestyle",
        "camera": "Static wide shot",
        "composition": "Full body shot",
        "focus_lens_effects": "",
        "ambiance": "Natural daylight, soft shadows"
      },
      "audio": {
        "dialogue": "",
        "sfx": "",
        "ambient": "Upbeat acoustic music starts"
      }
    }
  ],
  "detected_language": "en"
}`
          }
        ]
      }
    ]
  }, {
    maxRetries: 10,
    timeoutMs: 120000
  });

  const apiResponse = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const rawContent = apiResponse.choices?.[0]?.message?.content;
  const normalizedContent = extractOpenRouterTextContent(rawContent);

  if (!normalizedContent) {
    console.error('[analyzeReferenceVideoWithLanguage] Invalid API response structure:', data);
    throw new Error('Invalid reference video analysis response format');
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(normalizedContent) as Record<string, unknown>;
  } catch (error) {
    console.error('[analyzeReferenceVideoWithLanguage] Failed to parse normalized content:', error);
    console.error('[analyzeReferenceVideoWithLanguage] Normalized content preview:', normalizedContent.substring(0, 400));
    throw new Error('Invalid reference video analysis response format');
  }

  // Extract language and validate it's a valid LanguageCode
  const rawDetectedLanguage = typeof result.detected_language === 'string' ? (result.detected_language as string) : undefined;
  const language: LanguageCode = rawDetectedLanguage && SUPPORTED_LANGUAGE_CODES.includes(rawDetectedLanguage as LanguageCode)
    ? (rawDetectedLanguage as LanguageCode)
    : 'en'; // Default to English if invalid
  const analysis = normalizeAnalysisToV2(result);
  if (!analysis) {
    throw new Error('Invalid reference video analysis response format');
  }

  console.log('[analyzeReferenceVideoWithLanguage] ✅ Analysis complete');
  console.log('[analyzeReferenceVideoWithLanguage] 🌍 Detected language:', language);

  return { analysis: analysis as unknown as Record<string, unknown>, language };
}

type StructuredContentChunk =
  | string
  | {
      type?: string;
      text?: unknown;
      content?: unknown;
    };

const extractStructuredContent = (content: unknown): string | null => {
  if (!content) return null;
  if (typeof content === 'string') {
    return content.trim() || null;
  }

  if (Array.isArray(content)) {
    const combined = content
      .map(chunk => getChunkText(chunk))
      .filter(Boolean)
      .join('\n')
      .trim();

    return combined || null;
  }

  if (typeof content === 'object') {
    const maybeText = getChunkText(content as StructuredContentChunk);
    if (maybeText) {
      return maybeText;
    }
  }

  return null;
};

const getChunkText = (chunk: StructuredContentChunk): string => {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (chunk && typeof chunk === 'object') {
    if (typeof chunk.text === 'string') {
      return chunk.text;
    }
    if (typeof chunk.content === 'string') {
      return chunk.content;
    }
  }
  return '';
};

/**
 * Step 2: Generate prompts for our product (Second API call)
 *
 * If referenceVideoDescription is provided, it will be used as a system prompt
 * to guide the generation in reference-video mode.
 *
 * @param imageUrl - Our product image
 * @param referenceVideoDescription - Optional reference video analysis from Step 1 (used as system prompt)
 */
async function generateImageBasedPrompts(
  imageUrl: string | undefined,
  language?: string,
  videoDurationSeconds?: number,
  segmentCount = 1,
  videoModel?: VideoModel,
  productContext?: { product_name?: string },
  petContext?: { pet_name?: string },
  referenceVideoDescription?: Record<string, unknown>, // Changed: Now receives analysis result, not raw context
  supplementalText?: string,
): Promise<Record<string, unknown>> {
  console.log(`[generateImageBasedPrompts] Step 2: Generating prompts for our product${petContext?.pet_name ? ` (with pet: ${petContext.pet_name})` : ''}${referenceVideoDescription ? ' (reference-video mode)' : ' (traditional mode)'}${!imageUrl ? ' (no product image provided)' : ''}`);


  const duration = Number.isFinite(videoDurationSeconds) && videoDurationSeconds ? videoDurationSeconds : 0;
  if (duration <= 0) {
    throw new Error('Video duration is required to generate image-based prompts.');
  }
  const minDurationForModel = SEEDANCE_MIN_TASK_DURATION_SECONDS;
  const maxDurationForModel = 64;
  const perSegmentDuration = Math.max(
    minDurationForModel,
    Math.min(maxDurationForModel, Math.round(duration / Math.max(1, segmentCount)))
  );
  const minShotsPerSegment = 2;
  const dialogueWordLimit = Math.max(12, Math.round(perSegmentDuration * 2.2));

  const shotProperties = {
    time_range: { type: "string", description: `Shot-relative time span formatted as MM:SS - MM:SS (starts at 00:00, ends at ${formatTimecode(perSegmentDuration)})` },
    audio: { type: "string", description: "Music or sound cue" },
    style: { type: "string", description: "Visual style for the shot" },
    action: { type: "string", description: "Exact moment to recreate" },
    subject: { type: "string", description: "Primary actors or objects" },
    dialogue: { type: "string", description: "Voiceover/dialogue line" },
    language: { type: "string", description: "Language short code (e.g., en, zh)" },
    composition: { type: "string", description: "Shot framing" },
    context_environment: { type: "string", description: "Location/environment context" },
    ambiance_colour_lighting: { type: "string", description: "Color and lighting mood" },
    camera_motion_positioning: { type: "string", description: "Camera motion and placement" }
  } as const;

  const shotRequiredFields = [
    'time_range',
    'audio',
    'style',
    'action',
    'subject',
    'dialogue',
    'language',
    'composition',
    'context_environment',
    'ambiance_colour_lighting',
    'camera_motion_positioning'
  ];

  const segmentProperties: Record<string, unknown> = {
    first_frame_description: {
      type: "string",
      minLength: 20,
      description: "Detailed description of the opening frame"
    },
    is_continuation_from_prev: { type: "boolean", description: "Continues from previous segment" },
    shots: {
      type: "array",
      description: `Timeline beats for the segment`,
      items: {
        type: "object",
        properties: shotProperties,
        required: shotRequiredFields,
        additionalProperties: false
      }
    }
  };

  const segmentRequiredFields = [
    "first_frame_description",
    "is_continuation_from_prev",
    "shots"
  ];

  const segmentFieldList = '"first_frame_description", "is_continuation_from_prev", "shots"';

  const strictSegmentFormat = `Segment Output Requirements:
- Output EXACTLY ${segmentCount} segment objects inside the "segments" array.
- Each segment MUST include only: ${segmentFieldList}.
- DO NOT add keys like "audio", "style", or "action" at the segment level — that information belongs inside each shot.
- Dialogue must stay under ${dialogueWordLimit} words and be natural.
- "first_frame_description" must provide a DETAILED visual description of the opening frame: scene setup, subject positioning, camera angle, key visual elements. This is used to generate the keyframe image. Example: "Close-up of woman's hands gently applying moisturizer to her face, soft natural lighting from the right, white marble bathroom counter in background, serene morning ambiance."
- "is_continuation_from_prev" must be false for Segment 1, and only true when the current segment continues the exact same camera move/subject as the previous segment.
- "shots" must contain ${minShotsPerSegment}-5 entries that evenly cover the entire ${perSegmentDuration}-second segment runtime. Each shot's "time_range" is RELATIVE to the start of the segment (e.g., "00:00 - 00:02", "00:02 - 00:04"), and the final shot must end at ${formatTimecode(perSegmentDuration)}.


Return JSON:
{
  "segments": [
    {
      "first_frame_description": string,
      "is_continuation_from_prev": boolean,
      "shots": [
        {
          "time_range": "00:00 - 00:02",
          "audio": string,
          "style": string,
          "action": string,
          "subject": string,
          "dialogue": string,
          "language": string,
          "composition": string,
          "context_environment": string,
          "ambiance_colour_lighting": string,
          "camera_motion_positioning": string
        }
      ]
    }
  ]
}

No other top-level keys or metadata.`;

  const supplementalInstruction = buildSupplementalTextPromptInstruction(supplementalText);

  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "shot_segment_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            description: `Final storyboard`,
            items: {
              type: "object",
              properties: segmentProperties,
              required: segmentRequiredFields,
              additionalProperties: false
            }
          }
        },
        required: ["segments"],
        additionalProperties: false
      }
    }
  } as const;

  // Define JSON schema for Structured Outputs - IMPORTANT: This must return a SINGLE object
  const requestPayload = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
    response_format: responseFormat,
    messages: referenceVideoDescription
      ? // === REFERENCE VIDEO MODE (Step 2) ===
        // Use reference video analysis as system prompt
        [
          {
            role: 'system',
            content: `You are an expert advertisement creator. You have been provided with a detailed analysis of a reference video.

**REFERENCE VIDEO ANALYSIS**:
${JSON.stringify(referenceVideoDescription, null, 2)}

Your task is to create a similar advertisement for OUR product${imageUrl ? ' (shown in the user\'s image)' : ''}${petContext?.pet_name ? ` and OUR pet (${petContext.pet_name})` : ''} by:
1. CLONING the reference video's creative structure, style, and approach
2. REPLACING the source product with our product${petContext?.pet_name ? ` and the source pet or on-screen animal with our pet (${petContext.pet_name})` : ''}
3. MAINTAINING the same narrative flow, visual style, and tone
4. PRESERVING the camera work, composition, and ambiance
5. MATCH EVERY SHOT EXACTLY: number of segments, graphic title cards, text overlays, and the final sign-off shot must appear in the same order as the reference video. Do not drop or rearrange any shots.

**CRITICAL: For "first_frame_description" field:**
- You MUST preserve the source video's detailed visual descriptions
- ONLY replace product-specific details (product name, packaging, labels) with our product${petContext?.pet_name ? ` and pet-specific details (breed, fur color, coat pattern, distinct markings, body plan) with our pet (${petContext.pet_name})` : ''}
- DO NOT simplify, shorten, or omit any environmental details, lighting, composition, or scene elements
- Keep the same level of detail and specificity as the source analysis
- Example: If the source has "A medium shot captures a woman with shoulder-length blonde wavy hair...", you should keep all those details but replace the product with ours
${petContext?.pet_name ? `
**CRITICAL: For "first_frame_description" pet replacement:**
- Whenever the source video shows a featured pet or animal (e.g., a cat, dog, or other on-screen companion), the on-screen pet MUST be replaced with our pet (${petContext.pet_name}).
- Preserve the original pet's pose, action, eyeline, position in frame, and interaction with the product or presenter, but render the on-screen animal as our pet.
- Preserve breed identity (use our pet's breed), fur color, coat pattern, distinct markings, body plan, and overall silhouette so the result clearly reads as our pet, not the source animal.
- If the source video shows multiple pets, every visible pet must be replaced with our pet (consistent identity throughout).
- Do not leave the original source pet or animal visible in any pet-focused or co-star shot.` : ''}

${imageUrl ? 'Remember: The user\'s image is OUR product - adapt the reference video to showcase OUR product instead.' : 'Note: No product image provided - use product context to adapt the reference video.'}${petContext?.pet_name ? `\nRemember: Our pet (${petContext.pet_name}) must replace any featured animal in the source video, with the same pose and interactions.` : ''}

${supplementalInstruction ? `${supplementalInstruction}` : ''}`
          },
          {
            role: 'user',
            content: imageUrl
              ? [
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                  },
                  {
                    type: 'text',
                    text: `📸 OUR PRODUCT IMAGE (above)${petContext?.pet_name ? `\n🐾 OUR PET (${petContext.pet_name}) — will replace any featured animal in the source video` : ''}

Use the reference video analysis provided in the system message to recreate the same storyboard for OUR product. Replace the featured product, labels, and packaging while keeping framing, movement, pacing, and energy identical.

**CRITICAL REQUIREMENTS:**
- For each segment's "first_frame_description", you MUST preserve the source video's detailed visual descriptions
- ONLY replace the source product-specific details with our product
${petContext?.pet_name ? `- ALSO replace the source pet or on-screen animal with our pet (${petContext.pet_name}); keep the pose, position, eyeline, and interaction with the product or presenter identical` : ''}
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Example transformation: "Woman applying source lotion..." → "Woman applying ${productContext?.product_name || 'our product'}..." (keep all other details unchanged)

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this to ensure accurate product replacement)\n` : ''}${petContext?.pet_name ? `\nPet Context:\nPet Name: ${petContext.pet_name}\n(Use this to ensure accurate pet replacement — describe our pet consistently in every shot that shows an animal)\n` : ''}

${supplementalInstruction ? `${supplementalInstruction}\n\n` : ''}

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `Recreate the reference video for our product using ONLY the information provided in the system message.

**CRITICAL REQUIREMENTS:**
- For each segment's "first_frame_description", you MUST preserve the source video's detailed visual descriptions
- ONLY replace the source product-specific details with our product
${petContext?.pet_name ? `- ALSO replace the source pet or on-screen animal with our pet (${petContext.pet_name}); keep the pose, position, eyeline, and interaction with the product or presenter identical` : ''}
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Keep all environmental details, lighting descriptions, composition specifics unchanged

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this context when replacing subjects or props)\n` : ''}${petContext?.pet_name ? `\nPet Context:\nPet Name: ${petContext.pet_name}\n(Use this to ensure accurate pet replacement — describe our pet consistently in every shot that shows an animal)\n` : ''}

${supplementalInstruction ? `${supplementalInstruction}\n\n` : ''}

${strictSegmentFormat}`
                  }
                ]
          }
        ]
      : // === TRADITIONAL AUTO-GENERATION MODE ===
        [
          {
            role: 'user',
            content: imageUrl
              ? [
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl }
                  },
                  {
                    type: 'text',
                    text: `🤖 TRADITIONAL AUTO-GENERATION MODE

Analyze the product image and build a storyboard that feels like a premium advertisement. Keep all details consistent with the supplied product photo (colors, proportions, packaging, materials) while enhancing the production value.

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this context sparingly and only when it matches what you see in the photo)\n` : ''}

${supplementalInstruction ? `${supplementalInstruction}\n\n` : ''}

Focus on real visual cues from the image: product texture, use cases, target audience, and natural environments. Dialogue must describe the product or experience without adding slogans or pricing.

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `🤖 TRADITIONAL AUTO-GENERATION MODE (PRODUCT-ONLY)

Use ONLY the product context to imagine what the product looks like in the real world, then output a storyboard following the exact reference-video-inspired schema.

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this to inform the visuals you invent)\n` : ''}

${supplementalInstruction ? `${supplementalInstruction}\n\n` : ''}

Every segment must feel grounded, cinematic, and ready for production. Mention props, environments, and characters explicitly.

${strictSegmentFormat}`
                  }
                ]
          }
        ]
  });

  const MAX_PROMPT_GENERATION_ATTEMPTS = 5;
  let lastPromptError: unknown;

  for (let attempt = 1; attempt <= MAX_PROMPT_GENERATION_ATTEMPTS; attempt++) {
    try {
      console.log(`[generateImageBasedPrompts] Attempt ${attempt}/${MAX_PROMPT_GENERATION_ATTEMPTS}`);

      const data = await sendOpenRouterChat(JSON.parse(requestPayload) as Record<string, unknown>, {
        maxRetries: 10,
        timeoutMs: 120000
      });
      const responseText = JSON.stringify(data);
      console.log('✅ AI Gateway response received:', {
        responseLength: responseText.length,
        preview: responseText.substring(0, 200)
      });

      const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
      if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message || !apiResponse.choices[0].message.content) {
        console.error('❌ AI Gateway response missing expected structure:', data);
        throw new Error('AI Gateway response missing choices[0].message.content');
      }

      const content = apiResponse.choices[0].message.content;

      let parsed: Record<string, unknown>;

      try {
        const rawParsed = JSON.parse(content);

        if (Array.isArray(rawParsed)) {
          console.warn('⚠️ AI returned an array instead of single object, taking first element');
          parsed = rawParsed[0] || {};
        } else {
          parsed = rawParsed;
        }

        const segments = Array.isArray((parsed as { segments?: SegmentPrompt[] }).segments)
          ? ((parsed as { segments?: SegmentPrompt[] }).segments || [])
          : [];

        if (segments.length !== segmentCount) {
          throw new Error(`AI response returned ${segments.length} segments but ${segmentCount} were requested`);
        }

        segments.forEach((segment, index) => {
          const missingSegmentFields = segmentRequiredFields.filter(field => {
            const value = (segment as Record<string, unknown>)[field];
            return value === undefined || value === null;
          });

          if (missingSegmentFields.length > 0) {
            console.error(`❌ Segment ${index + 1} missing required fields:`, missingSegmentFields);
            console.error(`❌ Segment ${index + 1} data:`, JSON.stringify(segment, null, 2));
            throw new Error(`[generateImageBasedPrompts] Segment ${index + 1} missing fields: ${missingSegmentFields.join(', ')}`);
          }

          // CRITICAL: Validate first_frame_description is not empty
          const firstFrameDesc = (segment as Record<string, unknown>).first_frame_description;
          if (typeof firstFrameDesc === 'string' && firstFrameDesc.trim().length < 20) {
            console.error(`❌ [generateImageBasedPrompts] Segment ${index + 1} has invalid first_frame_description (length: ${firstFrameDesc.trim().length})`);
            console.error(`❌ [generateImageBasedPrompts] Content: "${firstFrameDesc}"`);
            console.error(`❌ [generateImageBasedPrompts] Full segment data:`, JSON.stringify(segment, null, 2));
            throw new Error(`[generateImageBasedPrompts] Segment ${index + 1} has invalid first_frame_description - must be at least 20 characters describing the visual scene. Received: "${firstFrameDesc}"`);
          }
        });

        parsed = {
          segments: applySupplementalTextToSegments(segments, supplementalText),
        };

        console.log('✅ Structured output parsed successfully with all required fields');
      } catch (parseError) {
        console.error(`[generateImageBasedPrompts] Failed to parse structured output on attempt ${attempt}:`, parseError);
        console.error('[generateImageBasedPrompts] Content received (truncated):', typeof content === 'string' ? content.substring(0, 1000) : content);
        throw parseError instanceof Error ? parseError : new Error(String(parseError));
      }

      return parsed;
    } catch (error) {
      lastPromptError = error;
      console.error(`[generateImageBasedPrompts] Attempt ${attempt} failed:`, error);
      if (attempt < MAX_PROMPT_GENERATION_ATTEMPTS) {
        const backoffMs = attempt * 2000;
        console.log(`[generateImageBasedPrompts] Retrying prompt generation in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(
    `Prompt generation failed after ${MAX_PROMPT_GENERATION_ATTEMPTS} attempts${
      lastPromptError instanceof Error ? `: ${lastPromptError.message}` : ''
    }`
  );
}

async function initializeStoryboardReferenceCloneProject(input: {
  projectId: string;
  request: StartWorkflowRequest & { imageUrl?: string; resolvedVideoModel: VideoModel };
  storyboardPlan: StoryboardPlan;
  cloneReferenceAssets: CloneReferenceAssets;
}): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { projectId, request, storyboardPlan, cloneReferenceAssets } = input;
  const aspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const referenceImageUrls = collectDistinctUrls(
    [
      ...cloneReferenceAssets.avatarPhotoUrls,
      ...cloneReferenceAssets.productImageUrls,
      ...cloneReferenceAssets.petPhotoUrls
    ],
    9
  );
  const storyboardPrompt = buildStoryboardSheetPrompt({
    rows: storyboardPlan.rows,
    aspectRatio,
    assets: cloneReferenceAssets
  });

  await moderatePromptBeforeGeneration(storyboardPrompt, {
    externalId: `user_${request.userId}:video_clone_${projectId}:storyboard_sheet`,
  });

  const storyboardTaskId = await createKieGptImageTask({
    prompt: storyboardPrompt,
    referenceImageUrls,
    aspectRatio: '9:16',
    callBackUrl: FRAME_WEBHOOK_URL,
    moderationExternalId: `user_${request.userId}:video_clone_${projectId}:storyboard_sheet`
  });

  const metadataSource = {
    clone_reference_assets: {
      selectedAvatarId: cloneReferenceAssets.selectedAvatarId || request.selectedAvatarId || null,
      selectedProductId: cloneReferenceAssets.selectedProductId || request.selectedProductId || null,
      selectedPetId: cloneReferenceAssets.selectedPetId || request.selectedPetId || null,
      selectedAvatarIds:
        cloneReferenceAssets.selectedAvatarIds ||
        normalizeSelectedIds(request.selectedAvatarId, request.selectedAvatarIds, 8),
      selectedProductIds:
        cloneReferenceAssets.selectedProductIds ||
        normalizeSelectedIds(request.selectedProductId, request.selectedProductIds, 8),
      selectedPetIds:
        cloneReferenceAssets.selectedPetIds ||
        normalizeSelectedIds(request.selectedPetId, request.selectedPetIds, 8),
      avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
      productImageUrls: cloneReferenceAssets.productImageUrls,
      petPhotoUrls: cloneReferenceAssets.petPhotoUrls
    },
    storyboard_mode: {
      mode: 'clone_storyboard_reference',
      prompt_version: STORYBOARD_REFERENCE_PROMPT_VERSION,
      storyboard_task_id: storyboardTaskId,
      storyboard_image_url: null,
      rows: storyboardPlan.rows,
      reference_asset_map: {
        avatarIds: cloneReferenceAssets.selectedAvatarIds || [],
        productIds: cloneReferenceAssets.selectedProductIds || [],
        petIds: cloneReferenceAssets.selectedPetIds || [],
        avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
        productImageUrls: cloneReferenceAssets.productImageUrls,
        petPhotoUrls: cloneReferenceAssets.petPhotoUrls
      }
    }
  } satisfies Record<string, unknown>;
  const storedVideoPrompts = buildStoredVideoPromptsPayload(storyboardPlan.segments, metadataSource);
  const serializedPlan = serializeSegmentPlan(storyboardPlan.segments);

  const { error: cleanupError } = await supabase
    .from('video_clone_segments')
    .delete()
    .eq('project_id', projectId);
  if (cleanupError) {
    console.error('Failed to clean up existing storyboard segments:', cleanupError);
    throw new Error('Failed to reset storyboard segments');
  }

  const segmentRows = storyboardPlan.segments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: 'pending_storyboard',
    prompt: serializeSegmentPrompt(segmentPrompt)
  }));

  const { data: segments, error: insertError } = await supabase
    .from('video_clone_segments')
    .insert(segmentRows)
    .select();
  if (insertError || !segments) {
    console.error('Failed to insert storyboard segments:', insertError);
    throw new Error('Failed to initialize storyboard segments');
  }

  const now = new Date().toISOString();
  const { error: projectUpdateError } = await supabase
    .from('video_clone_projects')
    .update({
      video_prompts: storedVideoPrompts,
      segment_plan: serializedPlan,
      is_segmented: true,
      segment_count: storyboardPlan.segments.length,
      segment_duration_seconds: null,
      video_duration: String(storyboardPlan.durationSeconds),
      status: 'processing',
      current_step: 'generating_storyboard_image',
      progress_percentage: 25,
      video_generation_requested: true,
      segment_status: buildSegmentStatusPayload(segments as VideoCloneSegment[]),
      last_processed_at: now
    })
    .eq('id', projectId);
  if (projectUpdateError) {
    console.error('Failed to update storyboard project state:', projectUpdateError);
    throw new Error('Failed to initialize storyboard clone project');
  }

  console.log(`✅ Storyboard clone initialized for project ${projectId}; storyboard task ${storyboardTaskId}`);
}

async function startSegmentedWorkflow(
  projectId: string,
  request: StartWorkflowRequest & { imageUrl?: string }, // Optional when no product image is provided
  prompts: Record<string, unknown>,
  segmentCount: number,
  referenceVideoDescription?: Record<string, unknown>, // Reference video analysis
  referenceVideoShots?: ReferenceVideoShot[],
  productImageUrls?: string[] | null, // UPDATED: Multiple product image URLs for product shots
  productContext?: { product_name?: string },
  referenceVideoType?: 'video' | null, // Reference videos are video-only (null means no clone source)
  cloneReferenceAssets?: CloneReferenceAssets
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const defaultFrameSize = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const segmentModelForDuration = request.resolvedVideoModel || request.videoModel;
  const perSegmentDurationSeconds = resolvePerSegmentDurationSeconds(
    segmentModelForDuration,
    request.videoDuration,
    segmentCount
  );
  const normalizedSegments = removeOriginalReferenceEntitiesFromSegments(
    normalizeSegmentPrompts(prompts, segmentCount, referenceVideoShots, perSegmentDurationSeconds).map(segment => ({
      ...segment,
      first_frame_image_size: segment.first_frame_image_size || defaultFrameSize
    })),
    {
      avatarName: cloneReferenceAssets?.avatarName,
      productName: cloneReferenceAssets?.productName || productContext?.product_name,
      petName: cloneReferenceAssets?.petName
    }
  );
  const normalizedAvatarPhotoUrls = collectDistinctUrls(cloneReferenceAssets?.avatarPhotoUrls || [], 4);
  const normalizedProductImageUrls = collectDistinctUrls(
    [
      ...(productImageUrls || []),
      ...(cloneReferenceAssets?.productImageUrls || []),
      ...(cloneReferenceAssets?.petPhotoUrls || [])
    ],
    8
  );
  const serializedPlan = serializeSegmentPlan(normalizedSegments);
  const useSeedanceReferenceImages = isProjectAgentSeedanceReferenceImageMode({
    requestSource: request.requestSource,
    videoModel: request.videoModel,
    resolvedVideoModel: request.resolvedVideoModel,
    executionMode: request.executionMode
  });
    const metadataSource = {
      ...(prompts as Record<string, unknown>),
      clone_reference_assets: {
        selectedAvatarId: cloneReferenceAssets?.selectedAvatarId || request.selectedAvatarId || null,
        selectedProductId: cloneReferenceAssets?.selectedProductId || request.selectedProductId || null,
      selectedAvatarIds:
          cloneReferenceAssets?.selectedAvatarIds ||
          normalizeSelectedIds(request.selectedAvatarId, request.selectedAvatarIds, 8),
        selectedProductIds:
          cloneReferenceAssets?.selectedProductIds ||
          normalizeSelectedIds(request.selectedProductId, request.selectedProductIds, 8),
        selectedPetId: cloneReferenceAssets?.selectedPetId || request.selectedPetId || null,
        selectedPetIds:
          cloneReferenceAssets?.selectedPetIds ||
          normalizeSelectedIds(request.selectedPetId, request.selectedPetIds, 8),
        avatarPhotoUrls: normalizedAvatarPhotoUrls,
        productImageUrls: normalizedProductImageUrls,
        petPhotoUrls: cloneReferenceAssets?.petPhotoUrls || []
      }
    } satisfies Record<string, unknown>;
  const storedVideoPrompts = buildStoredVideoPromptsPayload(normalizedSegments, metadataSource);
  const now = new Date().toISOString();

  // Clear any previous segment rows for this project to avoid unique key conflicts when restarting workflows
  const { error: cleanupError } = await supabase
    .from('video_clone_segments')
    .delete()
    .eq('project_id', projectId);
  if (cleanupError) {
    console.error('Failed to clean up existing segments before re-initializing:', cleanupError);
    throw new Error('Failed to reset previous segments');
  }

  // Schema verified via Supabase MCP (2026-01-29): video_clone_segments columns include
  // project_id, segment_index, status, prompt.
  const segmentRows = normalizedSegments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: useSeedanceReferenceImages ? 'ready_for_video' : 'pending_first_frame',
    prompt: serializeSegmentPrompt(segmentPrompt)
  }));

  const { data: insertedSegments, error } = await supabase
    .from('video_clone_segments')
    .insert(segmentRows)
    .select();

  if (error || !insertedSegments) {
    console.error('Failed to insert segmented rows:', error);
    throw new Error('Failed to initialize segment records');
  }

  const segments = insertedSegments as VideoCloneSegment[];

  const { error: projectPromptUpdateError } = await supabase
    .from('video_clone_projects')
    .update({
      video_prompts: storedVideoPrompts,
      segment_plan: serializedPlan,
      current_step: useSeedanceReferenceImages ? 'ready_for_video' : 'generating_segment_frames',
      progress_percentage: useSeedanceReferenceImages ? 60 : 35,
      last_processed_at: now,
      segment_status: buildSegmentStatusPayload(segments)
    })
    .eq('id', projectId);
  if (projectPromptUpdateError) {
    console.error('Failed to update segmented project prompt state:', projectPromptUpdateError);
    throw new Error('Failed to finalize segmented prompt state');
  }

  if (useSeedanceReferenceImages) {
    const { error: directModeUpdateError } = await supabase
      .from('video_clone_projects')
      .update({
        segment_status: buildSegmentStatusPayload(segments),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId);
    if (directModeUpdateError) {
      console.error('Failed to update Seedance direct segment status:', directModeUpdateError);
      throw new Error('Failed to finalize Seedance direct segment status');
    }
    return;
  }

  const segmentsToStart: VideoCloneSegment[] = [];

  // Mark continuation dependencies before starting any KIE task.
  // This prevents a race where segment 0 returns fast and its webhook arrives
  // before later segments have been flipped from pending_first_frame to
  // awaiting_prev_first_frame.
  for (const segment of segments) {
    const promptData = normalizedSegments[segment.segment_index];
    const shouldWaitForContinuation = shouldWaitForContinuationFrame({
      segmentIndex: segment.segment_index,
      isContinuationFromPrev: promptData.is_continuation_from_prev
    });

    if (shouldWaitForContinuation) {
      await supabase
        .from('video_clone_segments')
        .update({
          status: 'awaiting_prev_first_frame',
          updated_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      segment.status = 'awaiting_prev_first_frame';
      continue;
    }

    segmentsToStart.push(segment);
  }

  for (const segment of segmentsToStart) {
    const promptData = normalizedSegments[segment.segment_index];
    const aspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';

    // Use smart frame generation with automatic routing
    const firstFrameTaskId = await createSmartSegmentFrame(
      promptData,
      segment.segment_index,
      'first',
      aspectRatio,
      normalizedProductImageUrls.length > 0 ? normalizedProductImageUrls : null,
      referenceVideoType || null,
      {
        characterPhotoUrls: normalizedAvatarPhotoUrls.length > 0 ? normalizedAvatarPhotoUrls : null,
        workflowSourceOverride: request.requestSource || 'default',
        moderationExternalId: `user_${request.userId}:video_clone_${projectId}:segment_${segment.segment_index}:frame`
      },
      null,
      request.resolvedVideoModel
    );

    const { error: updateError } = await supabase
      .from('video_clone_segments')
      .update({
        first_frame_task_id: firstFrameTaskId,
        status: 'generating_first_frame',
        updated_at: new Date().toISOString()
      })
      .eq('id', segment.id)
      .select();

    if (updateError) {
      console.error('Failed to update segment after keyframe start:', updateError);
      throw new Error('Failed to update segment state');
    }

    segment.first_frame_task_id = firstFrameTaskId;
    segment.status = 'generating_first_frame';
  }

  await supabase
    .from('video_clone_projects')
    .update({
      segment_status: buildSegmentStatusPayload(segments),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

export function normalizeSegmentPrompts(
  prompts: Record<string, unknown>,
  segmentCount: number,
  referenceVideoShots?: ReferenceVideoShot[],
  segmentDurationSeconds?: number
): SegmentPrompt[] {
  type LooseSegment = Partial<SegmentPrompt> & Record<string, unknown>;

  const rawSegments = Array.isArray((prompts as { segments?: LooseSegment[] }).segments)
    ? ((prompts as { segments?: LooseSegment[] }).segments || [])
    : [];

  const durationPerSegment = Number.isFinite(segmentDurationSeconds) && segmentDurationSeconds
    ? Number(segmentDurationSeconds)
    : 0;

  const normalized: SegmentPrompt[] = [];

  for (let index = 0; index < segmentCount; index++) {
    const source = (rawSegments[index] || rawSegments[rawSegments.length - 1] || {}) as LooseSegment;
    const shot = referenceVideoShots?.[index];
    const shotOverrides = shot ? buildSegmentOverridesFromShot(shot) : undefined;
    const defaultLanguage = cleanSegmentText(source.language) || 'en';
    const sourceShots = Array.isArray((source as { shots?: unknown }).shots)
      ? ((source as { shots?: Array<Record<string, unknown>> }).shots || [])
      : [];
    const serializedShotDuration = sourceShots.reduce((sum, rawShot) => {
      const duration = typeof rawShot.duration_seconds === 'number'
        ? rawShot.duration_seconds
        : Number(rawShot.duration_seconds);
      if (Number.isFinite(duration) && duration > 0) {
        return sum + duration;
      }
      const start = typeof rawShot.start_seconds === 'number'
        ? rawShot.start_seconds
        : Number(rawShot.start_seconds);
      const end = typeof rawShot.end_seconds === 'number'
        ? rawShot.end_seconds
        : Number(rawShot.end_seconds);
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        return sum + (end - start);
      }
      return sum;
    }, 0);
    const segmentDurationForIndex =
      durationPerSegment > 0
        ? durationPerSegment
        : shot?.durationSeconds && shot.durationSeconds > 0
          ? shot.durationSeconds
          : serializedShotDuration > 0
            ? serializedShotDuration
            : getSegmentDurationForModel('seedance_2_fast');
    const normalizedShots = normalizeSegmentShots(
      (source as { shots?: unknown }).shots,
      segmentDurationForIndex,
      defaultLanguage,
      source,
      shot
    );

    const primaryShot = normalizedShots[0];
    const fromShot = (field: keyof SegmentShot): string | undefined => cleanSegmentText((primaryShot as Record<string, unknown> | undefined)?.[field]);

    const segment: SegmentPrompt = {
      audio: cleanSegmentText(source.audio) ?? fromShot('audio') ?? '',
      style: cleanSegmentText(source.style) ?? fromShot('style') ?? '',
      action: cleanSegmentText(source.action) ?? fromShot('action') ?? '',
      subject: cleanSegmentText(source.subject) ?? fromShot('subject') ?? '',
      composition: cleanSegmentText(source.composition) ?? fromShot('composition') ?? '',
      context_environment: cleanSegmentText(source.context_environment) ?? fromShot('context_environment') ?? '',
      // Add fallback to the reference shot description if AI returns empty/invalid
      first_frame_description:
        cleanSegmentText(source.first_frame_description) ??
        (shotOverrides?.first_frame_description ? cleanSegmentText(shotOverrides.first_frame_description) : undefined) ??
        (shot?.firstFrameDescription ? cleanSegmentText(shot.firstFrameDescription) : undefined) ??
        '',
      ambiance_colour_lighting: cleanSegmentText(source.ambiance_colour_lighting) ?? fromShot('ambiance_colour_lighting') ?? '',
      camera_motion_positioning: cleanSegmentText(source.camera_motion_positioning) ?? fromShot('camera_motion_positioning') ?? '',
      dialogue: cleanSegmentText(source.dialogue) ?? fromShot('dialogue') ?? '',
      language: cleanSegmentText(source.language) ?? fromShot('language') ?? defaultLanguage,
      index:
        typeof source.index === 'number'
          ? source.index
          : typeof shotOverrides?.index === 'number'
            ? shotOverrides.index
            : index + 1,
      first_frame_image_size: source.first_frame_image_size,
      is_continuation_from_prev: index === 0
        ? false
        : typeof source.is_continuation_from_prev === 'boolean'
          ? source.is_continuation_from_prev
          : false,
      shots: normalizedShots
    };

    normalized.push(segment);
  }

  return normalized;
}

export function serializeSegmentPlan(segments: SegmentPrompt[]): SerializedSegmentPlan {
  return {
    segments: segments.map(serializeSegmentPrompt)
  };
}

const extractPromptMetadata = (raw: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  return Object.entries(raw).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (key === 'segments') {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
};

export function buildStoredVideoPromptsPayload(
  segments: SegmentPrompt[],
  metadataSource?: Record<string, unknown> | null
): Record<string, unknown> {
  const serializedPlan = serializeSegmentPlan(segments);
  const metadata = extractPromptMetadata(metadataSource || null);
  return {
    ...metadata,
    ...serializedPlan
  };
}

export function serializeSegmentPrompt(segment: SegmentPrompt): SerializedSegmentPlanSegment {
  return {
    first_frame_description: segment.first_frame_description || '',
    is_continuation_from_prev: Boolean(segment.is_continuation_from_prev),
    shots: Array.isArray(segment.shots)
      ? segment.shots.map(shot => ({
          id: shot.id,
          time_range: shot.time_range,
          start_seconds: shot.start_seconds,
          end_seconds: shot.end_seconds,
          duration_seconds: shot.duration_seconds,
          audio: shot.audio,
          sfx: shot.sfx,
          ambient: shot.ambient,
          style: shot.style,
          action: shot.action,
          subject: shot.subject,
          dialogue: shot.dialogue,
          language: shot.language,
          composition: shot.composition,
          context_environment: shot.context_environment,
          ambiance_colour_lighting: shot.ambiance_colour_lighting,
          camera_motion_positioning: shot.camera_motion_positioning
        }))
      : []
  };
}

export function hydrateSerializedSegmentPrompt(
  planSegment: SerializedSegmentPlanSegment | Record<string, unknown> | null | undefined,
  segmentIndex: number,
  segmentDurationSeconds?: number
): SegmentPrompt {
  const hydrated = hydrateSegmentPlan(
    { segments: [planSegment || {}] },
    1,
    segmentDurationSeconds
  )[0];
  hydrated.index = segmentIndex + 1;
  if (planSegment && typeof (planSegment as Record<string, unknown>).is_continuation_from_prev === 'boolean') {
    hydrated.is_continuation_from_prev = Boolean((planSegment as Record<string, unknown>).is_continuation_from_prev);
  }
  return hydrated;
}

export function hydrateSegmentPlan(
  plan: SerializedSegmentPlan | Record<string, unknown> | null | undefined,
  segmentCount: number,
  segmentDurationSeconds?: number,
  referenceVideoShots?: ReferenceVideoShot[]
): SegmentPrompt[] {
  if (!plan || typeof plan !== 'object') {
    return [];
  }
  const segments = Array.isArray((plan as { segments?: unknown[] }).segments)
    ? ((plan as { segments?: unknown[] }).segments || [])
    : [];
  if (!segments.length) {
    return [];
  }
  const resolvedCount = segmentCount > 0 ? segmentCount : segments.length;
  return normalizeSegmentPrompts(
    plan as Record<string, unknown>,
    resolvedCount,
    referenceVideoShots,
    segmentDurationSeconds
  );
}

function compressReferenceVideoShotsToSegments(shots: ReferenceVideoShot[], segmentCount: number): ReferenceVideoShot[] {
  if (segmentCount <= 0 || shots.length === 0) {
    return [];
  }

  if (segmentCount === shots.length) {
    return shots;
  }

  const buckets: ReferenceVideoShot[][] = Array.from({ length: segmentCount }, () => []);
  const totalShots = shots.length;

  for (let i = 0; i < segmentCount; i++) {
    const startRatio = i / segmentCount;
    const endRatio = (i + 1) / segmentCount;
    const startIndex = Math.floor(startRatio * totalShots);
    const endIndex = Math.max(startIndex + 1, Math.floor(endRatio * totalShots));
    let slice = shots.slice(startIndex, Math.min(endIndex, totalShots));

    if (slice.length === 0) {
      const fallbackIndex = Math.min(startIndex, totalShots - 1);
      slice = [shots[Math.max(0, fallbackIndex)]];
    }

    buckets[i] = slice;
  }

  return buckets.map((group, index) => mergeShotGroup(group, index));
}

function mergeShotGroup(shots: ReferenceVideoShot[], segmentIndex: number): ReferenceVideoShot {
  const first = shots[0];
  const last = shots[shots.length - 1] || first;

  const joinText = (values: Array<string | undefined>) => {
    const sanitized = values
      .map(value => (value || '').trim())
      .filter(Boolean);
    if (sanitized.length === 0) return '';
    // Use sentence-like spacing when combining multiple clips
    return sanitized.join('\n\n');
  };

  const durationSeconds = Math.max(
    1,
    Math.round((last.endTimeSeconds ?? 0) - (first.startTimeSeconds ?? 0)) || shots.reduce((sum, shot) => sum + (shot.durationSeconds || 0), 0)
  );

  return {
    id: segmentIndex + 1,
    startTime: first.startTime,
    endTime: last.endTime,
    durationSeconds,
    firstFrameDescription: joinText(shots.map(shot => shot.firstFrameDescription)),
    subject: joinText(shots.map(shot => shot.subject)),
    contextEnvironment: joinText(shots.map(shot => shot.contextEnvironment)),
    action: joinText(shots.map(shot => shot.action)),
    style: joinText(shots.map(shot => shot.style)),
    cameraMotionPositioning: joinText(shots.map(shot => shot.cameraMotionPositioning)),
    composition: joinText(shots.map(shot => shot.composition)),
    ambianceColourLighting: joinText(shots.map(shot => shot.ambianceColourLighting)),
    audio: joinText(shots.map(shot => shot.audio)),
    dialogue: joinText(shots.map(shot => shot.dialogue)),
    sfx: joinText(shots.map(shot => shot.sfx)),
    ambient: joinText(shots.map(shot => shot.ambient)),
    startTimeSeconds: first.startTimeSeconds,
    endTimeSeconds: last.endTimeSeconds
  };
}

function resolveFrameDescription(segmentPrompt: SegmentPrompt, frameType: 'first' | 'closing'): string {
  const derived = deriveSegmentDetails(segmentPrompt);
  if (frameType === 'first') {
    return derived.first_frame_prompt || derived.description;
  }
  return derived.ending || derived.description;
}

function buildSegmentOverridesFromShot(shot: ReferenceVideoShot): Partial<SegmentPrompt> {
  return {
    index: shot.id,
    first_frame_description: shot.firstFrameDescription || ''
  };
}

export function buildSegmentPlanFromReferenceVideoShots(segmentCount: number, referenceVideoShots: ReferenceVideoShot[]): SegmentPrompt[] {
  if (segmentCount <= 0 || referenceVideoShots.length === 0) {
    return [];
  }

  const effectiveShots = segmentCount === referenceVideoShots.length
    ? referenceVideoShots
    : compressReferenceVideoShotsToSegments(referenceVideoShots, segmentCount);

  const totalDuration = effectiveShots.reduce((sum, shot) => sum + (shot.durationSeconds || 0), 0);
  if (totalDuration <= 0) {
    throw new Error('Reference video shots are missing durations.');
  }
  const perSegmentDuration = Math.max(1, Math.round(totalDuration / segmentCount));

  const placeholderPrompts = {
    segments: Array.from({ length: segmentCount }, (_, index) => ({ index: index + 1 }))
  } as { segments: Array<Partial<SegmentPrompt>> };

  return normalizeSegmentPrompts(placeholderPrompts, segmentCount, effectiveShots, perSegmentDuration);
}

export function getFailedSegmentErrorMessage(segments: VideoCloneSegment[]): string | null {
  const failedSegment = segments.find((segment) => segment.status === 'failed');
  return failedSegment
    ? ((failedSegment as { error_message?: string | null }).error_message || 'Video generation failed.')
    : null;
}

export function shouldRetryCloneVideoFailure(input: {
  code: number;
  failCode?: string | null;
  failMsg?: string | null;
  retryCount: number;
  maxRetries: number;
}) {
  const normalizedMessage = input.failMsg?.toLowerCase() || '';
  const isProviderSafetyFailure = (
    input.failCode === '501' ||
    normalizedMessage.includes('sensitive information') ||
    normalizedMessage.includes('safety') ||
    normalizedMessage.includes('content policy')
  );

  return input.code >= 500 &&
    input.retryCount < input.maxRetries &&
    !isProviderSafetyFailure;
}

export function getTerminalFailedCloneRefundAmount(project: {
  status?: string | null;
  generation_credits_used?: number | null;
}) {
  const chargedCredits = Number(project.generation_credits_used || 0);
  return chargedCredits > 0 ? chargedCredits : 0;
}

export function buildSegmentStatusPayload(
  segments: VideoCloneSegment[],
  mergedVideoUrl: string | null = null
): SegmentStatusPayload {
  const total = segments.length;
  const framesReady = segments.filter(seg => !!seg.first_frame_url).length;
  const videosReady = segments.filter(seg => !!seg.video_url).length;

  return {
    total,
    framesReady,
    videosReady,
    segments: segments.map(seg => ({
      index: seg.segment_index,
      status: seg.status,
      firstFrameUrl: seg.first_frame_url,
      closingFrameUrl: seg.closing_frame_url,
      videoUrl: seg.video_url,
      errorMessage: (seg as { error_message?: string | null }).error_message || null,
      retryCount: (seg as { retry_count?: number | null }).retry_count || null
    })),
    mergedVideoUrl
  };
}

/**
 * Generate frame from text prompt only (Text-to-Image)
 * Used when no reference assets are available
 */
async function createFrameFromText(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  moderationExternalId?: string
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);

  const frameDescription = resolveFrameDescription(segmentPrompt, frameType);

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

Scene Description:
- ${frameDescription}

Creative Direction:
- Setting: ${derived.setting}
- Camera: ${derived.camera_type} with ${derived.camera_movement}
- Action: ${derived.action}
- Lighting: ${derived.lighting}
- Style: Professional, high-quality commercial photography
- Composition: ${frameType === 'first' ? 'Strong opening frame that captures attention' : 'Smooth closing that transitions naturally'}

Technical Requirements:
- No text overlays, no watermarks, no borders
- Photorealistic rendering
- Commercial-grade quality`;

  return createKieGptImageTask({
    prompt,
    aspectRatio,
    callBackUrl: FRAME_WEBHOOK_URL,
    moderationExternalId
  });
}

/**
 * Generate frame from reference image (Image-to-Image)
 * Used when reference images are available (product, character, or continuation)
 */
type FrameGenerationOverrides = {
  aspectRatioOverride?: string;
  imageSizeOverride?: string;
  characterPhotoUrls?: string[] | null;
  additionalReferenceImageUrls?: string[] | null;
  workflowSourceOverride?: 'project_agent_clone' | 'project_agent_edit_video' | 'default';
  usePromptAsIs?: boolean;
  moderationExternalId?: string;
};

function shouldWaitForContinuationFrame(input: {
  segmentIndex: number;
  isContinuationFromPrev?: boolean;
}) {
  return Boolean(input.segmentIndex > 0 && input.isContinuationFromPrev);
}

function buildStructuredVideoPromptPayload(input: {
  normalizedShots: NormalizedVideoShot[];
}) {
  return {
    shots: input.normalizedShots
  };
}
async function createFrameFromImage(
  referenceImageUrls: string[],
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  referenceVideoType?: 'video' | null, // Reference videos are video-only (indicates clone mode)
  overrides?: FrameGenerationOverrides
): Promise<string> {
  const sanitizedReferences = (referenceImageUrls || []).filter(Boolean);
  if (sanitizedReferences.length === 0) {
    throw new Error('No reference images provided for frame generation');
  }
  const limitedReferences = sanitizedReferences.slice(0, 8);

  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);
  const isProjectAgentClone = overrides?.workflowSourceOverride === 'project_agent_clone';
  console.log('🎨 Using GPT Image 2 keyframes for clone frame generation (docs/kie/gpt_2_img*.md)');
  const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;

  const frameDescription = resolveFrameDescription(segmentPrompt, frameType);
  const prompt = isProjectAgentClone
    ? buildProjectAgentFramePrompt({
        segmentIndex,
        frameType,
        frameDescription,
        isBrandShot: false
      })
    : `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

Use the provided reference images as the canonical reference. Maintain identical product proportions, textures, materials, and packaging details.

Scene Focus:
- Description: ${frameDescription}
- Setting: ${derived.setting}
- Camera: ${derived.camera_type} with ${derived.camera_movement}
- Lighting: ${derived.lighting}
- Maintain SCENE, LIGHTING, CAMERA ANGLE, and STYLE from original segment
- Create a product-focused keyframe that shows authentic use cases

Render Instructions:
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;

  const requestPayload = buildKieGptImageTaskPayload({
    prompt,
    referenceImageUrls: limitedReferences,
    aspectRatio: resolvedAspectRatio,
    callBackUrl: FRAME_WEBHOOK_URL
  });

  console.log(`📤 [createFrameFromImage] Sending to KIE API:`, {
    imageModel: requestPayload.model,
    referenceImageCount: limitedReferences.length,
    referenceImageUrls: limitedReferences
  });

  console.log(`📤 [createFrameFromImage] Full request payload:`, JSON.stringify(requestPayload, null, 2));

  return createKieGptImageTask({
    prompt,
    referenceImageUrls: limitedReferences,
    aspectRatio: resolvedAspectRatio,
    callBackUrl: FRAME_WEBHOOK_URL,
    moderationExternalId: overrides?.moderationExternalId
  });
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createSmartSegmentFrame instead
 */
 
async function createSegmentFrameTask(
  request: StartWorkflowRequest & { imageUrl: string },
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing'
): Promise<string> {
  // Default to product image for backward compatibility
  return createFrameFromImage(
    [request.imageUrl],
    segmentPrompt,
    segmentIndex,
    frameType,
    request.videoAspectRatio === '9:16' ? '9:16' : '16:9'
  );
}

/**
 * Smart segment frame generation with automatic routing
 * Decides between Text-to-Image, Brand Image-to-Image, or Product Image-to-Image
 * based on available reference assets and continuation context
 */
export async function createSmartSegmentFrame(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  productImageUrls: string[] | null,
  referenceVideoType?: 'video' | null, // Reference videos are video-only (indicates clone mode)
  overrides?: FrameGenerationOverrides,
  continuationReferenceUrl?: string | null,
  videoModel?: VideoModel
): Promise<string> {
  const compileModel = videoModel || null;
  const compilation = compileModel
    ? compilePromptForExecution(segmentPrompt, compileModel)
    : null;
  const promptForProvider = compilation?.compiledValue || segmentPrompt;
  if (compilation) {
    console.log('[Prompt Compile] Frame prompt compiled:', {
      model: compileModel,
      mention_count: compilation.mentionCount,
      compile_mode: compilation.compileMode
    });
  }

  // Direct text-to-image shortcut for reference-video cloning
  const isReferenceCloneMode = referenceVideoType === 'video';
  const usesContinuationReference = Boolean(
    continuationReferenceUrl && frameType === 'first' && promptForProvider.is_continuation_from_prev
  );
  const usePromptAsIs = Boolean(overrides?.usePromptAsIs && frameType === 'first');

  if (usePromptAsIs) {
    const frameDescription = resolveFrameDescription(promptForProvider, frameType);
    const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;
    const characterPhotos = Array.isArray(overrides?.characterPhotoUrls)
      ? overrides.characterPhotoUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    const normalizedProductImages = Array.isArray(productImageUrls)
      ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    const additionalReferenceImages = Array.isArray(overrides?.additionalReferenceImageUrls)
      ? overrides.additionalReferenceImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    const imageInput = Array.from(
      new Set([
        ...(usesContinuationReference && continuationReferenceUrl ? [continuationReferenceUrl] : []),
        ...additionalReferenceImages,
        ...characterPhotos,
        ...normalizedProductImages
      ])
    );

    console.log('[Frame Routing]', {
      segmentIndex,
      frameType,
      isCloneMode: isReferenceCloneMode,
      usesContinuationReference,
      imageInputCount: imageInput.length,
      usePromptAsIs: true
    });

    const prompt = overrides?.workflowSourceOverride === 'project_agent_clone'
      ? buildProjectAgentFramePrompt({
          segmentIndex,
          frameType,
          frameDescription,
          isBrandShot: false
        })
      : frameDescription;

    const requestPayload = buildKieGptImageTaskPayload({
      prompt,
      referenceImageUrls: imageInput,
      aspectRatio: resolvedAspectRatio,
      callBackUrl: FRAME_WEBHOOK_URL
    });

    console.log('   - 📤 Manual frame regeneration using raw prompt');
    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);
    console.log(`   - 📤 input_urls:`, imageInput);
    console.log(`   - 📤 Full KIE API request payload:`, JSON.stringify(requestPayload, null, 2));

    return createKieGptImageTask({
      prompt,
      referenceImageUrls: imageInput,
      aspectRatio: resolvedAspectRatio,
      callBackUrl: FRAME_WEBHOOK_URL,
      moderationExternalId: overrides?.moderationExternalId
    });
  }

  if (isReferenceCloneMode) {
    console.log(`🎨 Reference video clone mode detected: Using direct text-to-image`);
    console.log(`   - Segment ${segmentIndex + 1} ${frameType} frame`);

    const frameDescription = resolveFrameDescription(promptForProvider, frameType);
    const isProjectAgentClone = overrides?.workflowSourceOverride === 'project_agent_clone';
    const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;

    // Build GPT Image 2 input_urls from multiple sources
    const imageInput: string[] = [];

    // 1. Continuation reference (for segment continuity)
    const shouldUseContinuation = usesContinuationReference;
    if (shouldUseContinuation && continuationReferenceUrl) {
      imageInput.push(continuationReferenceUrl);
      console.log(`   - 🔗 Continuation mode: Using previous segment's first frame as reference`);
    }

    // 2. Character photos (manually selected by user via Character Reference)
    const characterPhotos = Array.isArray(overrides?.characterPhotoUrls)
      ? overrides.characterPhotoUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    if (characterPhotos.length > 0) {
      imageInput.push(...characterPhotos);
      console.log(`   - 👤 Character references: Using ${characterPhotos.length} character photo(s)`);
    }

    // 3. Product images (manually selected by user via Product References)
    const normalizedProductImages = Array.isArray(productImageUrls)
      ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    if (normalizedProductImages.length > 0) {
      imageInput.push(...normalizedProductImages);
      console.log(`   - 📦 Product references: Using ${normalizedProductImages.length} product photo(s)`);
    }
    const additionalReferenceImages = Array.isArray(overrides?.additionalReferenceImageUrls)
      ? overrides.additionalReferenceImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    if (additionalReferenceImages.length > 0) {
      imageInput.unshift(...additionalReferenceImages);
      console.log(`   - 🎞️ Storyboard/reference images: Using ${additionalReferenceImages.length} additional reference(s)`);
    }

    console.log('[Frame Routing]', {
      segmentIndex,
      frameType,
      isCloneMode: true,
      usesContinuationReference,
      imageInputCount: imageInput.length
    });
    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);
    console.log(`   - 📤 Sending to KIE API - input_urls count: ${imageInput.length}`);
    console.log(`   - 📤 input_urls:`, imageInput);

    const prompt = isProjectAgentClone
      ? buildProjectAgentFramePrompt({
          segmentIndex,
          frameType,
          frameDescription,
          isBrandShot: false
        })
      : frameDescription;

    const requestPayload = buildKieGptImageTaskPayload({
      prompt,
      referenceImageUrls: imageInput,
      aspectRatio: resolvedAspectRatio,
      callBackUrl: FRAME_WEBHOOK_URL
    });

    console.log(`   - 📤 Full KIE API request payload:`, JSON.stringify(requestPayload, null, 2));

    const taskId = await createKieGptImageTask({
      prompt,
      referenceImageUrls: imageInput,
      aspectRatio: resolvedAspectRatio,
      callBackUrl: FRAME_WEBHOOK_URL,
      moderationExternalId: overrides?.moderationExternalId
    });

    console.log(`   ✅ Task created: ${taskId}`);
    return taskId;
  }

  // Traditional mode continues using product and character references only.
  const normalizedProductImages = Array.isArray(productImageUrls)
    ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];

  const shouldUseContinuationReference = usesContinuationReference;
  const continuationReferences: string[] = shouldUseContinuationReference && continuationReferenceUrl
    ? [continuationReferenceUrl]
    : [];

  const characterPhotos = Array.isArray(overrides?.characterPhotoUrls)
    ? overrides.characterPhotoUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];
  const additionalReferenceImages = Array.isArray(overrides?.additionalReferenceImageUrls)
    ? overrides.additionalReferenceImageUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];
  const hasCharacterPhotos = characterPhotos.length > 0;

  console.log(`🎬 Segment ${segmentIndex + 1} ${frameType} frame generation:`);
  console.log(`   - productImageRefs: ${normalizedProductImages.length}`);
  console.log(`   - character references: ${hasCharacterPhotos ? `${characterPhotos.length} photo(s)` : 'none'}`);
  if (shouldUseContinuationReference) {
    console.log(`   - continuation_from_prev: using previous first frame as reference`);
  }

  const combinedReferenceImages = Array.from(
    new Set([
      ...continuationReferences,
      ...additionalReferenceImages,
      ...(hasCharacterPhotos ? characterPhotos : []),
      ...normalizedProductImages
    ])
  );

  console.log('[Frame Routing]', {
    segmentIndex,
    frameType,
    isCloneMode: false,
    usesContinuationReference: shouldUseContinuationReference,
    imageInputCount: combinedReferenceImages.length
  });

  if (combinedReferenceImages.length > 0) {
    console.log(`   ✅ Using Image-to-Image with ${combinedReferenceImages.length} reference(s)`);
    return createFrameFromImage(
      combinedReferenceImages,
      promptForProvider,
      segmentIndex,
      frameType,
      aspectRatio,
      referenceVideoType,
      overrides
    );
  }

  console.log(`   ✅ Using Text-to-Image (no references available)`);
  return createFrameFromText(
    promptForProvider,
    segmentIndex,
    frameType,
    aspectRatio,
    overrides?.moderationExternalId
  );
}

export async function startSegmentVideoTask(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string | null,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number
): Promise<string> {
  const videoModel = (project.video_model || 'seedance_2_fast') as VideoModel;
  const promptCompilation = compilePromptForExecution(segmentPrompt, videoModel);
  const compiledSegmentPrompt = promptCompilation.compiledValue;

  console.log('[Prompt Compile] Video prompt compiled:', {
    model: videoModel,
    mention_count: promptCompilation.mentionCount,
    compile_mode: promptCompilation.compileMode
  });

  const supportedSegmentModels: VideoModel[] = ['seedance_2_mini', 'seedance_2_fast', 'seedance_2'];
  if (!supportedSegmentModels.includes(videoModel)) {
    throw new Error(`Segmented workflow only supports Seedance 2 Mini, Seedance 2 Fast, or Seedance 2. Received ${videoModel}`);
  }
  await assertKieCreditsAvailable();

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const languageCode = (project.language || 'en') as LanguageCode;
  const prompts = (project.video_prompts || {}) as { ad_copy?: string };
  const providedAdCopyRaw = typeof prompts.ad_copy === 'string' ? prompts.ad_copy.trim() : undefined;
  const providedAdCopy = providedAdCopyRaw && providedAdCopyRaw.length > 0 ? providedAdCopyRaw : undefined;
  const action = cleanSegmentText(compiledSegmentPrompt.action) || '';
  const dialogueSeed = providedAdCopy || compiledSegmentPrompt.dialogue || '';
  const dialogueContent = compilePromptForExecution(dialogueSeed, videoModel).compiledValue;
  const music = cleanSegmentText(compiledSegmentPrompt.audio) || '';
  const perSegmentDuration = resolveTaskDurationSeconds(
    project,
    videoModel,
    segmentIndex,
    totalSegments,
    compiledSegmentPrompt
  );
  const normalizedShots = buildNormalizedShots(
    compiledSegmentPrompt,
    perSegmentDuration,
    languageCode,
    action,
    dialogueContent,
    music
  );

  return await startSegmentVideoTaskSeedance(
    project,
    compiledSegmentPrompt,
    firstFrameUrl,
    closingFrameUrl,
    segmentIndex,
    totalSegments,
    videoModel
  );
}

type NormalizedVideoShot = {
  time_range: string;
  audio: string;
  style: string;
  action: string;
  subject: string;
  dialogue: string;
  language: string;
  composition: string;
  context_environment: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
};

function parseTimeRangeEndSeconds(value: string): number | null {
  const parts = String(value || '').split('-').map((part) => part.trim());
  if (parts.length !== 2) return null;
  const parsed = parseTimecode(parts[1]);
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function getTimeRangeDurationSeconds(value: string): number {
  const parts = String(value || '').split('-').map((part) => part.trim());
  if (parts.length !== 2) return 0;
  const start = parseTimecode(parts[0]);
  const end = parseTimecode(parts[1]);
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
    return 0;
  }
  return Math.max(1, Math.round(end - start));
}

function getPromptSegmentDurationSeconds(
  segment:
    | NonNullable<StartWorkflowRequest['segmentPrompts']>[number]
    | SegmentPrompt
    | undefined,
  fallback = 0
): number {
  const shots = Array.isArray(segment?.shots) ? segment.shots : [];
  const endTimes = shots
    .map((shot: { time_range?: string }) => parseTimeRangeEndSeconds(String(shot.time_range || '')))
    .filter((value: number | null): value is number => typeof value === 'number' && Number.isFinite(value));

  if (endTimes.length === 0) {
    return fallback;
  }

  return Math.max(1, Math.round(Math.max(...endTimes)));
}

function resolveTaskDurationSeconds(
  project: SingleVideoProject,
  model: VideoModel,
  segmentIndex: number,
  totalSegments: number,
  segmentPrompt?: SegmentPrompt
): number {
  if (isSeedanceStoryboardReferenceProject(project) && Array.isArray(segmentPrompt?.shots) && segmentPrompt.shots.length > 0) {
    return Math.max(
      SEEDANCE_MIN_TASK_DURATION_SECONDS,
      Math.min(SEEDANCE_DIRECT_REFERENCE_MAX_SECONDS, getPromptSegmentDurationSeconds(segmentPrompt))
    );
  }

  if (typeof project.segment_duration_seconds === 'number' && project.segment_duration_seconds > 0) {
    return project.segment_duration_seconds;
  }

  const totalDuration = Number(project.video_duration);
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return getSegmentDurationForModel(model);
  }

  const safeTotalSegments = Math.max(1, totalSegments);
  const base = Math.floor(totalDuration / safeTotalSegments);
  const remainder = totalDuration % safeTotalSegments;
  const distributed = base + (segmentIndex < remainder ? 1 : 0);
  return Math.max(1, distributed);
}

function buildNormalizedShots(
  segmentPrompt: SegmentPrompt,
  perSegmentDuration: number,
  languageCode: LanguageCode,
  action: string,
  dialogueContent: string,
  music: string
): NormalizedVideoShot[] {
  return (segmentPrompt.shots && segmentPrompt.shots.length > 0
    ? segmentPrompt.shots
    : [buildFallbackShot(1, languageCode, segmentPrompt, perSegmentDuration)]
  ).map((shot, index) => ({
    time_range: shot.time_range || `00:00 - ${formatTimecode(perSegmentDuration)}`,
    audio: cleanSegmentText(shot.audio) || music,
    style: cleanSegmentText(shot.style) || cleanSegmentText(segmentPrompt.style) || '',
    action: cleanSegmentText(shot.action) || action,
    subject: cleanSegmentText(shot.subject) || cleanSegmentText(segmentPrompt.subject) || '',
    dialogue: cleanSegmentText(shot.dialogue) || dialogueContent,
    language: cleanSegmentText(shot.language) || cleanSegmentText(segmentPrompt.language) || languageCode,
    composition: cleanSegmentText(shot.composition) || cleanSegmentText(segmentPrompt.composition) || '',
    context_environment: cleanSegmentText(shot.context_environment) || cleanSegmentText(segmentPrompt.context_environment) || '',
    ambiance_colour_lighting: cleanSegmentText(shot.ambiance_colour_lighting) || cleanSegmentText(segmentPrompt.ambiance_colour_lighting) || '',
    camera_motion_positioning: cleanSegmentText(shot.camera_motion_positioning) || cleanSegmentText(segmentPrompt.camera_motion_positioning) || '',
  }));
}

function buildSeedanceVideoRequestBody(input: {
  projectId: string;
  segmentIndex: number;
  model: SeedanceVideoModel;
  prompt: string;
  inputUrls: string[];
  referenceImageUrls?: string[];
  firstFrameUrl?: string | null;
  lastFrameUrl?: string | null;
  useFirstLastFrameFields?: boolean;
  aspectRatio: '16:9' | '9:16';
  resolution: '480p' | '720p' | '1080p';
  duration: number;
}) {
  const referenceImageUrls = collectDistinctUrls(input.referenceImageUrls || [], 9);
  const useReferenceImageMode = !input.useFirstLastFrameFields &&
    referenceImageUrls.length > 0;
  const inputUrls = collectDistinctUrls(input.inputUrls || [], 2);
  const requestInput: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution,
    duration: input.duration,
    generate_audio: true,
    web_search: !input.useFirstLastFrameFields && !useReferenceImageMode && inputUrls.length === 0
  };

  if (input.useFirstLastFrameFields) {
    if (input.firstFrameUrl) {
      requestInput.first_frame_url = input.firstFrameUrl;
    }
    if (input.lastFrameUrl && input.lastFrameUrl !== input.firstFrameUrl) {
      requestInput.last_frame_url = input.lastFrameUrl;
    }
    if (referenceImageUrls.length > 0) {
      requestInput.reference_image_urls = referenceImageUrls;
    }
    requestInput.fixed_lens = false;
    requestInput.web_search = false;
  } else if (useReferenceImageMode) {
    requestInput.reference_image_urls = referenceImageUrls;
  } else if (inputUrls.length > 0) {
    requestInput.input_urls = inputUrls;
    requestInput.fixed_lens = false;
  }

  return {
    model: getSeedanceKieVideoModelId(input.model),
    input: requestInput,
    callBackUrl: buildSegmentVideoWebhookUrl(input.projectId, input.segmentIndex)
  };
}

function buildSeedanceEditVideoRequestBody(input: {
  projectId: string;
  model: SeedanceVideoModel;
  prompt: string;
  referenceVideoUrl: string;
  referenceImageUrls?: string[];
  aspectRatio: '16:9' | '9:16';
  resolution: '480p' | '720p' | '1080p';
  duration: number;
}) {
  const referenceImageUrls = collectDistinctUrls(input.referenceImageUrls || [], 9);
  return {
    model: getSeedanceKieVideoModelId(input.model),
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      duration: input.duration,
      generate_audio: true,
      fixed_lens: false,
      reference_video_urls: [input.referenceVideoUrl],
      ...(referenceImageUrls.length > 0 ? { reference_image_urls: referenceImageUrls } : {}),
    },
    callBackUrl: buildSegmentVideoWebhookUrl(input.projectId, 0),
  };
}

async function startEditVideoTaskSeedance(input: {
  projectId: string;
  userId: string;
  model: SeedanceVideoModel;
  prompt: string;
  referenceVideoUrl: string;
  referenceImageUrls?: string[];
  aspectRatio: '16:9' | '9:16';
  resolution: '480p' | '720p' | '1080p';
  duration: number;
}) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error('KIE_API_KEY environment variable is not configured');
  }

  await moderatePromptBeforeGeneration(input.prompt, {
    externalId: `user_${input.userId}:video_clone_${input.projectId}:edit_video`,
  });
  await assertKieCreditsAvailable();

  const requestBody = buildSeedanceEditVideoRequestBody(input);
  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Seedance 2 API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Seedance 2 API failed: ${result.msg || 'Unknown error'}`);
  }

  return result.data.taskId as string;
}

async function startDirectReferenceCloneWorkflow(input: {
  request: StartWorkflowRequest;
  model: SeedanceVideoModel;
  quality: PersistedVideoQuality;
  durationSeconds: number;
  referenceSourceVideoUrl: string;
  cloneReferenceAssets: Awaited<ReturnType<typeof resolveCloneReferenceAssets>>;
  referenceVideoContext?: {
    id?: string;
    reference_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  };
}): Promise<WorkflowResult> {
  const supabase = getSupabaseAdmin();
  const { request, model, quality, durationSeconds, referenceSourceVideoUrl, cloneReferenceAssets, referenceVideoContext } = input;
  const directReferencePlan = buildDirectReferenceImagePlan({
    avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
    productImageUrls: cloneReferenceAssets.productImageUrls,
    petPhotoUrls: cloneReferenceAssets.petPhotoUrls,
    avatarName: cloneReferenceAssets.avatarName || null,
    productName: cloneReferenceAssets.productName || null,
    petName: cloneReferenceAssets.petName || null,
  });
  const referenceImageUrls = directReferencePlan.referenceImageUrls;

  const generationCost = getProjectAgentCloneGenerationCost({
    model,
    durationSeconds,
    videoQuality: quality,
    executionMode: 'clone_direct_reference',
    hasReferenceVideoUrl: true,
  });

  const creditCheck = await checkCredits(request.userId, generationCost);
  if (!creditCheck.success) {
    return { success: false, error: 'Failed to check credits', details: creditCheck.error || 'Credit check failed' };
  }
  if (!creditCheck.hasEnoughCredits) {
    return {
      success: false,
      error: 'Insufficient credits',
      details: `Need ${generationCost} credits for ${model.toUpperCase()} model, have ${creditCheck.currentCredits || 0}`,
    };
  }

  await assertKieCreditsAvailable();

  const replacementSummary = [
    cloneReferenceAssets.avatarName ? `avatar/person: ${cloneReferenceAssets.avatarName}` : null,
    cloneReferenceAssets.productName ? `product: ${cloneReferenceAssets.productName}` : null,
    cloneReferenceAssets.petName ? `pet/animal: ${cloneReferenceAssets.petName}` : null,
    normalizeSupplementalText(request.supplementalText) ? `notes: ${normalizeSupplementalText(request.supplementalText)}` : null,
  ].filter(Boolean).join('; ');
  const replacementTargets: string[] = [];
  if (cloneReferenceAssets.avatarPhotoUrls && cloneReferenceAssets.avatarPhotoUrls.length > 0) {
    replacementTargets.push('person');
  }
  if (cloneReferenceAssets.productImageUrls && cloneReferenceAssets.productImageUrls.length > 0) {
    replacementTargets.push('product');
  }
  if (cloneReferenceAssets.petPhotoUrls && cloneReferenceAssets.petPhotoUrls.length > 0) {
    replacementTargets.push('pet');
  }
  const targetList = replacementTargets.length === 0
    ? 'person and/or product'
    : replacementTargets.length === 1
      ? replacementTargets[0]
      : replacementTargets.length === 2
        ? `${replacementTargets[0]} and ${replacementTargets[1]}`
        : `${replacementTargets[0]}, ${replacementTargets[1]}, and ${replacementTargets[2]}`;
  const prompt = [
    ...directReferencePlan.promptDirectives,
    `Replace the original featured ${targetList} with the provided replacement assets while preserving the source video structure.`,
    replacementSummary ? `Replacement context: ${replacementSummary}.` : '',
    'Keep the result commercially usable, natural, and free of watermarks or text overlays unless they are part of the replacement product packaging.',
  ].filter(Boolean).join(' ');

  const selectedInputs: VideoCloneSelectedInputs = {
    primaryAvatarId: cloneReferenceAssets.selectedAvatarId || null,
    primaryProductId: cloneReferenceAssets.selectedProductId || null,
    primaryPetId: cloneReferenceAssets.selectedPetId || null,
    avatarIds: cloneReferenceAssets.selectedAvatarIds || [],
    productIds: cloneReferenceAssets.selectedProductIds || [],
    petIds: cloneReferenceAssets.selectedPetIds || [],
    workflowSource: 'project_agent_clone',
    mergePolicy: 'auto',
    executionMode: 'clone_direct_reference',
    referenceSourceVideoUrl,
    supplementalText: normalizeSupplementalText(request.supplementalText),
    referenceSourceMediaType: 'video',
    referenceSourceId: request.referenceVideoId || request.creatorSourceVideoId || null,
    isCloneMode: true,
  };

  // Schema verified via Supabase MCP (2026-06-12): video_clone_projects supports
  // selected_inputs, video_duration, segment_count, segment_status, video_generation_requested.
  const { data: project, error: projectError } = await supabase
    .from('video_clone_projects')
    .insert({
      user_id: request.userId,
      reference_video_id: request.referenceVideoId && !isSystemReferenceVideoId(request.referenceVideoId)
        ? request.referenceVideoId
        : null,
      video_model: model,
      video_aspect_ratio: request.videoAspectRatio || '9:16',
      status: 'processing',
      current_step: 'generating_video',
      progress_percentage: 70,
      credits_cost: generationCost,
      generation_credits_used: 0,
      language: request.language || referenceVideoContext?.language || 'en',
      video_duration: String(durationSeconds),
      video_quality: quality,
      download_credits_used: 0,
      is_segmented: true,
      segment_count: 1,
      segment_duration_seconds: durationSeconds,
      segment_status: { total: 1, framesReady: 1, videosReady: 0, segments: [] },
      selected_inputs: selectedInputs,
      video_prompts: {
        mode: 'clone_direct_reference',
        direct_reference_prompt_version: DIRECT_REFERENCE_PROMPT_VERSION,
        prompt,
        referenceVideoName: referenceVideoContext?.reference_name || null,
        clone_reference_assets: {
          selectedAvatarId: cloneReferenceAssets.selectedAvatarId || request.selectedAvatarId || null,
          selectedProductId: cloneReferenceAssets.selectedProductId || request.selectedProductId || null,
          selectedAvatarIds: cloneReferenceAssets.selectedAvatarIds || [],
          selectedProductIds: cloneReferenceAssets.selectedProductIds || [],
          selectedPetId: cloneReferenceAssets.selectedPetId || request.selectedPetId || null,
          selectedPetIds: cloneReferenceAssets.selectedPetIds || [],
          avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
          productImageUrls: cloneReferenceAssets.productImageUrls,
          petPhotoUrls: cloneReferenceAssets.petPhotoUrls,
          directReferenceImageUrls: referenceImageUrls,
        },
      },
      segment_plan: { segments: [{ prompt, duration: durationSeconds, mode: 'clone_direct_reference' }] },
      video_generation_requested: true,
    })
    .select()
    .single();

  if (projectError || !project) {
    return {
      success: false,
      error: 'Failed to create project record',
      details: projectError?.message || 'Unknown insert error',
    };
  }

  const deduction = await deductCredits(request.userId, generationCost);
  if (!deduction.success) {
    await supabase
      .from('video_clone_projects')
      .update({
        status: 'failed',
        current_step: 'failed',
        error_message: deduction.error || 'Credit deduction failed',
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);
    return { success: false, error: 'Failed to deduct credits', details: deduction.error || 'Credit deduction failed' };
  }

  await recordCreditTransaction(
    request.userId,
    'usage',
    generationCost,
    `Video Clone - Direct reference generation (${model.toUpperCase()})`,
    project.id,
    true
  );

  const { data: segment, error: segmentError } = await supabase
    .from('video_clone_segments')
    .insert({
      project_id: project.id,
      segment_index: 0,
      status: 'generating_video',
      prompt: { mode: 'clone_direct_reference', prompt },
      first_frame_url: null,
      video_task_id: null,
      video_url: null,
      error_message: null,
      video_generation_approved: true,
    })
    .select()
    .single();

  if (segmentError || !segment) {
    await deductCredits(request.userId, -generationCost);
    await recordCreditTransaction(request.userId, 'refund', generationCost, 'Video Clone - Direct reference generation refund', project.id, true);
    await supabase
      .from('video_clone_projects')
      .update({
        generation_credits_used: 0,
        status: 'failed',
        current_step: 'failed',
        error_message: 'Failed to create direct reference segment',
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);
    return { success: false, error: 'Failed to create direct reference segment', details: segmentError?.message || 'Unknown insert error' };
  }

  try {
    console.log('[Direct Reference Clone] Seedance edit-video request', {
      promptVersion: DIRECT_REFERENCE_PROMPT_VERSION,
      model,
      durationSeconds,
      referenceVideoUrl: referenceSourceVideoUrl,
      referenceImageCount: referenceImageUrls.length,
      referenceImageUrls,
    });
    const taskId = await startEditVideoTaskSeedance({
      projectId: project.id,
      userId: request.userId,
      model,
      prompt,
      referenceVideoUrl: referenceSourceVideoUrl,
      referenceImageUrls,
      aspectRatio: request.videoAspectRatio === '16:9' ? '16:9' : '9:16',
      resolution: mapCloneQualityToSeedanceResolution(quality),
      duration: durationSeconds,
    });

    await supabase
      .from('video_clone_segments')
      .update({
        video_task_id: taskId,
        status: 'generating_video',
        updated_at: new Date().toISOString(),
      })
      .eq('id', segment.id);

    await supabase
      .from('video_clone_projects')
      .update({
        generation_credits_used: generationCost,
        video_task_id: taskId,
        segment_status: {
          total: 1,
          framesReady: 1,
          videosReady: 0,
          segments: [{ index: 0, status: 'generating_video', videoTaskId: taskId }],
        },
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    return {
      success: true,
      projectId: project.id,
      remainingCredits: deduction.remainingCredits,
      creditsUsed: generationCost,
    };
  } catch (error) {
    await deductCredits(request.userId, -generationCost);
    await recordCreditTransaction(
      request.userId,
      'refund',
      generationCost,
      `Video Clone - Refund for failed ${model.toUpperCase()} direct reference generation`,
      project.id,
      true
    );
    await supabase
      .from('video_clone_projects')
      .update({
        generation_credits_used: 0,
        status: 'failed',
        current_step: 'failed',
        error_message: error instanceof Error ? error.message : 'Direct reference workflow failed',
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);
    await supabase
      .from('video_clone_segments')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Direct reference task failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', segment.id);

    return {
      success: false,
      error: 'Direct reference workflow failed',
      details: error instanceof Error ? error.message : 'Unknown task start error',
    };
  }
}

async function startEditVideoWorkflow(request: StartWorkflowRequest): Promise<WorkflowResult> {
  const supabase = getSupabaseAdmin();
  const prompt = request.editVideoPrompt?.trim();
  const sourceUrl = request.editVideoSourceUrl?.trim();
  const duration = Number(request.videoDuration);
  const model = request.videoModel;

  if (!prompt || !sourceUrl) {
    return {
      success: false,
      error: 'Invalid edit-video inputs',
      details: 'Edit-video mode requires prompt text and a source video URL.',
    };
  }

  if (model !== 'seedance_2' && model !== 'seedance_2_fast' && model !== 'seedance_2_mini') {
    return {
      success: false,
      error: 'Invalid edit-video model',
      details: 'Edit-video mode supports Seedance 2 models only.',
    };
  }

  const maxEditVideoDuration = 15;
  if (!Number.isFinite(duration) || duration < 2 || duration > maxEditVideoDuration) {
    return {
      success: false,
      error: 'Invalid edit-video duration',
      details: `Edit-video mode requires a source video duration between 2 and ${maxEditVideoDuration} seconds.`,
    };
  }

  const requestedQuality = request.videoQuality || getDefaultCloneVideoQuality(model);
  const quality = normalizeCloneVideoQualityForModel(model, requestedQuality);
  const generationCost = getGenerationCost(model, String(duration), quality, {
    hasVideoInput: true,
  });
  const creditCheck = await checkCredits(request.userId, generationCost);
  if (!creditCheck.success) {
    return { success: false, error: 'Failed to check credits', details: creditCheck.error || 'Credit check failed' };
  }
  if (!creditCheck.hasEnoughCredits) {
    return {
      success: false,
      error: 'Insufficient credits',
      details: `Need ${generationCost} credits for ${model.toUpperCase()} model, have ${creditCheck.currentCredits || 0}`,
    };
  }

  await assertKieCreditsAvailable();

  const deduction = await deductCredits(request.userId, generationCost);
  if (!deduction.success) {
    return { success: false, error: 'Failed to deduct credits', details: deduction.error || 'Credit deduction failed' };
  }

  await recordCreditTransaction(
    request.userId,
    'usage',
    generationCost,
    `Video Clone - Edit video generation (${model.toUpperCase()})`,
    undefined,
    true
  );

  // Schema verified via Supabase MCP (2026-05-17):
  // video_clone_projects includes selected_inputs, video_duration, segment_count,
  // segment_duration_seconds, segment_status, generation_credits_used.
  const selectedInputs: VideoCloneSelectedInputs = {
    workflowSource: 'project_agent_edit_video',
    mergePolicy: 'auto',
    executionMode: 'edit_video',
    editVideoPrompt: prompt,
    editVideoSourceUrl: sourceUrl,
    isCloneMode: false,
  };
  const { data: project, error: projectError } = await supabase
    .from('video_clone_projects')
    .insert({
      user_id: request.userId,
      reference_video_id: null,
      video_model: model,
      video_aspect_ratio: request.videoAspectRatio || '9:16',
      status: 'processing',
      current_step: 'generating_video',
      progress_percentage: 60,
      credits_cost: generationCost,
      generation_credits_used: generationCost,
      language: request.language || 'en',
      video_duration: String(duration),
      video_quality: quality,
      download_credits_used: 0,
      is_segmented: true,
      segment_count: 1,
      segment_duration_seconds: duration,
      segment_status: { total: 1, framesReady: 1, videosReady: 0, segments: [] },
      selected_inputs: selectedInputs,
      video_prompts: { mode: 'edit_video', prompt },
      segment_plan: { segments: [{ prompt, duration }] },
    })
    .select()
    .single();

  if (projectError || !project) {
    await deductCredits(request.userId, -generationCost);
    return {
      success: false,
      error: 'Failed to create project record',
      details: projectError?.message || 'Unknown insert error',
    };
  }

  // Schema verified via Supabase MCP (2026-05-17):
  // video_clone_segments includes project_id, segment_index, status, prompt,
  // first_frame_url, video_task_id, video_url, error_message.
  const { data: segment, error: segmentError } = await supabase
    .from('video_clone_segments')
    .insert({
      project_id: project.id,
      segment_index: 0,
      status: 'generating_video',
      prompt: { mode: 'edit_video', prompt },
      first_frame_url: null,
      video_task_id: null,
      video_url: null,
      error_message: null,
    })
    .select()
    .single();

  if (segmentError || !segment) {
    await deductCredits(request.userId, -generationCost);
    await supabase.from('video_clone_projects').update({ status: 'failed', error_message: 'Failed to create edit-video segment' }).eq('id', project.id);
    return {
      success: false,
      error: 'Failed to create edit-video segment',
      details: segmentError?.message || 'Unknown insert error',
    };
  }

  try {
    const taskId = await startEditVideoTaskSeedance({
      projectId: project.id,
      userId: request.userId,
      model,
      prompt,
      referenceVideoUrl: sourceUrl,
      aspectRatio: request.videoAspectRatio === '16:9' ? '16:9' : '9:16',
      resolution: mapCloneQualityToSeedanceResolution(quality),
      duration,
    });

    await supabase
      .from('video_clone_segments')
      .update({ video_task_id: taskId, status: 'generating_video' })
      .eq('id', segment.id);

    return {
      success: true,
      projectId: project.id,
      remainingCredits: deduction.remainingCredits,
      creditsUsed: generationCost,
    };
  } catch (error) {
    await deductCredits(request.userId, -generationCost);
    await recordCreditTransaction(
      request.userId,
      'refund',
      generationCost,
      `Video Clone - Refund for failed ${model.toUpperCase()} edit video generation`,
      project.id,
      true
    );
    await supabase
      .from('video_clone_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Edit-video workflow failed',
        last_processed_at: new Date().toISOString(),
      })
      .eq('id', project.id);
    throw error;
  }
}

/**
 * Start video generation task using Seedance 2 / Seedance 2 Fast API.
 * Uses generic jobs/createTask endpoint (same as frame generation).
 */
async function startSegmentVideoTaskSeedance(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string | null,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number,
  model: SeedanceVideoModel
): Promise<string> {
  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY environment variable is not configured');
  }

  const isStoryboardReferenceMode = isSeedanceStoryboardReferenceProject(project);
  const referenceImageUrls = model === 'seedance_2_fast' || model === 'seedance_2_mini' || isStoryboardReferenceMode
    ? getProjectAgentSeedanceReferenceImageUrls(project)
    : [];
  const useReferenceImageMode = referenceImageUrls.length > 0;
  if (!firstFrameUrl && !useReferenceImageMode) {
    throw new Error('Seedance video generation requires a first frame or reference images.');
  }

  // Prepare input_urls for legacy first/last-frame mode. This is mutually exclusive
  // with Seedance 2 Fast multimodal reference-image mode.
  const hasClosingFrame = !useReferenceImageMode && !!closingFrameUrl && closingFrameUrl !== firstFrameUrl;
  const inputUrls = useReferenceImageMode
    ? []
    : hasClosingFrame
      ? [firstFrameUrl as string, closingFrameUrl as string]
      : [firstFrameUrl as string];
  const segmentDuration = resolveTaskDurationSeconds(
    project,
    model,
    segmentIndex,
    totalSegments
  );

  console.log(`🎬 Seedance Segment ${segmentIndex + 1}/${totalSegments}: Images count = ${useReferenceImageMode ? referenceImageUrls.length : inputUrls.length} ${isStoryboardReferenceMode ? '(storyboard/reference images)' : useReferenceImageMode ? '(reference images)' : hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const resolution = normalizeCloneVideoQualityForModel(model, project.video_quality) as '480p' | '720p' | '1080p';

  // Build prompt text from segment fields
  const promptParts: string[] = [];

  // Start with first frame description (opening scene)
  if (segmentPrompt.first_frame_description) {
    promptParts.push(segmentPrompt.first_frame_description);
  }

  // Check if we have multiple shots - if yes, build timeline-based prompt
  if (segmentPrompt.shots && segmentPrompt.shots.length > 0) {
    console.log(`📝 Building multi-shot prompt for ${segmentPrompt.shots.length} shots`);

    // Add each shot with its timeline
    segmentPrompt.shots.forEach((shot, idx) => {
      const shotParts: string[] = [];

      // Timeline marker
      if (shot.time_range) {
        shotParts.push(`Shot ${idx + 1} (${shot.time_range}):`);
      } else {
        shotParts.push(`Shot ${idx + 1}:`);
      }

      // Core shot elements (action + subject are most important)
      if (shot.action) shotParts.push(shot.action);
      if (shot.subject) shotParts.push(`Subject: ${shot.subject}`);
      if (shot.dialogue) shotParts.push(`Dialogue: "${shot.dialogue}"`);
      if (shot.style) shotParts.push(`Style: ${shot.style}`);
      if (shot.composition) shotParts.push(`Composition: ${shot.composition}`);
      if (shot.audio) shotParts.push(`Audio: ${shot.audio}`);

      promptParts.push(shotParts.join('. '));
    });

    // Add shared environmental context (applies to entire segment)
    const environmentParts: string[] = [];
    if (segmentPrompt.context_environment) {
      environmentParts.push(`Environment: ${segmentPrompt.context_environment}`);
    }
    if (segmentPrompt.ambiance_colour_lighting) {
      environmentParts.push(`Lighting: ${segmentPrompt.ambiance_colour_lighting}`);
    }
    if (segmentPrompt.camera_motion_positioning) {
      environmentParts.push(`Camera: ${segmentPrompt.camera_motion_positioning}`);
    }
    if (environmentParts.length > 0) {
      promptParts.push(environmentParts.join('. '));
    }
  } else {
    // Fallback: Use top-level fields (backwards compatibility or single-shot segments)
    console.log('📝 Building single-shot prompt from top-level fields');

    if (segmentPrompt.action) {
      promptParts.push(`Action: ${segmentPrompt.action}`);
    }
    if (segmentPrompt.subject) {
      promptParts.push(`Subject: ${segmentPrompt.subject}`);
    }
    if (segmentPrompt.dialogue) {
      promptParts.push(`Dialogue: ${segmentPrompt.dialogue}`);
    }
    if (segmentPrompt.style) {
      promptParts.push(`Style: ${segmentPrompt.style}`);
    }
    if (segmentPrompt.context_environment) {
      promptParts.push(`Environment: ${segmentPrompt.context_environment}`);
    }
    if (segmentPrompt.ambiance_colour_lighting) {
      promptParts.push(`Lighting: ${segmentPrompt.ambiance_colour_lighting}`);
    }
    if (segmentPrompt.camera_motion_positioning) {
      promptParts.push(`Camera: ${segmentPrompt.camera_motion_positioning}`);
    }
  }

  const storyboardRowIndex = isStoryboardReferenceMode
    ? (typeof segmentPrompt.firstChunkIndex === 'number' ? segmentPrompt.firstChunkIndex + 1 : segmentIndex + 1)
    : segmentIndex + 1;
  const storyboardInstruction = isStoryboardReferenceMode
    ? `Use @Image1 as the storyboard sheet. Follow storyboard row ${storyboardRowIndex} exactly for scene order, row duration, composition, camera movement, handheld rhythm, push-in/pan/tilt speed, subject distance, action timing, cut timing, motion pacing, and audio intent. Use the remaining reference images only as replacement identity assets. For any person, match the connected avatar reference photo's full visible appearance and wardrobe exactly, not only the face: hair, skin tone, eyewear, accessories, body proportions, clothing color, fabric, cut, fit, sleeves, neckline, visible bottoms, and footwear if visible. Never copy the original source person's clothing or styling unless it appears in the connected avatar reference. Do not render the storyboard table itself. `
    : '';
  const promptText = `${storyboardInstruction}${promptParts.join('. ')}`.substring(0, 2500); // Max 2500 chars per Seedance API

  await moderatePromptBeforeGeneration(promptText, {
    externalId: `user_${project.user_id}:video_clone_${project.id}:segment_${segmentIndex}:video`,
  });

  const requestBody = buildSeedanceVideoRequestBody({
    projectId: project.id,
    segmentIndex,
    model,
    prompt: promptText,
    inputUrls: isStoryboardReferenceMode ? [] : inputUrls,
    referenceImageUrls: useReferenceImageMode ? referenceImageUrls : [],
    firstFrameUrl: isStoryboardReferenceMode ? null : firstFrameUrl,
    lastFrameUrl: isStoryboardReferenceMode ? null : closingFrameUrl || null,
    useFirstLastFrameFields: false,
    aspectRatio,
    resolution,
    duration: segmentDuration
  });

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Seedance 2 API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Seedance 2 API failed: ${result.msg || 'Unknown error'}`);
  }

  console.log(`✅ Seedance 2 task created: ${result.data.taskId} for segment ${segmentIndex + 1}`);
  return result.data.taskId;
}

export const __test__ = {
  cleanSegmentText,
  cleanReferenceTextForStoryboard,
  buildProjectAgentFramePrompt,
  shouldWaitForContinuationFrame,
  buildStructuredVideoPromptPayload,
  buildSeedanceVideoRequestBody,
  buildSeedanceEditVideoRequestBody,
  getPromptSegmentDurationSeconds,
  getTimeRangeDurationSeconds,
  isProjectAgentSeedanceReferenceImageMode,
  isProjectAgentSeedanceReferenceImageProject,
  isSeedanceStoryboardReferenceProject,
  getProjectAgentSeedanceReferenceImageUrls,
  buildReplacementSummary,
  buildStoryboardSheetPrompt
};
