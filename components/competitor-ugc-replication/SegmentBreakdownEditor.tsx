'use client';

import { useState } from 'react';
import { X, Film, Edit3, Clock, ChevronRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';

type SegmentBreakdownEditorProps = {
  projectId: string;
  segments: SegmentCardSummary[];
  segmentPlan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
  videoModel?: string;
  videoDuration?: string | null;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  onSegmentClick?: (segmentIndex: number) => void;
};

export default function SegmentBreakdownEditor({
  segments,
  segmentPlan,
  videoModel,
  videoDuration,
  onSegmentClick
}: SegmentBreakdownEditorProps) {
  const [open, setOpen] = useState(false);

  const segmentPlanArray = Array.isArray(segmentPlan?.segments) ? segmentPlan.segments : [];

  const getSegmentTitle = (index: number) => {
    const plan = segmentPlanArray[index];
    if (!plan) return `Segment ${index + 1}`;

    const promptWithMeta = plan as SegmentPrompt & {
      segment_title?: string;
      segment_goal?: string;
    };

    if (promptWithMeta.segment_title) return promptWithMeta.segment_title;
    if (promptWithMeta.segment_goal) return promptWithMeta.segment_goal;
    return `Segment ${index + 1}`;
  };

  const getSegmentDescription = (index: number) => {
    const plan = segmentPlanArray[index];
    if (!plan) return 'No description available';
    return plan.first_frame_description || 'No description available';
  };

  const formatStatus = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending_first_frame':
        return 'Pending';
      case 'generating_first_frame':
        return 'Generating frame';
      case 'first_frame_ready':
        return 'Ready for Video';
      case 'generating_video':
        return 'Generating video';
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

  const handleSegmentClick = (index: number) => {
    onSegmentClick?.(index);
    setOpen(false);
  };

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="clone-breakdown-trigger group inline-flex items-center gap-2.5 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-sm font-medium text-black transition-all hover:border-black hover:shadow-sm"
        >
          <Film className="h-4 w-4" />
          <span>View Segment Breakdown</span>
          <span className="ml-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
            {segments.length}
          </span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="clone-breakdown-dialog fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-4xl translate-x-[-50%] translate-y-[-50%] bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden" style={{ borderRadius: '8px', maxHeight: 'calc(100vh - 4rem)' }}>
          {/* Header */}
          <div className="clone-breakdown-header flex items-center justify-between border-b border-[#E5E5E5] px-8 py-6">
            <div className="space-y-1">
              <Dialog.Title className="clone-breakdown-title text-xl font-semibold text-black">
                Segment Breakdown
              </Dialog.Title>
              <Dialog.Description className="clone-breakdown-subtitle text-sm text-[#666666]">
                {videoModel && videoDuration
                  ? `${segments.length} segments • ${videoModel.toUpperCase()} • ${videoDuration}s`
                  : `${segments.length} segments`}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="clone-breakdown-close inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E5E5] text-[#666666] transition-colors hover:border-black hover:text-black"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div className="clone-breakdown-body overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
            <div className="space-y-3">
              {segments.map((segment, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSegmentClick(index)}
                  className="clone-breakdown-item group w-full rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-5 text-left transition-all hover:border-black hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    {/* Segment Number */}
                    <div className="clone-breakdown-index flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white border border-[#E5E5E5] text-sm font-semibold text-black">
                      {index + 1}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="clone-breakdown-item-title text-base font-semibold text-black">
                          {getSegmentTitle(index)}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`clone-breakdown-status inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${getStatusColor(segment.status)}`}>
                            {formatStatus(segment.status)}
                          </span>
                          <ChevronRight className="clone-breakdown-chevron h-4 w-4 text-[#666666] transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>

                      <p className="clone-breakdown-copy line-clamp-2 text-sm text-[#666666]">
                        {getSegmentDescription(index)}
                      </p>

                      {segmentPlanArray[index]?.duration && (
                        <div className="clone-breakdown-duration flex items-center gap-1.5 text-xs text-[#666666]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{segmentPlanArray[index].duration}s segment</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="clone-breakdown-footer border-t border-[#E5E5E5] bg-[#F7F7F7] px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="clone-breakdown-hint flex items-center gap-2 text-xs text-blue-600 font-medium">
                <Edit3 className="h-3.5 w-3.5" />
                <span>Review segment frames and click to generate videos.</span>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="clone-breakdown-done inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Done
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
