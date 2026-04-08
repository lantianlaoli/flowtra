'use client';

import { useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { Loader2, Image as ImageIcon, Video as VideoIcon, Eye, RefreshCw } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import { MODEL_PROCESSING_TIMES, type VideoModel } from '@/lib/constants';

interface SegmentPreviewColumnProps {
  segment: SegmentCardSummary;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  videoModel?: string;
  layout?: 'split' | 'stacked';
  videoEtaLabel?: string;
  onRefreshVideo?: () => Promise<void>;
  isRefreshing?: boolean;
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
  videoModel,
  layout = 'split',
  videoEtaLabel,
  onRefreshVideo,
  isRefreshing = false
}: SegmentPreviewColumnProps) {
  const [videoError, setVideoError] = useState(false);
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
    <div className="motion-clone-editor-preview flex h-full flex-col bg-white">
      {/* Header */}
      <div className="motion-clone-editor-preview-header flex-shrink-0 border-b border-[#E5E5E5] bg-gray-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Eye className="motion-clone-editor-preview-icon h-4 w-4 text-black" />
          <h2 className="motion-clone-editor-preview-title text-sm font-semibold text-black">Preview</h2>
        </div>
      </div>

      {/* Preview Content - Side by Side Layout */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className={clsx('grid gap-3', layout === 'stacked' ? 'grid-cols-1' : 'grid-cols-2')}>
          {/* First Frame Preview */}
          <div className="flex flex-col">
            <div className="motion-clone-editor-preview-label mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#666666]">
              <ImageIcon className="h-3.5 w-3.5" />
              First Frame
            </div>
            <div className={clsx('motion-clone-editor-preview-media', previewMediaClass())}>
              {showPhotoSkeleton ? (
                <div className="motion-clone-editor-preview-skeleton flex h-full w-full flex-col items-center justify-center animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                  <Loader2 className="motion-clone-editor-preview-skeleton-icon h-6 w-6 animate-spin text-gray-600" />
                  <span className="mt-2">Rendering first frame… (~1-2 min)</span>
                </div>
              ) : segment?.firstFrameUrl ? (
                <NextImage
                  src={segment.firstFrameUrl}
                  alt="Segment first frame"
                  className="h-full w-full object-contain"
                  fill
                  sizes="(max-width: 768px) 50vw, 300px"
                />
              ) : (
                <div className="motion-clone-editor-preview-empty text-center text-sm text-[#666666]">
                  First frame not generated yet.
                </div>
              )}
            </div>
          </div>

          {/* Video Preview */}
          <div className="flex flex-col">
            <div className="motion-clone-editor-preview-label mb-1.5 flex items-center gap-2 text-xs font-semibold text-[#666666]">
              <VideoIcon className="h-3.5 w-3.5" />
              Video Clip
            </div>
            <div className={clsx('motion-clone-editor-preview-media', previewMediaClass(true))}>
              {showVideoSkeleton ? (
                <div className="motion-clone-editor-preview-skeleton flex h-full w-full flex-col items-center justify-center animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                  <Loader2 className="motion-clone-editor-preview-skeleton-icon h-6 w-6 animate-spin text-gray-600" />
                  <span className="mt-2">Rendering video{getEstimatedTime(videoModel)}…</span>
                  {videoEtaLabel && (
                    <span className="motion-clone-editor-preview-eta mt-1 text-xs text-[#777777]">{videoEtaLabel}</span>
                  )}
                </div>
              ) : segment?.videoUrl ? (
                <>
                  <video
                    key={segment.videoUrl}
                    src={segment.videoUrl}
                    poster={segment.firstFrameUrl || undefined}
                    controls
                    controlsList="nodownload"
                    playsInline
                    muted
                    loop
                    preload="auto"
                    className="h-full w-full rounded-lg bg-black object-contain"
                    onError={(e) => {
                      const videoElement = e.currentTarget;
                      setVideoError(true);
                      console.error('[SegmentPreviewColumn] Video load error:', {
                        url: segment.videoUrl,
                        error: videoElement.error,
                        networkState: videoElement.networkState,
                        readyState: videoElement.readyState
                      });
                    }}
                    onLoadedData={(e) => {
                      setVideoError(false);
                      console.log('[SegmentPreviewColumn] Video loaded successfully:', {
                        url: segment.videoUrl,
                        duration: e.currentTarget.duration
                      });
                    }}
                  />
                  {videoError && onRefreshVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <button
                        onClick={onRefreshVideo}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh Video'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-4">
                  <div className="motion-clone-editor-preview-empty text-sm text-[#666666] mb-2">Video not generated yet.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
