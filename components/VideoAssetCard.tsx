"use client";

import { useRef } from "react";
import { Eye, Video } from "lucide-react";

interface VideoAsset {
  id: string;
  platform?: string;
  video_url?: string | null;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  source_id?: string | null;
}

interface VideoAssetCardProps {
  video: VideoAsset;
  onViewDetails: (video: VideoAsset) => void;
}

export default function VideoAssetCard({
  video,
  onViewDetails,
}: VideoAssetCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleViewDetails = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onViewDetails(video);
  };

  const handleHoverPlay = () => {
    if (!videoRef.current) return;
    videoRef.current.play().catch(() => undefined);
  };

  const handleHoverPause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  return (
    <div className="assets-video-card bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 group">
      <div
        className="assets-video-card-media relative w-full aspect-[9/16] bg-gray-100"
        onMouseEnter={handleHoverPlay}
        onMouseLeave={handleHoverPause}
        onFocus={handleHoverPlay}
        onBlur={handleHoverPause}
      >
        {video.video_cdn_url ? (
          <video
            ref={videoRef}
            src={video.video_cdn_url}
            className="w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
            loop
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <Video className="w-8 h-8" />
          </div>
        )}
        <div className="assets-video-card-overlay absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="assets-video-card-footer p-3 bg-white">
        <button
          onClick={handleViewDetails}
          className="assets-video-card-action w-full flex items-center justify-between px-3 py-2.5 text-sm bg-white text-gray-900 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 group/btn"
        >
          <span className="font-medium">View Details</span>
          <Eye className="w-4 h-4 text-gray-400 group-hover/btn:text-gray-600 transition-colors" />
        </button>
      </div>
    </div>
  );
}
