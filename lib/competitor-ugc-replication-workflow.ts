import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  getActualImageModel,
  IMAGE_MODELS,
  GENERATION_COSTS,
  getGenerationCost,
  getSegmentCountFromDuration,
  getSegmentDurationForModel,
  getReplicaPhotoCredits,
  DEFAULT_SEGMENT_DURATION_SECONDS,
  KLING_MAX_TASK_DURATION_SECONDS,
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  snapDurationToModel,
  MAX_BASE64_VIDEO_SIZE_BYTES,
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
import { SYSTEM_AVATARS } from '@/lib/default-avatars';

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
const FRAME_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/competitor-ugc-replication/webhooks/frame`;
const VIDEO_WEBHOOK_URL = `${WEBHOOK_BASE_URL}/api/competitor-ugc-replication/webhooks/video`;

export interface StartWorkflowRequest {
  imageUrl?: string;
  competitorAdId?: string; // NEW: Competitor ad reference for creative direction
  creatorSourceVideoId?: string; // Asset video reference
  userId: string;
  videoModel: VideoModel;
  imageModel?: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro';
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
  videoQuality?: 'standard' | 'high';
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
  resolvedVideoModel?: VideoModel;
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

  // CRITICAL FIX: When a competitor shot is provided, use ONLY that shot
  // Do NOT process rawShots which may contain all competitor shots from the full timeline
  // This prevents data duplication and JSON Schema overflow
  if (competitorShot) {
    console.log(`🔧 [NORMALIZATION] Using single competitor shot (ID: ${competitorShot.id}), ignoring rawShots array to prevent duplication`);
    return [convertCompetitorShotToSegmentShot(1, defaultLanguage, competitorShot, duration)];
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
  shot: CompetitorShot;
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

function normalizeKlingTimelineShots(shots: CompetitorShot[], targetTotalSeconds: number): PlannedKlingShotPart[] {
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
  shots: CompetitorShot[],
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
        style: part.shot.style || '',
        action: part.shot.action || '',
        subject: part.shot.subject || '',
        dialogue: '',
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
      dialogue: '',
      language: defaultLanguage,
      index: segmentIndex + 1,
      first_frame_image_size: undefined,
      is_continuation_from_prev: segmentIndex > 0,
      shots
    };
  });
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
    const brandLogoUrl: string | null = null;
    const productContext = { product_name: '', brand_name: '' };

    if (!request.competitorAdId && !request.creatorSourceVideoId) {
      return {
        success: false,
        error: 'Competitor reference required',
        details: 'Select a competitor video or photo to clone before generating.'
      };
    }

    // imageUrl is now optional when using competitor reference mode
    // It will be used if available, otherwise Text-to-Image will be used

    // Load competitor ad if provided (optional reference for creative direction)
    // Note: Competitor ads now store only analysis data (no video files)
    // Extended type to include existing analysis and language for performance optimization
  let competitorAdContext: {
    id?: string;
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  } | undefined;

    if (request.competitorAdId) {
      console.log(`🎯 Loading competitor ad: ${request.competitorAdId}`);
      const fetchCompetitor = async () => {
        const { data: competitorAd, error: competitorError} = await supabase
          .from('competitor_ads')
          .select('competitor_name, analysis_result, analysis_status, language, video_duration_seconds')
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
          competitor_name: competitorAd.competitor_name,
          existing_analysis: competitorAd.analysis_result,
          analysis_status: competitorAd.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
          language: competitorAd.language,
          video_duration_seconds: competitorAd.video_duration_seconds
        };
        console.log(`✅ Competitor ad loaded: ${competitorAdContext.competitor_name}`);
        console.log(`📊 Analysis status: ${competitorAdContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!competitorAdContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${competitorAdContext.language || 'none'}`);
      } catch (competitorError) {
        console.warn(`⚠️ Competitor ad not found or access denied: ${request.competitorAdId}`, competitorError);
        // Don't fail the workflow if competitor ad is not found, just proceed without it
      }
    }

    if (!competitorAdContext && request.creatorSourceVideoId) {
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
        competitorAdContext = {
          id: request.creatorSourceVideoId,
          competitor_name: referenceVideo.description || 'Reference video',
          existing_analysis: referenceVideo.analysis_result,
          analysis_status: referenceVideo.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
          language: referenceVideo.analysis_language,
          video_duration_seconds: referenceVideo.duration_seconds
        };
        console.log(`✅ Reference video analysis loaded`);
        console.log(`📊 Analysis status: ${competitorAdContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!competitorAdContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${competitorAdContext.language || 'none'}`);
      } catch (referenceError) {
        console.warn(`⚠️ Reference video not found or access denied: ${request.creatorSourceVideoId}`, referenceError);
      }
    }

    // Use the selected video model directly
    const actualVideoModel: VideoModel = request.videoModel;
    const referenceDurationSeconds = Number(competitorAdContext?.video_duration_seconds || 0);
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
    let competitorShotTimeline: { shots: CompetitorShot[]; totalDurationSeconds: number } | null = null;
    let plannedKlingSegments: PlannedKlingSegment[] | null = null;

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
        if (!request.videoDuration) {
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

    const segmentedByDuration = actualVideoModel === 'kling_3'
      ? true
      : isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const isSegmented = segmentedByDuration;

    // NEW: Smart segment count calculation
    // Priority 1: If competitor shots exist and match user's segment count → use 1:1 mapping
    // Priority 2: Use user's chosen duration
    console.log(`🎯 [SEGMENT DEBUG] Calculating segment count:`);
    console.log(`   - Video model: ${actualVideoModel}`);
    console.log(`   - Video duration: ${request.videoDuration}`);
    console.log(`   - Is segmented: ${isSegmented}`);

    let segmentCount: number;
    const competitorShotCount = competitorShotTimeline?.shots.length || 0;
    const userSegmentCount = segmentedByDuration
      ? getSegmentCountFromDuration(request.videoDuration, actualVideoModel)
      : 1;

    console.log(`   - Competitor shot count: ${competitorShotCount}`);
    console.log(`   - User segment count (from duration): ${userSegmentCount}`);

    if (actualVideoModel === 'kling_3') {
      const klingTargetDuration = Number(request.videoDuration || competitorShotTimeline?.totalDurationSeconds || 8);
      plannedKlingSegments = planKlingSegmentsFromShots(
        competitorShotTimeline?.shots || [],
        klingTargetDuration
      );
      segmentCount = plannedKlingSegments.length;
      console.log(`✅ Kling 3.0 shot-aware segmentation planned: ${segmentCount} segments`);
    } else if (competitorShotCount > 0 && userSegmentCount === competitorShotCount) {
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
    const resolvedSegmentDuration = resolvePerSegmentDurationSeconds(
      actualVideoModel,
      request.videoDuration,
      segmentCount
    );
    const hasSegmentFlow = segmentCount >= 1;

    // Precompute shot-to-segment mapping asap so we can persist plans even if prompt generation fails later
    let shotPlanForSegments: CompetitorShot[] | undefined;
    let precomputedSegmentPlan: SegmentPrompt[] | undefined;
    if (actualVideoModel === 'kling_3' && plannedKlingSegments?.length) {
      precomputedSegmentPlan = buildSegmentPlanFromKlingSegments(
        plannedKlingSegments,
        request.language || competitorAdContext?.language || 'en'
      );
      console.log(`📐 Prepared Kling segment plan (${plannedKlingSegments.length} segments)`);
    } else if (segmentCount > 0 && competitorShotTimeline?.shots.length) {
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
    const duration = request.videoDuration;
    const quality = request.videoQuality || 'standard';

    console.log(`💳 [CREDITS DEBUG] Calculating generation cost:`, {
      model: actualVideoModel,
      duration,
      quality,
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

      console.log(`💳 [CREDITS DEBUG] Generation cost calculated:`, {
        model: actualVideoModel,
        duration,
        units: actualVideoModel === 'kling_3'
          ? `${Math.ceil(Number(duration || '0') || 0)}s`
          : `${Math.ceil(Number(duration || '0') / 8)} segments`,
        unitCost: GENERATION_COSTS[actualVideoModel],
        totalCost: generationCost
      });

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

    // Create project record in competitor_ugc_replication_projects table
    const { data: project, error: insertError} = await supabase
      .from('competitor_ugc_replication_projects')
      .insert({
        user_id: request.userId,
        selected_brand_id: null,
        competitor_ad_id: request.competitorAdId || null, // NEW: Competitor ad reference
        video_model: actualVideoModel,
        video_aspect_ratio: request.videoAspectRatio || '16:9',
        status: 'processing',
        current_step: request.useCustomScript
          ? 'ready_for_video'
          : hasSegmentFlow
            ? 'generating_segment_frames'
            : 'generating_cover',
        progress_percentage: request.useCustomScript ? 50 : hasSegmentFlow ? 25 : 20,
        credits_cost: generationCost, // Only generation cost (download cost charged separately)
        language: request.language || 'en', // Language for AI-generated content
        // Generic video fields
        video_duration: duration || '8',
        video_quality: quality || 'standard',
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

    console.log(`✅ [CREDITS DEBUG] Project created with credits info:`, {
      projectId: project.id,
      videoDuration: duration,
      segmentCount,
      creditsDeducted: generationCost,
      savedInDB: project.credits_cost
    });

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

    // CRITICAL FIX: Must await workflow completion before returning
    // Vercel terminates serverless functions immediately after API response
    // Fire-and-forget IIFE would be killed before generateImageBasedPrompts executes
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
          brandLogoUrl, // Optional logo reference if available
          shotPlanForSegments
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
    imageUrl?: string; // Optional when no product image is provided
    resolvedVideoModel: VideoModel;
  },
  productContext?: { product_name?: string; brand_name?: string },
  competitorAdContext?: {
    id?: string;
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  },
  brandLogoUrl?: string | null, // Optional logo reference if available
  initialShotPlan?: CompetitorShot[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let shotPlanForSegments = initialShotPlan;

  try {
    // Image-driven workflow with AI creative generation
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
        // No existing analysis - competitor ads no longer store files
        const statusReason = !competitorAdContext.analysis_status
          ? 'no existing analysis found'
          : `status is ${competitorAdContext.analysis_status}`;

        console.error(`❌ Cannot perform fresh analysis (${statusReason}): Files are no longer stored`);
        throw new Error(
          'Competitor ad analysis not found. ' +
          'Competitor ads no longer store original files, so analysis must be completed before use. ' +
          'Please ensure the competitor ad has been analyzed via create-with-analysis endpoint.'
        );
      }
    }

    const referenceDurationSeconds = Number(competitorAdContext?.video_duration_seconds || 0);
    if (
      request.resolvedVideoModel === 'kling_3' &&
      Number.isFinite(referenceDurationSeconds) &&
      referenceDurationSeconds > KLING_MAX_PROJECT_DURATION_SECONDS
    ) {
      throw new Error('Kling 3.0 clone supports reference videos up to 60 seconds.');
    }

    let competitorTimelineShots: CompetitorShot[] | undefined;
    let plannedKlingSegments: PlannedKlingSegment[] | null = null;
    if (competitorDescription) {
      const parsedTimeline = parseCompetitorTimeline(
        competitorDescription as Record<string, unknown>,
        competitorAdContext?.video_duration_seconds
      );
      competitorTimelineShots = parsedTimeline.shots;
      if (request.resolvedVideoModel === 'kling_3') {
        const klingTargetDuration = Number(request.videoDuration || parsedTimeline.videoDurationSeconds || 8);
        plannedKlingSegments = planKlingSegmentsFromShots(parsedTimeline.shots, klingTargetDuration);
      }

      if (
        parsedTimeline.videoDurationSeconds &&
        (request.resolvedVideoModel === 'veo3' ||
          request.resolvedVideoModel === 'veo3_fast' ||
          request.resolvedVideoModel === 'kling_3')
      ) {
        const snappedDuration = snapDurationToModel(request.resolvedVideoModel, parsedTimeline.videoDurationSeconds);
        if (snappedDuration && request.videoDuration !== snappedDuration) {
          console.log(`⏱️ Aligning video duration to competitor timeline (${snappedDuration}s)`);
          request.videoDuration = snappedDuration;
        }
      }
    }

    if (request.resolvedVideoModel === 'kling_3' && !plannedKlingSegments) {
      plannedKlingSegments = planKlingSegmentsFromShots([], Number(request.videoDuration || 8));
    }

    const totalDurationSeconds = parseInt(request.videoDuration || '8', 10);
    const segmentedFlow = request.resolvedVideoModel === 'kling_3'
      ? true
      : isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const segmentCount = request.resolvedVideoModel === 'kling_3'
      ? (plannedKlingSegments?.length || 1)
      : (segmentedFlow
        ? getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel)
        : 1);
    const resolvedSegmentDurationSeconds = resolvePerSegmentDurationSeconds(
      request.resolvedVideoModel,
      request.videoDuration,
      segmentCount
    );

    // BUG FIX: Do NOT update is_segmented here, as it was already set correctly during project creation
    // Updating it here can cause data inconsistency if videoDuration was modified (line 1046)
    // between initial creation and this update, leading to is_segmented=false but having segment records
    const { error: projectConfigUpdateError } = await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        video_duration: request.videoDuration || null,
        // is_segmented: segmentedFlow, // REMOVED: Do not overwrite is_segmented
        segment_count: segmentedFlow ? segmentCount : 1,
        segment_duration_seconds: resolvedSegmentDurationSeconds
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
      segmentCount,
      request.resolvedVideoModel,
      productContext,
      competitorDescription // Pass competitor analysis result (not raw context)
    );

    console.log('🎯 Generated creative prompts:', prompts);

    if (request.resolvedVideoModel !== 'kling_3' && !shotPlanForSegments && segmentedFlow && competitorTimelineShots && competitorTimelineShots.length > 0) {
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
      request.resolvedVideoModel === 'kling_3'
        ? undefined
        : shotPlanForSegments,
      plannedKlingSegments,
      brandLogoUrl, // NEW: Pass brand logo URL
      request.imageUrl ? [request.imageUrl] : null, // Provide initial product reference if available
      productContext, // NEW: Pass product context for fallback text generation
      competitorAdContext ? 'video' : null // Competitor ads are now video-only
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
  productContext?: { product_name?: string; brand_name?: string },
  competitorAdContext?: {
    id?: string;
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
      // Competitor ads no longer store files, so analysis must exist
      // If analysis doesn't exist, the user must upload and analyze first
      throw new Error(
        'Competitor ad analysis not found. ' +
        'Competitor ads no longer store original files, so analysis must be completed before use. ' +
        'Please upload and analyze the competitor ad first via create-with-analysis endpoint.'
      );
    }
  }

  const prompt = buildReplicaPrompt({
    competitorDescription,
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
  language
}: {
  competitorDescription?: Record<string, unknown>;
  productContext?: { product_name?: string; brand_name?: string };
  language?: LanguageCode;
}): string {
  // Validate brand name - fallback to generic if too short or invalid
  const rawBrandName = productContext?.brand_name || '';
  const brandName = rawBrandName.trim().length >= 3
    ? rawBrandName
    : 'the featured product';

  if (rawBrandName && rawBrandName.trim().length < 3) {
    console.warn(`⚠️  Invalid brand name "${rawBrandName}" detected, using fallback: "${brandName}"`);
  }

  const productName = truncateText(productContext?.product_name, 120);
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

  const promptSections = [
    `Replica UGC mode: recreate the competitor scene exactly as analyzed, but swap every branded object with ${brandName}'s products using the provided reference images. Maintain identical framing, pose, lens, lighting, mood, and prop placement.`,
    subject && `Competitor subject focus: ${subject}`,
    action && `Action/motion cues: ${action}`,
    style && `Visual style: ${style}`,
    ambiance && `Ambiance & color palette: ${ambiance}`,
    firstFrame && `Spatial layout (match precisely): ${firstFrame}`,
    'Scene elements to reproduce verbatim:\n' + sceneGuide,
    productName && `Product name: ${productName}`,
    `Use only the supplied ${brandName} assets for replacement props. Preserve the same number of toys, type of flooring, wall textures, and negative space. If people or children are present, keep their poses, clothing vibes, and camera depth identical.`,
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
      image_input: referenceImages.slice(0, 8),
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
 * @param competitorAdContext - Competitor ad metadata including file URL (video only)
 * @returns Object with { analysis: {...}, language: 'en' }
 */
export async function analyzeCompetitorAdWithLanguage(
  competitorAdContext: { file_url: string; competitor_name?: string },
  options?: { model?: string }
): Promise<{ analysis: Record<string, unknown>; language: LanguageCode }> {
  console.log('[analyzeCompetitorAdWithLanguage] 🔍 Starting competitor analysis with language detection...');
  console.log('[analyzeCompetitorAdWithLanguage] File type: video (video-only mode)');
  console.log('[analyzeCompetitorAdWithLanguage] File URL:', competitorAdContext.file_url);

  let processedFileUrl: string;

  try {
    processedFileUrl = await fetchVideoAsBase64(competitorAdContext.file_url);
    console.log('[analyzeCompetitorAdWithLanguage] Video converted to base64');

    const base64SizeInMB = processedFileUrl.length / (1024 * 1024);
    const maxBase64SizeMB = MAX_BASE64_VIDEO_SIZE_BYTES / (1024 * 1024);

    if (base64SizeInMB > maxBase64SizeMB) {
      console.error(`[analyzeCompetitorAdWithLanguage] Base64 size too large: ${base64SizeInMB.toFixed(2)}MB (max: ${maxBase64SizeMB}MB)`);
      throw new Error(
        `Video file too large for AI analysis (${base64SizeInMB.toFixed(1)} MB after encoding). ` +
        `Please trim or compress your video and try again.`
      );
    }
  } catch (error) {
    console.error('[analyzeCompetitorAdWithLanguage] Video processing failed:', error);
    if (error instanceof Error && error.message.includes('too large')) {
      throw error;
    }
    throw new Error('Failed to process competitor video');
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
      model: options?.model || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      response_format: responseFormat,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'video_url' as const,
              video_url: { url: processedFileUrl }
            },
            {
              type: 'text',
              text: `📺 COMPETITOR AD MULTI-SHOT ANALYSIS

You are analyzing a competitor advertisement video${competitorAdContext.competitor_name ? ` from "${competitorAdContext.competitor_name}"` : ''}.

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
      "audio": "Upbeat acoustic music starts"
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
  const validLanguageCodes: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'zh', 'ur', 'pa', 'id'];
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
  segmentCount = 1,
  videoModel?: VideoModel,
  productContext?: { product_name?: string; brand_name?: string },
  competitorDescription?: Record<string, unknown> // Changed: Now receives analysis result, not raw context
): Promise<Record<string, unknown>> {
  console.log(`[generateImageBasedPrompts] Step 2: Generating prompts for our product${competitorDescription ? ' (competitor reference mode)' : ' (traditional mode)'}${!imageUrl ? ' (no product image provided)' : ''}`);


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
- "shots" must contain ${minShotsPerSegment}-4 entries that evenly cover the entire ${perSegmentDuration}-second segment runtime. Each shot's "time_range" is RELATIVE to the start of the segment (e.g., "00:00 - 00:02", "00:02 - 00:04"), and the final shot must end at ${formatTimecode(perSegmentDuration)}.


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

${productContext && (productContext.product_name || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_name ? `Product Name: ${productContext.product_name}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}(Use this to ensure accurate product replacement)\n` : ''}

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

${productContext && (productContext.product_name || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_name ? `Product Name: ${productContext.product_name}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}(Use this context when replacing subjects or props)\n` : ''}

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

${productContext && (productContext.product_name || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_name ? `Product Name: ${productContext.product_name}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}(Use this context sparingly and only when it matches what you see in the photo)\n` : ''}

Focus on real visual cues from the image: product texture, use cases, target audience, and natural environments. Dialogue must describe the product or experience without adding slogans or pricing.

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `🤖 TRADITIONAL AUTO-GENERATION MODE (BRAND-ONLY)

Use ONLY the brand/product context to imagine what the product looks like in the real world, then output a storyboard following the exact competitor-style schema.

${productContext && (productContext.product_name || productContext.brand_name) ? `Brand & Product Context:\n${productContext.product_name ? `Product Name: ${productContext.product_name}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}(Use this to inform the visuals you invent)\n` : ''}

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
        10,     // Increased from 3 to 10 retries (match analyzeCompetitorAdWithLanguage)
        120000  // Increased from 30s to 120s timeout for complex prompts (production has higher latency)
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
  request: StartWorkflowRequest & { imageUrl?: string }, // Optional when no product image is provided
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorDescription?: Record<string, unknown>, // Competitor analysis
  competitorShots?: CompetitorShot[],
  klingPlannedSegments?: PlannedKlingSegment[] | null,
  brandLogoUrl?: string | null, // NEW: Brand logo URL for brand shots
  productImageUrls?: string[] | null, // UPDATED: Multiple product image URLs for product shots
  productContext?: { product_name?: string; brand_name?: string }, // NEW: For text fallback
  competitorFileType?: 'video' | null // Competitor ads are now video-only (null means no competitor)
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
  const normalizedSegments = (klingSegments || normalizeSegmentPrompts(prompts, segmentCount, competitorShots, perSegmentDurationSeconds)).map(segment => ({
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

  // Schema verified via Supabase MCP (2026-01-29): competitor_ugc_replication_segments columns include
  // project_id, segment_index, status, prompt.
  const segmentRows = normalizedSegments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: 'pending_first_frame',
    prompt: serializeSegmentPrompt(segmentPrompt)
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

function buildSegmentOverridesFromShot(shot: CompetitorShot): Partial<SegmentPrompt> {
  return {
    index: shot.id,
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
  brandContext?: { brand_name?: string }
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);
  const imageModel = IMAGE_MODELS.nano_banana_pro;

  // Build prompt from shot description + brand context
  const brandInfo = brandContext && brandContext.brand_name
    ? `\n\nBrand Context:\n- Brand: ${brandContext.brand_name}`
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
 * Used when reference images are available (brand, product, character, or continuation)
 */
type FrameGenerationOverrides = {
  imageModelOverride?: 'nano_banana' | 'seedream' | 'nano_banana_pro';
  imageSizeOverride?: string;
  resolutionOverride?: '1K' | '2K' | '4K';
  characterPhotoUrls?: string[] | null;
};

async function createFrameFromImage(
  referenceImageUrls: string[],
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  isBrandShot: boolean,
  competitorFileType?: 'video' | null, // Competitor ads are video-only (indicates competitor clone mode)
  overrides?: FrameGenerationOverrides
): Promise<string> {
  const sanitizedReferences = (referenceImageUrls || []).filter(Boolean);
  if (sanitizedReferences.length === 0) {
    throw new Error('No reference images provided for frame generation');
  }
  const limitedReferences = sanitizedReferences.slice(0, 8);

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
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;

  const inputPayload: Record<string, unknown> = {
    prompt,
    image_input: limitedReferences,
    output_format: 'png'
  };

  if (imageModelKey === 'nano_banana_pro') {
    inputPayload.aspect_ratio = resolvedAspectRatio;
    inputPayload.resolution = resolvedResolution || '1K';
  } else {
    inputPayload.image_size = resolvedAspectRatio;
  }

  console.log(`📤 [createFrameFromImage] Sending to KIE API:`, {
    imageModel,
    referenceImageCount: limitedReferences.length,
    referenceImageUrls: limitedReferences,
    isBrandShot
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
    request.videoAspectRatio === '9:16' ? '9:16' : '16:9',
    false
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
  brandLogoUrl: string | null,
  productImageUrls: string[] | null,
  brandContext?: { brand_name?: string },
  competitorFileType?: 'video' | null, // Competitor ads are video-only (indicates competitor clone mode)
  overrides?: FrameGenerationOverrides,
  continuationReferenceUrl?: string | null
): Promise<string> {
  // 🎯 COMPETITOR CLONE MODE: Direct text-to-image shortcut
  const isCompetitorCloneMode = competitorFileType === 'video';

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

    console.log(`   - Prompt: ${frameDescription.substring(0, 100)}...`);
    console.log(`   - 📤 Sending to KIE API - image_input count: ${imageInput.length}`);
    console.log(`   - 📤 image_input URLs:`, imageInput);

    const requestPayload = {
      model: imageModel,
      input: {
        prompt: frameDescription,
        ...(imageInput.length > 0 ? { image_input: imageInput } : {}),
        aspect_ratio: aspectRatio,
        resolution: overrides?.resolutionOverride || '1K',
        output_format: 'png'
      },
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
      throw new Error(`Competitor clone frame generation failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate competitor clone frame');
    }

    console.log(`   ✅ Task created: ${data.data.taskId}`);
    return data.data.taskId;
  }

  // 传统模式继续执行现有逻辑（不再依赖 contains_brand / contains_product）
  const normalizedProductImages = Array.isArray(productImageUrls)
    ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];
  const hasProductImages = normalizedProductImages.length > 0;
  const hasBrandLogo = Boolean(brandLogoUrl);
  const isBrandShot = !hasProductImages && hasBrandLogo;

  const shouldUseContinuationReference = Boolean(
    continuationReferenceUrl && frameType === 'first' && segmentPrompt.is_continuation_from_prev
  );
  const continuationReferences: string[] = shouldUseContinuationReference && continuationReferenceUrl
    ? [continuationReferenceUrl]
    : [];

  const characterPhotos = Array.isArray(overrides?.characterPhotoUrls)
    ? overrides.characterPhotoUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];
  const hasCharacterPhotos = characterPhotos.length > 0;

  console.log(`🎬 Segment ${segmentIndex + 1} ${frameType} frame generation:`);
  console.log(`   - brandLogoUrl: ${hasBrandLogo ? 'available' : 'missing'}`);
  console.log(`   - productImageRefs: ${normalizedProductImages.length}`);
  console.log(`   - character references: ${hasCharacterPhotos ? `${characterPhotos.length} photo(s)` : 'none'}`);
  if (shouldUseContinuationReference) {
    console.log(`   - continuation_from_prev: using previous first frame as reference`);
  }

  const combinedReferenceImages = Array.from(
    new Set([
      ...continuationReferences,
      ...(hasCharacterPhotos ? characterPhotos : []),
      ...(hasBrandLogo ? [brandLogoUrl as string] : []),
      ...normalizedProductImages
    ])
  );

  if (combinedReferenceImages.length > 0) {
    console.log(`   ✅ Using Image-to-Image with ${combinedReferenceImages.length} reference(s)`);
    return createFrameFromImage(
      combinedReferenceImages,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      isBrandShot,
      competitorFileType,
      overrides
    );
  }

  console.log(`   ✅ Using Text-to-Image (no references available)`);
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
  const videoModel = (project.video_model || 'veo3_fast') as VideoModel;

  const supportedSegmentModels: VideoModel[] = ['veo3', 'veo3_fast', 'seedance_1_5_pro', 'kling_3'];
  if (!supportedSegmentModels.includes(videoModel)) {
    throw new Error(`Segmented workflow only supports Veo3, Seedance 1.5 Pro, or Kling 3.0. Received ${videoModel}`);
  }

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const languageCode = (project.language || 'en') as LanguageCode;
  const prompts = (project.video_prompts || {}) as { ad_copy?: string };
  const providedAdCopyRaw = typeof prompts.ad_copy === 'string' ? prompts.ad_copy.trim() : undefined;
  const providedAdCopy = providedAdCopyRaw && providedAdCopyRaw.length > 0 ? providedAdCopyRaw : undefined;
  const action = cleanSegmentText(segmentPrompt.action) || '';
  const dialogueContent = providedAdCopy || segmentPrompt.dialogue || '';
  const music = cleanSegmentText(segmentPrompt.audio) || '';
  const perSegmentDuration = resolveTaskDurationSeconds(project, videoModel, segmentIndex, totalSegments);
  const normalizedShots = buildNormalizedShots(
    segmentPrompt,
    perSegmentDuration,
    languageCode,
    action,
    dialogueContent,
    music
  );

  if (videoModel === 'seedance_1_5_pro') {
    return await startSegmentVideoTaskSeedance(
      project,
      segmentPrompt,
      firstFrameUrl,
      closingFrameUrl,
      segmentIndex,
      totalSegments
    );
  }

  if (videoModel === 'kling_3') {
    return await startSegmentVideoTaskKling(
      project,
      segmentPrompt,
      normalizedShots,
      firstFrameUrl,
      closingFrameUrl,
      segmentIndex,
      totalSegments,
      perSegmentDuration
    );
  }

  const voiceDescriptor = 'Calm professional narrator';
  const voiceToneDescriptor = 'warm and confident';
  const structuredPromptPayload = {
    is_continuation_from_prev: Boolean(segmentPrompt.is_continuation_from_prev && segmentIndex > 0),
    first_frame_description: segmentPrompt.first_frame_description,
    narrator: {
      descriptor: voiceDescriptor,
      tone: voiceToneDescriptor
    },
    shots: normalizedShots
  };

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
    callBackUrl: VIDEO_WEBHOOK_URL
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

type KlingMentionType = 'character' | 'product';

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

const MENTION_REGEX = /@(?<type>character|product)\((?<name>[^)]*)\)/g;
const KLING_SHOT_MIN_DURATION_SECONDS = 1;
const KLING_SHOT_MAX_DURATION_SECONDS = 12;

function resolveTaskDurationSeconds(
  project: SingleVideoProject,
  model: VideoModel,
  segmentIndex: number,
  totalSegments: number
): number {
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
      const type = match.groups?.type as KlingMentionType | undefined;
      const name = (match.groups?.name || '').trim();
      if (!type || !name) continue;
      const key = `${type}:${name.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, { type, name, key });
      }
    }
  });
  return Array.from(map.values());
}

function slugifyElementName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'asset';
}

function buildShortStableToken(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).slice(0, 4).padEnd(4, '0');
}

function buildKlingElementName(rawName: string, mentionKey: string, usedNames: Set<string>): string {
  const MAX_LEN = 20;
  const stableToken = buildShortStableToken(mentionKey.toLowerCase());
  const slug = slugifyElementName(rawName).replace(/^element_+/, '') || 'asset';
  const suffix = `_${stableToken}`;
  const headLen = Math.max(1, MAX_LEN - suffix.length);
  let candidate = `${slug.slice(0, headLen)}${suffix}`;

  if (!usedNames.has(candidate)) {
    return candidate;
  }

  for (let i = 2; i < 200; i++) {
    const dedupeSuffix = `_${i.toString(36)}`;
    const baseLen = Math.max(1, MAX_LEN - dedupeSuffix.length);
    candidate = `${candidate.slice(0, baseLen)}${dedupeSuffix}`;
    if (!usedNames.has(candidate)) {
      return candidate;
    }
  }

  return candidate.slice(0, MAX_LEN);
}

function optimizeKlingPromptText(text: string): string {
  if (!text) return text;
  return text
    .split('\n')
    .map(line =>
      line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\.{2,}/g, '.')
        .trim()
    )
    .filter((line, index, arr) => !(line === '' && arr[index - 1] === ''))
    .join('\n')
    .trim();
}

function replacePromptMentions(text: string, tokenMap: Record<string, string>): string {
  if (!text) return text;
  return text.replace(MENTION_REGEX, (_, type: string, name: string) => {
    const key = `${type}:${String(name || '').trim().toLowerCase()}`;
    const mapped = tokenMap[key];
    // If mention cannot be mapped to kling_elements, degrade to plain text
    // to avoid Kling failing on unresolved @element references.
    return mapped ? `@${mapped}` : String(name || '').trim();
  });
}

function collectElementKeysFromText(text: string, tokenMap: Record<string, string>): string[] {
  if (!text) return [];
  const tags: string[] = [];
  for (const match of text.matchAll(MENTION_REGEX)) {
    const type = match.groups?.type;
    const name = (match.groups?.name || '').trim().toLowerCase();
    if (!type || !name) continue;
    const mapped = tokenMap[`${type}:${name}`];
    if (mapped) {
      tags.push(`@${mapped}`);
    }
  }
  return tags;
}

function collectElementTagsFromTexts(texts: string[], tokenMap: Record<string, string>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const text of texts) {
    const tags = collectElementKeysFromText(text, tokenMap);
    for (const tag of tags) {
      if (!seen.has(tag)) {
        seen.add(tag);
        ordered.push(tag);
      }
    }
  }
  return ordered;
}

function appendTrailingElementTags(basePrompt: string, tags: string[], maxChars = 2500): string {
  if (!tags.length) {
    return truncateText(optimizeKlingPromptText(basePrompt), maxChars);
  }

  const trailing = tags.join(' ');
  const optimizedBasePrompt = optimizeKlingPromptText(basePrompt);
  if (optimizedBasePrompt.length + 1 + trailing.length <= maxChars) {
    return `${optimizedBasePrompt}\n${trailing}`;
  }

  const allowedBaseLen = Math.max(0, maxChars - 1 - trailing.length);
  const trimmedBase = truncateText(optimizedBasePrompt, allowedBaseLen);
  if (trimmedBase.length + 1 + trailing.length <= maxChars) {
    return `${trimmedBase}\n${trailing}`;
  }

  const allowedTrailingLen = Math.max(0, maxChars - 1 - trimmedBase.length);
  return `${trimmedBase}\n${trailing.slice(0, allowedTrailingLen)}`.trim();
}

async function buildKlingElementsFromMentions(
  userId: string,
  mentions: KlingMention[]
): Promise<{ elements: KlingElement[]; tokenMap: Record<string, string>; skippedMentions: KlingMention[] }> {
  if (!mentions.length) {
    return { elements: [], tokenMap: {}, skippedMentions: [] };
  }

  const mentionNames = Array.from(new Set(mentions.map(mention => mention.name.toLowerCase())));
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
    mentionNames.includes((product.product_name || '').toLowerCase())
  );
  const userAvatars = (avatarResult.data || []).filter(avatar =>
    mentionNames.includes((avatar.avatar_name || '').toLowerCase())
  );
  const systemAvatars = SYSTEM_AVATARS.filter(avatar =>
    mentionNames.includes((avatar.avatar_name || '').toLowerCase())
  );
  const avatars = [...systemAvatars, ...userAvatars];

  const productsByName = new Map(
    products.map(product => [(product.product_name || '').toLowerCase(), product])
  );
  const avatarsByName = new Map(
    avatars.map(avatar => [(avatar.avatar_name || '').toLowerCase(), avatar])
  );

  const collectAvatarUrls = (avatar: Record<string, unknown> | undefined): string[] => {
    if (!avatar) return [];

    const urls: string[] = [];
    const pushIfString = (value: unknown) => {
      if (typeof value === 'string' && value.trim()) {
        urls.push(value.trim());
      }
    };

    pushIfString(avatar.photo_url);
    const referencePhotos = Array.isArray(avatar.reference_photos)
      ? avatar.reference_photos
      : [];
    referencePhotos.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        pushIfString((entry as Record<string, unknown>).photo_url);
      }
    });

    const photoSet = avatar.photo_set_json && typeof avatar.photo_set_json === 'object'
      ? (avatar.photo_set_json as Record<string, unknown>)
      : null;

    if (photoSet) {
      const primary = photoSet.primary && typeof photoSet.primary === 'object'
        ? (photoSet.primary as Record<string, unknown>)
        : null;
      if (primary) {
        pushIfString(primary.photo_url);
      }

      const setReferences = Array.isArray(photoSet.references)
        ? photoSet.references
        : [];
      setReferences.forEach((entry) => {
        if (entry && typeof entry === 'object') {
          pushIfString((entry as Record<string, unknown>).photo_url);
        }
      });
    }

    // Kling image element requires 2-4 images
    return Array.from(new Set(urls)).slice(0, 4);
  };

  const tokenMap: Record<string, string> = {};
  const elements: KlingElement[] = [];
  const usedElementNames = new Set<string>();
  const skippedMentions: KlingMention[] = [];

  mentions.forEach((mention) => {
    const product = mention.type === 'product' ? productsByName.get(mention.name.toLowerCase()) : undefined;
    const avatar = mention.type === 'character' ? avatarsByName.get(mention.name.toLowerCase()) : undefined;

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

    const elementName = buildKlingElementName(mention.name, mention.key, usedElementNames);
    usedElementNames.add(elementName);
    tokenMap[mention.key] = elementName;

    elements.push({
      name: elementName,
      description:
        mention.type === 'product'
          ? (product?.product_name || mention.name)
          : (avatar?.avatar_name || mention.name),
      element_input_urls: urls
    });
  });

  return { elements, tokenMap, skippedMentions };
}

function buildKlingShotPrompt(
  segmentPrompt: SegmentPrompt,
  shot: NormalizedVideoShot,
  shotIndex: number,
  tokenMap: Record<string, string>,
  replaceMention: (text: string) => string
): string {
  const shotParts: string[] = [];
  if (shot.action) shotParts.push(shot.action);
  if (shot.subject) shotParts.push(`Subject: ${shot.subject}`);
  if (shot.dialogue) shotParts.push(`Dialogue: ${shot.dialogue}`);
  if (shot.style) shotParts.push(`Style: ${shot.style}`);
  if (shot.composition) shotParts.push(`Composition: ${shot.composition}`);
  if (shot.context_environment) shotParts.push(`Environment: ${shot.context_environment}`);
  if (shot.ambiance_colour_lighting) shotParts.push(`Lighting: ${shot.ambiance_colour_lighting}`);
  if (shot.camera_motion_positioning) shotParts.push(`Camera: ${shot.camera_motion_positioning}`);
  if (shot.audio) shotParts.push(`Audio: ${shot.audio}`);

  const headerParts: string[] = [];
  if (shot.time_range) {
    headerParts.push(`Time range: ${shot.time_range}`);
  }
  if (shotIndex === 0 && segmentPrompt.first_frame_description) {
    headerParts.push(`Opening frame: ${segmentPrompt.first_frame_description}`);
  }

  const merged = [
    `Shot ${shotIndex + 1}`,
    ...headerParts,
    shotParts.join('. ')
  ]
    .filter(Boolean)
    .join('\n');
  const trailingTags = collectElementTagsFromTexts([
    shot.action,
    shot.subject,
    shot.dialogue,
    shot.context_environment,
    shot.composition,
    shot.style,
    shot.ambiance_colour_lighting,
    shot.camera_motion_positioning,
    shot.audio,
    shotIndex === 0 ? segmentPrompt.first_frame_description : ''
  ].filter(Boolean) as string[], tokenMap);
  return appendTrailingElementTags(replaceMention(merged), trailingTags, 2500);
}

function buildKlingSinglePrompt(
  segmentPrompt: SegmentPrompt,
  shot: NormalizedVideoShot,
  tokenMap: Record<string, string>,
  replaceMention: (text: string) => string
): string {
  const parts: string[] = [];
  if (segmentPrompt.first_frame_description) {
    parts.push(`Opening frame: ${segmentPrompt.first_frame_description}`);
  }
  if (shot.subject) parts.push(`Subject: ${shot.subject}`);
  if (shot.action) parts.push(`Action: ${shot.action}`);
  if (shot.dialogue) parts.push(`Dialogue: ${shot.dialogue}`);
  if (shot.style) parts.push(`Style: ${shot.style}`);
  if (shot.context_environment) parts.push(`Environment: ${shot.context_environment}`);
  if (shot.composition) parts.push(`Composition: ${shot.composition}`);
  if (shot.ambiance_colour_lighting) parts.push(`Lighting: ${shot.ambiance_colour_lighting}`);
  if (shot.camera_motion_positioning) parts.push(`Camera: ${shot.camera_motion_positioning}`);
  if (shot.audio) parts.push(`Audio: ${shot.audio}`);
  const trailingTags = collectElementTagsFromTexts([
    segmentPrompt.first_frame_description,
    shot.subject,
    shot.action,
    shot.dialogue,
    shot.context_environment,
    shot.composition,
    shot.style,
    shot.ambiance_colour_lighting,
    shot.camera_motion_positioning,
    shot.audio
  ].filter(Boolean) as string[], tokenMap);
  return appendTrailingElementTags(replaceMention(parts.join('\n')), trailingTags, 2500);
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

function buildKlingMultiPrompt(
  segmentPrompt: SegmentPrompt,
  normalizedShots: NormalizedVideoShot[],
  tokenMap: Record<string, string>,
  replaceMention: (text: string) => string,
  totalDuration: number
): Array<{ prompt: string; duration: number }> {
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
  const desiredShotCount = Math.max(minShotCount, Math.min(totalDuration, sourceShots.length));
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

  const shotDurations = allocateKlingShotDurations(totalDuration, desiredShotCount);
  return mergedShots.map((shot, index) => ({
    prompt: buildKlingShotPrompt(segmentPrompt, shot, index, tokenMap, replaceMention),
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
    segmentPrompt.first_frame_description,
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
  const { elements, tokenMap, skippedMentions } = await buildKlingElementsFromMentions(project.user_id, mentions);
  const replaceMention = (text: string) => replacePromptMentions(text, tokenMap);
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
    ? buildKlingMultiPrompt(segmentPrompt, normalizedShots, tokenMap, replaceMention, boundedDuration)
    : [];
  const singlePrompt = hasMultipleShots
    ? ''
    : buildKlingSinglePrompt(segmentPrompt, primaryShot, tokenMap, replaceMention);
  const hasClosingFrame = Boolean(closingFrameUrl && closingFrameUrl !== firstFrameUrl);
  const imageUrls = hasMultipleShots
    ? [firstFrameUrl]
    : (hasClosingFrame ? [firstFrameUrl, closingFrameUrl as string] : [firstFrameUrl]);

  const requestBody: Record<string, unknown> = {
    model: 'kling-3.0/video',
    callBackUrl: VIDEO_WEBHOOK_URL,
    input: {
      mode: 'pro',
      image_urls: imageUrls,
      sound: true,
      duration: String(boundedDuration),
      aspect_ratio: project.video_aspect_ratio === '9:16' ? '9:16' : '16:9',
      multi_shots: hasMultipleShots
    }
  };

  if (hasMultipleShots) {
    (requestBody.input as Record<string, unknown>).multi_prompt = multiPrompt;
  } else {
    (requestBody.input as Record<string, unknown>).prompt = singlePrompt;
  }

  if (elements.length > 0) {
    (requestBody.input as Record<string, unknown>).kling_elements = elements;
  }

  console.log(`🎬 Kling Segment ${segmentIndex + 1}/${totalSegments}:`, {
    mode: 'pro',
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
    trailingTagCounts: hasMultipleShots
      ? multiPrompt.map(item => (item.prompt.match(/@element_[a-z0-9_]+/g) || []).length)
      : [(singlePrompt.match(/@element_[a-z0-9_]+/g) || []).length]
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

/**
 * Start video generation task using Seedance 1.5 Pro API
 * Uses generic jobs/createTask endpoint (same as frame generation)
 * Documentation: docs/kie/seedance1.5pro.md
 */
async function startSegmentVideoTaskSeedance(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number
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
    'seedance_1_5_pro',
    segmentIndex,
    totalSegments
  );

  console.log(`🎬 Seedance Segment ${segmentIndex + 1}/${totalSegments}: Images count = ${inputUrls.length} ${hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

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
    model: 'bytedance/seedance-1.5-pro',
    input: {
      prompt: promptText,
      input_urls: inputUrls,
      aspect_ratio: aspectRatio, // '16:9' or '9:16'
      resolution: '1080p', // Fixed 1080p as default for Seedance
      duration: String(segmentDuration),
      fixed_lens: false, // Allow dynamic camera movement
      generate_audio: true // Enable audio generation
    },
    callBackUrl: VIDEO_WEBHOOK_URL
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
    throw new Error(`Seedance API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Seedance API failed: ${result.msg || 'Unknown error'}`);
  }

  console.log(`✅ Seedance task created: ${result.data.taskId} for segment ${segmentIndex + 1}`);
  return result.data.taskId;
}
