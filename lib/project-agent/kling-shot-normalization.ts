import {
  KLING_PROMPT_MAX_CHARS,
  optimizeKlingPromptText,
  truncateKlingField,
  estimateKlingPromptUsage,
} from '@/lib/kling-prompt-budget';
import { KLING_MAX_MULTI_SHOT_ITEMS } from '@/lib/kling-shot-limits';
import {
  formatTimelineRange,
  normalizeTimelineRanges,
  parseTimelineRange,
} from '@/lib/segment-shot-timeline';
import {
  buildProjectAgentLegacyAudioField,
  serializeProjectAgentCloneShot,
  type ProjectAgentCloneShot,
} from '@/lib/project-agent/clone-prompt-schema';

const FIELD_TRIM_ORDER = [
  'ambient',
  'sfx',
  'ambiance_colour_lighting',
  'style',
  'camera_motion_positioning',
  'composition',
  'context_environment',
  'dialogue',
  'subject',
  'action',
] as const;

type TrimField = typeof FIELD_TRIM_ORDER[number];

type ShotBucket = ProjectAgentCloneShot & {
  durationSeconds: number;
};

const FIELD_MIN_CHARS: Record<TrimField, number> = {
  ambient: 12,
  sfx: 12,
  ambiance_colour_lighting: 12,
  style: 12,
  camera_motion_positioning: 12,
  composition: 12,
  context_environment: 12,
  dialogue: 24,
  subject: 24,
  action: 32,
};

function buildShotBuckets(
  shots: Array<Partial<ProjectAgentCloneShot> | undefined>,
  fallbackLanguage: string
): ShotBucket[] {
  const normalizedShots = (shots.length > 0 ? shots : [undefined]).map((shot, index) => (
    serializeProjectAgentCloneShot(shot, index, fallbackLanguage)
  ));
  const parsedTotalDuration = normalizedShots.reduce((sum, shot) => {
    const range = parseTimelineRange(shot.time_range);
    return sum + Math.max(0, (range?.endSec ?? 0) - (range?.startSec ?? 0));
  }, 0);
  const timeline = normalizeTimelineRanges(
    normalizedShots.map((shot) => ({ id: shot.id, time_range: shot.time_range })),
    Math.max(1, parsedTotalDuration, normalizedShots.length * 2)
  );

  return normalizedShots.map((shot, index) => {
    const range = timeline[index];
    const durationSeconds = Math.max(1, (range?.endSec || 1) - (range?.startSec || 0));
    return {
      ...shot,
      durationSeconds,
    };
  });
}

function rebuildContiguousTimeRanges(buckets: ShotBucket[]): ShotBucket[] {
  let cursor = 0;

  return buckets.map((bucket, index) => {
    const startSec = cursor;
    const endSec = cursor + Math.max(1, Math.round(bucket.durationSeconds));
    cursor = endSec;

    return {
      ...bucket,
      id: index + 1,
      time_range: formatTimelineRange(startSec, endSec),
      audio: buildProjectAgentLegacyAudioField(bucket),
    };
  });
}

function measureShotPromptLength(shot: ProjectAgentCloneShot): number {
  return estimateKlingPromptUsage({
    shot: {
      subject: shot.subject,
      action: shot.action,
      dialogue: shot.dialogue,
      context_environment: shot.context_environment,
      composition: shot.composition,
      camera_motion_positioning: shot.camera_motion_positioning,
      style: shot.style,
      ambiance_colour_lighting: shot.ambiance_colour_lighting,
      audio: buildProjectAgentLegacyAudioField(shot),
    },
  }).originalLength;
}

function trimShotFieldValue(currentValue: string, field: TrimField, overflow: number): string {
  const normalized = optimizeKlingPromptText(currentValue);
  const minChars = FIELD_MIN_CHARS[field];
  if (normalized.length <= minChars) {
    return normalized;
  }

  const reduction = Math.max(8, overflow + 8, Math.ceil(normalized.length * 0.18));
  const targetChars = Math.max(minChars, normalized.length - reduction);
  return truncateKlingField(normalized, targetChars);
}

function fitShotToKlingPromptLimit(shot: ProjectAgentCloneShot): ProjectAgentCloneShot {
  let nextShot = {
    ...shot,
    subject: optimizeKlingPromptText(shot.subject),
    action: optimizeKlingPromptText(shot.action),
    dialogue: optimizeKlingPromptText(shot.dialogue),
    context_environment: optimizeKlingPromptText(shot.context_environment),
    composition: optimizeKlingPromptText(shot.composition),
    camera_motion_positioning: optimizeKlingPromptText(shot.camera_motion_positioning),
    style: optimizeKlingPromptText(shot.style),
    ambiance_colour_lighting: optimizeKlingPromptText(shot.ambiance_colour_lighting),
    sfx: optimizeKlingPromptText(shot.sfx),
    ambient: optimizeKlingPromptText(shot.ambient),
  };

  for (let attempts = 0; attempts < 36; attempts += 1) {
    const originalLength = measureShotPromptLength(nextShot);
    if (originalLength <= KLING_PROMPT_MAX_CHARS) {
      return {
        ...nextShot,
        audio: buildProjectAgentLegacyAudioField(nextShot),
      };
    }

    const overflow = originalLength - KLING_PROMPT_MAX_CHARS;
    let changed = false;

    for (const field of FIELD_TRIM_ORDER) {
      const currentValue = nextShot[field];
      const trimmedValue = trimShotFieldValue(currentValue, field, overflow);
      if (trimmedValue !== currentValue) {
        nextShot = {
          ...nextShot,
          [field]: trimmedValue,
        };
        changed = true;
        break;
      }
    }

    if (!changed) {
      break;
    }
  }

  for (const field of FIELD_TRIM_ORDER) {
    const originalLength = measureShotPromptLength(nextShot);
    if (originalLength <= KLING_PROMPT_MAX_CHARS) {
      break;
    }
    if (!nextShot[field]) {
      continue;
    }
    nextShot = {
      ...nextShot,
      [field]: '',
    };
  }

  return {
    ...nextShot,
    audio: buildProjectAgentLegacyAudioField(nextShot),
  };
}

export function normalizeProjectAgentKlingShots(
  shots: Array<Partial<ProjectAgentCloneShot> | undefined>,
  fallbackLanguage: string
): ProjectAgentCloneShot[] {
  const shotBuckets = buildShotBuckets(shots, fallbackLanguage);
  const timedBuckets = rebuildContiguousTimeRanges(shotBuckets);

  return timedBuckets.map((bucket, index) => serializeProjectAgentCloneShot({
    ...bucket,
    id: index + 1,
    time_range: bucket.time_range,
    audio: buildProjectAgentLegacyAudioField(bucket),
  }, index, fallbackLanguage));
}

export function normalizeProjectAgentKlingShotsForProvider(
  shots: Array<Partial<ProjectAgentCloneShot> | undefined>,
  fallbackLanguage: string
): ProjectAgentCloneShot[] {
  return normalizeProjectAgentKlingShots(shots, fallbackLanguage).map((shot) => (
    fitShotToKlingPromptLimit(shot)
  ));
}

export function validateProjectAgentKlingShots(
  shots: Array<Partial<ProjectAgentCloneShot> | undefined>,
  fallbackLanguage: string
): ProjectAgentCloneShot[] {
  const rawCount = Array.isArray(shots) ? shots.length : 0;
  if (rawCount > KLING_MAX_MULTI_SHOT_ITEMS) {
    throw new Error(`Scenes support at most ${KLING_MAX_MULTI_SHOT_ITEMS} shots per generation.`);
  }
  return normalizeProjectAgentKlingShots(shots, fallbackLanguage);
}

export function validateProjectAgentKlingShotsForProvider(
  shots: Array<Partial<ProjectAgentCloneShot> | undefined>,
  fallbackLanguage: string
): ProjectAgentCloneShot[] {
  const rawCount = Array.isArray(shots) ? shots.length : 0;
  if (rawCount > KLING_MAX_MULTI_SHOT_ITEMS) {
    throw new Error(`Scenes support at most ${KLING_MAX_MULTI_SHOT_ITEMS} shots per generation.`);
  }
  return normalizeProjectAgentKlingShotsForProvider(shots, fallbackLanguage);
}
