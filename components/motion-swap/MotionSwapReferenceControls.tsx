'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Bookmark, Clapperboard, Heart, MessageCircle, Share2, Video as VideoIcon, Clock3, Languages } from 'lucide-react';
import BottomBarDropdown from '@/components/ui/BottomBarDropdown';
import { cn } from '@/lib/utils';
import { getLanguageDisplayInfo } from '@/lib/language';

interface MotionSwapVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  analysis_language?: string | null;
  stats?: Record<string, unknown> | null;
}

interface MotionSwapReferenceControlsProps {
  videos: MotionSwapVideo[];
  selectedVideoId: string;
  onSelectVideoId: (id: string) => void;
  variant?: 'inline' | 'stacked';
  showLabel?: boolean;
  className?: string;
}

const getStatCount = (stats: Record<string, unknown> | null | undefined, key: string) => {
  const value = (stats as Record<string, unknown> | null)?.[key];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function MotionSwapReferenceControls({
  videos,
  selectedVideoId,
  onSelectVideoId,
  variant = 'stacked',
  showLabel = true,
  className
}: MotionSwapReferenceControlsProps) {
  const [videoOpen, setVideoOpen] = useState(false);

  const selectedVideo = useMemo(
    () => videos.find(video => video.id === selectedVideoId),
    [videos, selectedVideoId]
  );
  const selectedVideoEligible = Boolean(selectedVideo?.cover_url);
  const triggerVideo = selectedVideoEligible ? selectedVideo : null;
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
          triggerClassName="min-w-[140px]"
          panelWidthClassName="w-[360px]"
          disabled={videos.length === 0}
          trigger={
            <div className="bottom-bar-video-trigger flex items-center gap-3">
              <div className="bottom-bar-video-thumb h-8 w-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                {selectedVideo?.cover_url ? (
                  <Image
                    src={triggerVideo?.cover_url || ''}
                    alt={triggerVideo?.description || 'Video'}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Clapperboard className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="bottom-bar-video-title text-sm font-medium text-gray-900">
                {triggerVideo?.description?.slice(0, 28) || 'Select video'}
              </p>
            </div>
          }
        >
          {videos.length > 0 ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {videos.map(video => {
                const hasFirstFrame = Boolean(video.cover_url);
                const likeCount = getStatCount(video.stats, 'diggCount');
                const commentCount = getStatCount(video.stats, 'commentCount');
                const shareCount = getStatCount(video.stats, 'shareCount');
                const collectCount = getStatCount(video.stats, 'collectCount');
                const languageDisplay = getLanguageDisplayInfo(video.analysis_language);
                const durationLabel = video.duration_seconds ? `${video.duration_seconds}s` : '--';
                const languageLabel = languageDisplay?.label || '--';
                const showStats = likeCount + commentCount + shareCount + collectCount > 0;
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      if (!hasFirstFrame) return;
                      onSelectVideoId(video.id);
                      setVideoOpen(false);
                    }}
                    disabled={!hasFirstFrame}
                    className={`bottom-bar-video-option w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedVideoId === video.id && hasFirstFrame
                        ? 'border-black bg-gray-50'
                        : hasFirstFrame
                          ? 'border-gray-200 hover:border-black'
                          : 'border-gray-200 bg-gray-50/70 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="bottom-bar-video-preview h-20 w-14 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
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
                          <VideoIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="bottom-bar-video-option-title text-sm font-medium text-gray-900 line-clamp-2">
                          {video.description || 'TikTok video'}
                        </p>
                        {!hasFirstFrame && (
                          <p className="text-[11px] font-medium text-gray-500 mt-1">First frame required</p>
                        )}
                        <div className="bottom-bar-video-option-meta flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {durationLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Languages className="w-3 h-3" />
                            {languageLabel}
                          </span>
                        </div>
                        {showStats && (
                          <div className="bottom-bar-video-option-meta flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2">
                            <span className="inline-flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {likeCount.toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Bookmark className="w-3 h-3" />
                              {collectCount.toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Share2 className="w-3 h-3" />
                              {shareCount.toLocaleString()}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle className="w-3 h-3" />
                              {commentCount.toLocaleString()}
                            </span>
                          </div>
                        )}
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
