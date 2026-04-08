'use client';

import { useMemo } from 'react';
import { Download, Loader2, Film, List } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import SegmentListItem from './SegmentListItem';

interface SegmentListColumnProps {
  segments: SegmentCardSummary[];
  selectedIndex: number;
  onSelectSegment: (index: number) => void;
  onMerge?: () => void;
  onDownload?: () => void;
  isMerging?: boolean;
  isDownloading?: boolean;
  readOnly?: boolean;
}

export default function SegmentListColumn({
  segments,
  selectedIndex,
  onSelectSegment,
  onMerge,
  onDownload,
  isMerging,
  isDownloading,
  readOnly = false
}: SegmentListColumnProps) {
  // Check if all segments have videos ready
  const allVideosReady = useMemo(() => {
    return segments.length > 1 && segments.every(seg => seg.videoUrl);
  }, [segments]);

  const singleSegmentReady = useMemo(() => {
    return segments.length === 1 && Boolean(segments[0]?.videoUrl);
  }, [segments]);

  // Count how many segments have videos
  const videosReadyCount = useMemo(() => {
    return segments.filter(seg => seg.videoUrl).length;
  }, [segments]);

  return (
    <div className="clone-editor-list flex h-full flex-col bg-white">
      {/* Header */}
      <div className="clone-editor-list-header flex-shrink-0 border-b border-[#E5E5E5] bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <List className="h-4 w-4 text-black" />
          <h2 className="text-sm font-semibold text-black">Segments</h2>
          <span className="clone-editor-list-count inline-flex h-5 min-w-[20px] items-center justify-center rounded-md bg-gray-100 px-1.5 text-xs font-medium text-[#666666]">
            {segments.length}
          </span>
        </div>
      </div>

      {/* Segment List */}
      <div className="clone-editor-list-body flex-1 overflow-y-auto p-3">
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

      {/* Merge Button - Always shown for multi-segment projects (hidden in read-only mode) */}
      {segments.length > 1 && onMerge && !readOnly && (
        <div className="clone-editor-list-footer flex-shrink-0 border-t border-[#E5E5E5] bg-white p-3 space-y-3">
          {!allVideosReady && !isMerging && (
            <p className="clone-editor-list-hint text-[11px] text-[#666666] text-center px-2">
              Generate each segment&apos;s video individually before merging the final result.
            </p>
          )}
          <button
            onClick={onMerge}
            disabled={!allVideosReady || isMerging}
            className="clone-editor-primary w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging Videos...
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                Merge All Segments
              </>
            )}
          </button>
        </div>
      )}

      {/* Download Button - Shown for single-segment projects */}
      {segments.length === 1 && onDownload && !readOnly && (
        <div className="clone-editor-list-footer flex-shrink-0 border-t border-[#E5E5E5] bg-white p-3 space-y-3">
          {!singleSegmentReady && !isDownloading && (
            <p className="clone-editor-list-hint text-[11px] text-[#666666] text-center px-2">
              Generate the segment video before downloading.
            </p>
          )}
          <button
            onClick={onDownload}
            disabled={!singleSegmentReady || isDownloading}
            className="clone-editor-primary w-full inline-flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing Download...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
