import {
  type PersistedVideoQuality,
  getSegmentVideoGenerationCost,
  type VideoModel
} from '@/lib/constants';

export type SegmentShotTimingLike = {
  duration_seconds?: number | null;
  time_range?: string | null;
};

function normalizePositiveInteger(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.max(1, Math.round(value));
}

export function parseTimecodeToSeconds(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parts = value
    .trim()
    .split(':')
    .map((part) => Number(part.trim()));

  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

export function getTimeRangeDurationSeconds(value?: string | null): number | null {
  if (!value || !value.includes('-')) {
    return null;
  }

  const [rawStart, rawEnd] = value.split('-', 2);
  const startSeconds = parseTimecodeToSeconds(rawStart);
  const endSeconds = parseTimecodeToSeconds(rawEnd);

  if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
    return null;
  }

  return normalizePositiveInteger(endSeconds - startSeconds);
}

export function getEffectiveSegmentDurationSeconds(
  shots?: Array<SegmentShotTimingLike> | null,
  fallbackDurationSeconds: number = 0
): number {
  const normalizedFallback = normalizePositiveInteger(fallbackDurationSeconds) || 0;
  const normalizedShots = Array.isArray(shots) ? shots : [];

  const explicitDurationTotal = normalizedShots.reduce((sum, shot) => {
    const duration = normalizePositiveInteger(Number(shot?.duration_seconds));
    return duration ? sum + duration : sum;
  }, 0);

  if (explicitDurationTotal > 0) {
    return explicitDurationTotal;
  }

  const timeRangeTotal = normalizedShots.reduce((sum, shot) => {
    const duration = getTimeRangeDurationSeconds(shot?.time_range);
    return duration ? sum + duration : sum;
  }, 0);

  if (timeRangeTotal > 0) {
    return timeRangeTotal;
  }

  return normalizedFallback;
}

export function getSegmentPromptVideoGenerationCost(
  model: VideoModel,
  shots?: Array<SegmentShotTimingLike> | null,
  fallbackDurationSeconds?: number,
  videoQuality?: PersistedVideoQuality
): number {
  const segmentDurationSeconds = getEffectiveSegmentDurationSeconds(shots, fallbackDurationSeconds);
  return getSegmentVideoGenerationCost(model, segmentDurationSeconds, videoQuality);
}
