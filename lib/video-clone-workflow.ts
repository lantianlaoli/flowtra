import { getSupabaseAdmin, type VideoCloneSegment, type SingleVideoProject } from '@/lib/supabase';
import type { VideoCloneSelectedInputs } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';
import {
  GENERATION_COSTS,
  NON_AGENT_IMAGE_MODEL,
  NON_AGENT_IMAGE_OUTPUT_FORMAT,
  NON_AGENT_IMAGE_RESOLUTION,
  getGenerationCost,
  getDefaultCloneVideoQuality,
  getSegmentCountFromDuration,
  getSegmentDurationForModel,
  getReplicaPhotoCredits,
  DEFAULT_SEGMENT_DURATION_SECONDS,
  KLING_MAX_TASK_DURATION_SECONDS,
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  mapCloneQualityToKlingMode,
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
  parseReferenceVideoTimeline,
  sumShotDurations,
  parseTimecode,
  formatTimecode,
  type ReferenceVideoShot
} from '@/lib/reference-video-shots';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getAvatarPhotoUrls, SYSTEM_AVATARS } from '@/lib/default-avatars';
import { compilePromptForExecution } from '@/lib/video-clone-prompt-compiler';
import {
  KLING_PROMPT_MAX_CHARS,
  KLING_PROMPT_SOFT_TARGET,
  buildKlingPromptSections,
  fitKlingPromptWithinLimit
} from '@/lib/kling-prompt-budget';
import { KLING_MAX_MULTI_SHOT_ITEMS } from '@/lib/kling-shot-limits';
import {
  MENTION_TOKEN_REGEX as SHARED_MENTION_TOKEN_REGEX,
  normalizeMentionLabel,
  parseMentionToken
} from '@/lib/prompt-mention-tokens';
import { normalizeAnalysisToV2 } from '@/lib/video-analysis-schema';

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
  selectedAvatarIds?: string[];
  selectedProductIds?: string[];
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
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
  resolvedVideoModel?: VideoModel;
  requestSource?: 'project_agent_clone' | 'default';
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
};

type CloneReferenceAssets = {
  selectedAvatarId?: string | null;
  selectedProductId?: string | null;
  selectedAvatarIds?: string[];
  selectedProductIds?: string[];
  avatarPhotoUrls: string[];
  productImageUrls: string[];
  avatarName?: string | null;
  productName?: string | null;
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

export type CloneReferenceSourceType = 'reference_video' | 'creator_source_video';

export type CloneModeResolution = {
  isCloneMode: boolean;
  sourceType: CloneReferenceSourceType | null;
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

const normalizeReferenceSourceType = (value: unknown): CloneReferenceSourceType | null => {
  if (value === 'reference_video' || value === 'creator_source_video') {
    return value;
  }
  return null;
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

  const sourceType = normalizeReferenceSourceType(selectedInputs?.referenceSourceType);
  const mediaType = normalizeReferenceMediaType(selectedInputs?.referenceSourceMediaType);
  const sourceId = normalizeReferenceSourceId(selectedInputs?.referenceSourceId);
  const isCloneFlag = selectedInputs?.isCloneMode === true;

  if (isCloneFlag || mediaType === 'video') {
    return {
      isCloneMode: true,
      sourceType,
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
      sourceType: sourceType || 'reference_video',
      mediaType: 'video',
      sourceId: sourceId || legacyReferenceVideoId
    };
  }

  return {
    isCloneMode: false,
    sourceType,
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

async function resolveCloneReferenceAssets(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  request: StartWorkflowRequest
): Promise<CloneReferenceAssets> {
  const selectedAvatarIds = normalizeSelectedIds(request.selectedAvatarId, request.selectedAvatarIds, 8);
  const selectedProductIds = normalizeSelectedIds(request.selectedProductId, request.selectedProductIds, 8);
  const primaryAvatarId = selectedAvatarIds[0] || null;
  const primaryProductId = selectedProductIds[0] || null;

  const assets: CloneReferenceAssets = {
    selectedAvatarId: primaryAvatarId,
    selectedProductId: primaryProductId,
    selectedAvatarIds,
    selectedProductIds,
    avatarPhotoUrls: [],
    productImageUrls: []
  };

  if (selectedProductIds.length > 0) {
    const { data: selectedProducts, error: productError } = await supabase
      .from('user_products')
      .select('id,product_name,user_product_photos(photo_url,is_primary)')
      .in('id', selectedProductIds)
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
      const productMap = new Map(productRows.map((product) => [product.id, product]));
      const orderedProducts = selectedProductIds
        .map((id) => productMap.get(id))
        .filter((product): product is NonNullable<typeof product> => Boolean(product));

      if (orderedProducts.length === 0) {
        console.warn('[Clone Assets] Selected product ids not found for user:', selectedProductIds);
      } else {
        const mergedProductPhotoUrls: Array<string | null> = [];
        for (const product of orderedProducts) {
          const photos = Array.isArray(product.user_product_photos)
            ? product.user_product_photos
            : [];
          const orderedPhotos = [
            ...photos.filter(photo => photo.is_primary),
            ...photos.filter(photo => !photo.is_primary)
          ];
          for (const photo of orderedPhotos) {
            mergedProductPhotoUrls.push(photo.photo_url || null);
          }
        }

        assets.productImageUrls = collectDistinctUrls(mergedProductPhotoUrls, 8);
        assets.productName = orderedProducts[0]?.product_name || null;
      }
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
  // Each segment is independent with 0-8s timing (segment-relative, not source-video absolute timing)
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
    : DEFAULT_SEGMENT_DURATION_SECONDS;

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
  if (model === 'kling_3') return true;
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
  if (model === 'kling_3') {
    return Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(KLING_MAX_TASK_DURATION_SECONDS, equalized));
  }

  return Math.max(1, equalized);
}

function normalizeRequestedDuration(
  model: VideoModel,
  rawDuration?: string | null
): VideoDuration | undefined {
  if (!rawDuration) return undefined;
  const seconds = Number(rawDuration);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (model === 'kling_3') {
    return snapDurationToModel(model, Math.min(seconds, KLING_MAX_PROJECT_DURATION_SECONDS));
  }
  return snapDurationToModel(model, Math.min(seconds, 64));
}

type PlannedKlingShotPart = {
  shot: ReferenceVideoShot;
  durationSeconds: number;
};

type PlannedKlingSegment = {
  durationSeconds: number;
  shotParts: PlannedKlingShotPart[];
};

function splitDurationForKlingSegments(totalSeconds: number): number[] {
  const safeTotal = Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.round(totalSeconds));
  const chunks: number[] = [];
  let remaining = safeTotal;

  while (remaining > KLING_MAX_TASK_DURATION_SECONDS) {
    chunks.push(KLING_MAX_TASK_DURATION_SECONDS);
    remaining -= KLING_MAX_TASK_DURATION_SECONDS;
  }

  if (remaining > 0) {
    chunks.push(remaining);
  }

  if (chunks.length >= 2) {
    const lastIndex = chunks.length - 1;
    while (chunks[lastIndex] < KLING_MIN_TASK_DURATION_SECONDS) {
      const donorIndex = chunks.findIndex((value, index) => index < lastIndex && value > KLING_MIN_TASK_DURATION_SECONDS);
      if (donorIndex === -1) {
        break;
      }
      chunks[donorIndex] -= 1;
      chunks[lastIndex] += 1;
    }
  }

  return chunks.filter(chunk => chunk > 0);
}

function normalizeKlingTimelineShots(shots: ReferenceVideoShot[], targetTotalSeconds: number): PlannedKlingShotPart[] {
  if (!shots.length) return [];

  const sourceDurations = shots.map(shot => Math.max(1, Math.round(shot.durationSeconds || 1)));
  const sourceTotal = sourceDurations.reduce((sum, value) => sum + value, 0);

  if (sourceTotal <= 0) {
    return shots.map(shot => ({ shot, durationSeconds: 1 }));
  }

  const scaled = sourceDurations.map(value => Math.max(1, Math.floor((value / sourceTotal) * targetTotalSeconds)));
  let allocated = scaled.reduce((sum, value) => sum + value, 0);
  let cursor = 0;

  while (allocated < targetTotalSeconds) {
    scaled[cursor % scaled.length] += 1;
    allocated += 1;
    cursor += 1;
  }

  while (allocated > targetTotalSeconds) {
    const index = scaled.findIndex(value => value > 1);
    if (index === -1) break;
    scaled[index] -= 1;
    allocated -= 1;
  }

  return shots.map((shot, index) => ({
    shot,
    durationSeconds: scaled[index]
  }));
}

function planKlingSegmentsFromShots(
  shots: ReferenceVideoShot[],
  totalDurationSeconds: number
): PlannedKlingSegment[] {
  const boundedTotal = Math.max(
    KLING_MIN_TASK_DURATION_SECONDS,
    Math.min(KLING_MAX_PROJECT_DURATION_SECONDS, Math.round(totalDurationSeconds))
  );

  if (!shots.length) {
    return splitDurationForKlingSegments(boundedTotal).map(durationSeconds => ({
      durationSeconds,
      shotParts: []
    }));
  }

  const normalizedParts = normalizeKlingTimelineShots(shots, boundedTotal);
  const plannedSegments: PlannedKlingSegment[] = [];
  let currentParts: PlannedKlingShotPart[] = [];
  let currentDuration = 0;

  const flushCurrent = () => {
    if (!currentParts.length) return;
    plannedSegments.push({
      durationSeconds: currentDuration,
      shotParts: [...currentParts]
    });
    currentParts = [];
    currentDuration = 0;
  };

  normalizedParts.forEach(part => {
    const splitDurations = part.durationSeconds > KLING_MAX_TASK_DURATION_SECONDS
      ? splitDurationForKlingSegments(part.durationSeconds)
      : [part.durationSeconds];

    splitDurations.forEach(duration => {
      const forcedSingle = splitDurations.length > 1;
      if (forcedSingle) {
        flushCurrent();
        plannedSegments.push({
          durationSeconds: duration,
          shotParts: [{ shot: part.shot, durationSeconds: duration }]
        });
        return;
      }

      if (currentDuration + duration <= KLING_MAX_TASK_DURATION_SECONDS) {
        currentParts.push({ shot: part.shot, durationSeconds: duration });
        currentDuration += duration;
      } else {
        flushCurrent();
        currentParts.push({ shot: part.shot, durationSeconds: duration });
        currentDuration = duration;
      }
    });
  });

  flushCurrent();

  if (!plannedSegments.length) {
    return [{
      durationSeconds: boundedTotal,
      shotParts: []
    }];
  }

  if (plannedSegments.length > 1) {
    const lastIndex = plannedSegments.length - 1;
    while (plannedSegments[lastIndex].durationSeconds < KLING_MIN_TASK_DURATION_SECONDS) {
      const donorIndex = plannedSegments.findIndex((segment, index) =>
        index < lastIndex && segment.durationSeconds > KLING_MIN_TASK_DURATION_SECONDS
      );
      if (donorIndex === -1) break;
      plannedSegments[donorIndex].durationSeconds -= 1;
      plannedSegments[lastIndex].durationSeconds += 1;
      if (plannedSegments[donorIndex].shotParts.length > 0) {
        plannedSegments[donorIndex].shotParts[plannedSegments[donorIndex].shotParts.length - 1].durationSeconds =
          Math.max(1, plannedSegments[donorIndex].shotParts[plannedSegments[donorIndex].shotParts.length - 1].durationSeconds - 1);
      }
      if (plannedSegments[lastIndex].shotParts.length > 0) {
        plannedSegments[lastIndex].shotParts[0].durationSeconds += 1;
      }
    }
  }

  return plannedSegments;
}

function buildSegmentPlanFromKlingSegments(
  plannedSegments: PlannedKlingSegment[],
  defaultLanguage: string
): SegmentPrompt[] {
  return plannedSegments.map((segment, segmentIndex) => {
    let offset = 0;
    const shotParts = segment.shotParts.length > 0
      ? segment.shotParts
      : [
          {
            shot: {
              id: 1,
              startTime: '00:00',
              endTime: formatTimecode(segment.durationSeconds),
              durationSeconds: segment.durationSeconds,
              firstFrameDescription: '',
              subject: '',
              contextEnvironment: '',
              action: '',
              style: '',
              cameraMotionPositioning: '',
              composition: '',
              ambianceColourLighting: '',
              audio: '',
              startTimeSeconds: 0,
              endTimeSeconds: segment.durationSeconds
            },
            durationSeconds: segment.durationSeconds
          }
        ];

    const shots: SegmentShot[] = shotParts.map((part, shotIndex) => {
      const start = offset;
      const end = Math.min(segment.durationSeconds, start + part.durationSeconds);
      offset = end;

      return {
        id: shotIndex + 1,
        time_range: `${formatTimecode(start)} - ${formatTimecode(end)}`,
        start_seconds: start,
        end_seconds: end,
        duration_seconds: Math.max(1, end - start),
        audio: part.shot.audio || '',
        sfx: part.shot.sfx || '',
        ambient: part.shot.ambient || '',
        style: part.shot.style || '',
        action: part.shot.action || '',
        subject: part.shot.subject || '',
        dialogue: part.shot.dialogue || '',
        language: defaultLanguage,
        composition: part.shot.composition || '',
        context_environment: part.shot.contextEnvironment || '',
        ambiance_colour_lighting: part.shot.ambianceColourLighting || '',
        camera_motion_positioning: part.shot.cameraMotionPositioning || ''
      };
    });

    const primaryShot = shotParts[0]?.shot;
    return {
      audio: primaryShot?.audio || '',
      style: primaryShot?.style || '',
      action: primaryShot?.action || '',
      subject: primaryShot?.subject || '',
      composition: primaryShot?.composition || '',
      context_environment: primaryShot?.contextEnvironment || '',
      first_frame_description: primaryShot?.firstFrameDescription || '',
      ambiance_colour_lighting: primaryShot?.ambianceColourLighting || '',
      camera_motion_positioning: primaryShot?.cameraMotionPositioning || '',
      dialogue: primaryShot?.dialogue || '',
      language: defaultLanguage,
      index: segmentIndex + 1,
      first_frame_image_size: undefined,
      is_continuation_from_prev: segmentIndex > 0,
      shots
    };
  });
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

  if (videoModel === 'kling_3') {
    const klingTargetDuration = Number(videoDuration || referenceTotalDurationSeconds || 8);
    const plannedKlingSegments = planKlingSegmentsFromShots(referenceVideoShots, klingTargetDuration);
    return buildSegmentPlanFromKlingSegments(
      plannedKlingSegments,
      language || 'en'
    );
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

function alignKlingPromptsToPlan(
  prompts: Record<string, unknown>,
  plannedSegments: PlannedKlingSegment[],
  defaultLanguage: string
): SegmentPrompt[] {
  const plannedBase = buildSegmentPlanFromKlingSegments(plannedSegments, defaultLanguage);
  const aiBase = normalizeSegmentPrompts(
    prompts,
    plannedSegments.length,
    undefined,
    DEFAULT_SEGMENT_DURATION_SECONDS
  );

  return plannedBase.map((plannedSegment, segmentIndex) => {
    const aiSegment = aiBase[segmentIndex] || aiBase[aiBase.length - 1];
    const plannedShots = Array.isArray(plannedSegment.shots) && plannedSegment.shots.length > 0
      ? plannedSegment.shots
      : [buildFallbackShot(1, defaultLanguage, plannedSegment, plannedSegments[segmentIndex]?.durationSeconds || DEFAULT_SEGMENT_DURATION_SECONDS)];
    const targetDuration = plannedSegments[segmentIndex]?.durationSeconds || plannedShots[0]?.duration_seconds || DEFAULT_SEGMENT_DURATION_SECONDS;
    const targetShotCount = Math.max(1, plannedShots.length);
    const aiShots = Array.isArray(aiSegment?.shots) ? aiSegment.shots : [];
    const perShotDuration = targetDuration / targetShotCount;

    const shots: SegmentShot[] = Array.from({ length: targetShotCount }, (_, shotIndex) => {
      const plannerShot = plannedShots[shotIndex] || plannedShots[plannedShots.length - 1];
      const aiShot = aiShots[shotIndex] || aiShots[aiShots.length - 1];
      const fallbackStart = Math.round(shotIndex * perShotDuration);
      const { display, start, end, duration } = normalizeShotTimeRange(
        undefined,
        fallbackStart,
        perShotDuration
      );

      return {
        id: shotIndex + 1,
        time_range: display,
        start_seconds: start,
        end_seconds: end,
        duration_seconds: duration,
        audio: cleanSegmentText(aiShot?.audio) || plannerShot?.audio || '',
        style: cleanSegmentText(aiShot?.style) || plannerShot?.style || '',
        action: cleanSegmentText(aiShot?.action) || plannerShot?.action || '',
        subject: cleanSegmentText(aiShot?.subject) || plannerShot?.subject || '',
        dialogue: cleanSegmentText(aiShot?.dialogue) || '',
        language: cleanSegmentText(aiShot?.language) || cleanSegmentText(aiSegment?.language) || defaultLanguage,
        composition: cleanSegmentText(aiShot?.composition) || plannerShot?.composition || '',
        context_environment: cleanSegmentText(aiShot?.context_environment) || plannerShot?.context_environment || '',
        ambiance_colour_lighting: cleanSegmentText(aiShot?.ambiance_colour_lighting) || plannerShot?.ambiance_colour_lighting || '',
        camera_motion_positioning: cleanSegmentText(aiShot?.camera_motion_positioning) || plannerShot?.camera_motion_positioning || ''
      };
    });

    const firstShot = shots[0];
    return {
      ...plannedSegment,
      first_frame_description:
        cleanSegmentText(aiSegment?.first_frame_description) ||
        cleanSegmentText(plannedSegment.first_frame_description) ||
        '',
      is_continuation_from_prev: segmentIndex > 0,
      audio: cleanSegmentText(aiSegment?.audio) || firstShot.audio || '',
      style: cleanSegmentText(aiSegment?.style) || firstShot.style || '',
      action: cleanSegmentText(aiSegment?.action) || firstShot.action || '',
      subject: cleanSegmentText(aiSegment?.subject) || firstShot.subject || '',
      composition: cleanSegmentText(aiSegment?.composition) || firstShot.composition || '',
      context_environment: cleanSegmentText(aiSegment?.context_environment) || firstShot.context_environment || '',
      ambiance_colour_lighting: cleanSegmentText(aiSegment?.ambiance_colour_lighting) || firstShot.ambiance_colour_lighting || '',
      camera_motion_positioning: cleanSegmentText(aiSegment?.camera_motion_positioning) || firstShot.camera_motion_positioning || '',
      dialogue: cleanSegmentText(aiSegment?.dialogue) || '',
      language: cleanSegmentText(aiSegment?.language) || firstShot.language || defaultLanguage,
      shots
    };
  });
}


export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

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
        console.log(`✅ Reference video loaded: ${referenceVideoContext.reference_name}`);
        console.log(`📊 Analysis status: ${referenceVideoContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!referenceVideoContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${referenceVideoContext.language || 'none'}`);
      } catch (referenceVideoError) {
        console.warn(`⚠️ Reference video not found or access denied: ${request.referenceVideoId}`, referenceVideoError);
        // Don't fail the workflow if reference video is not found, just proceed without it
      }
    }

    if (!referenceVideoContext && request.creatorSourceVideoId) {
      console.log(`🎯 Loading reference video analysis: ${request.creatorSourceVideoId}`);
      const fetchReferenceVideo = async () => {
        // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_result, analysis_language, duration_seconds
        const { data: referenceVideo, error: referenceError } = await supabase
          .from('creator_source_videos')
          .select('description, analysis_result, analysis_status, analysis_language, duration_seconds')
          .eq('id', request.creatorSourceVideoId)
          .eq('user_id', request.userId)
          .single();
        if (referenceError) throw referenceError;
        return referenceVideo;
      };

      try {
        const referenceVideo = await retryAsync(fetchReferenceVideo, { maxAttempts: 3, baseDelayMs: 500, label: 'Reference video fetch' });
        referenceVideoContext = {
          id: request.creatorSourceVideoId,
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
    if (
      actualVideoModel === 'kling_3' &&
      Number.isFinite(referenceDurationSeconds) &&
      referenceDurationSeconds > KLING_MAX_PROJECT_DURATION_SECONDS
    ) {
      return {
        success: false,
        error: 'Kling duration limit exceeded',
        details: 'Kling 3.0 clone supports reference videos up to 60 seconds.'
      };
    }

    request.videoDuration = normalizeRequestedDuration(
      actualVideoModel,
      request.videoDuration
    );
    let referenceVideoShotTimeline: { shots: ReferenceVideoShot[]; totalDurationSeconds: number } | null = null;
    let plannedKlingSegments: PlannedKlingSegment[] | null = null;

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

    const segmentedByDuration = actualVideoModel === 'kling_3'
      ? true
      : isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
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

    if (actualVideoModel === 'kling_3') {
      const klingTargetDuration = Number(request.videoDuration || referenceVideoShotTimeline?.totalDurationSeconds || 8);
      plannedKlingSegments = planKlingSegmentsFromShots(
        referenceVideoShotTimeline?.shots || [],
        klingTargetDuration
      );
      segmentCount = plannedKlingSegments.length;
      console.log(`✅ Kling 3.0 shot-aware segmentation planned: ${segmentCount} segments`);
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
    if (segmentCount > 0 && actualVideoModel === 'kling_3') {
      precomputedSegmentPlan = buildManualCloneSeedPrompts({
        videoModel: actualVideoModel,
        segmentCount,
        videoDuration: request.videoDuration,
        language: request.language || referenceVideoContext?.language || 'en',
        referenceVideoShots: referenceVideoShotTimeline?.shots || [],
        referenceTotalDurationSeconds: referenceVideoShotTimeline?.totalDurationSeconds
      });
      console.log(`📐 Prepared Kling segment plan (${precomputedSegmentPlan.length} segments)`);
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
    const requestedQuality = request.requestSource === 'project_agent_clone'
      ? 'standard'
      : (request.videoQuality || getDefaultCloneVideoQuality(actualVideoModel));
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
        `Video Clone - Replica photo generation (Nano Banana 2, ${replicaResolution})`,
        undefined,
        true
      );
      creditsDeductedAtCreate = true;
    } else if (!request.photoOnly) {
      // Calculate generation cost based on model
      generationCost = getGenerationCost(
        actualVideoModel,
        duration,
        quality
      );

      console.log(`💳 [CREDITS DEBUG] Generation cost calculated:`, {
        model: actualVideoModel,
        duration,
        units: actualVideoModel === 'kling_3'
          ? `${Math.ceil(Number(duration || '0') || 0)}s`
          : `${Math.ceil(Number(duration || '0') / 8)} segments`,
        unitCost: GENERATION_COSTS[actualVideoModel],
        totalCost: generationCost
      });

      // Clone projects now seed prompts for manual editing first.
      // Defer billing until the user explicitly starts video generation.
      if (
        generationCost > 0 &&
        !isReferenceCloneCreate &&
        request.requestSource !== 'project_agent_clone'
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

    const projectInsertBase = {
      user_id: request.userId,
      reference_video_id: request.referenceVideoId || null, // Reference video
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
      generation_credits_used: isReferenceCloneCreate ? 0 : generationCost,
      language: request.language || 'en', // Language for AI-generated content
      // Generic video fields
      video_duration: duration || '8',
      video_quality: quality,
      // DEPRECATED: download_credits_used (downloads are now free)
      download_credits_used: 0,
      is_segmented: hasSegmentFlow, // FIX: Use segmentCount instead of isSegmented to avoid data inconsistency
      segment_count: segmentCount,
      segment_duration_seconds: hasSegmentFlow ? resolvedSegmentDuration : null,
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
          referenceSourceType: 'reference_video' as const,
          referenceSourceMediaType: 'video' as const,
          referenceSourceId: request.referenceVideoId,
          isCloneMode: true
        }
      : request.creatorSourceVideoId
        ? {
            referenceSourceType: 'creator_source_video' as const,
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
      avatarIds: cloneReferenceAssets.selectedAvatarIds || [],
      productIds: cloneReferenceAssets.selectedProductIds || [],
      workflowSource: request.requestSource || 'default',
      mergePolicy: request.requestSource === 'project_agent_clone' ? 'manual_confirm' : 'auto',
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
              avatarPhotoUrls: cloneReferenceAssets.avatarPhotoUrls,
              productImageUrls: cloneReferenceAssets.productImageUrls
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

    const referenceDurationSeconds = Number(referenceVideoContext?.video_duration_seconds || 0);
    if (
      request.resolvedVideoModel === 'kling_3' &&
      Number.isFinite(referenceDurationSeconds) &&
      referenceDurationSeconds > KLING_MAX_PROJECT_DURATION_SECONDS
    ) {
      throw new Error('Kling 3.0 clone supports reference videos up to 60 seconds.');
    }

    let referenceVideoTimelineShots: ReferenceVideoShot[] | undefined;
    let plannedKlingSegments: PlannedKlingSegment[] | null = null;
    if (referenceVideoDescription) {
      const parsedTimeline = parseReferenceVideoTimeline(
        referenceVideoDescription as Record<string, unknown>,
        referenceVideoContext?.video_duration_seconds
      );
      referenceVideoTimelineShots = parsedTimeline.shots;
      if (request.resolvedVideoModel === 'kling_3') {
        const klingTargetDuration = Number(request.videoDuration || parsedTimeline.videoDurationSeconds || 8);
        plannedKlingSegments = planKlingSegmentsFromShots(parsedTimeline.shots, klingTargetDuration);
      }

      if (
        parsedTimeline.videoDurationSeconds &&
        (request.resolvedVideoModel === 'seedance_2' ||
          request.resolvedVideoModel === 'seedance_2_fast' ||
          request.resolvedVideoModel === 'kling_3')
      ) {
        const snappedDuration = snapDurationToModel(request.resolvedVideoModel, parsedTimeline.videoDurationSeconds);
        if (snappedDuration && request.videoDuration !== snappedDuration) {
          console.log(`⏱️ Aligning video duration to reference-video timeline (${snappedDuration}s)`);
          request.videoDuration = snappedDuration;
        }
      }
    }

    if (request.resolvedVideoModel === 'kling_3' && !plannedKlingSegments) {
      plannedKlingSegments = planKlingSegmentsFromShots([], Number(request.videoDuration || 8));
    }

    const overrideSegmentCount = hasSegmentPromptOverrides ? request.segmentPrompts!.length : 0;
    const overrideTotalDurationSeconds = hasSegmentPromptOverrides
      ? request.segmentPrompts!.reduce((total, segment) => (
          total + getPromptSegmentDurationSeconds(segment)
        ), 0)
      : 0;
    if (
      hasSegmentPromptOverrides &&
      request.resolvedVideoModel === 'kling_3' &&
      overrideTotalDurationSeconds >= KLING_MIN_TASK_DURATION_SECONDS
    ) {
      request.videoDuration = String(overrideTotalDurationSeconds) as VideoDuration;
    }
    const totalDurationSeconds = parseInt(
      request.videoDuration || String(overrideTotalDurationSeconds || Math.max(1, overrideSegmentCount) * 8),
      10
    );
    const segmentedFlow = request.resolvedVideoModel === 'kling_3'
      ? true
      : isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const calculatedSegmentCount = request.resolvedVideoModel === 'kling_3'
      ? (plannedKlingSegments?.length || 1)
      : (segmentedFlow
        ? getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel)
        : 1);
    const segmentCount = hasSegmentPromptOverrides ? overrideSegmentCount : calculatedSegmentCount;
    const effectiveSegmentedFlow = segmentCount > 1 || request.resolvedVideoModel === 'kling_3';
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
          referenceVideoDescription, // Pass reference video analysis result (not raw context)
          request.supplementalText,
        );

    if (hasSegmentPromptOverrides) {
      console.log(`✅ Using ${segmentCount} segment prompt overrides from Step 3 (skipping AI prompt regeneration).`);
    }

    console.log('🎯 Generated creative prompts:', prompts);

    if (request.resolvedVideoModel !== 'kling_3' && !shotPlanForSegments && segmentedFlow && referenceVideoTimelineShots && referenceVideoTimelineShots.length > 0) {
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
      request.resolvedVideoModel === 'kling_3'
        ? undefined
        : shotPlanForSegments,
      plannedKlingSegments,
      collectDistinctUrls([
        ...(request.imageUrl ? [request.imageUrl] : []),
        ...(cloneReferenceAssets?.productImageUrls || [])
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
    resolution: request.photoResolution,
    outputFormat: request.photoOutputFormat
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
  resolution,
  outputFormat
}: {
  prompt: string;
  referenceImages: string[];
  aspectRatio?: string;
  resolution?: '1K' | '2K' | '4K';
  outputFormat?: 'png' | 'jpg';
}): Promise<string> {
  if (!referenceImages.length) {
    throw new Error('Replica photo generation requires reference images');
  }

  const requestBody = {
    model: NON_AGENT_IMAGE_MODEL,
    input: {
      prompt,
      image_input: referenceImages.slice(0, 8),
      aspect_ratio: aspectRatio || '9:16',
      resolution: NON_AGENT_IMAGE_RESOLUTION,
      output_format: NON_AGENT_IMAGE_OUTPUT_FORMAT
    }
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Replica photo generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start replica photo task');
  }

  return data.data.taskId as string;
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
  referenceVideoDescription?: Record<string, unknown>, // Changed: Now receives analysis result, not raw context
  supplementalText?: string,
): Promise<Record<string, unknown>> {
  console.log(`[generateImageBasedPrompts] Step 2: Generating prompts for our product${referenceVideoDescription ? ' (reference-video mode)' : ' (traditional mode)'}${!imageUrl ? ' (no product image provided)' : ''}`);


  const duration = Number.isFinite(videoDurationSeconds) && videoDurationSeconds ? videoDurationSeconds : 10;
  const minDurationForModel = videoModel === 'kling_3' ? KLING_MIN_TASK_DURATION_SECONDS : DEFAULT_SEGMENT_DURATION_SECONDS;
  const maxDurationForModel = videoModel === 'kling_3' ? KLING_MAX_TASK_DURATION_SECONDS : 64;
  const perSegmentDuration = Math.max(
    minDurationForModel,
    Math.min(maxDurationForModel, Math.round(duration / Math.max(1, segmentCount)))
  );
  const minShotsPerSegment = videoModel === 'kling_3' ? 1 : 2;
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

**REFERENCE VIDEO ANALYSIS** (Veo Guide 8 Elements):
${JSON.stringify(referenceVideoDescription, null, 2)}

Your task is to create a similar advertisement for OUR product${imageUrl ? ' (shown in the user\'s image)' : ''} by:
1. CLONING the reference video's creative structure, style, and approach
2. REPLACING the source product with our product
3. MAINTAINING the same narrative flow, visual style, and tone
4. PRESERVING the camera work, composition, and ambiance
5. MATCH EVERY SHOT EXACTLY: number of segments, graphic title cards, text overlays, and the final sign-off shot must appear in the same order as the reference video. Do not drop or rearrange any shots.

**CRITICAL: For "first_frame_description" field:**
- You MUST preserve the source video's detailed visual descriptions
- ONLY replace product-specific details (product name, packaging, labels) with our product
- DO NOT simplify, shorten, or omit any environmental details, lighting, composition, or scene elements
- Keep the same level of detail and specificity as the source analysis
- Example: If the source has "A medium shot captures a woman with shoulder-length blonde wavy hair...", you should keep all those details but replace the product with ours

${imageUrl ? 'Remember: The user\'s image is OUR product - adapt the reference video to showcase OUR product instead.' : 'Note: No product image provided - use product context to adapt the reference video.'}

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
                    text: `📸 OUR PRODUCT IMAGE (above)

Use the reference video analysis provided in the system message to recreate the same storyboard for OUR product. Replace the featured product, labels, and packaging while keeping framing, movement, pacing, and energy identical.

**CRITICAL REQUIREMENTS:**
- For each segment's "first_frame_description", you MUST preserve the source video's detailed visual descriptions
- ONLY replace the source product-specific details with our product
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Example transformation: "Woman applying source lotion..." → "Woman applying ${productContext?.product_name || 'our product'}..." (keep all other details unchanged)

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this to ensure accurate product replacement)\n` : ''}

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
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Keep all environmental details, lighting descriptions, composition specifics unchanged

${productContext?.product_name ? `Product Context:\nProduct Name: ${productContext.product_name}\n(Use this context when replacing subjects or props)\n` : ''}

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

async function startSegmentedWorkflow(
  projectId: string,
  request: StartWorkflowRequest & { imageUrl?: string }, // Optional when no product image is provided
  prompts: Record<string, unknown>,
  segmentCount: number,
  referenceVideoDescription?: Record<string, unknown>, // Reference video analysis
  referenceVideoShots?: ReferenceVideoShot[],
  klingPlannedSegments?: PlannedKlingSegment[] | null,
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
  const klingSegments = request.resolvedVideoModel === 'kling_3' && klingPlannedSegments?.length
    ? alignKlingPromptsToPlan(prompts, klingPlannedSegments, request.language || 'en')
    : null;
  const normalizedSegments = (klingSegments || normalizeSegmentPrompts(prompts, segmentCount, referenceVideoShots, perSegmentDurationSeconds)).map(segment => ({
    ...segment,
    first_frame_image_size: segment.first_frame_image_size || defaultFrameSize
  }));
  const normalizedAvatarPhotoUrls = collectDistinctUrls(cloneReferenceAssets?.avatarPhotoUrls || [], 4);
  const normalizedProductImageUrls = collectDistinctUrls(
    [
      ...(productImageUrls || []),
      ...(cloneReferenceAssets?.productImageUrls || [])
    ],
    8
  );
  const serializedPlan = serializeSegmentPlan(normalizedSegments);
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
        avatarPhotoUrls: normalizedAvatarPhotoUrls,
        productImageUrls: normalizedProductImageUrls
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
    status: 'pending_first_frame',
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

  await supabase
    .from('video_clone_projects')
    .update({
      video_prompts: storedVideoPrompts,
      segment_plan: serializedPlan,
      current_step: 'generating_segment_frames',
      progress_percentage: 35,
      last_processed_at: now,
      segment_status: buildSegmentStatusPayload(segments)
    })
    .eq('id', projectId);

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
        workflowSourceOverride: request.requestSource || 'default'
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
    : DEFAULT_SEGMENT_DURATION_SECONDS;

  const normalized: SegmentPrompt[] = [];

  for (let index = 0; index < segmentCount; index++) {
    const source = (rawSegments[index] || rawSegments[rawSegments.length - 1] || {}) as LooseSegment;
    const shot = referenceVideoShots?.[index];
    const shotOverrides = shot ? buildSegmentOverridesFromShot(shot) : undefined;
    const defaultLanguage = cleanSegmentText(source.language) || 'en';
    const normalizedShots = normalizeSegmentShots(
      (source as { shots?: unknown }).shots,
      durationPerSegment,
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

  const totalDuration = effectiveShots.reduce((sum, shot) => sum + (shot.durationSeconds || DEFAULT_SEGMENT_DURATION_SECONDS), 0);
  const perSegmentDuration = segmentCount > 0 ? Math.max(1, Math.round(totalDuration / segmentCount)) : DEFAULT_SEGMENT_DURATION_SECONDS;

  const placeholderPrompts = {
    segments: Array.from({ length: segmentCount }, (_, index) => ({ index: index + 1 }))
  } as { segments: Array<Partial<SegmentPrompt>> };

  return normalizeSegmentPrompts(placeholderPrompts, segmentCount, effectiveShots, perSegmentDuration);
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
  aspectRatio: '16:9' | '9:16'
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);
  const imageModel = NON_AGENT_IMAGE_MODEL;

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

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        resolution: NON_AGENT_IMAGE_RESOLUTION,
        output_format: NON_AGENT_IMAGE_OUTPUT_FORMAT
      },
      callBackUrl: FRAME_WEBHOOK_URL // Event-driven: Register callback for instant status updates
    })
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Text-to-Image frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate frame from text');
  }

  return data.data.taskId;
}

/**
 * Generate frame from reference image (Image-to-Image)
 * Used when reference images are available (product, character, or continuation)
 */
type FrameGenerationOverrides = {
  aspectRatioOverride?: string;
  imageSizeOverride?: string;
  resolutionOverride?: '1K' | '2K' | '4K';
  characterPhotoUrls?: string[] | null;
  workflowSourceOverride?: 'project_agent_clone' | 'default';
  usePromptAsIs?: boolean;
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
  console.log('🎨 Using nano_banana_2 keyframes for clone frame generation (docs/kie/nano_banana_2.md)');
  const imageModel = NON_AGENT_IMAGE_MODEL;
  const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;
  const resolvedResolution = overrides?.resolutionOverride || '1K';

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

  const inputPayload: Record<string, unknown> = {
    prompt,
    image_input: limitedReferences,
    output_format: 'png',
    google_search: false
  };

  inputPayload.aspect_ratio = resolvedAspectRatio;
  inputPayload.resolution = resolvedResolution || '1K';

  console.log(`📤 [createFrameFromImage] Sending to KIE API:`, {
    imageModel,
    referenceImageCount: limitedReferences.length,
    referenceImageUrls: limitedReferences
  });

  const requestPayload = {
    model: imageModel,
    input: inputPayload,
    callBackUrl: FRAME_WEBHOOK_URL // Event-driven: Register callback for instant status updates
  };

  console.log(`📤 [createFrameFromImage] Full request payload:`, JSON.stringify(requestPayload, null, 2));

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Image-to-Image frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate frame from image');
  }

  return data.data.taskId;
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
    const imageModel = NON_AGENT_IMAGE_MODEL;
    const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;
    const characterPhotos = Array.isArray(overrides?.characterPhotoUrls)
      ? overrides.characterPhotoUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    const normalizedProductImages = Array.isArray(productImageUrls)
      ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    const imageInput = Array.from(
      new Set([
        ...(usesContinuationReference && continuationReferenceUrl ? [continuationReferenceUrl] : []),
        ...characterPhotos,
        ...normalizedProductImages
      ])
    );

    console.log('[Frame Routing]', {
      segmentIndex,
      frameType,
      isCloneMode: isReferenceCloneMode,
      referenceSourceType: isReferenceCloneMode ? 'video' : null,
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

    const requestInput: Record<string, unknown> = {
      prompt,
      ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
      output_format: 'png',
      google_search: false
    };

    requestInput.aspect_ratio = resolvedAspectRatio;
    requestInput.resolution = overrides?.resolutionOverride || NON_AGENT_IMAGE_RESOLUTION;

    const requestPayload = {
      model: imageModel,
      input: requestInput,
      callBackUrl: FRAME_WEBHOOK_URL
    };

    console.log('   - 📤 Manual frame regeneration using raw prompt');
    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);
    console.log(`   - 📤 image_input URLs:`, imageInput);
    console.log(`   - 📤 Full KIE API request payload:`, JSON.stringify(requestPayload, null, 2));

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    }, 5, 30000);

    if (!response.ok) {
      throw new Error(`Manual raw-prompt frame generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate frame from raw prompt');
    }

    return data.data.taskId;
  }

  if (isReferenceCloneMode) {
    console.log(`🎨 Reference video clone mode detected: Using direct text-to-image`);
    console.log(`   - Segment ${segmentIndex + 1} ${frameType} frame`);

    const frameDescription = resolveFrameDescription(promptForProvider, frameType);
    const imageModel = NON_AGENT_IMAGE_MODEL;
    const isProjectAgentClone = overrides?.workflowSourceOverride === 'project_agent_clone';
    const resolvedAspectRatio = overrides?.imageSizeOverride || overrides?.aspectRatioOverride || aspectRatio;

    // Build image_input from multiple sources
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

    console.log('[Frame Routing]', {
      segmentIndex,
      frameType,
      isCloneMode: true,
      referenceSourceType: 'video',
      usesContinuationReference,
      imageInputCount: imageInput.length
    });
    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);
    console.log(`   - 📤 Sending to KIE API - image_input count: ${imageInput.length}`);
    console.log(`   - 📤 image_input URLs:`, imageInput);

    const prompt = isProjectAgentClone
      ? buildProjectAgentFramePrompt({
          segmentIndex,
          frameType,
          frameDescription,
          isBrandShot: false
        })
      : frameDescription;

    const requestPayload = {
      model: imageModel,
      input: (() => {
        const input: Record<string, unknown> = {
          prompt,
          ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
          output_format: 'png',
          google_search: false
        };
        input.aspect_ratio = resolvedAspectRatio;
        input.resolution = overrides?.resolutionOverride || NON_AGENT_IMAGE_RESOLUTION;
        return input;
      })(),
      callBackUrl: FRAME_WEBHOOK_URL // Event-driven: Register callback for instant status updates
    };

    console.log(`   - 📤 Full KIE API request payload:`, JSON.stringify(requestPayload, null, 2));

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    }, 5, 30000);

    if (!response.ok) {
      throw new Error(`Reference video clone frame generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate reference video clone frame');
    }

    console.log(`   ✅ Task created: ${data.data.taskId}`);
    return data.data.taskId;
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
      ...(hasCharacterPhotos ? characterPhotos : []),
      ...normalizedProductImages
    ])
  );

  console.log('[Frame Routing]', {
    segmentIndex,
    frameType,
    isCloneMode: false,
    referenceSourceType: null,
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
    aspectRatio
  );
}

export async function startSegmentVideoTask(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string,
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

  const supportedSegmentModels: VideoModel[] = ['seedance_2_fast', 'seedance_2', 'kling_3'];
  if (!supportedSegmentModels.includes(videoModel)) {
    throw new Error(`Segmented workflow only supports Seedance 2 Fast, Seedance 2, or Kling 3.0. Received ${videoModel}`);
  }

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

  if (videoModel === 'seedance_2_fast' || videoModel === 'seedance_2') {
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

  if (videoModel === 'kling_3') {
    return await startSegmentVideoTaskKling(
      project,
      compiledSegmentPrompt,
      normalizedShots,
      firstFrameUrl,
      closingFrameUrl,
      segmentIndex,
      totalSegments,
      perSegmentDuration
    );
  }

  const structuredPromptPayload = buildStructuredVideoPromptPayload({
    normalizedShots
  });

  // Determine imageUrls based on whether a closing frame exists
  const hasClosingFrame = !!closingFrameUrl && closingFrameUrl !== firstFrameUrl;
  const imageUrls = hasClosingFrame ? [firstFrameUrl, closingFrameUrl] : [firstFrameUrl];

  console.log(`🎬 Segment ${segmentIndex + 1}: Images count = ${imageUrls.length} ${hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  const requestBody = {
    prompt: JSON.stringify(structuredPromptPayload),
    model: videoModel,
    aspectRatio,
    generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
    imageUrls,
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: true,
    includeDialogue: true,
    enableTranslation: false,
    callBackUrl: buildSegmentVideoWebhookUrl(project.id, segmentIndex)
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to generate segment video: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate segment video');
  }

  return data.data.taskId;
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

type KlingMentionType = 'character' | 'product' | 'unknown';

type KlingMention = {
  type: KlingMentionType;
  name: string;
  key: string;
};

type KlingElement = {
  name: string;
  description: string;
  element_input_urls: string[];
};

const MENTION_REGEX = SHARED_MENTION_TOKEN_REGEX;
const KLING_SHOT_MIN_DURATION_SECONDS = 1;
const KLING_SHOT_MAX_DURATION_SECONDS = 12;

function parseTimeRangeEndSeconds(value: string): number | null {
  const parts = String(value || '').split('-').map((part) => part.trim());
  if (parts.length !== 2) return null;
  const [minutesPart, secondsPart] = parts[1].split(':');
  const minutes = Number(minutesPart);
  const seconds = Number(secondsPart);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return (minutes * 60) + seconds;
}

function getPromptSegmentDurationSeconds(
  segment:
    | NonNullable<StartWorkflowRequest['segmentPrompts']>[number]
    | SegmentPrompt
    | undefined,
  fallback = DEFAULT_SEGMENT_DURATION_SECONDS
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
  if (model === 'kling_3' && Array.isArray(segmentPrompt?.shots) && segmentPrompt.shots.length > 0) {
    return Math.max(
      KLING_MIN_TASK_DURATION_SECONDS,
      Math.min(KLING_MAX_TASK_DURATION_SECONDS, getPromptSegmentDurationSeconds(segmentPrompt))
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

  if (model === 'kling_3') {
    return Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(KLING_MAX_TASK_DURATION_SECONDS, distributed));
  }

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
    : [
        {
          id: 1,
          time_range: `00:00 - ${formatTimecode(perSegmentDuration)}`,
          audio: music,
          style: segmentPrompt.style || '',
          action: action,
          subject: segmentPrompt.subject || '',
          dialogue: dialogueContent,
          language: segmentPrompt.language || languageCode,
          composition: segmentPrompt.composition || '',
          context_environment: segmentPrompt.context_environment || '',
          ambiance_colour_lighting: segmentPrompt.ambiance_colour_lighting || '',
          camera_motion_positioning: segmentPrompt.camera_motion_positioning || ''
        }
      ]
  ).map(shot => ({
    time_range: shot.time_range || `00:00 - ${formatTimecode(perSegmentDuration)}`,
    audio: cleanSegmentText(shot.audio) || music,
    style: cleanSegmentText(shot.style) || segmentPrompt.style || '',
    action: cleanSegmentText(shot.action) || action,
    subject: cleanSegmentText(shot.subject) || segmentPrompt.subject || '',
    dialogue: cleanSegmentText(shot.dialogue) || dialogueContent,
    language: cleanSegmentText(shot.language) || languageCode,
    composition: cleanSegmentText(shot.composition) || segmentPrompt.composition || '',
    context_environment: cleanSegmentText(shot.context_environment) || segmentPrompt.context_environment || '',
    ambiance_colour_lighting: cleanSegmentText(shot.ambiance_colour_lighting) || segmentPrompt.ambiance_colour_lighting || '',
    camera_motion_positioning: cleanSegmentText(shot.camera_motion_positioning) || segmentPrompt.camera_motion_positioning || ''
  }));
}

function collectKlingMentions(texts: string[]): KlingMention[] {
  const map = new Map<string, KlingMention>();
  texts.forEach(text => {
    if (!text) return;
    for (const match of text.matchAll(MENTION_REGEX)) {
      const parsed = parseMentionToken(match[0]);
      const type = parsed?.type as KlingMentionType | undefined;
      const keyName = parsed?.key || normalizeMentionLabel(parsed?.label || '');
      if (!type || !keyName) continue;
      const key = `${type}:${keyName}`;
      if (!map.has(key)) {
        map.set(key, { type, name: keyName, key });
      }
    }
  });
  return Array.from(map.values());
}

function buildKlingElementName(rawName: string, _mentionKey?: string, _usedNames?: Set<string>): string {
  return normalizeMentionLabel(rawName) || 'asset';
}

function extractUnresolvedKlingReferences(text: string): string[] {
  const references = new Set<string>();

  for (const match of text.matchAll(MENTION_REGEX)) {
    references.add(match[0]);
  }

  const shorthandMatches = text.match(/@(character|product|c|p)\b/g) || [];
  shorthandMatches.forEach(match => references.add(match));

  return Array.from(references);
}

function replacePromptMentions(
  text: string,
  tokenMap: Record<string, string>,
  _plainTokenMap: Record<string, string>
): string {
  if (!text) return text;
  return text.replace(MENTION_REGEX, (match) => {
    const parsed = parseMentionToken(match);
    if (!parsed) return match;
    const keyName = parsed.key || normalizeMentionLabel(String(parsed.label || ''));
    if (!keyName) {
      return parsed.syntax !== 'plain' ? String(parsed.label || '').trim() : match;
    }
    const key = `${parsed.type}:${keyName}`;
    const mapped = tokenMap[key];
    if (mapped) {
      return `@${mapped}`;
    }
    return parsed.syntax !== 'plain' ? `@${keyName}` : match;
  });
}

function collectElementKeysFromText(
  text: string,
  tokenMap: Record<string, string>,
  plainTokenMap: Record<string, string>
): string[] {
  if (!text) return [];
  const tags: string[] = [];
  for (const match of text.matchAll(MENTION_REGEX)) {
    const parsed = parseMentionToken(match[0]);
    const type = parsed?.type;
    const keyName = parsed?.key || normalizeMentionLabel(parsed?.label || '');
    if (!type || !keyName) continue;
    const mapped = tokenMap[`${type}:${keyName}`];
    if (mapped) {
      tags.push(`@${mapped}`);
    }
  }
  return tags;
}

function collectElementTagsFromTexts(
  texts: string[],
  tokenMap: Record<string, string>,
  plainTokenMap: Record<string, string>
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const text of texts) {
    const tags = collectElementKeysFromText(text, tokenMap, plainTokenMap);
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        ordered.push(tag);
      }
    }
  }
  return ordered;
}

async function buildKlingElementsFromMentions(
  userId: string,
  mentions: KlingMention[]
): Promise<{ elements: KlingElement[]; tokenMap: Record<string, string>; plainTokenMap: Record<string, string>; skippedMentions: KlingMention[] }> {
  if (!mentions.length) {
    return { elements: [], tokenMap: {}, plainTokenMap: {}, skippedMentions: [] };
  }

  const mentionNames = Array.from(new Set(mentions.map(mention => mention.name)));
  const supabase = getSupabaseAdmin();
  const productPromise = supabase
    .from('user_products')
    .select('id,product_name,user_product_photos(photo_url,is_primary)')
    .eq('user_id', userId);

  const fetchAvatars = async () => {
    const photoSetQuery = await supabase
      .from('user_avatars')
      .select('id,avatar_name,photo_url,photo_set_json')
      .eq('user_id', userId);

    if (!photoSetQuery.error) {
      return photoSetQuery;
    }

    if ((photoSetQuery.error as { code?: string } | null)?.code === '42703') {
      console.warn('[Kling Elements] Falling back to minimal avatar query without photo_set_json:', photoSetQuery.error.message);
      return supabase
        .from('user_avatars')
        .select('id,avatar_name,photo_url')
        .eq('user_id', userId);
    }

    return photoSetQuery;
  };

  const [productResult, avatarResult] = await Promise.all([
    productPromise,
    fetchAvatars()
  ]);

  if (productResult.error) {
    console.error('[Kling Elements] Failed to fetch products:', productResult.error);
  }
  if (avatarResult.error) {
    console.error('[Kling Elements] Failed to fetch avatars:', avatarResult.error);
  }

  const products = (productResult.data || []).filter(product =>
    mentionNames.includes(normalizeMentionLabel(product.product_name || ''))
  );
  const userAvatars = (avatarResult.data || []).filter(avatar =>
    mentionNames.includes(normalizeMentionLabel(avatar.avatar_name || ''))
  );
  const systemAvatars = SYSTEM_AVATARS.filter(avatar =>
    mentionNames.includes(normalizeMentionLabel(avatar.avatar_name || ''))
  );
  const avatars = [...systemAvatars, ...userAvatars];

  const productsByName = new Map(
    products.map(product => [normalizeMentionLabel(product.product_name || ''), product])
  );
  const avatarsByName = new Map(
    avatars.map(avatar => [normalizeMentionLabel(avatar.avatar_name || ''), avatar])
  );

  const collectAvatarUrls = (avatar: Record<string, unknown> | undefined): string[] => (
    getAvatarPhotoUrls(avatar as Parameters<typeof getAvatarPhotoUrls>[0])
  );

  const tokenMap: Record<string, string> = {};
  const plainTokenMap: Record<string, string> = {};
  const elements: KlingElement[] = [];
  const skippedMentions: KlingMention[] = [];

  mentions.forEach((mention) => {
    const mentionNameKey = mention.name;
    const product = mention.type === 'character'
      ? undefined
      : productsByName.get(mentionNameKey);
    const avatar = mention.type === 'product'
      ? undefined
      : avatarsByName.get(mentionNameKey);

    if (mention.type === 'unknown' && product && avatar) {
      throw new Error(`Ambiguous mention @${mention.name}: matches both an avatar and a product. Rename one asset or use a unique name.`);
    }

    const productUrls = product?.user_product_photos
      ? [
          ...product.user_product_photos
            .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
            .map(photo => photo.photo_url)
        ]
      : [];
    const avatarUrls = collectAvatarUrls(avatar as Record<string, unknown> | undefined);
    const urls = Array.from(new Set([...(mention.type === 'product' ? productUrls : avatarUrls)].filter(Boolean) as string[])).slice(0, 4);

    if (urls.length < 2) {
      console.warn('[Kling Elements] Skipping mention without minimum 2 images:', {
        mention,
        imageCount: urls.length
      });
      skippedMentions.push(mention);
      return;
    }

    const elementName = mention.name;
    tokenMap[mention.key] = elementName;
    plainTokenMap[mentionNameKey] = elementName;

    elements.push({
      name: elementName,
      description:
        mention.type === 'product'
          ? (product?.product_name || mention.name)
          : (avatar?.avatar_name || mention.name),
      element_input_urls: urls
    });
  });

  return { elements, tokenMap, plainTokenMap, skippedMentions };
}

type KlingPromptBuildResult = {
  prompt: string;
  originalLength: number;
  finalLength: number;
  wasCompressed: boolean;
  tagCount: number;
};

function buildKlingShotPrompt(
  segmentPrompt: SegmentPrompt,
  shot: NormalizedVideoShot,
  shotIndex: number,
  tokenMap: Record<string, string>,
  plainTokenMap: Record<string, string>,
  replaceMention: (text: string) => string
): KlingPromptBuildResult {
  const trailingTags = collectElementTagsFromTexts([
    shot.action,
    shot.subject,
    shot.dialogue,
    shot.context_environment,
    shot.composition,
    shot.style,
    shot.ambiance_colour_lighting,
    shot.camera_motion_positioning,
    shot.audio
  ].filter(Boolean) as string[], tokenMap, plainTokenMap);

  const sections = buildKlingPromptSections({
    shot
  });

  const fitted = fitKlingPromptWithinLimit({
    sections,
    tags: trailingTags,
    replaceMention,
    maxChars: KLING_PROMPT_MAX_CHARS,
    softTarget: KLING_PROMPT_SOFT_TARGET
  });

  return {
    prompt: fitted.finalPrompt,
    originalLength: fitted.originalLength,
    finalLength: fitted.finalLength,
    wasCompressed: fitted.wasCompressed,
    tagCount: fitted.tagCount
  };
}

function buildKlingSinglePrompt(
  segmentPrompt: SegmentPrompt,
  shot: NormalizedVideoShot,
  tokenMap: Record<string, string>,
  plainTokenMap: Record<string, string>,
  replaceMention: (text: string) => string
): KlingPromptBuildResult {
  const trailingTags = collectElementTagsFromTexts([
    shot.subject,
    shot.action,
    shot.dialogue,
    shot.context_environment,
    shot.composition,
    shot.style,
    shot.ambiance_colour_lighting,
    shot.camera_motion_positioning,
    shot.audio
  ].filter(Boolean) as string[], tokenMap, plainTokenMap);

  const sections = buildKlingPromptSections({
    shot
  });

  const fitted = fitKlingPromptWithinLimit({
    sections,
    tags: trailingTags,
    replaceMention,
    maxChars: KLING_PROMPT_MAX_CHARS,
    softTarget: KLING_PROMPT_SOFT_TARGET
  });

  return {
    prompt: fitted.finalPrompt,
    originalLength: fitted.originalLength,
    finalLength: fitted.finalLength,
    wasCompressed: fitted.wasCompressed,
    tagCount: fitted.tagCount
  };
}

function allocateKlingShotDurations(totalDuration: number, shotCount: number): number[] {
  const safeShotCount = Math.max(1, Math.min(totalDuration, shotCount));
  const durations = new Array<number>(safeShotCount).fill(KLING_SHOT_MIN_DURATION_SECONDS);
  let remaining = totalDuration - safeShotCount * KLING_SHOT_MIN_DURATION_SECONDS;

  let cursor = 0;
  while (remaining > 0) {
    const room = KLING_SHOT_MAX_DURATION_SECONDS - durations[cursor];
    if (room > 0) {
      durations[cursor] += 1;
      remaining -= 1;
    }
    cursor = (cursor + 1) % safeShotCount;
  }

  return durations;
}

function getTimeRangeDurationSeconds(value: string): number | null {
  const parts = String(value || '').split('-').map((part) => part.trim());
  if (parts.length !== 2) return null;

  const [startMinutesPart, startSecondsPart] = parts[0].split(':');
  const [endMinutesPart, endSecondsPart] = parts[1].split(':');
  const startMinutes = Number(startMinutesPart);
  const startSeconds = Number(startSecondsPart);
  const endMinutes = Number(endMinutesPart);
  const endSeconds = Number(endSecondsPart);

  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(startSeconds) ||
    !Number.isFinite(endMinutes) ||
    !Number.isFinite(endSeconds)
  ) {
    return null;
  }

  const start = (startMinutes * 60) + startSeconds;
  const end = (endMinutes * 60) + endSeconds;
  if (end <= start) return null;

  return end - start;
}

function deriveKlingShotDurationsFromSourceShots(
  sourceShots: NormalizedVideoShot[],
  desiredShotCount: number,
  totalDuration: number
): number[] | null {
  if (sourceShots.length < desiredShotCount) {
    return null;
  }

  const parsedDurations = sourceShots
    .map((shot) => getTimeRangeDurationSeconds(shot.time_range))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);

  if (parsedDurations.length !== sourceShots.length) {
    return null;
  }

  const nextDurations = sourceShots.length > desiredShotCount
    ? [
        ...parsedDurations.slice(0, desiredShotCount - 1),
        parsedDurations.slice(desiredShotCount - 1).reduce((sum, value) => sum + value, 0)
      ]
    : parsedDurations.slice(0, desiredShotCount);

  if (nextDurations.length !== desiredShotCount) {
    return null;
  }

  if (nextDurations.some((duration) => duration < KLING_SHOT_MIN_DURATION_SECONDS || duration > KLING_SHOT_MAX_DURATION_SECONDS)) {
    return null;
  }

  const totalFromShots = nextDurations.reduce((sum, value) => sum + value, 0);
  const diff = totalDuration - totalFromShots;
  if (diff === 0) {
    return nextDurations;
  }

  const lastIndex = nextDurations.length - 1;
  const adjustedLast = nextDurations[lastIndex] + diff;
  if (adjustedLast < KLING_SHOT_MIN_DURATION_SECONDS || adjustedLast > KLING_SHOT_MAX_DURATION_SECONDS) {
    return null;
  }

  nextDurations[lastIndex] = adjustedLast;
  return nextDurations;
}

function buildKlingMultiPrompt(
  segmentPrompt: SegmentPrompt,
  normalizedShots: NormalizedVideoShot[],
  tokenMap: Record<string, string>,
  plainTokenMap: Record<string, string>,
  replaceMention: (text: string) => string,
  totalDuration: number
): Array<{ prompt: string; duration: number; originalLength: number; finalLength: number; wasCompressed: boolean; tagCount: number }> {
  const sourceShots = normalizedShots.length > 0 ? normalizedShots : [
    {
      time_range: `00:00 - ${formatTimecode(totalDuration)}`,
      audio: '',
      style: segmentPrompt.style || '',
      action: segmentPrompt.action || '',
      subject: segmentPrompt.subject || '',
      dialogue: segmentPrompt.dialogue || '',
      language: segmentPrompt.language || 'en',
      composition: segmentPrompt.composition || '',
      context_environment: segmentPrompt.context_environment || '',
      ambiance_colour_lighting: segmentPrompt.ambiance_colour_lighting || '',
      camera_motion_positioning: segmentPrompt.camera_motion_positioning || ''
    }
  ];

  const minShotCount = Math.ceil(totalDuration / KLING_SHOT_MAX_DURATION_SECONDS);
  const desiredShotCount = Math.min(
    KLING_MAX_MULTI_SHOT_ITEMS,
    Math.max(minShotCount, Math.min(totalDuration, sourceShots.length))
  );
  const mergedShots: NormalizedVideoShot[] = sourceShots.slice(0, desiredShotCount);

  if (sourceShots.length > desiredShotCount) {
    const overflowShots = sourceShots.slice(desiredShotCount - 1);
    const mergedLastAction = overflowShots
      .map(shot => shot.action)
      .filter(Boolean)
      .join(' Then ');
    mergedShots[desiredShotCount - 1] = {
      ...mergedShots[desiredShotCount - 1],
      action: mergedLastAction || mergedShots[desiredShotCount - 1].action
    };
  }

  while (mergedShots.length < desiredShotCount) {
    mergedShots.push({ ...mergedShots[mergedShots.length - 1] });
  }

  const shotDurations = deriveKlingShotDurationsFromSourceShots(sourceShots, desiredShotCount, totalDuration)
    ?? allocateKlingShotDurations(totalDuration, desiredShotCount);
  return mergedShots.map((shot, index) => ({
    ...buildKlingShotPrompt(segmentPrompt, shot, index, tokenMap, plainTokenMap, replaceMention),
    duration: shotDurations[index]
  }));
}

async function startSegmentVideoTaskKling(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  normalizedShots: NormalizedVideoShot[],
  firstFrameUrl: string,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number,
  taskDuration: number
): Promise<string> {
  const boundedDuration = Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(KLING_MAX_TASK_DURATION_SECONDS, taskDuration));
  const mentionSourceTexts = [
    segmentPrompt.action,
    segmentPrompt.subject,
    segmentPrompt.dialogue,
    segmentPrompt.context_environment,
    segmentPrompt.composition,
    segmentPrompt.style,
    segmentPrompt.ambiance_colour_lighting,
    segmentPrompt.camera_motion_positioning,
    ...normalizedShots.flatMap(shot => [
      shot.action,
      shot.subject,
      shot.dialogue,
      shot.context_environment,
      shot.composition,
      shot.style,
      shot.ambiance_colour_lighting,
      shot.camera_motion_positioning,
      shot.audio
    ])
  ].filter(Boolean) as string[];

  const mentions = collectKlingMentions(mentionSourceTexts);
  const { elements, tokenMap, plainTokenMap, skippedMentions } = await buildKlingElementsFromMentions(project.user_id, mentions);
  const replaceMention = (text: string) => replacePromptMentions(text, tokenMap, plainTokenMap);
  const hasMultipleShots = normalizedShots.length > 1;
  const primaryShot = normalizedShots[0] || {
    time_range: `00:00 - ${formatTimecode(boundedDuration)}`,
    audio: '',
    style: segmentPrompt.style || '',
    action: segmentPrompt.action || '',
    subject: segmentPrompt.subject || '',
    dialogue: segmentPrompt.dialogue || '',
    language: segmentPrompt.language || 'en',
    composition: segmentPrompt.composition || '',
    context_environment: segmentPrompt.context_environment || '',
    ambiance_colour_lighting: segmentPrompt.ambiance_colour_lighting || '',
    camera_motion_positioning: segmentPrompt.camera_motion_positioning || ''
  };
  const multiPrompt = hasMultipleShots
    ? buildKlingMultiPrompt(segmentPrompt, normalizedShots, tokenMap, plainTokenMap, replaceMention, boundedDuration)
    : [];
  const singlePrompt = hasMultipleShots
    ? null
    : buildKlingSinglePrompt(segmentPrompt, primaryShot, tokenMap, plainTokenMap, replaceMention);
  const hasClosingFrame = Boolean(closingFrameUrl && closingFrameUrl !== firstFrameUrl);
  const imageUrls = hasMultipleShots
    ? [firstFrameUrl]
    : (hasClosingFrame ? [firstFrameUrl, closingFrameUrl as string] : [firstFrameUrl]);

  const unresolvedPromptReferences = hasMultipleShots
    ? multiPrompt.flatMap(item => extractUnresolvedKlingReferences(item.prompt))
    : extractUnresolvedKlingReferences(singlePrompt?.prompt || '');

  if (unresolvedPromptReferences.length > 0) {
    console.error('[Kling Prompt] Unresolved mention references before API call:', {
      segmentIndex,
      unresolvedPromptReferences,
      multiShots: hasMultipleShots,
      promptPreview: hasMultipleShots
        ? multiPrompt.map((item, index) => ({
            shotIndex: index,
            preview: item.prompt.slice(0, 220)
          }))
        : (singlePrompt?.prompt || '').slice(0, 220)
    });
    throw new Error(`Kling prompt still contains unresolved references: ${unresolvedPromptReferences.join(', ')}`);
  }

  const requestBody = buildKlingVideoRequestBody({
    projectId: project.id,
    segmentIndex,
    aspectRatio: project.video_aspect_ratio === '9:16' ? '9:16' : '16:9',
    quality: project.video_quality,
    imageUrls,
    boundedDuration,
    hasMultipleShots,
    multiPrompt: multiPrompt.map(({ prompt, duration }) => ({ prompt, duration })),
    prompt: singlePrompt?.prompt || '',
    elements
  });

  console.log(`🎬 Kling Segment ${segmentIndex + 1}/${totalSegments}:`, {
    mode: (requestBody.input as Record<string, unknown>).mode,
    duration: boundedDuration,
    multiShots: hasMultipleShots,
    shotCount: normalizedShots.length,
    imageCount: imageUrls.length,
    multiPromptCount: multiPrompt.length,
    mentionsCount: mentions.length,
    elementsCount: elements.length,
    skippedMentionsCount: skippedMentions.length,
    trailingTagMode: 'shot-only',
    inlineAndTrailing: true,
    promptLimit: KLING_PROMPT_MAX_CHARS,
    softTarget: KLING_PROMPT_SOFT_TARGET,
    promptMetrics: hasMultipleShots
      ? multiPrompt.map((item, index) => ({
          shotIndex: index,
          originalLength: item.originalLength,
          finalLength: item.finalLength,
          wasCompressed: item.wasCompressed,
          tagCount: item.tagCount
        }))
      : [{
          shotIndex: 0,
          originalLength: singlePrompt?.originalLength || 0,
          finalLength: singlePrompt?.finalLength || 0,
          wasCompressed: singlePrompt?.wasCompressed || false,
          tagCount: singlePrompt?.tagCount || 0
        }],
    trailingTagCounts: hasMultipleShots
      ? multiPrompt.map(item => (item.prompt.match(/@[a-z0-9_]+/g) || []).length)
      : [((singlePrompt?.prompt || '').match(/@[a-z0-9_]+/g) || []).length]
  });

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kling API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Kling API failed: ${result.msg || 'Unknown error'}`);
  }

  return result.data.taskId;
}

function buildKlingVideoRequestBody(input: {
  projectId: string;
  segmentIndex: number;
  aspectRatio: '16:9' | '9:16';
  quality?: PersistedVideoQuality | null;
  imageUrls: string[];
  boundedDuration: number;
  hasMultipleShots: boolean;
  multiPrompt: Array<{ prompt: string; duration: number }>;
  prompt: string;
  elements: KlingElement[];
}) {
  const requestBody: Record<string, unknown> = {
    model: 'kling-3.0/video',
    callBackUrl: buildSegmentVideoWebhookUrl(input.projectId, input.segmentIndex),
    input: {
      mode: mapCloneQualityToKlingMode(input.quality),
      image_urls: input.imageUrls,
      sound: true,
      duration: String(input.boundedDuration),
      aspect_ratio: input.aspectRatio,
      multi_shots: input.hasMultipleShots
    }
  };

  if (input.hasMultipleShots) {
    if (input.multiPrompt.length > KLING_MAX_MULTI_SHOT_ITEMS) {
      throw new Error(`Kling 3.0 scenes support at most ${KLING_MAX_MULTI_SHOT_ITEMS} shots per generation.`);
    }
    (requestBody.input as Record<string, unknown>).multi_prompt = input.multiPrompt;
  } else {
    (requestBody.input as Record<string, unknown>).prompt = input.prompt;
  }

  if (input.elements.length > 0) {
    (requestBody.input as Record<string, unknown>).kling_elements = input.elements;
  }

  return requestBody;
}

/**
 * Start video generation task using Seedance 2 / Seedance 2 Fast API.
 * Uses generic jobs/createTask endpoint (same as frame generation).
 */
async function startSegmentVideoTaskSeedance(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number,
  model: 'seedance_2_fast' | 'seedance_2'
): Promise<string> {
  const KIE_API_KEY = process.env.KIE_API_KEY;
  if (!KIE_API_KEY) {
    throw new Error('KIE_API_KEY environment variable is not configured');
  }

  // Prepare input_urls: first frame is required, closing frame optional
  const hasClosingFrame = !!closingFrameUrl && closingFrameUrl !== firstFrameUrl;
  const inputUrls = hasClosingFrame ? [firstFrameUrl, closingFrameUrl] : [firstFrameUrl];
  const segmentDuration = resolveTaskDurationSeconds(
    project,
    model,
    segmentIndex,
    totalSegments
  );

  console.log(`🎬 Seedance Segment ${segmentIndex + 1}/${totalSegments}: Images count = ${inputUrls.length} ${hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const resolution = mapCloneQualityToSeedanceResolution(project.video_quality);

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

  const promptText = promptParts.join('. ').substring(0, 2500); // Max 2500 chars per Seedance API

  const requestBody = {
    model: model === 'seedance_2_fast' ? 'bytedance/seedance-2-fast' : 'bytedance/seedance-2',
    input: {
      prompt: promptText,
      input_urls: inputUrls,
      aspect_ratio: aspectRatio, // '16:9' or '9:16'
      resolution,
      duration: segmentDuration,
      fixed_lens: false, // Allow dynamic camera movement
      generate_audio: true, // Enable audio generation
      web_search: true
    },
    callBackUrl: buildSegmentVideoWebhookUrl(project.id, segmentIndex)
  };

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
  buildProjectAgentFramePrompt,
  shouldWaitForContinuationFrame,
  buildStructuredVideoPromptPayload,
  buildKlingVideoRequestBody,
  buildKlingElementName,
  getPromptSegmentDurationSeconds,
  getTimeRangeDurationSeconds,
  deriveKlingShotDurationsFromSourceShots
};
