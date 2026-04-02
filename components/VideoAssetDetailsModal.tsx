"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  Shuffle,
  Clock,
  Languages,
  Film,
  Trash2,
  Upload,
  AlertTriangle,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import VideoPlayer from "@/components/ui/VideoPlayer";
import CompetitorShotsEditor from "@/components/CompetitorShotsEditor";
import { parseShotsFromAnalysis } from "@/lib/competitor-shot-form";
import { getAnalysisShotCount, normalizeAnalysisToV2 } from "@/lib/video-analysis-schema";

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
  created_at?: string | null;
  updated_at?: string | null;
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
  onVideoUpdated?: (video: VideoAsset) => void;
  requireFirstFrameForClone?: boolean;
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
  onVideoUpdated,
  requireFirstFrameForClone = false,
}: VideoAssetDetailsModalProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isCreatingClone, setIsCreatingClone] = useState(false);
  const [deletingVideoIds, setDeletingVideoIds] = useState<Set<string>>(new Set());
  const [currentVideo, setCurrentVideo] = useState<VideoAsset | null>(video);
  const [isUploadingFirstFrame, setIsUploadingFirstFrame] = useState(false);
  const [firstFrameUploadError, setFirstFrameUploadError] = useState<string | null>(null);
  const [editableVideoName, setEditableVideoName] = useState("");
  const [isSavingVideoName, setIsSavingVideoName] = useState(false);
  const firstFrameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCurrentVideo(video);
    setFirstFrameUploadError(null);
  }, [video]);

  const parsedShots = useMemo(
    () => parseShotsFromAnalysis(currentVideo?.analysis_result || null),
    [currentVideo?.analysis_result],
  );

  const displayDurationSeconds = useMemo(() => {
    const normalizedAnalysis = normalizeAnalysisToV2(currentVideo?.analysis_result || null);
    const analysisDuration = normalizedAnalysis?.video_duration_seconds;
    const summedShotDuration = parsedShots.reduce(
      (sum, shot) => sum + (Number(shot.duration_seconds) || 0),
      0,
    );

    if (typeof analysisDuration === "number" && analysisDuration > 0) {
      return analysisDuration;
    }

    if (summedShotDuration > 0) {
      return summedShotDuration;
    }

    return currentVideo?.duration_seconds || null;
  }, [currentVideo?.analysis_result, currentVideo?.duration_seconds, parsedShots]);

  const analysisName = useMemo(() => {
    if (!currentVideo?.analysis_result || typeof currentVideo.analysis_result !== "object") {
      return null;
    }
    const name = (currentVideo.analysis_result as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }, [currentVideo?.analysis_result]);

  const detectedLanguage = useMemo(() => {
    if (currentVideo?.analysis_result && typeof currentVideo.analysis_result === "object") {
      const detected = (currentVideo.analysis_result as { detected_language?: unknown }).detected_language;
      if (typeof detected === "string") return detected;
    }
    return currentVideo?.analysis_language || null;
  }, [currentVideo?.analysis_result, currentVideo?.analysis_language]);

  const hasAnalysis = Boolean(currentVideo?.analysis_result);
  const hasFirstFrame = Boolean(currentVideo?.cover_url);
  const isCompact = size === "compact";
  const isAgentSelectionMode = Boolean(onUseForClone);
  const cloneActionNeedsFirstFrame = Boolean(
    requireFirstFrameForClone &&
    currentVideo?.source_type === "creator",
  );
  const cloneActionBlockedByFirstFrame = cloneActionNeedsFirstFrame && !hasFirstFrame;
  const cloneActionDisabled = !hasAnalysis || cloneActionBlockedByFirstFrame || isCreatingClone;
  const cloneActionText = cloneActionBlockedByFirstFrame
    ? "First frame required"
    : cloneActionLabel;
  const cloneActionClassName = cloneActionBlockedByFirstFrame
    ? "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 disabled:cursor-not-allowed"
    : "assets-video-details-action flex w-full items-center justify-center gap-2 rounded-lg border border-[#0f0f0f] bg-[#0f0f0f] px-3 py-2.5 text-sm text-white transition-all duration-200 group/btn hover:bg-[#1d1d1d] disabled:cursor-not-allowed disabled:border-[#cfcfca] disabled:bg-[#e9e9e6] disabled:text-[#6f6f6a]";
  const cloneActionStyle = cloneActionBlockedByFirstFrame
    ? {
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#b91c1c",
        boxShadow: "none",
      }
    : undefined;
  const shouldShowFirstFramePanel = currentVideo?.source_type === "creator";
  const previewWidth = isCompact ? 252 : 324;
  const previewHeight = Math.round((previewWidth * 16) / 9);
  const previewCardClassName = "flex-none overflow-hidden rounded-xl";

  const displayName = useMemo(() => {
    if (!currentVideo) return "TikTok Video";
    return currentVideo.source_name || "TikTok Video";
  }, [currentVideo]);

  const overviewName = useMemo(() => {
    if (!currentVideo) return "—";
    return (
      currentVideo.description?.trim()
      || analysisName
      || currentVideo.source_name?.trim()
      || "—"
    );
  }, [analysisName, currentVideo]);

  useEffect(() => {
    setEditableVideoName(overviewName === "—" ? "" : overviewName);
  }, [overviewName, currentVideo?.id]);

  const isDeletingCurrentVideo = Boolean(currentVideo?.id && deletingVideoIds.has(currentVideo.id));
  const trimmedEditableVideoName = editableVideoName.trim();
  const canSaveVideoName = Boolean(
    currentVideo &&
    trimmedEditableVideoName &&
    trimmedEditableVideoName !== overviewName &&
    !isSavingVideoName,
  );

  const handleUseForClone = async () => {
    if (!currentVideo?.analysis_result || !currentVideo) {
      showError("Video analysis is still running. Please try again shortly.");
      return;
    }

    if (onUseForClone) {
      // Agent selection flow: close immediately for snappy UX,
      // then continue async work in the background.
      onClose();
      try {
        await onUseForClone(currentVideo);
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
            videoId: currentVideo.id,
            analysis: currentVideo.analysis_result,
            language: currentVideo.analysis_language || "en",
            videoUrl: currentVideo.video_cdn_url || null,
            tiktokUrl: currentVideo.video_url || null,
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

  const handleUseInMotionClone = () => {
    if (!currentVideo) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        "preselect_motion_clone_video",
        JSON.stringify({
          videoId: currentVideo.id,
        }),
      );
    }

    showSuccess("Video selected for Motion Clone.");
    onClose();
    router.push("/dashboard/motion-clone");
  };

  const handleDeleteVideo = async () => {
    if (!currentVideo || !onDeleteVideo || deletingVideoIds.has(currentVideo.id)) return;

    onClose();

    try {
      setDeletingVideoIds((current) => new Set(current).add(currentVideo.id));
      await onDeleteVideo(currentVideo);
      onVideoDeleted?.(currentVideo.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete video";
      showError(message);
    } finally {
      setDeletingVideoIds((current) => {
        const next = new Set(current);
        next.delete(currentVideo.id);
        return next;
      });
    }
  };

  const handleSaveVideoName = async () => {
    if (!currentVideo) return;

    const nextName = trimmedEditableVideoName;
    if (!nextName) {
      showError("Video name is required.");
      return;
    }

    if (nextName.length > 120) {
      showError("Video name must be 120 characters or fewer.");
      return;
    }

    const isCompetitorAd =
      currentVideo.source_type === "competitor_ad" || Boolean(currentVideo.competitor_ad_id);
    const endpoint = isCompetitorAd
      ? `/api/competitor-ads/${currentVideo.id}`
      : `/api/creator-videos/${currentVideo.id}`;
    const payload = isCompetitorAd
      ? { competitor_name: nextName }
      : { description: nextName };

    setIsSavingVideoName(true);

    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update video name.");
      }

      const nextVideo = isCompetitorAd
        ? {
            ...currentVideo,
            description: data.competitorAd?.competitor_name ?? nextName,
            analysis_language: data.competitorAd?.language ?? currentVideo.analysis_language,
            analysis_result: data.competitorAd?.analysis_result ?? currentVideo.analysis_result,
            duration_seconds: data.competitorAd?.video_duration_seconds ?? currentVideo.duration_seconds,
            updated_at: data.competitorAd?.updated_at ?? currentVideo.updated_at,
          }
        : {
            ...currentVideo,
            ...data.video,
          };

      setCurrentVideo(nextVideo);
      onVideoUpdated?.(nextVideo);
      showSuccess("Video name updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update video name.";
      showError(message);
    } finally {
      setIsSavingVideoName(false);
    }
  };

  const handleUploadFirstFrame = async (file: File | null) => {
    if (!file || !currentVideo?.id) return;

    setIsUploadingFirstFrame(true);
    setFirstFrameUploadError(null);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file for the first frame.");
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/creator-videos/${currentVideo.id}/first-frame`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.video) {
        throw new Error(data.error || "Failed to upload first frame image.");
      }

      const nextVideo = {
        ...currentVideo,
        ...data.video,
      } as VideoAsset;

      setCurrentVideo(nextVideo);
      onVideoUpdated?.(nextVideo);
      showSuccess("First frame uploaded. Motion Clone is now available.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload first frame image.";
      setFirstFrameUploadError(message);
      showError(message);
    } finally {
      setIsUploadingFirstFrame(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && currentVideo && (
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
            className={`assets-modal-panel assets-video-details-panel relative mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ${
              isCompact
                ? "max-h-[76vh] max-w-[980px]"
                : "max-h-[86vh] max-w-5xl"
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
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className={`assets-modal-body grid min-h-0 grid-cols-1 items-start gap-6 overflow-y-auto p-6 ${isCompact ? "lg:grid-cols-[max-content_minmax(0,1fr)]" : "lg:grid-cols-[max-content_minmax(0,1fr)]"} lg:items-end`}>
              <div className={`min-h-0 min-w-0 overflow-hidden ${shouldShowFirstFramePanel ? "flex items-end gap-4" : "flex items-end justify-center"}`}>
                {shouldShowFirstFramePanel ? (
                  <label
                    className={`assets-video-details-preview flex min-w-0 min-h-0 border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-500 cursor-pointer ${previewCardClassName}`}
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                  >
                    <div className="flex h-full w-full items-center justify-center overflow-hidden px-5 text-center">
                      {currentVideo.cover_url ? (
                        <img
                          src={currentVideo.cover_url}
                          alt="First frame"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Upload className="w-5 h-5 text-gray-500" />
                          {isUploadingFirstFrame ? (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Uploading first frame...</span>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-gray-800">First Frame</p>
                              <p className="text-xs text-gray-500">Click to upload</p>
                            </>
                          )}
                          {firstFrameUploadError ? (
                            <p className="max-w-[220px] text-xs text-red-500">{firstFrameUploadError}</p>
                          ) : null}
                        </div>
                      )}
                      <span className="sr-only">Upload first frame</span>
                      <input
                        ref={firstFrameInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingFirstFrame}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          void handleUploadFirstFrame(file);
                          event.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </label>
                ) : null}
                <div className="min-h-0 flex items-stretch justify-center">
                  <div
                    className={`assets-video-details-preview bg-black/95 ${previewCardClassName}`}
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                  >
                    {currentVideo.video_cdn_url ? (
                      <VideoPlayer
                        key={`${currentVideo.id}:${currentVideo.video_cdn_url ?? "no-video"}`}
                        src={currentVideo.video_cdn_url}
                        className="h-full w-full object-contain"
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
              </div>

              <div
                className="assets-video-details-panel min-h-0 flex flex-col gap-4 self-end"
                style={{ height: `${previewHeight}px` }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="assets-video-details-label text-xs uppercase tracking-wide text-gray-500">
                      Video Name
                    </p>
                    <span className="text-xs text-gray-400">
                      {trimmedEditableVideoName.length}/120
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editableVideoName}
                      onChange={(event) => setEditableVideoName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && canSaveVideoName) {
                          event.preventDefault();
                          void handleSaveVideoName();
                        }
                      }}
                      maxLength={120}
                      placeholder={displayName}
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveVideoName()}
                      disabled={!canSaveVideoName}
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-black bg-black px-3 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isSavingVideoName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="assets-video-details-label text-xs uppercase tracking-wide text-gray-500">
                    Overview
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                      <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {displayDurationSeconds
                          ? `${displayDurationSeconds}s`
                          : "—"}
                      </span>
                    </div>
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                      <Languages className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-800">{detectedLanguage || "—"}</span>
                    </div>
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                      <Film className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="font-medium text-gray-800">{getAnalysisShotCount(currentVideo.analysis_result || null) || "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2">
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
                      {currentVideo?.analysis_status === "failed" ? (
                        <>
                          <p className="text-red-600">
                            Analysis failed. Please retry by re-importing the
                            video.
                          </p>
                          {currentVideo.analysis_error && (
                            <p className="text-xs text-red-500">
                              {currentVideo.analysis_error}
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
                    disabled={cloneActionDisabled}
                    className={cloneActionClassName}
                    style={cloneActionStyle}
                  >
                    <span className="font-medium flex items-center gap-2">
                      {isCreatingClone ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : cloneActionBlockedByFirstFrame ? (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-white/80 group-hover/btn:text-white transition-colors" />
                      )}
                      {cloneActionText}
                    </span>
                  </button>
                  {!isAgentSelectionMode && onDeleteVideo ? (
                    <>
                      <button
                        onClick={handleUseInMotionClone}
                        disabled={!currentVideo.source_id}
                        className="assets-video-details-action w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-black text-white rounded-lg border border-black hover:bg-gray-900 transition-all duration-200 group/btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="font-medium flex items-center gap-2">
                          <Shuffle className="w-4 h-4 text-white/90" />
                          Use in Motion Clone
                        </span>
                      </button>
                      <button
                        onClick={handleDeleteVideo}
                        disabled={isDeletingCurrentVideo}
                        className="assets-video-details-action w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 text-sm bg-white text-red-600 rounded-lg border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="font-medium flex items-center gap-2">
                          {isDeletingCurrentVideo ? (
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
