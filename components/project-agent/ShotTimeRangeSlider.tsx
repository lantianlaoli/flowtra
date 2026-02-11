'use client';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type ShotRangeSec = {
  startSec: number;
  endSec: number;
};

type ShotTimeRangeSliderProps = {
  ranges: ShotRangeSec[];
  selectedIndex: number;
  sceneDurationSec: number;
  minStartSec: number;
  maxEndSec: number;
  minGapSec?: number;
  stepSec?: number;
  onChange: (next: ShotRangeSec) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toPercent = (value: number, max: number) => {
  if (max <= 0) return 0;
  return (value / max) * 100;
};

export default function ShotTimeRangeSlider({
  ranges,
  selectedIndex,
  sceneDurationSec,
  minStartSec,
  maxEndSec,
  minGapSec = 0.2,
  stepSec = 0.1,
  onChange
}: ShotTimeRangeSliderProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null);
  const safeDuration = Math.max(0.1, sceneDurationSec);
  const selectedRange = ranges[selectedIndex] || { startSec: 0, endSec: minGapSec };
  const startSec = clamp(selectedRange.startSec, 0, safeDuration);
  const endSec = clamp(selectedRange.endSec, 0, safeDuration);

  const segments = useMemo(() => {
    return ranges.map((range, index) => ({
      key: `${index}-${range.startSec}-${range.endSec}`,
      left: toPercent(range.startSec, safeDuration),
      width: Math.max(0.5, toPercent(range.endSec - range.startSec, safeDuration)),
      isActive: index === selectedIndex
    }));
  }, [ranges, selectedIndex, safeDuration]);

  const startLeft = toPercent(startSec, safeDuration);
  const endLeft = toPercent(endSec, safeDuration);

  const pickByPointer = (clientX: number) => {
    const root = rootRef.current;
    if (!root) return { valueSec: startSec, thumb: 'start' as const };
    const rect = root.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const rawSec = ratio * safeDuration;
    const snapped = Number((Math.round(rawSec / stepSec) * stepSec).toFixed(1));
    const startDistance = Math.abs(snapped - startSec);
    const endDistance = Math.abs(snapped - endSec);
    return {
      valueSec: snapped,
      thumb: startDistance <= endDistance ? 'start' as const : 'end' as const
    };
  };

  const applyValue = (thumb: 'start' | 'end', rawSec: number) => {
    const snapped = Number((Math.round(rawSec / stepSec) * stepSec).toFixed(1));
    const boundedStartMin = minStartSec;
    const boundedEndMax = maxEndSec;

    if (thumb === 'start') {
      const nextStart = clamp(snapped, boundedStartMin, endSec - minGapSec);
      onChange({ startSec: nextStart, endSec });
      return;
    }

    const nextEnd = clamp(snapped, startSec + minGapSec, boundedEndMax);
    onChange({ startSec, endSec: nextEnd });
  };

  const onTrackPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { valueSec, thumb } = pickByPointer(event.clientX);
    setActiveThumb(thumb);
    applyValue(thumb, valueSec);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onTrackPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeThumb) return;
    const { valueSec } = pickByPointer(event.clientX);
    applyValue(activeThumb, valueSec);
  };

  const onTrackPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setActiveThumb(null);
  };

  return (
    <div className="space-y-2">
      <div
        ref={rootRef}
        role="group"
        aria-label="Shot time range slider"
        className="relative h-10 touch-none rounded-lg border border-[#e4e4e2] bg-[#f7f7f6]"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
      >
        <div className="absolute inset-x-2 inset-y-0">
          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[#e7e7e5]" />

          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2">
            {segments.map((segment, index) => (
              <div
                key={segment.key}
                className={`absolute top-0 h-2.5 rounded-full transition-colors ${
                  segment.isActive ? 'bg-[#111111]' : index % 2 === 0 ? 'bg-[#d4d4d1]' : 'bg-[#c8c8c5]'
                }`}
                style={{
                  left: `${segment.left}%`,
                  width: `${segment.width}%`
                }}
              />
            ))}
          </div>

          <button
            type="button"
            aria-label="Adjust shot start time"
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#ffffff] bg-[#111111] shadow-[0_0_0_1px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            style={{ left: `calc(${startLeft}% - 8px)` }}
            onPointerDown={(event) => {
              event.stopPropagation();
              setActiveThumb('start');
            }}
            onPointerUp={() => setActiveThumb(null)}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 0.5 : 0.1;
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                applyValue('start', startSec - delta);
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                applyValue('start', startSec + delta);
              }
            }}
          />

          <button
            type="button"
            aria-label="Adjust shot end time"
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-[#ffffff] bg-[#111111] shadow-[0_0_0_1px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            style={{ left: `calc(${endLeft}% - 8px)` }}
            onPointerDown={(event) => {
              event.stopPropagation();
              setActiveThumb('end');
            }}
            onPointerUp={() => setActiveThumb(null)}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 0.5 : 0.1;
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                applyValue('end', endSec - delta);
              }
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                applyValue('end', endSec + delta);
              }
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.1em] text-[#8a8a87]">
        <span>0.0s</span>
        <span>{safeDuration.toFixed(1)}s</span>
      </div>
    </div>
  );
}
