"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  Shuffle,
  Clock,
  Languages,
  Film,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import VideoPlayer from "@/components/ui/VideoPlayer";
import CompetitorShotsEditor from "@/components/CompetitorShotsEditor";
import { parseShotsFromAnalysis } from "@/lib/competitor-shot-form";
import { getAnalysisShotCount } from "@/lib/video-analysis-schema";

interface VideoAsset {
  id: string;
  video_url?: string | null;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  source_id?: string | null;
  source_name?: string | null;
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
  source_type?: "creator" | "competitor_ad";
  competitor_ad_id?: string | null;
}

interface VideoAssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoAsset | null;
  size?: "default" | "compact";
  onUseForClone?: (video: VideoAsset) => Promise<void> | void;
  cloneActionLabel?: string;
  onDeleteVideo?: (video: VideoAsset) => Promise<void> | void;
  onVideoDeleted?: (videoId: string) => void;
}

export default function VideoAssetDetailsModal({
  isOpen,
  onClose,
  video,
  size = "default",
  onUseForClone,
  cloneActionLabel = "Use for Clone",
  onDeleteVideo,
  onVideoDeleted,
}: VideoAssetDetailsModalProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isCreatingClone, setIsCreatingClone] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  const parsedShots = useMemo(
    () => parseShotsFromAnalysis(video?.analysis_result || null),
    [video?.analysis_result],
  );

  const analysisName = useMemo(() => {
    if (!video?.analysis_result || typeof video.analysis_result !== "object") {
      return null;
    }
    const name = (video.analysis_result as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  }, [video?.analysis_result]);

  const detectedLanguage = useMemo(() => {
    if (video?.analysis_result && typeof video.analysis_result === "object") {
      const detected = (video.analysis_result as { detected_language?: unknown }).detected_language;
      if (typeof detected === "string") return detected;
    }
    return video?.analysis_language || null;
  }, [video?.analysis_result, video?.analysis_language]);

  const hasAnalysis = Boolean(video?.analysis_result);
  const isCompact = size === "compact";
  const isAgentSelectionMode = Boolean(onUseForClone);

  const displayName = useMemo(() => {
    if (!video) return "TikTok Video";
    return video.source_name || "TikTok Video";
  }, [video]);

  const handleUseForClone = async () => {
    if (!video?.analysis_result || !video) {
      showError("Video analysis is still running. Please try again shortly.");
      return;
    }

    if (onUseForClone) {
      // Agent selection flow: close immediately for snappy UX,
      // then continue async work in the background.
      onClose();
      try {
        await onUseForClone(video);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start clone flow";
        showError(message);
      }
      return;
    }

    setIsCreatingClone(true);
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "preselect_competitor_ad",
          JSON.stringify({
            videoId: video.id,
            analysis: video.analysis_result,
            language: video.analysis_language || "en",
            videoUrl: video.video_cdn_url || null,
            tiktokUrl: video.video_url || null,
          }),
        );
      }

      showSuccess("Analysis ready. Continue to clone setup.");
      onClose();
      router.push("/dashboard/competitor-ugc-replication");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start clone flow";
      showError(message);
    } finally {
      setIsCreatingClone(false);
    }
  };

  const handleUseInMotionSwap = () => {
    if (!video) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "preselect_motion_swap_video",
        JSON.stringify({
          videoId: video.id,
        }),
      );
    }

    showSuccess("Video selected for Motion Swap.");
    onClose();
    router.push("/dashboard/motion-swap");
  };

  const handleDeleteVideo = async () => {
    if (!video || isDeletingVideo || !onDeleteVideo) return;

    onClose();

    try {
      setIsDeletingVideo(true);
      await onDeleteVideo(video);
      onVideoDeleted?.(video.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete video";
      showError(message);
    } finally {
      setIsDeletingVideo(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && video && (
        <motion.div
          className="assets-modal assets-video-details fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="assets-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`assets-modal-panel assets-video-details-panel relative flex flex-col bg-white rounded-2xl shadow-xl border border-gray-200 w-full mx-auto overflow-hidden h-[86vh] ${
              isCompact ? "max-w-[1320px] h-[78vh] max-h-[820px]" : "max-w-5xl"
            }`}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="assets-modal-title text-lg font-semibold text-gray-900">
                  Video Details
                </h3>
                <p className="assets-modal-subtitle text-sm text-gray-500">
                  {displayName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className={`assets-modal-body grid min-h-0 flex-1 grid-cols-1 items-stretch gap-6 p-6 overflow-hidden ${isCompact ? "lg:grid-cols-[420px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)]"}`}>
              <div className="min-h-0 h-full flex items-center justify-center">
                <div className={`assets-video-details-preview bg-black/95 rounded-xl overflow-hidden aspect-[9/16] ${isCompact ? "w-full max-w-[380px] h-auto" : "h-full w-auto max-w-full"}`}>
                  {video.video_cdn_url ? (
                    <VideoPlayer
                      src={video.video_cdn_url}
                      className="w-full h-full object-contain"
                      showControls
                    />
                  ) : (
                    <div
                      className={`assets-video-details-preview-empty flex h-full w-full items-center justify-center text-gray-400 ${
                        isCompact ? "min-h-[320px]" : "aspect-[9/16]"
                      }`}
                    >
                      Video unavailable
                    </div>
                  )}
                </div>
              </div>

              <div className="assets-video-details-panel min-h-0 h-full flex flex-col gap-6">
                <div className="space-y-2">
                  <p className="assets-video-details-label text-xs uppercase tracking-wide text-gray-500">
                    Overview
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        Duration
                      </span>
                      <span>
                        {video.duration_seconds
                          ? `${video.duration_seconds}s`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-gray-400" />
                        Language
                      </span>
                      <span>{detectedLanguage || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-400" />
                        Shots
                      </span>
                      <span>{getAnalysisShotCount(video.analysis_result || null) || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-400" />
                        Name
                      </span>
                      <span className="assets-video-details-meta truncate max-w-[160px]">
                        {analysisName || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-3">
                  <p className="assets-video-details-label text-xs uppercase tracking-wide text-gray-500">
                    Structure Analysis
                  </p>
                  {hasAnalysis ? (
                    <div className="min-h-0 flex-1">
                      <div className="assets-video-details-shots h-full overflow-y-auto pr-1">
                        <CompetitorShotsEditor
                          shots={parsedShots}
                          onShotsChange={() => {}}
                          showSummary={false}
                          readOnly
                          hideHeader
                          expandedMaxHeightClass="max-h-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="assets-video-details-alert rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 space-y-3">
                      {video?.analysis_status === "failed" ? (
                        <>
                          <p className="text-red-600">
                            Analysis failed. Please retry by re-importing the
                            video.
                          </p>
                          {video.analysis_error && (
                            <p className="text-xs text-red-500">
                              {video.analysis_error}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>
                              Analysis is running automatically in the
                              background.
                            </span>
                          </div>
                          <p className="assets-video-details-meta text-xs text-gray-500">
                            This may take a few minutes. Refresh the page to see
                            the results.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="assets-video-details-actions mt-auto flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleUseForClone}
                    disabled={!hasAnalysis || isCreatingClone}
                    className="assets-video-details-action w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-[#0f0f0f] text-white rounded-lg border border-[#0f0f0f] hover:bg-[#1d1d1d] transition-all duration-200 group/btn disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#0f0f0f] disabled:border-[#0f0f0f]"
                  >
                    <span className="font-medium flex items-center gap-2">
                      {isCreatingClone ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-white/80 group-hover/btn:text-white transition-colors" />
                      )}
                      {cloneActionLabel}
                    </span>
                  </button>
                  {!isAgentSelectionMode && onDeleteVideo ? (
                    <>
                      <button
                        onClick={handleUseInMotionSwap}
                        disabled={!video.source_id}
                        className="assets-video-details-action w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-black text-white rounded-lg border border-black hover:bg-gray-900 transition-all duration-200 group/btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="font-medium flex items-center gap-2">
                          <Shuffle className="w-4 h-4 text-white/90" />
                          Use in Motion Swap
                        </span>
                      </button>
                      <button
                        onClick={handleDeleteVideo}
                        disabled={isDeletingVideo}
                        className="assets-video-details-action w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white text-red-600 rounded-lg border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="font-medium flex items-center gap-2">
                          {isDeletingVideo ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete Video
                        </span>
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
