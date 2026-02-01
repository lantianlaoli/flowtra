'use client';

import clsx from 'clsx';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';

interface SegmentListItemProps {
  segment: SegmentCardSummary;
  isSelected: boolean;
  onClick: () => void;
}

export default function SegmentListItem({
  segment,
  isSelected,
  onClick
}: SegmentListItemProps) {
  const formatStatus = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending_first_frame':
        return 'Pending';
      case 'generating_first_frame':
        return 'Generating';
      case 'first_frame_ready':
        return 'Ready for Video';
      case 'generating_video':
        return 'Generating';
      case 'video_ready':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status || 'Unknown';
    }
  };

  const getStatusColor = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'video_ready':
        return 'bg-black text-white';
      case 'generating_video':
      case 'generating_first_frame':
        return 'bg-gray-100 text-gray-700';
      case 'failed':
        return 'bg-gray-100 text-gray-500';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'clone-editor-list-item w-full rounded-lg p-3 text-left transition-all',
        isSelected
          ? 'clone-editor-list-item-selected border-2 border-black bg-white shadow-sm'
          : 'border border-gray-200 bg-gray-100 hover:border-gray-300 hover:bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-black">
          Segment {segment.index + 1}
        </span>
        <span
          className={clsx(
            'clone-editor-list-status inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
            getStatusColor(segment.status)
          )}
        >
          {formatStatus(segment.status)}
        </span>
      </div>
    </button>
  );
}
