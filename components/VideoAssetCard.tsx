"use client";

import { useRef } from "react";
import { Pencil, Trash2, Video, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface VideoAsset {
  id: string;
  platform?: string;
  video_url?: string | null;
  video_cdn_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  source_id?: string | null;
  source_name?: string | null;
  source_type?: "creator" | "reference_video";
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
  isSystem?: boolean;
}

interface VideoAssetCardProps {
  video: VideoAsset;
  onViewDetails: (video: VideoAsset) => void;
  onDelete?: (video: VideoAsset) => void;
  compact?: boolean;
  isDeleting?: boolean;
}

export default function VideoAssetCard({
  video,
  onViewDetails,
  onDelete,
  compact = false,
  isDeleting = false,
}: VideoAssetCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleViewDetails = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onViewDetails(video);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!onDelete || isDeleting) return;
    onDelete(video);
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
      className={`assets-video-card relative flex h-full flex-col bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 group ${
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

      <div className={`assets-video-card-footer mt-auto bg-white ${compact ? 'p-2' : 'p-3'}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={handleViewDetails}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-black bg-black px-3 text-xs font-semibold text-white transition hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
            disabled={isDeleting}
            aria-label="Edit video"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || video.isSystem}
              className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={video.isSystem ? 'System video cannot be deleted' : 'Delete video'}
              title={video.isSystem ? 'System video cannot be deleted' : 'Delete video'}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>{deletingOverlay}</AnimatePresence>
    </motion.div>
  );
}
