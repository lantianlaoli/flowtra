import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  getActualImageModel,
  IMAGE_MODELS,
  getAutoModeSelection,
  getGenerationCost,
  getLanguagePromptName,
  getSegmentCountFromDuration,
  getSegmentDurationForModel,
  getReplicaPhotoCredits,
  DEFAULT_SEGMENT_DURATION_SECONDS,
  snapDurationToModel,
  type LanguageCode,
  type VideoDuration,
  type VideoModel
} from '@/lib/constants';
import {
  parseCompetitorTimeline,
  sumShotDurations,
  parseTimecode,
  formatTimecode,
  type CompetitorShot
} from '@/lib/competitor-shots';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

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

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedBrandId?: string; // NEW: Brand selection for ending frame
  competitorAdId?: string; // NEW: Competitor ad reference for creative direction
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
  imageModel?: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro';
  imageSize?: string;
  elementsCount?: number;
  photoOnly?: boolean;
  shouldGenerateVideo?: boolean;
  videoAspectRatio?: '16:9' | '9:16';
  adCopy?: string;
  referenceImageUrls?: string[];
  photoAspectRatio?: string;
  photoResolution?: '1K' | '2K' | '4K';
  photoOutputFormat?: 'png' | 'jpg';
  replicaMode?: boolean;
  // NEW: Sora2 Pro params
  sora2ProDuration?: '10' | '15';
  sora2ProQuality?: 'standard' | 'high';
  // Generic video params (applies to all models)
  videoDuration?: VideoDuration;
  videoQuality?: 'standard' | 'high';
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
  resolvedVideoModel?: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
}

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
  contains_brand?: boolean; // Whether this segment/shot contains brand elements
  contains_product?: boolean; // Whether this segment/shot contains product
  description?: string;
  first_frame_image_size?: string;
  is_continuation_from_prev?: boolean;
  shots?: SegmentShot[];
};

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
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

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

const convertCompetitorShotToSegmentShot = (
  id: number,
  language: string,
  shot: CompetitorShot,
  fallbackDuration: number
): SegmentShot => {
  // Each segment is independent with 0-8s timing (segment-relative, not competitor absolute timing)
  const startSeconds = 0;
  const durationSeconds = fallbackDuration; // Use segment duration directly (e.g., 8s for veo3_fast)
  const endSeconds = startSeconds + durationSeconds;
  return {
    id,
    time_range: `${formatTimecode(startSeconds)} - ${formatTimecode(endSeconds)}`,
    start_seconds: startSeconds,
    end_seconds: endSeconds,
    duration_seconds: durationSeconds,
    audio: shot.audio || '',
    style: shot.style || '',
    action: shot.action || '',
    subject: shot.subject || '',
    dialogue: '',
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
  competitorShot?: CompetitorShot
): SegmentShot[] => {
  const duration = Number.isFinite(segmentDurationSeconds) && segmentDurationSeconds > 0
    ? segmentDurationSeconds
    : DEFAULT_SEGMENT_DURATION_SECONDS;

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

  if (competitorShot) {
    return [convertCompetitorShotToSegmentShot(1, defaultLanguage, competitorShot, duration)];
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

export const SEGMENTED_DURATIONS = new Set(['16', '24', '32', '40', '48', '56', '64']);

export function normalizeKlingDuration(duration?: string | null): VideoDuration {
  const numericDuration = Number(duration);
  const targetSeconds = Number.isFinite(numericDuration) && numericDuration > 0 ? numericDuration : 10;
  return snapDurationToModel('kling_2_6', targetSeconds);
}

function shouldForceSingleSegmentGrok(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6', videoDuration?: string | null): boolean {
  if (model !== 'grok' || !videoDuration) return false;
  const duration = Number(videoDuration);
  if (!Number.isFinite(duration)) return false;
  return duration <= 6;
}

export function isSegmentedVideoRequest(
  model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6',
  videoDuration?: string | null
): boolean {
  if (!videoDuration) return false;
  if (model === 'grok') {
    const duration = Number(videoDuration);
    return Number.isFinite(duration) && duration > 6;
  }
  if (model === 'kling_2_6') {
    const duration = Number(videoDuration);
    return Number.isFinite(duration) && duration > getSegmentDurationForModel('kling_2_6');
  }
  if (model !== 'veo3' && model !== 'veo3_fast') return false;
  return SEGMENTED_DURATIONS.has(videoDuration);
}


export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

    let imageUrl = request.imageUrl;
    let brandLogoUrl: string | null = null;
    let productContext = { product_details: '', brand_name: '', brand_slogan: '', brand_details: '' };

    if (!request.selectedBrandId) {
      return {
        success: false,
        error: 'Brand selection required',
        details: 'Please select one of your brands before starting a generation.'
      };
    }
    if (!request.competitorAdId) {
      return {
        success: false,
        error: 'Competitor reference required',
        details: 'Select a competitor video or photo to clone before generating.'
      };
    }

    if (request.selectedBrandId) {
      const shouldFetchBrand = !brandLogoUrl || !productContext.brand_name;
      if (shouldFetchBrand) {
        const fetchBrand = async () => {
          const { data: brand, error: brandError } = await supabase
            .from('user_brands')
            .select('id,brand_name,brand_slogan,brand_details,brand_logo_url')
            .eq('id', request.selectedBrandId)
            .eq('user_id', request.userId)
            .single();
          if (brandError) throw brandError;
          return brand;
        };

        const brand = await retryAsync(fetchBrand, { maxAttempts: 3, baseDelayMs: 500, label: 'Brand fetch' });
        if (brand) {
          productContext = {
            ...productContext,
            brand_name: brand.brand_name || productContext.brand_name,
            brand_slogan: brand.brand_slogan || productContext.brand_slogan,
            brand_details: brand.brand_details || productContext.brand_details
          };
          brandLogoUrl = brand.brand_logo_url || brandLogoUrl;
        } else {
          console.error('Brand query failed after retries');
          return {
            success: false,
            error: 'Brand not found',
            details: 'Selected brand does not exist or does not belong to this user'
          };
        }
      }
    }

    if (!imageUrl && brandLogoUrl) {
      imageUrl = brandLogoUrl;
    }

    // imageUrl is now optional when using competitor reference mode
    // It will be used if available, otherwise Text-to-Image will be used

    // Load competitor ad if provided (optional reference for creative direction)
    // Extended type to include existing analysis and language for performance optimization
  let competitorAdContext: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  } | undefined;

    if (request.competitorAdId) {
      console.log(`🎯 Loading competitor ad: ${request.competitorAdId}`);
      const fetchCompetitor = async () => {
        const { data: competitorAd, error: competitorError } = await supabase
          .from('competitor_ads')
          .select('ad_file_url, file_type, competitor_name, analysis_result, analysis_status, language, video_duration_seconds')
          .eq('id', request.competitorAdId)
          .eq('user_id', request.userId)
          .single();
        if (competitorError) throw competitorError;
        return competitorAd;
      };

      try {
        const competitorAd = await retryAsync(fetchCompetitor, { maxAttempts: 3, baseDelayMs: 500, label: 'Competitor fetch' });

        competitorAdContext = {
          id: request.competitorAdId,
          file_url: competitorAd.ad_file_url,
          file_type: competitorAd.file_type as 'image' | 'video',
          competitor_name: competitorAd.competitor_name,
          existing_analysis: competitorAd.analysis_result,
          analysis_status: competitorAd.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
          language: competitorAd.language,
          video_duration_seconds: competitorAd.video_duration_seconds
        };
        console.log(`✅ Competitor ad loaded: ${competitorAdContext.competitor_name} (${competitorAdContext.file_type})`);
        console.log(`📊 Analysis status: ${competitorAdContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!competitorAdContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${competitorAdContext.language || 'none'}`);
      } catch (competitorError) {
        console.warn(`⚠️ Competitor ad not found or access denied: ${request.competitorAdId}`, competitorError);
        // Don't fail the workflow if competitor ad is not found, just proceed without it
      }
    }

    // Convert 'auto' to specific model
    let actualVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
    let competitorShotTimeline: { shots: CompetitorShot[]; totalDurationSeconds: number } | null = null;

    if (request.videoModel === 'auto') {
      const autoSelection = getAutoModeSelection(0); // Get cheapest model
        actualVideoModel = autoSelection || 'sora2'; // Fallback to cheapest
    } else {
      actualVideoModel = request.videoModel;
    }

    if (actualVideoModel === 'kling_2_6') {
      request.videoAspectRatio = '16:9';
      request.videoQuality = 'standard';
      request.videoDuration = normalizeKlingDuration(request.videoDuration);
    }

    if (competitorAdContext?.existing_analysis) {
      const timeline = parseCompetitorTimeline(
        competitorAdContext.existing_analysis as Record<string, unknown>,
        competitorAdContext.video_duration_seconds
      );
      if (timeline.shots.length > 0) {
        competitorShotTimeline = {
          shots: timeline.shots,
          totalDurationSeconds: timeline.videoDurationSeconds || sumShotDurations(timeline.shots)
        };

        // NEW: Recommend duration based on competitor shot count, but let user decide
        // If user hasn't chosen duration yet, recommend shot_count × segment_duration
        if (!request.videoDuration && (actualVideoModel === 'veo3' || actualVideoModel === 'veo3_fast' || actualVideoModel === 'grok' || actualVideoModel === 'kling_2_6')) {
          const segmentDuration = getSegmentDurationForModel(actualVideoModel);
          const recommendedDuration = competitorShotTimeline.shots.length * segmentDuration;

          console.log(`🎯 [SEGMENT DEBUG] Competitor shot analysis:`);
          console.log(`   - Model: ${actualVideoModel}`);
          console.log(`   - Competitor shots: ${competitorShotTimeline.shots.length}`);
          console.log(`   - Segment duration: ${segmentDuration}s per shot`);
          console.log(`   - Recommended duration: ${competitorShotTimeline.shots.length} × ${segmentDuration} = ${recommendedDuration}s`);

          const snappedDuration = snapDurationToModel(actualVideoModel, recommendedDuration);
          console.log(`   - Snapped duration: ${snappedDuration}s`);

          if (snappedDuration) {
            console.log(
              `💡 Final recommended video duration: ${snappedDuration}s (${competitorShotTimeline.shots.length} shots × ${segmentDuration}s per shot)`
            );
            request.videoDuration = snappedDuration;
          }
        }
      }
    }

    const forceSingleSegmentGrok = shouldForceSingleSegmentGrok(actualVideoModel, request.videoDuration);
    const segmentedByDuration = isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const isSegmented = forceSingleSegmentGrok || segmentedByDuration;
    const resolvedSegmentDuration = getSegmentDurationForModel(actualVideoModel);

    // NEW: Smart segment count calculation
    // Priority 1: If competitor shots exist and match user's segment count → use 1:1 mapping
    // Priority 2: Use user's chosen duration
    console.log(`🎯 [SEGMENT DEBUG] Calculating segment count:`);
    console.log(`   - Video model: ${actualVideoModel}`);
    console.log(`   - Video duration: ${request.videoDuration}`);
    console.log(`   - Is segmented: ${isSegmented}`);

    let segmentCount: number;
    const competitorShotCount = competitorShotTimeline?.shots.length || 0;
    const userSegmentCount = forceSingleSegmentGrok
      ? 1
      : segmentedByDuration
        ? getSegmentCountFromDuration(request.videoDuration, actualVideoModel)
        : 1;

    console.log(`   - Competitor shot count: ${competitorShotCount}`);
    console.log(`   - User segment count (from duration): ${userSegmentCount}`);

    if (competitorShotCount > 0 && userSegmentCount === competitorShotCount) {
      segmentCount = competitorShotCount;
      console.log(`✅ Perfect match: ${competitorShotCount} competitor shots = ${userSegmentCount} segments (1:1 mapping)`);
    } else {
      segmentCount = userSegmentCount;
      if (competitorShotCount > 0 && competitorShotCount !== userSegmentCount) {
        console.log(`⚠️ Mismatch: ${competitorShotCount} competitor shots ≠ ${userSegmentCount} segments. Using user's choice, AI will adapt.`);
      } else if (competitorShotCount === 0) {
        console.log(`ℹ️ No competitor shots, using segment count from duration: ${userSegmentCount}`);
      }
    }

    console.log(`🎬 [SEGMENT DEBUG] Final segment count: ${segmentCount}`);

    // Precompute shot-to-segment mapping asap so we can persist plans even if prompt generation fails later
    let shotPlanForSegments: CompetitorShot[] | undefined;
    let precomputedSegmentPlan: SegmentPrompt[] | undefined;
    if (segmentCount > 0 && competitorShotTimeline?.shots.length) {
      if (competitorShotTimeline.shots.length === segmentCount) {
        shotPlanForSegments = competitorShotTimeline.shots;
        console.log('📐 Prepared 1:1 competitor shot map for future recovery');
      } else {
        shotPlanForSegments = compressCompetitorShotsToSegments(competitorShotTimeline.shots, segmentCount);
        console.log(
          `📐 Prepared compressed competitor shot map (${competitorShotTimeline.shots.length} shots → ${segmentCount} segments)`
        );
      }

      precomputedSegmentPlan = buildSegmentPlanFromCompetitorShots(segmentCount, shotPlanForSegments);
    }

    let remainingCreditsAfterDeduction: number | undefined;
    const isReplicaMode = Boolean(
      request.replicaMode &&
      request.photoOnly &&
      Array.isArray(request.referenceImageUrls) &&
      request.referenceImageUrls.length > 0
    );

    // ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
    // ALL models: PAID generation, FREE download
    let generationCost = 0;
    const duration = request.videoDuration || request.sora2ProDuration;
    const quality = request.videoQuality || request.sora2ProQuality;
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
        `Competitor UGC Replication - Replica photo generation (Nano Banana Pro, ${replicaResolution})`,
        undefined,
        true
      );
    } else if (!request.photoOnly) {
      // Calculate generation cost based on model
      generationCost = getGenerationCost(
        actualVideoModel,
        duration,
        quality
      );

      // Check and deduct credits for ALL models
      if (generationCost > 0) {
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
          `Competitor UGC Replication - Video generation (${actualVideoModel.toUpperCase()})`,
          undefined,
          true
        );
      }
    } else {
      generationCost = 0; // Photo-only mode is free
    }

    // Determine actual cover_image_aspect_ratio (resolve 'auto' to actual value)
    let actualCoverAspectRatio: string;
    if (isReplicaMode && request.photoAspectRatio) {
      actualCoverAspectRatio = request.photoAspectRatio;
    } else if (request.imageSize === 'auto' || !request.imageSize) {
      // When image size is 'auto', use the video aspect ratio
      actualCoverAspectRatio = request.videoAspectRatio || '16:9';
    } else {
      actualCoverAspectRatio = request.imageSize;
    }

    // Create project record in competitor_ugc_replication_projects table
    const { data: project, error: insertError} = await supabase
      .from('competitor_ugc_replication_projects')
      .insert({
        user_id: request.userId,
        selected_brand_id: request.selectedBrandId, // NEW: Brand selection
        competitor_ad_id: request.competitorAdId || null, // NEW: Competitor ad reference
        video_model: actualVideoModel,
        video_aspect_ratio: request.videoAspectRatio || '16:9',
        status: 'processing',
        current_step: request.useCustomScript
          ? 'ready_for_video'
          : isSegmented
            ? 'generating_segment_frames'
            : 'generating_cover',
        progress_percentage: request.useCustomScript ? 50 : isSegmented ? 25 : 20,
        credits_cost: generationCost, // Only generation cost (download cost charged separately)
        cover_image_aspect_ratio: actualCoverAspectRatio, // Store actual ratio, never 'auto'
        photo_only: request.photoOnly || false,
        language: request.language || 'en', // Language for AI-generated content
        // Generic video fields (renamed from sora2_pro_*)
        video_duration: duration || (actualVideoModel === 'veo3' || actualVideoModel === 'veo3_fast' ? '8' : '10'),
        video_quality: quality || 'standard',
        // NEW: Custom script fields
        custom_script: request.customScript || null,
        use_custom_script: request.useCustomScript || false,
        // DEPRECATED: download_credits_used (downloads are now free)
        download_credits_used: 0,
        is_segmented: isSegmented,
        segment_count: segmentCount,
        segment_duration_seconds: isSegmented ? resolvedSegmentDuration : null,
        segment_status: isSegmented
          ? {
              total: segmentCount,
              framesReady: 0,
              videosReady: 0,
              segments: []
            }
          : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        success: false,
        error: 'Failed to create project record',
        details: insertError.message
      };
    }

    if (precomputedSegmentPlan?.length === segmentCount) {
      const { error: planSeedError } = await supabase
        .from('competitor_ugc_replication_projects')
        .update({ segment_plan: serializeSegmentPlan(precomputedSegmentPlan) })
        .eq('id', project.id);
      if (planSeedError) {
        console.error('⚠️ Failed to seed segment plan with competitor timeline:', planSeedError);
      } else {
        console.log('💾 Seeded segment_plan with competitor timeline segments');
      }
    }

    // Start the AI workflow in background (fire-and-forget for instant UX)
    // Wrap in IIFE to ensure error handling is reliable
    (async () => {
      try {
        if (isReplicaMode) {
          await startReplicaWorkflow(
            project.id,
            { ...request, imageUrl, resolvedVideoModel: actualVideoModel },
            productContext,
            competitorAdContext
          );
        } else {
          await startAIWorkflow(
            project.id,
            { ...request, imageUrl, videoModel: actualVideoModel, resolvedVideoModel: actualVideoModel },
            productContext,
            competitorAdContext, // Pass competitor ad context for reference
            brandLogoUrl, // NEW: Pass brand logo URL for brand-only shots
            shotPlanForSegments
          );
        }
      } catch (workflowError) {
        console.error('❌ Background workflow error:', workflowError);
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
        if (generationCost > 0) {
          console.log(`⚠️ Refunding ${generationCost} credits due to workflow failure`);
          try {
            await deductCredits(request.userId, -generationCost); // Negative = refund
            await recordCreditTransaction(
              request.userId,
              'refund',
              generationCost,
              isReplicaMode
                ? 'Competitor UGC Replication - Refund for failed replica photo generation'
                : `Competitor UGC Replication - Refund for failed ${actualVideoModel.toUpperCase()} generation`,
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
            .from('competitor_ugc_replication_projects')
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
    })();

    return {
      success: true,
      projectId: project.id,
      remainingCredits: remainingCreditsAfterDeduction,
      creditsUsed: generationCost
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

async function startAIWorkflow(
  projectId: string,
  request: StartWorkflowRequest & {
    imageUrl?: string; // UPDATED: Now optional to support brand-only mode
    resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
  },
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  },
  brandLogoUrl?: string | null, // NEW: Brand logo URL for brand-only shots
  initialShotPlan?: CompetitorShot[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let shotPlanForSegments = initialShotPlan;

  try {
    // CUSTOM SCRIPT MODE: Skip AI steps and use original image
    if (request.useCustomScript && request.customScript) {
      console.log('📜 Custom script mode enabled - skipping AI description and cover generation');
      console.log('📝 Custom script:', request.customScript.substring(0, 100) + '...');

      // Store custom script directly in video_prompts field
      // Convert language code to language name for video generation
      const languageCode = (request.language || 'en') as LanguageCode;
      const languageName = getLanguagePromptName(languageCode);

      const customScriptPrompt = {
        customScript: request.customScript,
        language: languageName
      };

      // Update project: use original image as cover, store custom script, mark ready for video
      const updateData = {
        cover_image_url: request.imageUrl, // Use original image directly
        video_prompts: customScriptPrompt,
        current_step: 'ready_for_video' as const,
        progress_percentage: 50,
        last_processed_at: new Date().toISOString()
      };

      console.log('💾 Updating project with custom script data');

      const { data: updateResult, error: updateError } = await supabase
        .from('competitor_ugc_replication_projects')
        .update(updateData)
        .eq('id', projectId)
        .select();

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Custom script workflow prepared successfully:', updateResult);
      return;
    }

    // AUTO MODE: Image-driven workflow with AI creative generation
    // Generate prompts based purely on visual analysis of the product image
    console.log('🤖 Generating creative video prompts from product image...');

    // TWO-STEP PROCESS for competitor reference mode (with intelligent caching)
    let competitorDescription: Record<string, unknown> | undefined;
    if (competitorAdContext) {
      // Check if we can reuse existing analysis from database
      if (competitorAdContext.existing_analysis) {
        // Performance optimization: Reuse cached analysis
        console.log('✅ Using existing competitor analysis from database (cached)');
        console.log(`   - Competitor: ${competitorAdContext.competitor_name}`);
        console.log(`   - Language: ${competitorAdContext.language || 'not detected'}`);
        console.log(`   - Skipping API call to OpenRouter (saving time & cost)`);

        competitorDescription = competitorAdContext.existing_analysis as Record<string, unknown>;
      } else {
        // No existing analysis or analysis failed/pending - perform fresh analysis
        const statusReason = !competitorAdContext.analysis_status
          ? 'no existing analysis found'
          : `status is ${competitorAdContext.analysis_status}`;

        console.log(`🔄 Performing fresh competitor analysis (${statusReason})...`);
        console.log('📺 Step 1: Analyzing competitor ad...');

        const { analysis, language } = await analyzeCompetitorAdWithLanguage({
          file_url: competitorAdContext.file_url,
          file_type: competitorAdContext.file_type,
          competitor_name: competitorAdContext.competitor_name
        });
        competitorDescription = analysis;

        console.log('✅ Step 1 complete: Fresh competitor analysis ready');

        if (competitorAdContext.id && competitorDescription) {
          const timeline = parseCompetitorTimeline(
            competitorDescription as Record<string, unknown>,
            competitorAdContext.video_duration_seconds
          );
          await supabase
            .from('competitor_ads')
            .update({
              analysis_result: competitorDescription,
              analysis_status: 'completed',
              language: language,
              video_duration_seconds: timeline.videoDurationSeconds
            })
            .eq('id', competitorAdContext.id);
        }
      }
    }

    let competitorTimelineShots: CompetitorShot[] | undefined;
    if (competitorDescription) {
      const parsedTimeline = parseCompetitorTimeline(
        competitorDescription as Record<string, unknown>,
        competitorAdContext?.video_duration_seconds
      );
      competitorTimelineShots = parsedTimeline.shots;

      if (
        parsedTimeline.videoDurationSeconds &&
        (request.resolvedVideoModel === 'veo3' ||
          request.resolvedVideoModel === 'veo3_fast' ||
          request.resolvedVideoModel === 'grok' ||
          request.resolvedVideoModel === 'kling_2_6')
      ) {
        const snappedDuration = snapDurationToModel(request.resolvedVideoModel, parsedTimeline.videoDurationSeconds);
        if (snappedDuration && request.videoDuration !== snappedDuration) {
          console.log(`⏱️ Aligning video duration to competitor timeline (${snappedDuration}s)`);
          request.videoDuration = snappedDuration;
        }
      }
    }

    const totalDurationSeconds = parseInt(request.videoDuration || request.sora2ProDuration || '10', 10);
    const forceSingleSegment = shouldForceSingleSegmentGrok(request.resolvedVideoModel, request.videoDuration);
    const segmentedFlow = forceSingleSegment || isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const segmentCount = segmentedFlow
      ? forceSingleSegment
        ? 1
        : getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel)
      : 1;

    const { error: projectConfigUpdateError } = await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        video_duration: request.videoDuration || request.sora2ProDuration || null,
        is_segmented: segmentedFlow,
        segment_count: segmentedFlow ? segmentCount : 1,
        segment_duration_seconds: segmentedFlow ? getSegmentDurationForModel(request.resolvedVideoModel) : null
      })
      .eq('id', projectId);
    if (projectConfigUpdateError) {
      console.error('⚠️ Failed to sync project video settings with competitor analysis:', projectConfigUpdateError);
    }

    // Step 2: Generate prompts for our product
    console.log(competitorDescription ? '🎯 Step 2: Generating prompts (competitor reference mode)...' : '🎨 Generating prompts (traditional mode)...');
    const prompts = await generateImageBasedPrompts(
      request.imageUrl,
      request.language,
      totalDurationSeconds,
      request.adCopy,
      segmentCount,
      productContext,
      competitorDescription // Pass competitor analysis result (not raw context)
    );

    console.log('🎯 Generated creative prompts:', prompts);

    if (!shotPlanForSegments && segmentedFlow && competitorTimelineShots && competitorTimelineShots.length > 0) {
      if (competitorTimelineShots.length === segmentCount) {
        shotPlanForSegments = competitorTimelineShots;
        console.log(`✅ Using 1:1 shot-to-segment mapping (${segmentCount} shots)`);
      } else {
        console.log(
          `🤖 Competitor has ${competitorTimelineShots.length} shots but user chose ${segmentCount} segments. Compressing timeline to preserve full narrative.`
        );
        shotPlanForSegments = compressCompetitorShotsToSegments(competitorTimelineShots, segmentCount);
      }
    }

    // All workflows are segmented (even single 8s segment)
    console.log('🎬 Segmented workflow enabled - orchestrating multi-segment pipeline');
    await startSegmentedWorkflow(
      projectId,
      request,
      prompts,
      segmentCount,
      competitorDescription,
      shotPlanForSegments,
      brandLogoUrl, // NEW: Pass brand logo URL
      request.imageUrl ? [request.imageUrl] : null, // Provide initial product reference if available
      productContext, // NEW: Pass product context for fallback text generation
      competitorAdContext?.file_type || null
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
    resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
  },
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
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

  let competitorDescription: Record<string, unknown> | undefined;
  let detectedLanguage: LanguageCode = (request.language as LanguageCode) || 'en';

  if (competitorAdContext) {
    if (competitorAdContext.analysis_status === 'completed' && competitorAdContext.existing_analysis) {
      competitorDescription = competitorAdContext.existing_analysis as Record<string, unknown>;
      detectedLanguage = (competitorAdContext.language as LanguageCode | undefined) || detectedLanguage;
    } else {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: competitorAdContext.file_url,
        file_type: competitorAdContext.file_type,
        competitor_name: competitorAdContext.competitor_name
      });
      competitorDescription = analysis;
      detectedLanguage = language;
      const timeline = parseCompetitorTimeline(analysis);

      if (competitorAdContext.id) {
        await supabase
          .from('competitor_ads')
          .update({
            analysis_result: analysis,
            analysis_status: 'completed',
            language,
            video_duration_seconds: timeline.videoDurationSeconds
          })
          .eq('id', competitorAdContext.id);
      }
    }
  }

  const prompt = buildReplicaPrompt({
    competitorDescription,
    productContext,
    language: detectedLanguage,
    additionalRequirements: request.adCopy
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
    .from('competitor_ugc_replication_projects')
    .update(updateData)
    .eq('id', projectId);

  if (updateError) {
    throw updateError;
  }
}

function buildReplicaPrompt({
  competitorDescription,
  productContext,
  language,
  additionalRequirements
}: {
  competitorDescription?: Record<string, unknown>;
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string };
  language?: LanguageCode;
  additionalRequirements?: string;
}): string {
  const brandName = productContext?.brand_name || 'the featured brand';
  const productDetails = truncateText(productContext?.product_details, 800);
  const brandSlogan = truncateText(productContext?.brand_slogan, 200);
  const subject = typeof competitorDescription?.subject === 'string' ? competitorDescription.subject : '';
  const action = typeof competitorDescription?.action === 'string' ? competitorDescription.action : '';
  const ambiance = typeof competitorDescription?.ambiance === 'string' ? competitorDescription.ambiance : '';
  const style = typeof competitorDescription?.style === 'string' ? competitorDescription.style : '';
  const firstFrame = typeof competitorDescription?.first_frame_composition === 'string'
    ? competitorDescription.first_frame_composition
    : '';
  const sceneElements = Array.isArray((competitorDescription as { scene_elements?: Array<{ element: string; position: string; details: string }> })?.scene_elements)
    ? ((competitorDescription as { scene_elements: Array<{ element: string; position: string; details: string }> }).scene_elements)
    : [];
  const MAX_SCENE_ELEMENTS = 12;
  const visibleSceneElements = sceneElements.slice(0, MAX_SCENE_ELEMENTS);
  const hasTrimmedScene = sceneElements.length > MAX_SCENE_ELEMENTS;

  const sceneGuide = visibleSceneElements.length
    ? `${visibleSceneElements.map(el => `- ${el.element} (${el.position}): ${truncateText(el.details, 280)}`).join('\n')}${hasTrimmedScene ? '\n- ... (trimmed additional scene elements)' : ''}`
    : 'Match every visible background object, flooring, wall color, prop, and piece of furniture based on the competitor photo. Keep their placement and proportions identical.';
  const sanitizedAdditionalRequirements = truncateText(additionalRequirements, 800);

  const promptSections = [
    `Replica UGC mode: recreate the competitor scene exactly as analyzed, but swap every branded object with ${brandName}'s products using the provided reference images. Maintain identical framing, pose, lens, lighting, mood, and prop placement.`,
    subject && `Competitor subject focus: ${subject}`,
    action && `Action/motion cues: ${action}`,
    style && `Visual style: ${style}`,
    ambiance && `Ambiance & color palette: ${ambiance}`,
    firstFrame && `Spatial layout (match precisely): ${firstFrame}`,
    'Scene elements to reproduce verbatim:\n' + sceneGuide,
    productDetails && `Brand/Product cues: ${productDetails}`,
    brandSlogan && `Brand tone: ${brandSlogan}`,
    `Use only the supplied ${brandName} assets for replacement props. Preserve the same number of toys, type of flooring, wall textures, and negative space. If people or children are present, keep their poses, clothing vibes, and camera depth identical.`,
    sanitizedAdditionalRequirements && `Additional requirements: ${sanitizedAdditionalRequirements}`,
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
    model: IMAGE_MODELS.nano_banana_pro,
    input: {
      prompt,
      image_urls: referenceImages.slice(0, 10),
      image_input: referenceImages.slice(0, 10),
      aspect_ratio: aspectRatio || '9:16',
      resolution: resolution || '1K',
      output_format: outputFormat || 'png'
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

async function fetchVideoAsBase64(videoUrl: string): Promise<string> {
  try {
    console.log(`[fetchVideoAsBase64] Starting download: ${videoUrl}`);
    const startTime = Date.now();

    // Set timeout for video download (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(videoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const downloadTime = Date.now() - startTime;
    const sizeInMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2);

    console.log(`[fetchVideoAsBase64] Downloaded ${sizeInMB}MB in ${downloadTime}ms`);

    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Detect mime type from URL extension
    let mimeType = 'video/mp4';
    if (videoUrl.endsWith('.webm')) mimeType = 'video/webm';
    else if (videoUrl.endsWith('.mov')) mimeType = 'video/mov';
    else if (videoUrl.endsWith('.mpeg')) mimeType = 'video/mpeg';

    const base64Url = `data:${mimeType};base64,${base64}`;
    const base64SizeInMB = (base64Url.length / (1024 * 1024)).toFixed(2);
    console.log(`[fetchVideoAsBase64] Base64 size: ${base64SizeInMB}MB`);

    return base64Url;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[fetchVideoAsBase64] Download timeout after 60 seconds');
      throw new Error('Video download timeout (60s limit exceeded)');
    }
    console.error('[fetchVideoAsBase64] Error fetching video:', error);
    throw error;
  }
}
/**
 * Analyze a competitor ad with automatic language detection.
 *
 * @param competitorAdContext - Competitor ad metadata including file URL and type
 * @returns Object with { analysis: {...}, language: 'en' }
 */
export async function analyzeCompetitorAdWithLanguage(
  competitorAdContext: { file_url: string; file_type: 'image' | 'video'; competitor_name?: string }
): Promise<{ analysis: Record<string, unknown>; language: LanguageCode }> {
  console.log('[analyzeCompetitorAdWithLanguage] 🔍 Starting competitor analysis with language detection...');
  console.log('[analyzeCompetitorAdWithLanguage] File type:', competitorAdContext.file_type);
  console.log('[analyzeCompetitorAdWithLanguage] File URL:', competitorAdContext.file_url);

  // Process video to base64 if needed (Gemini requirement)
  let processedFileUrl = competitorAdContext.file_url;
  if (competitorAdContext.file_type === 'video') {
    try {
      processedFileUrl = await fetchVideoAsBase64(competitorAdContext.file_url);
      console.log('[analyzeCompetitorAdWithLanguage] Video converted to base64');
    } catch (error) {
      console.error('[analyzeCompetitorAdWithLanguage] Video processing failed:', error);
      throw new Error('Failed to process competitor video');
    }
  }

  // Extended JSON schema with language detection + shot breakdown
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "competitor_analysis_with_language_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A concise, descriptive name for this competitor ad (e.g., 'lovevery-playkits-delivery', 'nike-running-motivation'). Use lowercase with hyphens, keep it under 40 characters, make it searchable and memorable."
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
                start_time: {
                  type: "string",
                  description: "Shot start timestamp formatted as MM:SS"
                },
                end_time: {
                  type: "string",
                  description: "Shot end timestamp formatted as MM:SS"
                },
                duration_seconds: {
                  type: "number",
                  description: "Shot duration in seconds (round to nearest second)"
                },
                first_frame_description: {
                  type: "string",
                  description: "Visual description of the opening frame for this shot"
                },
                subject: {
                  type: "string",
                  description: "People, products, or hero objects featured in the shot"
                },
                context_environment: {
                  type: "string",
                  description: "Location, environment, and background details"
                },
                action: {
                  type: "string",
                  description: "What happens during the shot"
                },
                style: {
                  type: "string",
                  description: "Visual style or mood for the shot"
                },
                camera_motion_positioning: {
                  type: "string",
                  description: "Camera movement and framing specifics for the shot"
                },
                composition: {
                  type: "string",
                  description: "Shot type/framing (close-up, medium, wide, etc.)"
                },
                ambiance_colour_lighting: {
                  type: "string",
                  description: "Lighting scheme, palette, and atmosphere"
                },
                audio: {
                  type: "string",
                  description: "Voiceover, dialogue, SFX, or music cues"
                },
                contains_brand: {
                  type: "boolean",
                  description: "Whether this shot contains brand elements (logo, packaging, brand name, brand signage)"
                },
                contains_product: {
                  type: "boolean",
                  description: "Whether this shot contains physical product(s) that should be replaced with user's product"
                }
              },
              required: [
                "shot_id",
                "start_time",
                "end_time",
                "duration_seconds",
                "first_frame_description",
                "subject",
                "context_environment",
                "action",
                "style",
                "camera_motion_positioning",
                "composition",
                "ambiance_colour_lighting",
                "audio",
                "contains_brand",
                "contains_product"
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
          "name",
          "video_duration_seconds",
          "shots",
          "detected_language"
        ],
        additionalProperties: false
      }
    }
  };

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      response_format: responseFormat,
      messages: [
        {
          role: 'user',
          content: [
            competitorAdContext.file_type === 'video'
              ? {
                  type: 'video_url' as const,
                  video_url: { url: processedFileUrl }
                }
              : {
                  type: 'image_url' as const,
                  image_url: { url: processedFileUrl }
                },
            {
              type: 'text',
              text: `📺 COMPETITOR AD MULTI-SHOT ANALYSIS

You are analyzing a competitor advertisement ${competitorAdContext.file_type === 'video' ? 'video' : 'image'}${competitorAdContext.competitor_name ? ` from "${competitorAdContext.competitor_name}"` : ''}.

TASK: Break down this ad into a structured shot-by-shot timeline with language detection. This is a PURE ANALYSIS - do not consider any other product or make recommendations.

OUTPUT REQUIREMENTS:

1. **name** (广告名称): Generate a concise, descriptive name for this ad
   - Format: lowercase-with-hyphens (e.g., "lovevery-playkits-delivery", "nike-running-motivation")
   - Keep it under 40 characters
   - Make it searchable and memorable
   - Include brand/product keywords if visible

2. **video_duration_seconds** (广告总时长): Return the precise total runtime in seconds
   - Use the video's metadata or calculate from timestamps
   - Round to nearest second

3. **shots** (多镜头拆解): Break down the ad into sequential shots/scenes
   - Each shot represents a distinct visual beat or narrative moment
   - Typical shot duration: 6-11 seconds
   - Cover the ENTIRE runtime with NO gaps

   For EACH shot, provide:
   - \`shot_id\` - Sequential number starting at 1
   - \`start_time\` - Format: MM:SS (e.g., "00:06")
   - \`end_time\` - Format: MM:SS
   - \`duration_seconds\` - Shot duration (round to nearest second)
   - \`first_frame_description\` - Hyper-detailed 3-4 sentence description (minimum 45 words) of the opening frame, covering foreground, midground, background, lighting cues, and focal hierarchy. Mention left/center/right placement, props, wardrobe, and depth cues so another artist could recreate it perfectly.
   - \`subject\` - People, products, or hero objects featured
   - \`context_environment\` - Location, environment, and background details
   - \`action\` - What happens during the shot
   - \`style\` - Visual style or mood
   - \`camera_motion_positioning\` - Camera movement and framing
   - \`composition\` - Shot type/framing (close-up, medium, wide, etc.)
   - \`ambiance_colour_lighting\` - Lighting scheme, palette, and atmosphere
   - \`audio\` - Voiceover, dialogue, SFX, or music cues
   - \`contains_brand\` - Boolean: Does this shot show brand logo, packaging, brand name, or brand signage?
   - \`contains_product\` - Boolean: Does this shot show physical product(s) that would need to be replaced?

   Shot requirements:
   - Timestamps must be strictly increasing (no gaps, no overlaps)
   - Durations must sum to total video duration
   - Be extremely detailed and specific
   - Think like you're creating a storyboard for recreation

   **BRAND/PRODUCT DETECTION RULES:**
   - \`contains_brand: true\` if the shot shows:
     * Brand logo or wordmark
     * Product packaging with brand name
     * Brand signage or storefront
     * Any visual brand identifier
   - \`contains_product: true\` if the shot shows:
     * Physical product(s) that are the focus or subject
     * Product being used, demonstrated, or displayed
     * Product in hand, on table, or in scene
   - Both can be true simultaneously (e.g., branded product packaging)
   - Both can be false (e.g., pure lifestyle/environment shots)

4. **detected_language** (检测语言): Detect the PRIMARY language
   - Check text overlays, subtitles, captions
   - Listen to voiceover, dialogue, or narration
   - Consider cultural and regional context
   - Return ONLY the short code: 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa'
   - Default to "en" if unclear or mostly visual

EXAMPLE OUTPUT STRUCTURE:
{
  "name": "lovevery-playkits-delivery",
  "video_duration_seconds": 47,
  "shots": [
    {
      "shot_id": 1,
      "start_time": "00:00",
      "end_time": "00:06",
      "duration_seconds": 6,
      "first_frame_description": "Exterior of a modern apartment building with a package on the doorstep",
      "subject": "Young woman",
      "context_environment": "Urban street entrance, brick building with glass door",
      "action": "Opens door, picks up package, walks inside",
      "style": "Realism, candid lifestyle",
      "camera_motion_positioning": "Static wide shot",
      "composition": "Full body shot",
      "ambiance_colour_lighting": "Natural daylight, soft shadows",
      "audio": "Upbeat acoustic music starts",
      "contains_brand": true,
      "contains_product": true
    }
  ],
  "detected_language": "en"
}`
            }
          ]
        }
      ]
    })
  });

  let data: unknown;
  let responseText = '';
  try {
    responseText = await response.text();
    data = JSON.parse(responseText);
  } catch (error) {
    console.error('[analyzeCompetitorAdWithLanguage] JSON parse error:', error);
    if (typeof responseText === 'string' && responseText.includes('Request En')) {
      throw new Error(`Failed to parse competitor analysis response: Possible request body too large. OpenRouter returned: ${responseText.substring(0, 100)}...`);
    }
    throw new Error('Failed to parse competitor analysis response');
  }

  const apiResponse = data as { choices?: Array<{ message?: { content?: unknown } }> };
  const rawContent = apiResponse.choices?.[0]?.message?.content;
  const normalizedContent = extractStructuredContent(rawContent);

  if (!normalizedContent) {
    console.error('[analyzeCompetitorAdWithLanguage] Invalid API response structure:', data);
    console.error('[analyzeCompetitorAdWithLanguage] Raw response text preview:', responseText.substring(0, 400));
    throw new Error('Invalid competitor analysis response format');
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(normalizedContent) as Record<string, unknown>;
  } catch (error) {
    console.error('[analyzeCompetitorAdWithLanguage] Failed to parse normalized content:', error);
    console.error('[analyzeCompetitorAdWithLanguage] Normalized content preview:', normalizedContent.substring(0, 400));
    throw new Error('Invalid competitor analysis response format');
  }

  // Extract language and validate it's a valid LanguageCode
  const rawDetectedLanguage = typeof result.detected_language === 'string' ? (result.detected_language as string) : undefined;
  const validLanguageCodes: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'zh', 'ur', 'pa'];
  const language: LanguageCode = rawDetectedLanguage && validLanguageCodes.includes(rawDetectedLanguage as LanguageCode)
    ? (rawDetectedLanguage as LanguageCode)
    : 'en'; // Default to English if invalid
  const analysis = result as Record<string, unknown>;

  console.log('[analyzeCompetitorAdWithLanguage] ✅ Analysis complete');
  console.log('[analyzeCompetitorAdWithLanguage] 🌍 Detected language:', language);

  return { analysis, language };
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
 * If competitorDescription is provided, it will be used as a system prompt
 * to guide the generation in competitor reference mode.
 *
 * @param imageUrl - Our product image
 * @param competitorDescription - Optional competitor analysis from Step 1 (used as system prompt)
 */
async function generateImageBasedPrompts(
  imageUrl: string | undefined,
  language?: string,
  videoDurationSeconds?: number,
  userRequirements?: string,
  segmentCount = 1,
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorDescription?: Record<string, unknown> // Changed: Now receives analysis result, not raw context
): Promise<Record<string, unknown>> {
  console.log(`[generateImageBasedPrompts] Step 2: Generating prompts for our product${competitorDescription ? ' (competitor reference mode)' : ' (traditional mode)'}${!imageUrl ? ' (brand-only mode, no product image)' : ''}`);


  const duration = Number.isFinite(videoDurationSeconds) && videoDurationSeconds ? videoDurationSeconds : 10;
  const perSegmentDuration = Math.max(8, Math.round(duration / Math.max(1, segmentCount)));
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
      description: "Detailed description of the opening frame: scene setup, subject positioning, visual composition, key elements. This describes the exact moment when the segment begins - what viewers see first. REQUIRED: Must be at least 20 characters describing the visual scene."
    },
    is_continuation_from_prev: { type: "boolean", description: "true if this segment continues the same camera setup as the previous segment" },
    shots: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      description: `Timeline beats that cover the entire ${perSegmentDuration}-second segment (each entry is a relative time span)`,
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
- "shots" must contain 2-4 entries that evenly cover the entire ${perSegmentDuration}-second segment runtime. Each shot's "time_range" is RELATIVE to the start of the segment (e.g., "00:00 - 00:02", "00:02 - 00:04"), and the final shot must end at ${formatTimecode(perSegmentDuration)}.


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
            description: `Final storyboard with EXACTLY ${segmentCount} segments`,
            minItems: segmentCount,
            maxItems: segmentCount,
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
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    response_format: responseFormat,
    messages: competitorDescription
      ? // === COMPETITOR REFERENCE MODE (Step 2) ===
        // Use competitor analysis as system prompt
        [
          {
            role: 'system',
            content: `You are an expert advertisement creator. You have been provided with a detailed analysis of a competitor's advertisement.

**COMPETITOR ANALYSIS** (Veo Guide 8 Elements):
${JSON.stringify(competitorDescription, null, 2)}

Your task is to create a similar advertisement for OUR product${imageUrl ? ' (shown in the user\'s image)' : ''} by:
1. CLONING the competitor's creative structure, style, and approach
2. REPLACING the competitor's product with our product
3. MAINTAINING the same narrative flow, visual style, and tone
4. PRESERVING the camera work, composition, and ambiance
5. MATCH EVERY SHOT EXACTLY: number of segments, graphic title cards, text overlays, and the final brand sign-off must appear in the same order as the competitor. Do not drop or rearrange any shots.

**CRITICAL: For "first_frame_description" field:**
- You MUST preserve the competitor's detailed visual descriptions
- ONLY replace product-specific details (product name, brand, packaging) with our product
- DO NOT simplify, shorten, or omit any environmental details, lighting, composition, or scene elements
- Keep the same level of detail and specificity as the competitor's analysis
- Example: If competitor has "A medium shot captures a woman with shoulder-length blonde wavy hair...", you should keep all those details but replace their product with ours

${imageUrl ? 'Remember: The user\'s image is OUR product - adapt the competitor\'s ad to showcase OUR product instead.' : 'Note: No product image provided - use brand context to adapt the competitor\'s ad.'}`
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

Use the competitor analysis provided in the system message to recreate the same storyboard for OUR product. Replace logos, subjects, and props with our brand while keeping framing, movement, pacing, and energy identical.

**CRITICAL REQUIREMENTS:**
- For each segment's "first_frame_description", you MUST preserve the competitor's detailed visual descriptions
- ONLY replace the competitor's product/brand with our product/brand
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Example transformation: "Woman applying Competitor Brand lotion..." → "Woman applying ${productContext?.brand_name || 'our product'} lotion..." (keep all other details unchanged)

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this to ensure accurate product replacement)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Apply without changing the competitor's creative structure)\n` : ''}

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `Recreate the competitor advertisement for our brand using ONLY the information provided in the system message.

**CRITICAL REQUIREMENTS:**
- For each segment's "first_frame_description", you MUST preserve the competitor's detailed visual descriptions
- ONLY replace the competitor's product/brand with our product/brand
- DO NOT simplify or shorten scene descriptions - maintain the same level of detail
- Keep all environmental details, lighting descriptions, composition specifics unchanged

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this context when replacing subjects or props)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Apply without inventing new structure)\n` : ''}

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

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this context sparingly and only when it matches what you see in the photo)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Blend these ideas into the storyboard without inventing off-image assets)\n` : ''}

Focus on real visual cues from the image: product texture, use cases, target audience, and natural environments. Dialogue must describe the product or experience without adding slogans or pricing.

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `🤖 TRADITIONAL AUTO-GENERATION MODE (BRAND-ONLY)

Use ONLY the brand/product context to imagine what the product looks like in the real world, then output a storyboard following the exact competitor-style schema.

${productContext && (productContext.product_details || productContext.brand_name) ? `Brand & Product Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this to inform the visuals you invent)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Blend these ideas directly into the storyboard)\n` : ''}

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

      const response = await fetchWithRetry(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: requestPayload
        },
        3,
        30000
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error('❌ OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Prompt generation failed: ${response.status} - ${responseText}`);
      }

      console.log('✅ OpenRouter API response received:', {
        status: response.status,
        responseLength: responseText.length,
        preview: responseText.substring(0, 200)
      });

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse OpenRouter response as JSON:', parseError);
        console.error('Response text:', responseText.substring(0, 1000));
        throw new Error(`OpenRouter returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
      if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message || !apiResponse.choices[0].message.content) {
        console.error('❌ OpenRouter response missing expected structure:', data);
        throw new Error('OpenRouter response missing choices[0].message.content');
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

        parsed = { segments };

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
  request: StartWorkflowRequest & { imageUrl?: string }, // UPDATED: Optional to support brand-only mode
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorDescription?: Record<string, unknown>, // Competitor analysis
  competitorShots?: CompetitorShot[],
  brandLogoUrl?: string | null, // NEW: Brand logo URL for brand shots
  productImageUrls?: string[] | null, // UPDATED: Multiple product image URLs for product shots
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string }, // NEW: For text fallback
  competitorFileType?: 'video' | 'image' | null
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const defaultFrameSize = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const segmentModelForDuration = request.resolvedVideoModel || (request.videoModel === 'auto' ? undefined : request.videoModel);
  const perSegmentDurationSeconds = getSegmentDurationForModel(segmentModelForDuration);
  const normalizedSegments = normalizeSegmentPrompts(prompts, segmentCount, competitorShots, perSegmentDurationSeconds).map(segment => ({
    ...segment,
    first_frame_image_size: segment.first_frame_image_size || defaultFrameSize
  }));
  const serializedPlan = serializeSegmentPlan(normalizedSegments);
  const storedVideoPrompts = buildStoredVideoPromptsPayload(normalizedSegments, prompts as Record<string, unknown>);
  const now = new Date().toISOString();

  // Clear any previous segment rows for this project to avoid unique key conflicts when restarting workflows
  const { error: cleanupError } = await supabase
    .from('competitor_ugc_replication_segments')
    .delete()
    .eq('project_id', projectId);
  if (cleanupError) {
    console.error('Failed to clean up existing segments before re-initializing:', cleanupError);
    throw new Error('Failed to reset previous segments');
  }

  const segmentRows = normalizedSegments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: 'pending_first_frame',
    prompt: serializeSegmentPrompt(segmentPrompt),
    contains_brand: segmentPrompt.contains_brand === true,
    contains_product: segmentPrompt.contains_product === true
  }));

  const { data: insertedSegments, error } = await supabase
    .from('competitor_ugc_replication_segments')
    .insert(segmentRows)
    .select();

  if (error || !insertedSegments) {
    console.error('Failed to insert segmented rows:', error);
    throw new Error('Failed to initialize segment records');
  }

  const segments = insertedSegments as CompetitorUgcReplicationSegment[];

  await supabase
    .from('competitor_ugc_replication_projects')
    .update({
      video_prompts: storedVideoPrompts,
      segment_plan: serializedPlan,
      current_step: 'generating_segment_frames',
      progress_percentage: 35,
      last_processed_at: now,
      segment_status: buildSegmentStatusPayload(segments)
    })
    .eq('id', projectId);

  for (const segment of segments) {
    const promptData = normalizedSegments[segment.segment_index];
    const aspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
    const shouldWaitForContinuation = Boolean(
      promptData.is_continuation_from_prev && segment.segment_index > 0
    );

    if (shouldWaitForContinuation) {
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: 'awaiting_prev_first_frame',
          updated_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      segment.status = 'awaiting_prev_first_frame';
      continue;
    }

    // Use smart frame generation with automatic routing
    const firstFrameTaskId = await createSmartSegmentFrame(
      promptData,
      segment.segment_index,
      'first',
      aspectRatio,
      brandLogoUrl || null,
      productImageUrls || null,
      productContext,
      competitorFileType || null,
      undefined,
      null
    );

    const { error: updateError } = await supabase
      .from('competitor_ugc_replication_segments')
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

    if (segment.segment_index === normalizedSegments.length - 1) {
      // For non-children products, only the last segment gets a closing frame
      const closingFrameTaskId = await createSmartSegmentFrame(
        promptData,
        segment.segment_index,
        'closing',
        aspectRatio,
        brandLogoUrl || null,
        productImageUrls || null,
        productContext,
        competitorFileType || null,
        undefined,
        null
      );

      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          closing_frame_task_id: closingFrameTaskId,
          updated_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      segment.closing_frame_task_id = closingFrameTaskId;
    }
  }

  await supabase
    .from('competitor_ugc_replication_projects')
    .update({
      segment_status: buildSegmentStatusPayload(segments),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

export function normalizeSegmentPrompts(
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorShots?: CompetitorShot[],
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
    const shot = competitorShots?.[index];
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
      // FIX: Add fallback to competitor shot description if AI returns empty/invalid
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
      contains_brand: typeof source.contains_brand === 'boolean'
        ? source.contains_brand
        : shotOverrides?.contains_brand,
      contains_product: typeof source.contains_product === 'boolean'
        ? source.contains_product
        : shotOverrides?.contains_product,
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
  segmentDurationSeconds?: number,
  containsBrand?: boolean,
  containsProduct?: boolean
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
  hydrated.contains_brand = containsBrand;
  hydrated.contains_product = containsProduct;
  return hydrated;
}

export function hydrateSegmentPlan(
  plan: SerializedSegmentPlan | Record<string, unknown> | null | undefined,
  segmentCount: number,
  segmentDurationSeconds?: number,
  competitorShots?: CompetitorShot[]
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
    competitorShots,
    segmentDurationSeconds
  );
}

function compressCompetitorShotsToSegments(shots: CompetitorShot[], segmentCount: number): CompetitorShot[] {
  if (segmentCount <= 0 || shots.length === 0) {
    return [];
  }

  if (segmentCount === shots.length) {
    return shots;
  }

  const buckets: CompetitorShot[][] = Array.from({ length: segmentCount }, () => []);
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

function mergeShotGroup(shots: CompetitorShot[], segmentIndex: number): CompetitorShot {
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
    startTimeSeconds: first.startTimeSeconds,
    endTimeSeconds: last.endTimeSeconds,
    containsBrand: shots.some(shot => shot.containsBrand),
    containsProduct: shots.some(shot => shot.containsProduct)
  };
}

function resolveFrameDescription(segmentPrompt: SegmentPrompt, frameType: 'first' | 'closing'): string {
  const derived = deriveSegmentDetails(segmentPrompt);
  if (frameType === 'first') {
    return derived.first_frame_prompt || derived.description;
  }
  return derived.ending || derived.description;
}

function buildSegmentOverridesFromShot(shot: CompetitorShot): Partial<SegmentPrompt> {
  return {
    index: shot.id,
    contains_brand: shot.containsBrand,
    contains_product: shot.containsProduct,
    first_frame_description: shot.firstFrameDescription || ''
  };
}

export function buildSegmentPlanFromCompetitorShots(segmentCount: number, competitorShots: CompetitorShot[]): SegmentPrompt[] {
  if (segmentCount <= 0 || competitorShots.length === 0) {
    return [];
  }

  const effectiveShots = segmentCount === competitorShots.length
    ? competitorShots
    : compressCompetitorShotsToSegments(competitorShots, segmentCount);

  const totalDuration = effectiveShots.reduce((sum, shot) => sum + (shot.durationSeconds || DEFAULT_SEGMENT_DURATION_SECONDS), 0);
  const perSegmentDuration = segmentCount > 0 ? Math.max(1, Math.round(totalDuration / segmentCount)) : DEFAULT_SEGMENT_DURATION_SECONDS;

  const placeholderPrompts = {
    segments: Array.from({ length: segmentCount }, (_, index) => ({ index: index + 1 }))
  } as { segments: Array<Partial<SegmentPrompt>> };

  return normalizeSegmentPrompts(placeholderPrompts, segmentCount, effectiveShots, perSegmentDuration);
}

export function buildSegmentStatusPayload(
  segments: CompetitorUgcReplicationSegment[],
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
      errorMessage: (seg as { error_message?: string | null }).error_message || null
    })),
    mergedVideoUrl
  };
}

/**
 * Generate frame from text prompt only (Text-to-Image)
 * Used for shots that don't contain brand or product (pure scene/lifestyle shots)
 */
async function createFrameFromText(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  brandContext?: { brand_name: string; brand_slogan: string; brand_details: string }
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);
  const imageModel = IMAGE_MODELS.nano_banana_pro;

  // Build prompt from shot description + brand context
  const brandInfo = brandContext && brandContext.brand_name
    ? `\n\nBrand Context:\n- Brand: ${brandContext.brand_name}\n- Slogan: ${brandContext.brand_slogan}\n- Details: ${brandContext.brand_details}`
    : '';

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
- Composition: ${frameType === 'first' ? 'Strong opening frame that captures attention' : 'Smooth closing that transitions naturally'}${brandInfo}

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
        resolution: '1K',
        output_format: 'png'
      }
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
 * Used for shots that contain brand logo or product
 */
type FrameGenerationOverrides = {
  imageModelOverride?: 'nano_banana' | 'seedream' | 'nano_banana_pro';
  imageSizeOverride?: string;
  resolutionOverride?: '1K' | '2K' | '4K';
};

async function createFrameFromImage(
  referenceImageUrls: string[],
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  isBrandShot: boolean,
  competitorFileType?: 'video' | 'image' | null,
  overrides?: FrameGenerationOverrides
): Promise<string> {
  const sanitizedReferences = (referenceImageUrls || []).filter(Boolean);
  if (sanitizedReferences.length === 0) {
    throw new Error('No reference images provided for frame generation');
  }
  const limitedReferences = sanitizedReferences.slice(0, 10);

  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);

  let imageModelKey: 'nano_banana' | 'seedream' | 'nano_banana_pro' = overrides?.imageModelOverride || 'nano_banana_pro';
  if (!overrides?.imageModelOverride) {
    console.log('🎨 Forcing nano_banana_pro for all keyframes (docs/kie/nano_banana_pro.md)');
  }
  const imageModel = IMAGE_MODELS[imageModelKey];
  const resolvedAspectRatio = overrides?.imageSizeOverride || aspectRatio;
  const resolvedResolution = overrides?.resolutionOverride || '1K';

  const frameDescription = resolveFrameDescription(segmentPrompt, frameType);

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

${isBrandShot
  ? 'Use the provided brand logo/asset as the canonical reference. Maintain identical brand styling, colors, and visual identity.'
  : 'Use the provided product image as the canonical reference. Maintain identical product proportions, textures, materials, and branding.'}

Scene Focus:
- Description: ${frameDescription}
- Setting: ${derived.setting}
- Camera: ${derived.camera_type} with ${derived.camera_movement}
- Lighting: ${derived.lighting}
- Maintain SCENE, LIGHTING, CAMERA ANGLE, and STYLE from original segment
- Create ${isBrandShot ? 'brand-focused' : 'product-focused'} keyframe that shows authentic use cases

Render Instructions:
- ${frameDescription}
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;

  const inputPayload: Record<string, unknown> = {
    prompt,
    image_urls: limitedReferences,
    image_input: limitedReferences,
    output_format: 'png'
  };

  if (imageModelKey === 'nano_banana_pro') {
    inputPayload.aspect_ratio = resolvedAspectRatio;
    inputPayload.resolution = resolvedResolution || '1K';
  } else {
    inputPayload.image_size = resolvedAspectRatio;
  }

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      input: inputPayload
    })
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
    request.videoAspectRatio === '9:16' ? '9:16' : '16:9',
    false
  );
}

/**
 * Smart segment frame generation with automatic routing
 * Decides between Text-to-Image, Brand Image-to-Image, or Product Image-to-Image
 * based on shot analysis flags (contains_brand, contains_product)
 */
export async function createSmartSegmentFrame(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  brandLogoUrl: string | null,
  productImageUrls: string[] | null,
  brandContext?: { brand_name: string; brand_slogan: string; brand_details: string },
  competitorFileType?: 'video' | 'image' | null,
  overrides?: FrameGenerationOverrides,
  continuationReferenceUrl?: string | null
): Promise<string> {
  // 🎯 COMPETITOR CLONE MODE: Direct text-to-image shortcut
  const isCompetitorCloneMode = competitorFileType === 'video' || competitorFileType === 'image';

  if (isCompetitorCloneMode) {
    console.log(`🎨 Competitor clone mode detected: Using direct text-to-image`);
    console.log(`   - Segment ${segmentIndex + 1} ${frameType} frame`);

    const frameDescription = resolveFrameDescription(segmentPrompt, frameType);
    const imageModel = IMAGE_MODELS.nano_banana_pro;

    // Build image_input from multiple sources
    const imageInput: string[] = [];

    // 1. Continuation reference (for segment continuity)
    const shouldUseContinuation = Boolean(
      continuationReferenceUrl && frameType === 'first' && segmentPrompt.is_continuation_from_prev
    );
    if (shouldUseContinuation && continuationReferenceUrl) {
      imageInput.push(continuationReferenceUrl);
      console.log(`   - 🔗 Continuation mode: Using previous segment's first frame as reference`);
    }

    // 2. Product images (manually selected by user via Product References)
    const normalizedProductImages = Array.isArray(productImageUrls)
      ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
      : [];
    if (normalizedProductImages.length > 0) {
      imageInput.push(...normalizedProductImages);
      console.log(`   - 📦 Product references: Using ${normalizedProductImages.length} product photo(s)`);
    }

    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: imageModel,
        input: {
          prompt: frameDescription,
          ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
          aspect_ratio: aspectRatio,
          resolution: overrides?.resolutionOverride || '1K',
          output_format: 'png'
        }
      })
    }, 5, 30000);

    if (!response.ok) {
      throw new Error(`Competitor clone frame generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate competitor clone frame');
    }

    console.log(`   ✅ Task created: ${data.data.taskId}`);
    return data.data.taskId;
  }

  // 传统模式继续执行现有逻辑
  const containsBrand = segmentPrompt.contains_brand === true;
  const containsProduct = segmentPrompt.contains_product === true;
  const normalizedProductImages = Array.isArray(productImageUrls)
    ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];
  const shouldUseContinuationReference = Boolean(
    continuationReferenceUrl && frameType === 'first' && segmentPrompt.is_continuation_from_prev
  );
  const continuationReferences: string[] = shouldUseContinuationReference && continuationReferenceUrl
    ? [continuationReferenceUrl]
    : [];

  console.log(`🎬 Segment ${segmentIndex + 1} ${frameType} frame generation:`);
  console.log(`   - contains_brand: ${containsBrand}, brandLogoUrl: ${brandLogoUrl ? 'available' : 'missing'}`);
  console.log(`   - contains_product: ${containsProduct}, productImageRefs: ${normalizedProductImages.length}`);
  if (shouldUseContinuationReference) {
    console.log(`   - continuation_from_prev: using previous first frame as reference`);
  }

  const combinedReferenceImages = Array.from(
    new Set([
      ...continuationReferences,
      ...(containsBrand && brandLogoUrl ? [brandLogoUrl] : []),
      ...(containsProduct ? normalizedProductImages : [])
    ])
  );

  // Priority 1: Brand shots use brand logo (if available)
  if (containsBrand && brandLogoUrl) {
    console.log(`   ✅ Using Image-to-Image with brand logo`);
    return createFrameFromImage(
      combinedReferenceImages.length ? combinedReferenceImages : [brandLogoUrl],
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      true, // isBrandShot
      competitorFileType,
      overrides
    );
  }

  // Priority 2: Product shots use product image (if available)
  if (containsProduct && normalizedProductImages.length > 0) {
    console.log(`   ✅ Using Image-to-Image with product image`);
    return createFrameFromImage(
      combinedReferenceImages.length ? combinedReferenceImages : normalizedProductImages,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      false, // isProductShot
      competitorFileType,
      overrides
    );
  }

  // Priority 3: Continuation shots without brand/product references should still reuse previous frame
  if (shouldUseContinuationReference && combinedReferenceImages.length) {
    console.log(`   ✅ Using Image-to-Image with continuation reference`);
    return createFrameFromImage(
      combinedReferenceImages,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      false,
      competitorFileType,
      overrides
    );
  }

  // Priority 4: Fallback to Text-to-Image for pure scene shots
  // OR when brand/product is flagged but no image available
  if (!containsBrand && !containsProduct) {
    console.log(`   ✅ Using Text-to-Image (pure scene shot)`);
  } else if (containsBrand && !brandLogoUrl) {
    console.warn(`   ⚠️  Brand shot detected but no logo available, falling back to Text-to-Image`);
  } else if (containsProduct && normalizedProductImages.length === 0) {
    console.warn(`   ⚠️  Product shot detected but no product image available, falling back to Text-to-Image`);
  }

  return createFrameFromText(
    segmentPrompt,
    segmentIndex,
    frameType,
    aspectRatio,
    brandContext
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
  const videoModel = (project.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'grok' | 'kling_2_6';

  const supportedSegmentModels: Array<'veo3' | 'veo3_fast' | 'grok' | 'kling_2_6'> = ['veo3', 'veo3_fast', 'grok', 'kling_2_6'];
  if (!supportedSegmentModels.includes(videoModel)) {
    throw new Error(`Segmented workflow only supports Veo3, Grok, or Kling (see docs/kie/kling_2.6.md). Received ${videoModel}`);
  }

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const languageCode = (project.language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode);
  const prompts = (project.video_prompts || {}) as { ad_copy?: string };
  const providedAdCopyRaw = typeof prompts.ad_copy === 'string' ? prompts.ad_copy.trim() : undefined;
  const providedAdCopy = providedAdCopyRaw && providedAdCopyRaw.length > 0 ? providedAdCopyRaw : undefined;
  const action = cleanSegmentText(segmentPrompt.action) || '';
  const dialogueContent = providedAdCopy || segmentPrompt.dialogue || '';
  const music = cleanSegmentText(segmentPrompt.audio) || '';

  const voiceDescriptor = 'Calm professional narrator';
  const voiceToneDescriptor = 'warm and confident';

  const projectVideoModel = (project.video_model ?? null) as VideoModel | null;
  const perSegmentDuration = project.segment_duration_seconds || getSegmentDurationForModel(projectVideoModel);
  const normalizedShots = (segmentPrompt.shots && segmentPrompt.shots.length > 0
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

  const structuredPromptPayload = {
    is_continuation_from_prev: Boolean(segmentPrompt.is_continuation_from_prev && segmentIndex > 0),
    first_frame_description: segmentPrompt.first_frame_description,
    narrator: {
      descriptor: voiceDescriptor,
      tone: voiceToneDescriptor
    },
    dialogue_language: languageName,
    shots: normalizedShots
  };
  const fullPrompt = JSON.stringify(structuredPromptPayload);

  // Determine imageUrls based on whether a closing frame exists
  // generationType remains 'FIRST_AND_LAST_FRAMES_2_VIDEO' but with 1 or 2 images
  const hasClosingFrame = !!closingFrameUrl && closingFrameUrl !== firstFrameUrl;
  const imageUrls = hasClosingFrame ? [firstFrameUrl, closingFrameUrl] : [firstFrameUrl];

  console.log(`🎬 Segment ${segmentIndex + 1}: Images count = ${imageUrls.length} ${hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  if (videoModel === 'grok') {
    const grokRequest = {
      model: 'grok-imagine/image-to-video',
      input: {
        image_urls: [firstFrameUrl],
        prompt: fullPrompt,
        mode: 'normal'
      }
    };

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(grokRequest)
    }, 5, 30000);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to generate Grok segment video: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate Grok segment video');
    }

    return data.data.taskId;
  }

  if (videoModel === 'kling_2_6') {
    const klingDurationSeconds = Math.min(80, Math.max(5, Math.round(perSegmentDuration / 5) * 5));
    const klingPromptText = [
      segmentPrompt.first_frame_description ? `First frame: ${segmentPrompt.first_frame_description}` : null,
      action ? `Action: ${action}` : null,
      segmentPrompt.subject ? `Subject: ${segmentPrompt.subject}` : null,
      segmentPrompt.style ? `Style: ${segmentPrompt.style}` : null,
      segmentPrompt.context_environment ? `Environment: ${segmentPrompt.context_environment}` : null,
      segmentPrompt.ambiance_colour_lighting ? `Lighting: ${segmentPrompt.ambiance_colour_lighting}` : null,
      dialogueContent ? `Dialogue/Narration: ${dialogueContent}` : null
    ]
      .filter(Boolean)
      .join('\n');

    console.log(`🎥 Kling 2.6 segment request (docs/kie/kling_2.6.md) – duration ${klingDurationSeconds}s block`);

    const klingRequest = {
      model: 'kling-2.6/image-to-video',
      input: {
        prompt: klingPromptText || `Segment ${segmentIndex + 1} commercial beat`,
        image_urls: [firstFrameUrl],
        sound: true,
        duration: String(klingDurationSeconds)
      }
    };

    const klingResponse = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(klingRequest)
    }, 5, 30000);

    if (!klingResponse.ok) {
      const errorData = await klingResponse.text();
      throw new Error(`Failed to generate Kling segment video: ${klingResponse.status} ${errorData}`);
    }

    const klingData = await klingResponse.json();
    if (klingData.code !== 200) {
      throw new Error(klingData.msg || 'Failed to generate Kling segment video');
    }

    return klingData.data.taskId;
  }

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
    enableTranslation: false
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
