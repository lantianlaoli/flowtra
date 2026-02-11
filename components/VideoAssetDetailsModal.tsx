"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  Clock,
  Languages,
  Film,
  Tag,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import VideoPlayer from "@/components/ui/VideoPlayer";
import CompetitorShotsEditor from "@/components/CompetitorShotsEditor";
import { parseShotsFromAnalysis } from "@/lib/competitor-shot-form";

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
}

interface VideoAssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoAsset | null;
  size?: "default" | "compact";
  onUseForClone?: (video: VideoAsset) => Promise<void> | void;
  cloneActionLabel?: string;
}

export default function VideoAssetDetailsModal({
  isOpen,
  onClose,
  video,
  size = "default",
  onUseForClone,
  cloneActionLabel = "Use for Clone",
}: VideoAssetDetailsModalProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isCreatingClone, setIsCreatingClone] = useState(false);

  const shots = useMemo(() => {
    const raw =
      video?.analysis_result && typeof video.analysis_result === "object"
        ? (video.analysis_result as any).shots
        : null;
    return Array.isArray(raw) ? raw : [];
  }, [video?.analysis_result]);

  const parsedShots = useMemo(() => parseShotsFromAnalysis(shots), [shots]);

  const analysisName = useMemo(() => {
    if (!video?.analysis_result || typeof video.analysis_result !== "object")
      return null;
    const name = (video.analysis_result as any).name;
    return typeof name === "string" ? name : null;
  }, [video?.analysis_result]);

  const analysisDuration = useMemo(() => {
    if (!video?.analysis_result || typeof video.analysis_result !== "object")
      return null;
    const duration = (video.analysis_result as any).video_duration_seconds;
    return typeof duration === "number" ? duration : null;
  }, [video?.analysis_result]);

  const detectedLanguage = useMemo(() => {
    if (video?.analysis_result && typeof video.analysis_result === "object") {
      const detected = (video.analysis_result as any).detected_language;
      if (typeof detected === "string") return detected;
    }
    return video?.analysis_language || null;
  }, [video?.analysis_result, video?.analysis_language]);

  const hasAnalysis = Boolean(video?.analysis_result);
  const isCompact = size === "compact";

  const displayName = useMemo(() => {
    if (!video) return "TikTok Video";
    return video.source_name || "TikTok Video";
  }, [video]);

  const handleUseForClone = async () => {
    if (!video?.analysis_result || !video) {
      showError("Video analysis is still running. Please try again shortly.");
      return;
    }

    setIsCreatingClone(true);
    try {
      if (onUseForClone) {
        await onUseForClone(video);
        onClose();
        return;
      }

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
            className={`assets-modal-panel assets-video-details-panel relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full mx-auto overflow-hidden ${
              isCompact ? "max-w-4xl max-h-[86vh]" : "max-w-5xl"
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

            <div className={`assets-modal-body grid grid-cols-1 gap-6 p-6 overflow-y-auto ${isCompact ? "lg:grid-cols-[minmax(0,0.54fr)_minmax(0,0.46fr)]" : "lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)]"}`}>
              <div className="assets-video-details-preview bg-black/95 rounded-xl overflow-hidden">
                {video.video_cdn_url ? (
                  <VideoPlayer
                    src={video.video_cdn_url}
                    className={`w-full ${isCompact ? "max-h-[62vh]" : "h-full"}`}
                    showControls
                  />
                ) : (
                  <div className={`assets-video-details-preview-empty flex items-center justify-center text-gray-400 ${isCompact ? "aspect-[4/5]" : "aspect-[9/16]"}`}>
                    Video unavailable
                  </div>
                )}
              </div>

              <div className="assets-video-details-panel flex flex-col gap-6">
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
                      <span>{parsedShots.length || "—"}</span>
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

                <div className="flex-1 space-y-3">
                  <p className="assets-video-details-label text-xs uppercase tracking-wide text-gray-500">
                    Structure Analysis
                  </p>
                  {hasAnalysis ? (
                    <div className="space-y-3">
                      <div className="assets-video-details-shots max-h-[420px] overflow-y-auto">
                        <CompetitorShotsEditor
                          shots={parsedShots}
                          onShotsChange={() => {}}
                          showSummary={false}
                          readOnly
                          hideHeader
                          expandedMaxHeightClass="max-h-[280px] overflow-y-auto"
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
                    className="assets-video-details-action w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white text-gray-900 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 group/btn disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200"
                  >
                    <span className="font-medium flex items-center gap-2">
                      {isCreatingClone ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-gray-400 group-hover/btn:text-gray-600 transition-colors" />
                      )}
                      {cloneActionLabel}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
