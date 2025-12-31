'use client';

import { useMemo } from 'react';
import { Loader2, Film } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import SegmentListItem from './SegmentListItem';

interface SegmentListColumnProps {
  segments: SegmentCardSummary[];
  selectedIndex: number;
  onSelectSegment: (index: number) => void;
  onMerge?: () => void;
  isMerging?: boolean;
}

export default function SegmentListColumn({
  segments,
  selectedIndex,
  onSelectSegment,
  onMerge,
  isMerging
}: SegmentListColumnProps) {
  // Check if all segments have videos ready
  const allVideosReady = useMemo(() => {
    return segments.length > 1 && segments.every(seg => seg.videoUrl);
  }, [segments]);

  // Count how many segments have videos
  const videosReadyCount = useMemo(() => {
    return segments.filter(seg => seg.videoUrl).length;
  }, [segments]);

  return (
    <div className="flex h-full flex-col bg-[#F7F7F7]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#E5E5E5] bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-black">Segments</h2>
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-gray-100 px-1.5 text-xs font-medium text-[#666666]">
            {segments.length}
          </span>
        </div>
      </div>

      {/* Segment List */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {segments.map((segment) => (
            <SegmentListItem
              key={segment.index}
              segment={segment}
              isSelected={segment.index === selectedIndex}
              onClick={() => onSelectSegment(segment.index)}
            />
          ))}
        </div>
      </div>

      {/* Merge Button - Always shown for multi-segment projects */}
      {segments.length > 1 && onMerge && (
        <div className="flex-shrink-0 border-t border-[#E5E5E5] bg-white p-3">
          <button
            onClick={onMerge}
            disabled={!allVideosReady || isMerging}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging Videos...
              </>
            ) : allVideosReady ? (
              <>
                <Film className="w-4 h-4" />
                Merge All Segments
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                Generate All Videos First ({videosReadyCount}/{segments.length})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
