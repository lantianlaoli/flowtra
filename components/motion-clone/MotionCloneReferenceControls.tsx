'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Clapperboard, Video as VideoIcon, Clock3, Languages, Rows3, ChevronRight } from 'lucide-react';
import BottomBarDropdown from '@/components/ui/BottomBarDropdown';
import { cn } from '@/lib/utils';
import { getLanguageDisplayInfo } from '@/lib/language';

interface MotionCloneVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_language?: string | null;
  stats?: Record<string, unknown> | null;
  source_name?: string | null;
}

interface MotionCloneReferenceControlsProps {
  videos: MotionCloneVideo[];
  selectedVideoId: string;
  onSelectVideoId: (id: string) => void;
  requireFirstFrameForSelection?: boolean;
  variant?: 'inline' | 'stacked';
  showLabel?: boolean;
  className?: string;
}

const getShotCount = (analysisResult?: Record<string, unknown> | null): number | null => {
  const shots = analysisResult?.shots;
  return Array.isArray(shots) ? shots.length : null;
};

export default function MotionCloneReferenceControls({
  videos,
  selectedVideoId,
  onSelectVideoId,
  requireFirstFrameForSelection = true,
  variant = 'stacked',
  showLabel = true,
  className
}: MotionCloneReferenceControlsProps) {
  const [videoOpen, setVideoOpen] = useState(false);

  const selectedVideo = useMemo(
    () => videos.find(video => video.id === selectedVideoId),
    [videos, selectedVideoId]
  );
  const selectedVideoEligible = requireFirstFrameForSelection
    ? Boolean(selectedVideo?.cover_url)
    : Boolean(selectedVideo);
  const triggerVideo = selectedVideoEligible ? selectedVideo : null;
  const selectedVideoLabel = selectedVideo
    ? (selectedVideo.description?.trim() || 'TikTok video')
    : 'Select video';
  const isInline = variant === 'inline';

  return (
    <div className={cn(isInline ? 'flex items-center gap-2' : 'space-y-3', className)}>
      {showLabel && (
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Reference video</p>
      )}
      <div className={cn('flex flex-wrap gap-2', isInline ? 'items-center' : '')}>
        <BottomBarDropdown
          open={videoOpen}
          onOpenChange={setVideoOpen}
          triggerClassName="min-w-[240px] sm:min-w-[300px]"
          panelWidthClassName="w-[340px] sm:w-[392px]"
          disabled={videos.length === 0}
          trigger={
            <div className="bottom-bar-video-trigger flex min-w-0 items-center gap-3">
              <div className="bottom-bar-video-thumb flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#d8d8d3] bg-[#f6f6f3]">
                {selectedVideo?.cover_url ? (
                  <Image
                    src={selectedVideo.cover_url}
                    alt={selectedVideoLabel}
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Clapperboard className="h-4 w-4 text-[#7a7a74]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="bottom-bar-video-title truncate text-sm font-semibold tracking-tight text-black">
                  {selectedVideoLabel}
                </p>
                <p className="mt-0.5 text-xs text-[#7a7a74]">
                  {selectedVideo ? 'Reference video selected' : 'Choose a reference video'}
                </p>
              </div>
            </div>
          }
        >
          {videos.length > 0 ? (
            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
              {videos.map(video => {
                const hasFirstFrame = Boolean(video.cover_url);
                const canSelectVideo = requireFirstFrameForSelection ? hasFirstFrame : true;
                const languageDisplay = getLanguageDisplayInfo(video.analysis_language);
                const durationLabel = video.duration_seconds ? `${video.duration_seconds}s` : '--';
                const languageLabel = languageDisplay?.label || '--';
                const shotCount = getShotCount(video.analysis_result);
                const sourceTitle = video.description?.trim() || video.source_name?.trim() || 'TikTok video';
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      if (!canSelectVideo) return;
                      onSelectVideoId(video.id);
                      setVideoOpen(false);
                    }}
                    disabled={!canSelectVideo}
                    className={`bottom-bar-video-option w-full rounded-[22px] border px-3 py-3 text-left transition-all ${
                      selectedVideoId === video.id && canSelectVideo
                        ? 'border-black bg-[#f8f8f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_0_rgba(232,232,228,0.98)]'
                        : canSelectVideo
                          ? 'border-[#e1e1dc] bg-white hover:border-black/45 hover:bg-[#fcfcfa]'
                          : 'cursor-not-allowed border-[#e6e6e1] bg-[#f7f7f4] opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="bottom-bar-video-preview flex h-[96px] w-[72px] flex-shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-[#d8d8d3] bg-[#f4f4f1]">
                        {video.video_cdn_url ? (
                          <video
                            src={video.video_cdn_url}
                            poster={video.cover_url || undefined}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : video.cover_url ? (
                          <Image
                            src={video.cover_url}
                            alt={video.description || 'Video cover'}
                            width={56}
                            height={80}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <VideoIcon className="h-4 w-4 text-[#8a8a84]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 self-start pt-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="bottom-bar-video-option-title truncate text-[15px] font-semibold tracking-tight text-black">
                              {sourceTitle}
                            </p>
                            {requireFirstFrameForSelection && !hasFirstFrame ? (
                              <p className="mt-1 text-xs font-medium text-[#8a8a84]">First frame required</p>
                            ) : null}
                          </div>
                          <ChevronRight
                            className={cn(
                              'mt-0.5 h-4 w-4 flex-shrink-0 text-[#9a9a94] transition-transform',
                              selectedVideoId === video.id && canSelectVideo && 'translate-x-0.5 text-black'
                            )}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-[#4f4f49]">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Clock3 className="h-3.5 w-3.5 text-[#7a7a74]" />
                            {durationLabel}
                          </span>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Languages className="h-3.5 w-3.5 text-[#7a7a74]" />
                            {languageLabel}
                          </span>
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Rows3 className="h-3.5 w-3.5 text-[#7a7a74]" />
                            {shotCount ? `${shotCount} shots` : 'No shots'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 px-3 py-2">No videos yet.</div>
          )}
        </BottomBarDropdown>
      </div>
    </div>
  );
}
