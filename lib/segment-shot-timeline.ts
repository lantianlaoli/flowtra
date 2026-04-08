import { KLING_MAX_TASK_DURATION_SECONDS, KLING_MIN_TASK_DURATION_SECONDS } from '@/lib/constants';

export type TimelineShotLike = {
  id: number;
  time_range?: string | null;
};

export type TimelineRange = {
  id: number;
  startSec: number;
  endSec: number;
};

export const DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS = KLING_MAX_TASK_DURATION_SECONDS;
export const DEFAULT_MIN_SHOT_DURATION_SECONDS = 1;
export const FIRST_SHOT_MIN_DURATION_SECONDS = KLING_MIN_TASK_DURATION_SECONDS;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatSecondsToTimecode(value: number): string {
  const safeValue = Math.max(0, Math.round(value));
  const hours = Math.floor(safeValue / 3600);
  const minutes = Math.floor((safeValue % 3600) / 60);
  const seconds = safeValue % 60;

  if (hours > 0) {
    return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  }

  return [minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

export function formatTimelineRange(startSec: number, endSec: number): string {
  return `${formatSecondsToTimecode(startSec)} - ${formatSecondsToTimecode(endSec)}`;
}

export function parseTimelineRange(value?: string | null): TimelineRange | null {
  if (!value || !value.includes('-')) {
    return null;
  }

  const [rawStart, rawEnd] = value.split('-', 2).map((item) => item.trim());
  const startSec = parseTimecode(rawStart);
  const endSec = parseTimecode(rawEnd);

  if (startSec === null || endSec === null || endSec <= startSec) {
    return null;
  }

  return {
    id: 0,
    startSec,
    endSec,
  };
}

function parseTimecode(value?: string | null): number | null {
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
    return (parts[0] * 60) + parts[1];
  }

  return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
}

function distributeDurations(count: number, totalDuration: number): number[] {
  const safeCount = Math.max(1, count);
  const safeTotalDuration = Math.max(safeCount, Math.round(totalDuration));
  const baseDuration = Math.floor(safeTotalDuration / safeCount);
  const remainder = safeTotalDuration % safeCount;

  return Array.from({ length: safeCount }, (_, index) => baseDuration + (index < remainder ? 1 : 0));
}

export function normalizeTimelineRanges(
  shots: TimelineShotLike[],
  fallbackDurationSeconds: number = DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
): TimelineRange[] {
  if (!Array.isArray(shots) || shots.length === 0) {
    return [];
  }

  const parsedDurations = shots.map((shot) => {
    const parsedRange = parseTimelineRange(shot.time_range);
    if (!parsedRange) {
      return null;
    }
    return Math.max(DEFAULT_MIN_SHOT_DURATION_SECONDS, Math.round(parsedRange.endSec - parsedRange.startSec));
  });

  const validDurations = parsedDurations.filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
  const durationPlan = validDurations.length === shots.length
    ? validDurations
    : distributeDurations(shots.length, fallbackDurationSeconds);

  let cursor = 0;
  const ranges = shots.map((shot, index) => {
    const nextDuration = durationPlan[index] || DEFAULT_MIN_SHOT_DURATION_SECONDS;
    const startSec = cursor;
    const endSec = cursor + nextDuration;
    cursor = endSec;
    return {
      id: shot.id,
      startSec,
      endSec,
    };
  });

  // Ensure last shot doesn't exceed fallbackDurationSeconds
  if (ranges.length > 0) {
    const lastIndex = ranges.length - 1;
    const lastRange = ranges[lastIndex];
    if (lastRange && lastRange.endSec > fallbackDurationSeconds) {
      const overflow = lastRange.endSec - fallbackDurationSeconds;
      // Clamp last shot's end to fallbackDurationSeconds
      lastRange.endSec = fallbackDurationSeconds;
      // Adjust start if needed to maintain minimum duration
      const minDuration = DEFAULT_MIN_SHOT_DURATION_SECONDS;
      if (lastRange.endSec - lastRange.startSec < minDuration) {
        lastRange.startSec = Math.max(0, lastRange.endSec - minDuration);
      }
      // Propagate adjustment backward to ensure no gaps and maintain boundaries
      for (let i = lastIndex - 1; i >= 0; i--) {
        const current = ranges[i];
        const next = ranges[i + 1];
        if (current && next && current.endSec > next.startSec) {
          current.endSec = next.startSec;
          // Ensure minimum duration
          if (current.endSec - current.startSec < minDuration) {
            current.startSec = Math.max(0, current.endSec - minDuration);
          }
        }
      }
    }
  }

  return ranges;
}

export function updateTimelineBoundary(
  ranges: TimelineRange[],
  boundaryIndex: number,
  nextBoundarySec: number,
  minShotDurationSeconds: number = DEFAULT_MIN_SHOT_DURATION_SECONDS,
): TimelineRange[] {
  if (boundaryIndex <= 0 || boundaryIndex >= ranges.length) {
    return ranges;
  }

  const leftRange = ranges[boundaryIndex - 1];
  const rightRange = ranges[boundaryIndex];
  if (!leftRange || !rightRange) {
    return ranges;
  }

  const leftMinimumDuration = boundaryIndex === 1
    ? Math.max(minShotDurationSeconds, FIRST_SHOT_MIN_DURATION_SECONDS)
    : minShotDurationSeconds;
  const minBoundary = leftRange.startSec + leftMinimumDuration;
  const maxBoundary = rightRange.endSec - minShotDurationSeconds;
  const resolvedBoundary = clamp(Math.round(nextBoundarySec), minBoundary, maxBoundary);

  return ranges.map((range, index) => {
    if (index === boundaryIndex - 1) {
      return { ...range, endSec: resolvedBoundary };
    }

    if (index === boundaryIndex) {
      return { ...range, startSec: resolvedBoundary };
    }

    return range;
  });
}

export function updateTimelineEnd(
  ranges: TimelineRange[],
  nextEndSec: number,
  minShotDurationSeconds: number = DEFAULT_MIN_SHOT_DURATION_SECONDS,
  maxDurationSeconds: number = DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
): TimelineRange[] {
  if (ranges.length === 0) {
    return ranges;
  }

  const lastIndex = ranges.length - 1;
  const lastRange = ranges[lastIndex];
  if (!lastRange) {
    return ranges;
  }

  const lastMinimumDuration = lastIndex === 0
    ? Math.max(minShotDurationSeconds, FIRST_SHOT_MIN_DURATION_SECONDS)
    : minShotDurationSeconds;
  const minEnd = lastRange.startSec + lastMinimumDuration;
  const resolvedEnd = clamp(Math.round(nextEndSec), minEnd, maxDurationSeconds);

  return ranges.map((range, index) => (
    index === lastIndex ? { ...range, endSec: resolvedEnd } : range
  ));
}

export function serializeTimelineRanges(ranges: TimelineRange[]): Array<{ id: number; time_range: string }> {
  return ranges.map((range) => ({
    id: range.id,
    time_range: formatTimelineRange(range.startSec, range.endSec),
  }));
}
