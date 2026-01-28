'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Trash2, RefreshCw, Users, Video, Volume2, VolumeX, Play, Heart, MessageCircle, Share2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreatorSourcePlatform {
  id: string;
  platform: string;
  handle: string;
  profile_url?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
  stats?: Record<string, unknown> | null;
}

interface CreatorSourceVideo {
  id: string;
  platform: string;
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

interface CreatorSourceCardProps {
  source: CreatorSource;
  onDelete: (sourceId: string) => void;
  onSync: (sourceId: string) => void;
  isDeleting?: boolean;
  isSyncing?: boolean;
}

export default function CreatorSourceCard({
  source,
  onDelete,
  onSync,
  isDeleting,
  isSyncing
}: CreatorSourceCardProps) {
  const platform = source.creator_source_platforms?.[0];
  const videos = source.creator_source_videos || [];
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {platform?.avatar_url ? (
                <Image
                  src={platform.avatar_url}
                  alt={platform.display_name || platform.handle}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Users className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-900">{source.source_name}</h3>
                {platform?.profile_url && (
                  <a
                    href={platform.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {platform?.display_name || platform?.handle ? (
                  <>TikTok · {platform.display_name ? `${platform.display_name} (@${platform.handle})` : `@${platform.handle}`}</>
                ) : (
                  'TikTok profile not connected'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
            <button
              onClick={() => onSync(source.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={isSyncing}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
            <button
              onClick={() => onDelete(source.id)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-4 h-4 text-gray-400" />
              <h4 className="text-sm font-semibold text-gray-700">Reference Videos</h4>
              <span className="text-xs text-gray-400">({videos.length})</span>
            </div>

            {isSyncing ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={`creator-source-skeleton-${index}`}
                    className="border border-gray-200 rounded-lg overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[9/16] bg-gray-200" />
                    <div className="p-2 space-y-2">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                      <div className="flex gap-2">
                        <div className="h-3 bg-gray-200 rounded w-10" />
                        <div className="h-3 bg-gray-200 rounded w-10" />
                        <div className="h-3 bg-gray-200 rounded w-10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : videos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map(video => (
                  <CreatorSourceVideoTile key={video.id} video={video} sourceId={source.id} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-4">
                No videos synced yet. Use Sync to fetch the latest posts.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CreatorSourceVideoTile({ video, sourceId }: { video: CreatorSourceVideo; sourceId: string }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userPrefersMuted, setUserPrefersMuted] = useState(true);

  const handleMouseEnter = () => {
    if (!video.video_cdn_url || !videoRef.current) return;
    videoRef.current.muted = userPrefersMuted;
    setIsMuted(userPrefersMuted);
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const handleMouseLeave = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setIsPlaying(false);
    // Keep user's muted preference, don't force to true
  };

  const toggleSound = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    setUserPrefersMuted(nextMuted); // Remember user's choice
    if (!isPlaying) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const stats = video.stats || {};
  const getStat = (key: string) => {
    const value = (stats as any)[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const playCount = getStat('playCount');
  const likeCount = getStat('diggCount');
  const commentCount = getStat('commentCount');
  const shareCount = getStat('shareCount');
  const collectCount = getStat('collectCount');

  const handleUseInMotionSwap = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    router.push(`/dashboard/motion-swap?videoId=${video.id}`);
  };

  return (
    <div
      className="group block border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={toggleSound}
    >
      <div className="aspect-[9/16] bg-gray-100 relative">
        {video.video_cdn_url ? (
          <video
            ref={videoRef}
            src={video.video_cdn_url}
            poster={video.cover_url || undefined}
            muted
            playsInline
            loop
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : video.cover_url ? (
          <Image
            src={video.cover_url}
            alt={video.description || 'TikTok video'}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <Video className="w-8 h-8" />
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleSound();
          }}
          className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5"
        >
          {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        </button>
      </div>
      <div className="p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Play className="w-3.5 h-3.5" />
            {playCount.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" />
            {likeCount.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="w-3.5 h-3.5" />
            {commentCount.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            {shareCount.toLocaleString()}
          </span>
        </div>
        <button
          onClick={handleUseInMotionSwap}
          className="w-full px-3 py-2 text-xs font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
        >
          <Wand2 className="w-3 h-3" />
          Use in Motion Swap
        </button>
      </div>
    </div>
  );
}
