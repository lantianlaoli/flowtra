"use client";

import { useRef } from "react";
import { Eye, Trash2, Video } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
  compact?: boolean;
  isDeleting?: boolean;
}

export default function VideoAssetCard({
  video,
  onViewDetails,
  compact = false,
  isDeleting = false,
}: VideoAssetCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleViewDetails = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onViewDetails(video);
  };

  const handleHoverPlay = () => {
    if (!videoRef.current || isDeleting) return;
    videoRef.current.play().catch(() => undefined);
  };

  const handleHoverPause = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
  };

  const deletingOverlay = isDeleting ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[rgba(255,255,255,0.9)]"
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -6, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_30px_rgba(15,15,15,0.16)]"
      >
        <Trash2 className="h-5 w-5" />
      </motion.div>
      <p className="text-sm font-semibold text-[#1f1f1e]">Removing…</p>
    </motion.div>
  ) : null;

  return (
    <motion.div
      className={`assets-video-card relative bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 group ${
        isDeleting ? "pointer-events-none" : "hover:shadow-lg"
      }`}
      whileHover={isDeleting ? undefined : { y: -2 }}
    >
      <div
        className={`assets-video-card-media relative w-full bg-gray-100 ${compact ? 'aspect-[3/4]' : 'aspect-[9/16]'}`}
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

      <div className={`assets-video-card-footer bg-white ${compact ? 'p-2' : 'p-3'}`}>
        <button
          onClick={handleViewDetails}
          className={`assets-video-card-action w-full flex items-center justify-between bg-white text-gray-900 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 group/btn ${compact ? 'px-2.5 py-2 text-xs' : 'px-3 py-2.5 text-sm'}`}
          disabled={isDeleting}
        >
          <span className="font-medium">View Details</span>
          <Eye className="w-4 h-4 text-gray-400 group-hover/btn:text-gray-600 transition-colors" />
        </button>
      </div>
      <AnimatePresence>{deletingOverlay}</AnimatePresence>
    </motion.div>
  );
}
