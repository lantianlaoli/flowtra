'use client';

import NextImage from 'next/image';
import clsx from 'clsx';
import { Loader2, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import { MODEL_PROCESSING_TIMES, type VideoModel } from '@/lib/constants';

interface SegmentPreviewColumnProps {
  segment: SegmentCardSummary;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  videoModel?: string;
}

function getAspectRatioClass(ratio?: string | null) {
  switch (ratio) {
    case '9:16':
      return 'aspect-[9/16]';
    case '1:1':
      return 'aspect-square';
    case '16:9':
    default:
      return 'aspect-[16/9]';
  }
}

function getEstimatedTime(videoModel?: string): string {
  if (!videoModel) return '';
  const model = videoModel as VideoModel;
  const timeRange = MODEL_PROCESSING_TIMES[model];
  return timeRange ? ` (~${timeRange})` : '';
}

export default function SegmentPreviewColumn({
  segment,
  videoAspectRatio,
  videoModel
}: SegmentPreviewColumnProps) {
  const normalizedStatus = (segment?.status || '').toLowerCase();
  const isGeneratingFirstFrame = normalizedStatus === 'generating_first_frame';
  const isGeneratingVideo = normalizedStatus === 'generating_video';
  const showPhotoSkeleton = isGeneratingFirstFrame;
  const showVideoSkeleton = isGeneratingVideo;
  const previewAspectClass = getAspectRatioClass(videoAspectRatio);

  const previewMediaClass = (isDashed?: boolean) =>
    clsx(
      'relative rounded-lg border bg-[#F7F7F7] overflow-hidden flex items-center justify-center',
      previewAspectClass,
      isDashed ? 'border-dashed border-[#E5E5E5]' : 'border border-[#E5E5E5]'
    );

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#E5E5E5] bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-black">Preview</h2>
      </div>

      {/* Preview Content - Side by Side Layout */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4 h-full">
          {/* First Frame Preview */}
          <div className="flex flex-col">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#666666]">
              <ImageIcon className="h-3.5 w-3.5" />
              First Frame
            </div>
            <div className={previewMediaClass()}>
              {showPhotoSkeleton ? (
                <div className="flex h-full w-full flex-col items-center justify-center animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                  <span className="mt-2">Rendering first frame… (~1-2 min)</span>
                </div>
              ) : segment?.firstFrameUrl ? (
                <NextImage
                  src={segment.firstFrameUrl}
                  alt="Segment first frame"
                  className="h-full w-full object-cover"
                  fill
                  sizes="(max-width: 768px) 50vw, 300px"
                />
              ) : (
                <div className="text-center text-sm text-[#666666]">
                  First frame not generated yet.
                </div>
              )}
            </div>
          </div>

          {/* Video Preview */}
          <div className="flex flex-col">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#666666]">
              <VideoIcon className="h-3.5 w-3.5" />
              Video Clip
            </div>
            <div className={previewMediaClass(true)}>
              {showVideoSkeleton ? (
                <div className="flex h-full w-full flex-col items-center justify-center animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                  <span className="mt-2">Rendering video{getEstimatedTime(videoModel)}…</span>
                </div>
              ) : segment?.videoUrl ? (
                <video
                  src={segment.videoUrl}
                  controls
                  controlsList="nodownload"
                  playsInline
                  className="h-full w-full rounded-lg bg-black object-contain"
                />
              ) : (
                <div className="text-center text-sm text-[#666666]">
                  Video not generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
