'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Bookmark, Clapperboard, Heart, MessageCircle, Music2, Play, Share2, Users, Video as VideoIcon } from 'lucide-react';
import BottomBarDropdown from '@/components/ui/BottomBarDropdown';
import { cn } from '@/lib/utils';

interface CreatorSourcePlatform {
  id: string;
  platform: string;
  handle: string;
  avatar_url?: string | null;
  display_name?: string | null;
}

interface CreatorSourceVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  stats?: Record<string, unknown> | null;
}

interface CreatorSource {
  id: string;
  source_name: string;
  creator_source_platforms?: CreatorSourcePlatform[];
  creator_source_videos?: CreatorSourceVideo[];
}

interface MotionSwapReferenceControlsProps {
  creatorSources: CreatorSource[];
  selectedSourceId: string;
  onSelectSourceId: (id: string) => void;
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
  creatorSources,
  selectedSourceId,
  onSelectSourceId,
  selectedVideoId,
  onSelectVideoId,
  variant = 'stacked',
  showLabel = true,
  className
}: MotionSwapReferenceControlsProps) {
  const [platformOpen, setPlatformOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const selectedSource = useMemo(
    () => creatorSources.find(source => source.id === selectedSourceId),
    [creatorSources, selectedSourceId]
  );
  const selectedVideo = useMemo(
    () => selectedSource?.creator_source_videos?.find(video => video.id === selectedVideoId),
    [selectedSource, selectedVideoId]
  );
  const selectedPlatform = selectedSource?.creator_source_platforms?.[0];
  const isInline = variant === 'inline';

  return (
    <div className={cn(isInline ? 'flex items-center gap-2' : 'space-y-3', className)}>
      {showLabel && (
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Reference video</p>
      )}
      <div className={cn('flex flex-wrap gap-2', isInline ? 'items-center' : '')}>
        <BottomBarDropdown
          open={platformOpen}
          onOpenChange={setPlatformOpen}
          triggerClassName="min-w-[120px]"
          trigger={
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                <Music2 className="w-4 h-4 text-gray-700" />
              </div>
              <p className="text-sm font-medium text-gray-900">TikTok</p>
            </div>
          }
        >
          <button
            type="button"
            onClick={() => setPlatformOpen(false)}
            className="w-full flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-left hover:border-black transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <Music2 className="w-4 h-4 text-gray-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">TikTok</p>
            </div>
          </button>
        </BottomBarDropdown>

        <BottomBarDropdown
          open={creatorOpen}
          onOpenChange={setCreatorOpen}
          triggerClassName="min-w-[140px]"
          trigger={
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                {selectedPlatform?.avatar_url ? (
                  <Image
                    src={selectedPlatform.avatar_url}
                    alt={selectedPlatform.display_name || selectedPlatform.handle}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Users className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">
                {selectedPlatform?.display_name || selectedSource?.source_name || 'Creator'}
              </p>
            </div>
          }
        >
          {creatorSources.length === 0 ? (
            <div className="text-sm text-gray-500 px-3 py-2">No creators yet.</div>
          ) : (
            <div className="space-y-2">
              {creatorSources.map(source => {
                const platformInfo = source.creator_source_platforms?.[0];
                const displayName = platformInfo?.display_name || source.source_name;
                const handle = platformInfo?.handle || source.source_name;
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => {
                      onSelectSourceId(source.id);
                      onSelectVideoId('');
                      setCreatorOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      selectedSourceId === source.id
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-black'
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                      {platformInfo?.avatar_url ? (
                        <Image
                          src={platformInfo.avatar_url}
                          alt={displayName}
                          width={36}
                          height={36}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Users className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{displayName}</p>
                      <p className="text-xs text-gray-500">@{handle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </BottomBarDropdown>

        <BottomBarDropdown
          open={videoOpen}
          onOpenChange={setVideoOpen}
          triggerClassName="min-w-[140px]"
          panelWidthClassName="w-[360px]"
          disabled={!selectedSource?.creator_source_videos?.length}
          trigger={
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                {selectedVideo?.cover_url ? (
                  <Image
                    src={selectedVideo.cover_url}
                    alt={selectedVideo.description || 'Video'}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Clapperboard className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">
                {selectedVideo?.description?.slice(0, 28) || 'Video'}
              </p>
            </div>
          }
        >
          {selectedSource?.creator_source_videos?.length ? (
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {selectedSource.creator_source_videos.map(video => {
                const playCount = getStatCount(video.stats, 'playCount');
                const likeCount = getStatCount(video.stats, 'diggCount');
                const commentCount = getStatCount(video.stats, 'commentCount');
                const shareCount = getStatCount(video.stats, 'shareCount');
                const collectCount = getStatCount(video.stats, 'collectCount');
                return (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => {
                      onSelectVideoId(video.id);
                      setVideoOpen(false);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedVideoId === video.id
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-black'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-12 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                        {video.cover_url ? (
                          <Image
                            src={video.cover_url}
                            alt={video.description || 'Video cover'}
                            width={48}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <VideoIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {video.description || 'TikTok video'}
                        </p>
                        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2">
                          <span className="inline-flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {playCount.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {likeCount.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {commentCount.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Share2 className="w-3 h-3" />
                            {shareCount.toLocaleString()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Bookmark className="w-3 h-3" />
                            {collectCount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-500 px-3 py-2">Select a creator first.</div>
          )}
        </BottomBarDropdown>
      </div>
    </div>
  );
}
