'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import {
  DEFAULT_MIN_SHOT_DURATION_SECONDS,
  DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
  FIRST_SHOT_MIN_DURATION_SECONDS,
  normalizeTimelineRanges,
  serializeTimelineRanges,
  updateTimelineBoundary,
  updateTimelineEnd,
  type TimelineRange,
  type TimelineShotLike,
} from '@/lib/segment-shot-timeline';

type SegmentTimelineRulerProps = {
  shots: TimelineShotLike[];
  readOnly?: boolean;
  fallbackDurationSeconds?: number;
  minShotDurationSeconds?: number;
  onChange: (ranges: Array<{ id: number; time_range: string }>) => void;
};

const TRACK_COLORS = [
  'bg-black text-white',
  'bg-zinc-700 text-white',
  'bg-zinc-500 text-white',
  'bg-zinc-300 text-black',
];

function BoundaryHandle() {
  return (
    <>
      <span className="absolute left-1/2 top-0 h-[56px] w-[3px] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(160,160,156,0.95)_14%,rgba(98,98,95,0.92)_50%,rgba(160,160,156,0.95)_86%,rgba(255,255,255,0.95)_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.42),0_0_14px_rgba(255,255,255,0.16)]" />
      <span className="absolute left-1/2 top-1/2 h-7 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(180deg,#A4A49F_0%,#8F8F89_100%)] shadow-[0_1px_3px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.45)]" />
      <span className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 -translate-y-[6px] rounded-full bg-white/95 shadow-[0_0_0_1px_rgba(120,120,120,0.12)]" />
      <span className="absolute left-1/2 top-1/2 h-[4px] w-[4px] -translate-x-1/2 translate-y-[2px] rounded-full bg-white/95 shadow-[0_0_0_1px_rgba(120,120,120,0.12)]" />
    </>
  );
}

export default function SegmentTimelineRuler({
  shots,
  readOnly = false,
  fallbackDurationSeconds = DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
  minShotDurationSeconds = DEFAULT_MIN_SHOT_DURATION_SECONDS,
  onChange,
}: SegmentTimelineRulerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number | null>(null);
  const [activeDragTarget, setActiveDragTarget] = useState<{ type: 'boundary'; index: number } | { type: 'end' } | null>(null);
  const [previewRanges, setPreviewRanges] = useState<TimelineRange[] | null>(null);
  const [limitHint, setLimitHint] = useState<{ left: number; message: string } | null>(null);

  const totalDurationSeconds = Math.max(
    DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
    Math.round(fallbackDurationSeconds),
  );

  const ranges = useMemo(
    () => normalizeTimelineRanges(shots, totalDurationSeconds),
    [shots, totalDurationSeconds],
  );

  const displayRanges = previewRanges ?? ranges;

  const previewDragRanges = (
    sourceRanges: TimelineRange[],
    target: { type: 'boundary'; index: number } | { type: 'end' },
    clientX: number,
  ): TimelineRange[] => {
    const track = trackRef.current;
    if (!track) {
      return sourceRanges;
    }

    const rect = track.getBoundingClientRect();
    const relativePosition = (clientX - rect.left) / rect.width;
    const nextSeconds = relativePosition * totalDurationSeconds;
    const floatClamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    if (target.type === 'end') {
      const lastIndex = sourceRanges.length - 1;
      const lastRange = sourceRanges[lastIndex];
      if (!lastRange) return sourceRanges;
      const lastMinimumDuration = lastIndex === 0
        ? Math.max(minShotDurationSeconds, FIRST_SHOT_MIN_DURATION_SECONDS)
        : minShotDurationSeconds;
      const minEnd = lastRange.startSec + lastMinimumDuration;
      const resolvedEnd = floatClamp(nextSeconds, minEnd, totalDurationSeconds);
      setLimitHint(null);
      return sourceRanges.map((range, index) => (
        index === lastIndex ? { ...range, endSec: resolvedEnd } : range
      ));
    }

    const boundaryIndex = target.index;
    const leftRange = sourceRanges[boundaryIndex - 1];
    const rightRange = sourceRanges[boundaryIndex];
    if (!leftRange || !rightRange) {
      return sourceRanges;
    }

    const leftMinimumDuration = boundaryIndex === 1
      ? Math.max(minShotDurationSeconds, FIRST_SHOT_MIN_DURATION_SECONDS)
      : minShotDurationSeconds;
    const minBoundary = leftRange.startSec + leftMinimumDuration;
    const maxBoundary = rightRange.endSec - minShotDurationSeconds;
    const resolvedBoundary = floatClamp(nextSeconds, minBoundary, maxBoundary);

    if (boundaryIndex === 1 && nextSeconds < minBoundary) {
      setLimitHint({
        left: (minBoundary / totalDurationSeconds) * 100,
        message: `Shot 1 must stay at least ${FIRST_SHOT_MIN_DURATION_SECONDS}s.`,
      });
    } else {
      setLimitHint(null);
    }

    return sourceRanges.map((range, index) => {
      if (index === boundaryIndex - 1) {
        return { ...range, endSec: resolvedBoundary };
      }

      if (index === boundaryIndex) {
        return { ...range, startSec: resolvedBoundary };
      }

      return range;
    });
  };

  useEffect(() => {
    if (activeDragTarget === null) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      latestClientXRef.current = event.clientX;

      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        if (latestClientXRef.current === null) return;
        setPreviewRanges(previewDragRanges(ranges, activeDragTarget, latestClientXRef.current));
      });
    };

    const handlePointerUp = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      const trackRect = trackRef.current?.getBoundingClientRect();
      const trackLeft = trackRect?.left ?? 0;
      const trackWidth = trackRect?.width || 1;
      const commitRanges = latestClientXRef.current === null
        ? ranges
        : activeDragTarget.type === 'boundary'
          ? updateTimelineBoundary(ranges, activeDragTarget.index, ((latestClientXRef.current - trackLeft) / trackWidth) * totalDurationSeconds, minShotDurationSeconds)
          : updateTimelineEnd(ranges, ((latestClientXRef.current - trackLeft) / trackWidth) * totalDurationSeconds, minShotDurationSeconds, totalDurationSeconds);

      onChange(serializeTimelineRanges(commitRanges));
      latestClientXRef.current = null;
      setPreviewRanges(null);
      setLimitHint(null);
      setActiveDragTarget(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activeDragTarget, ranges, totalDurationSeconds, minShotDurationSeconds, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#666666]">
        <Clock className="h-3.5 w-3.5" />
        <span>Timing</span>
      </div>

      <div className="rounded-lg border border-[#E7E7E3] bg-[#FAFAFA] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div
          ref={shellRef}
          className="relative rounded-lg border border-[#E8E8E4] bg-white px-4 pb-4 pt-4"
          aria-label="Shared shot timeline ruler"
        >
          <div
            ref={trackRef}
            className="relative mx-1 mt-6 h-[64px] overflow-visible rounded-lg px-0 pb-2 pt-0"
          >
            <div className="pointer-events-none absolute inset-x-0 -top-3.5 flex items-center justify-between text-[11px] font-medium tracking-[0.01em] text-[#6B6B6B]">
              {Array.from({ length: totalDurationSeconds + 1 }).map((_, index) => (
                <span key={`tick-${index}`} className="min-w-[8px] text-center">
                  {index}
                </span>
              ))}
            </div>

            <div className="absolute inset-x-1 top-[2rem] h-[2px] -translate-y-1/2 rounded-full bg-[#D8D8D1]" />

            {displayRanges.map((range, index) => {
              const left = (range.startSec / totalDurationSeconds) * 100;
              const width = ((range.endSec - range.startSec) / totalDurationSeconds) * 100;
              const isFirst = index === 0;
              const isLast = index === ranges.length - 1;

              return (
                <div
                  key={`${range.id}-${range.startSec}-${range.endSec}`}
                  className="absolute top-0 h-[56px]"
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 4)}%`,
                  }}
                >
                  <div
                    className={`flex h-full items-center justify-center border-y border-white/50 text-[11px] font-semibold tracking-[0.01em] shadow-[0_1px_3px_rgba(0,0,0,0.07)] ${
                      isFirst && isLast
                        ? 'rounded-lg border-x'
                        : isFirst
                          ? 'rounded-l-lg rounded-r-[3px] border-l'
                          : isLast
                            ? 'rounded-l-[3px] rounded-r-lg border-r'
                            : 'rounded-[3px]'
                    } ${TRACK_COLORS[index % TRACK_COLORS.length]}`}
                  >
                    Shot {index + 1}
                  </div>
                </div>
              );
            })}

            {!readOnly && displayRanges.slice(1).map((range, index) => {
              const boundaryIndex = index + 1;
              const left = (range.startSec / totalDurationSeconds) * 100;

              return (
                <button
                  key={`boundary-${range.id}-${boundaryIndex}`}
                  type="button"
                  aria-label={`Adjust boundary between shot ${boundaryIndex} and shot ${boundaryIndex + 1}`}
                  className="absolute top-0 z-10 h-[64px] w-4 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                  style={{ left: `${left}%` }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setActiveDragTarget({ type: 'boundary', index: boundaryIndex });
                  }}
                  onKeyDown={(event) => {
                    const currentBoundary = displayRanges[boundaryIndex]?.startSec ?? 0;
                    if (event.key === 'ArrowLeft') {
                      event.preventDefault();
                      const nextRanges = updateTimelineBoundary(ranges, boundaryIndex, currentBoundary - 1, minShotDurationSeconds);
                      onChange(serializeTimelineRanges(nextRanges));
                    }
                    if (event.key === 'ArrowRight') {
                      event.preventDefault();
                      const nextRanges = updateTimelineBoundary(ranges, boundaryIndex, currentBoundary + 1, minShotDurationSeconds);
                      onChange(serializeTimelineRanges(nextRanges));
                    }
                  }}
                >
                  <BoundaryHandle />
                </button>
              );
            })}

            {!readOnly && ranges.length > 0 && (
              <button
                type="button"
                aria-label="Adjust end of last shot"
                className="absolute top-0 z-10 h-[64px] w-4 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                style={{ left: `${(displayRanges[displayRanges.length - 1]!.endSec / totalDurationSeconds) * 100}%` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActiveDragTarget({ type: 'end' });
                }}
                onKeyDown={(event) => {
                  const currentEnd = displayRanges[displayRanges.length - 1]?.endSec ?? totalDurationSeconds;
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    onChange(serializeTimelineRanges(
                      updateTimelineEnd(ranges, currentEnd - 1, minShotDurationSeconds, totalDurationSeconds),
                    ));
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    onChange(serializeTimelineRanges(
                      updateTimelineEnd(ranges, currentEnd + 1, minShotDurationSeconds, totalDurationSeconds),
                    ));
                  }
                }}
              >
                <BoundaryHandle />
              </button>
            )}

            {limitHint && (
              <div
                className="pointer-events-none absolute top-[-1.9rem] z-20 -translate-x-1/2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 shadow-sm"
                style={{ left: `${limitHint.left}%` }}
              >
                {limitHint.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
