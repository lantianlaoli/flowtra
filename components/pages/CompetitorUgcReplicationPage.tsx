"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useCompetitorUgcReplicationWorkflow } from "@/hooks/useCompetitorUgcReplicationWorkflow";
import { useMultipleProjectsRealtime } from "@/hooks/useCompetitorUgcReplicationRealtime";
import { useUser } from "@clerk/nextjs";
import { useCredits } from "@/contexts/CreditsContext";
import { useToast } from "@/contexts/ToastContext";
import Sidebar from "@/components/layout/Sidebar";
import { Sparkles, Coins, TrendingUp, AlertCircle, Boxes } from "lucide-react";
import BottomComposerBar from "@/components/ui/BottomComposerBar";

// New components for redesigned UX
import MotionSwapReferenceControls from "@/components/motion-swap/MotionSwapReferenceControls";
import ConfigPopover from "@/components/ui/ConfigPopover";
import GenerationProgressDisplay, {
  type Generation,
  type SegmentCardSummary,
} from "@/components/ui/GenerationProgressDisplay";
import SegmentInspector, {
  type SegmentPromptPayload,
} from "@/components/competitor-ugc-replication/SegmentInspector";

import {
  canAffordModel,
  getGenerationCost,
  getSegmentCountFromDuration,
  snapDurationToModel,
  type VideoModel,
  type VideoDuration,
  getReplicaPhotoCredits,
} from "@/lib/constants";
import { Format } from "@/components/ui/FormatSelector";
import { LanguageCode } from "@/components/ui/LanguageSelector";
import type {
  SegmentStatusPayload,
  SegmentPrompt,
} from "@/lib/competitor-ugc-replication-workflow";
import type { CreatorSourceVideo } from "@/lib/supabase";

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

type ReplicaAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "4:5"
  | "5:4"
  | "9:16"
  | "16:9"
  | "21:9";
type ReplicaResolution = "1K" | "2K" | "4K";
type ReplicaOutputFormat = "png" | "jpg";

const REPLICA_ASPECT_RATIOS: ReplicaAspectRatio[] = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];
const REPLICA_RESOLUTIONS: ReplicaResolution[] = ["1K", "2K", "4K"];
const REPLICA_OUTPUT_FORMATS: ReplicaOutputFormat[] = ["png", "jpg"];

const STEP_DESCRIPTIONS: Record<string, string> = {
  generating_cover:
    "Crafting your viral hook – the moment they stop scrolling…",
  generating_segment_frames:
    'Open "Edit" to manually refine photos and prompts for each segment until satisfied.',
  reviewing_segment_frames:
    'Frames ready! Click "Edit" to refine prompts, then trigger video generation for each segment.',
  generating_segment_videos: "Transforming scenes into engagement powerhouses…",
  merging_segments: "Stitching viral moments into one compelling story…",
  awaiting_merge: "All scenes are ready – assembling your video clone…",
  ready_for_video:
    "Your competitor strategy is dialed in! Ready to generate the final video",
  generating_video: "Creating your winning video… it's almost time to viral!",
  processing:
    "Analyzing competitor tactics and adapting them for your product…",
  completed: "Your viral competitor clone is ready to roll!",
  failed: "Generation paused – let's troubleshoot and try again",
};

const STATUS_MAP: Record<string, Generation["status"]> = {
  completed: "completed",
  failed: "failed",
  processing: "processing",
  generating_cover: "processing",
  generating_segment_frames: "processing",
  generating_segment_videos: "processing",
  merging_segments: "processing",
  segment_frames_ready: "awaiting_review",
  ready_for_video: "awaiting_review",
  generating_video: "processing",
};

type SessionGeneration = Generation & {
  projectId?: string;
  isSegmented?: boolean;
  segmentStatus?: SegmentStatusPayload | null;
  segmentPlan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
  segments?: SegmentCardSummary[] | null;
  awaitingMerge?: boolean;
  mergeTaskId?: string | null;
  videoGenerationRequested?: boolean;
  isPhotoOnly?: boolean;
};

interface CompetitorUgcReplicationStatusPayload {
  success?: boolean;
  status?: string;
  workflowStatus?: string;
  isCompleted?: boolean;
  isFailed?: boolean;
  current_step?: string | null;
  progress_percentage?: number;
  progress?: number;
  data?: {
    videoUrl?: string | null;
    coverImageUrl?: string | null;
    videoModel?: VideoModel | null;
    video_model?: VideoModel | null;
    downloaded?: boolean;
    errorMessage?: string | null;
    videoDuration?: string | null;
    videoAspectRatio?: "16:9" | "9:16" | string | null;
    segmentCount?: number | null;
    segmentDurationSeconds?: number | null;
    isSegmented?: boolean | null;
    segmentStatus?: SegmentStatusPayload | null;
    segmentPlan?:
      | { segments?: SegmentPrompt[] }
      | Record<string, unknown>
      | null;
    segments?: SegmentCardSummary[] | null;
    awaitingMerge?: boolean;
    mergeTaskId?: string | null;
    photoOnly?: boolean | null;
    videoGenerationRequested?: boolean | null;
    credits_cost?: number | null;
  };
  error?: string;
}

const STEP_PROGRESS_HINTS: Record<string, number> = {
  generating_cover: 20,
  ready_for_video: 60,
  generating_segment_frames: 35,
  generating_segment_videos: 70,
  merging_segments: 80,
  awaiting_merge: 95,
  reviewing_segment_frames: 60,
  generating_video: 85,
  processing: 35,
  completed: 100,
  failed: 0,
};

const getStageLabel = (status: Generation["status"], step?: string | null) => {
  const key = step?.toLowerCase() ?? "";
  if (key && STEP_DESCRIPTIONS[key]) {
    return STEP_DESCRIPTIONS[key];
  }
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "processing") return "Processing…";
  return "Queued";
};

const ALL_VIDEO_MODELS: VideoModel[] = [
  "veo3",
  "veo3_fast",
  "seedance_1_5_pro",
  "kling_3",
];
const SESSION_STORAGE_KEY = "flowtra_competitor_ugc_replication_generations";

export default function CompetitorUgcReplicationPage() {
  const { user } = useUser();
  const {
    credits: userCredits,
    creditsData,
    updateCredits,
    refetchCredits,
  } = useCredits();
  const { showSuccess, showError } = useToast();
  const sidebarProps = {
    credits: userCredits,
    creditsData: creditsData,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    userImageUrl: user?.imageUrl,
  };

  // Platform selection feature has been removed

  // NEW: Generation history
  const [generations, setGenerations] = useState<SessionGeneration[]>([]);
  const [expandedGenerationId, setExpandedGenerationId] = useState<
    string | null
  >(null);
  const [segmentInspector, setSegmentInspector] = useState<{
    projectId: string;
    segmentIndex: number;
    generationId: string;
  } | null>(null);
  const [segmentInspectorSubmitting, setSegmentInspectorSubmitting] = useState({
    photo: false,
    video: false,
  });
  const [mergeSubmitting, setMergeSubmitting] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    setSegmentInspectorSubmitting({ photo: false, video: false });
  }, [segmentInspector?.generationId, segmentInspector?.segmentIndex]);
  const [downloadingProjects, setDownloadingProjects] = useState<
    Record<string, boolean>
  >({});

  // Video configuration states
  const [selectedModel, setSelectedModel] = useState<VideoModel>("veo3_fast");
  const [format, setFormat] = useState<Format>("9:16");

  // Image and language
  const [selectedImageModel] = useState<"nano_banana" | "seedream">(
    "nano_banana",
  );
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");

  // Other states
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true,
  });
  const elementsCount = 1;
  type ReferenceVideo = CreatorSourceVideo & {
    source_type?: "creator" | "competitor_ad";
    competitor_ad_id?: string;
  };
  const [assetVideos, setAssetVideos] = useState<ReferenceVideo[]>([]);
  const [isLoadingAssetVideos, setIsLoadingAssetVideos] = useState(true);
  const [selectedReferenceVideoId, setSelectedReferenceVideoId] = useState("");
  const selectedReferenceVideo = useMemo(
    () =>
      assetVideos.find((video) => video.id === selectedReferenceVideoId) ||
      null,
    [assetVideos, selectedReferenceVideoId],
  );
  const hasCompetitorReference = Boolean(selectedReferenceVideo);
  // Competitor ads are now video-only, so photo mode is never active from competitor selection
  const isCompetitorPhotoMode = false;
  const competitorImageUrl = null;
  const [photoAspectRatio, setPhotoAspectRatio] =
    useState<ReplicaAspectRatio>("9:16");
  const [photoResolution, setPhotoResolution] =
    useState<ReplicaResolution>("2K");
  const [photoOutputFormat, setPhotoOutputFormat] =
    useState<ReplicaOutputFormat>("png");
  const [isGenerating, setIsGenerating] = useState(false);
  const isMountedRef = useRef(true);
  const lastAutoLanguageRef = useRef<{
    competitorId: string | null;
    appliedLanguage: string | null;
  }>({
    competitorId: null,
    appliedLanguage: null,
  });
  const effectiveImageModel = hasCompetitorReference
    ? "nano_banana_pro"
    : selectedImageModel;

  useEffect(() => {
    const loadAssetVideos = async () => {
      setIsLoadingAssetVideos(true);
      try {
        const response = await fetch("/api/assets", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setAssetVideos(data.videos || []);
      } catch (error) {
        console.error(
          "[CompetitorUgcReplicationPage] Failed to load asset videos:",
          error,
        );
      } finally {
        setIsLoadingAssetVideos(false);
      }
    };

    loadAssetVideos();
  }, []);

  // Modal states for user guidance
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");

  // Auto-switch language when reference video with language is selected (only on first selection)
  useEffect(() => {
    // Reset tracking when reference is cleared
    if (!selectedReferenceVideo) {
      lastAutoLanguageRef.current = {
        competitorId: null,
        appliedLanguage: null,
      };
      return;
    }

    // Only auto-switch if:
    // 1. Reference video has a language
    // 2. This is the first time we're seeing this video (not already auto-switched)
    if (
      selectedReferenceVideo.analysis_language &&
      lastAutoLanguageRef.current.competitorId !== selectedReferenceVideo.id
    ) {
      console.log(
        `🌍 Auto-switching language to ${selectedReferenceVideo.analysis_language} (from reference video)`,
      );
      setSelectedLanguage(
        selectedReferenceVideo.analysis_language as LanguageCode,
      );
      // Mark that we've auto-switched for this reference video
      lastAutoLanguageRef.current = {
        competitorId: selectedReferenceVideo.id,
        appliedLanguage: selectedReferenceVideo.analysis_language,
      };
    }
  }, [selectedReferenceVideo]);

  const effectiveVideoDuration = useMemo<VideoDuration>(() => {
    const targetDurationSeconds = selectedReferenceVideo?.duration_seconds || 0;
    if (!targetDurationSeconds) {
      return "8";
    }
    return snapDurationToModel(selectedModel, Math.min(targetDurationSeconds, 64));
  }, [selectedReferenceVideo?.duration_seconds, selectedModel]);

  // Check for showcase TikTok analysis and preselect matching asset video
  useEffect(() => {
    const handleShowcaseAnalysis = async () => {
      if (typeof window === "undefined") return;

      const showcaseData = window.sessionStorage.getItem(
        "showcase_tiktok_analysis",
      );
      if (!showcaseData) return;

      try {
        const { videoUrl, tiktokUrl } = JSON.parse(showcaseData);

        // Clear from storage immediately (one-time use)
        window.sessionStorage.removeItem("showcase_tiktok_analysis");

        const match = assetVideos.find(
          (video) =>
            (tiktokUrl && video.video_url === tiktokUrl) ||
            (videoUrl &&
              (video.video_url === videoUrl ||
                video.video_cdn_url === videoUrl)),
        );

        if (match) {
          setSelectedReferenceVideoId(match.id);
          showSuccess("Your TikTok video is ready. You can start cloning.");
        } else {
          showError("Import the analyzed video in Assets to use it here.");
        }
      } catch (error) {
        console.error(
          "[CompetitorUgcReplicationPage] Failed to process showcase analysis:",
          error,
        );
        showError("Failed to load your TikTok analysis. Please try again.");
      }
    };

    // Delay to ensure assets are ready
    const timer = setTimeout(handleShowcaseAnalysis, 500);
    return () => clearTimeout(timer);
  }, [assetVideos, showSuccess, showError]);

  useEffect(() => {
    const handlePreselectCompetitorAd = async () => {
      if (typeof window === "undefined") return;
      if (isLoadingAssetVideos) return;

      const stored = window.sessionStorage.getItem("preselect_competitor_ad");
      if (!stored) return;

      window.sessionStorage.removeItem("preselect_competitor_ad");

      try {
        const parsed = JSON.parse(stored) as {
          creatorSourceVideoId?: string;
          videoId?: string;
        };
        const targetId = parsed.creatorSourceVideoId || parsed.videoId;
        if (!targetId) return;

        const match = assetVideos.find((video) => video.id === targetId);
        if (match) {
          setSelectedReferenceVideoId(match.id);
          showSuccess("Video ready. You can start cloning.");
        } else {
          showError("Selected video not found in Assets.");
        }
      } catch (error) {
        console.error(
          "[CompetitorUgcReplicationPage] Failed to preselect competitor ad:",
          error,
        );
        showError("Failed to load competitor ad. Please select it manually.");
      }
    };

    const timer = setTimeout(handlePreselectCompetitorAd, 300);
    return () => clearTimeout(timer);
  }, [assetVideos, isLoadingAssetVideos, showSuccess, showError]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed: SessionGeneration[] = JSON.parse(saved);
      setGenerations(
        parsed.map((gen) => {
          // Fix: Ensure segmented projects have proper segmentStatus to trigger polling
          // If it's a segmented project but segmentStatus is null, reinitialize it
          const segmentStatus =
            gen.segmentStatus ||
            (gen.isSegmented && gen.segmentCount
              ? {
                  total: gen.segmentCount,
                  framesReady: 0,
                  videosReady: 0,
                  segments: Array.from(
                    { length: gen.segmentCount },
                    (_, i) => ({
                      index: i,
                      status: "pending_first_frame",
                      firstFrameUrl:
                        gen.segmentStatus?.segments?.[i]?.firstFrameUrl || null,
                      closingFrameUrl:
                        gen.segmentStatus?.segments?.[i]?.closingFrameUrl ||
                        null,
                      videoUrl: null,
                      errorMessage: null,
                    }),
                  ),
                  mergedVideoUrl: null,
                }
              : null);

          return {
            ...gen,
            timestamp: new Date(gen.timestamp),
            downloaded: gen.downloaded ?? false,
            segmentStatus, // Updated with fix
          };
        }),
      );
    } catch (error) {
      console.error(
        "Failed to restore Competitor UGC Replication session state:",
        error,
      );
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!generations.length) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    try {
      const serialized = generations.map((gen) => ({
        ...gen,
        timestamp:
          gen.timestamp instanceof Date
            ? gen.timestamp.toISOString()
            : gen.timestamp,
      }));
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(serialized),
      );
    } catch (error) {
      console.error(
        "Failed to persist Competitor UGC Replication session state:",
        error,
      );
    }
  }, [generations]);

  useEffect(() => {
    isMountedRef.current = true; // Reset to true on mount (handles React Strict Mode remounts)
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-derive brand info
  const derivedAdCopy = "";
  const shouldGenerateVideo = !isCompetitorPhotoMode;

  const { startWorkflowWithSelectedProduct } =
    useCompetitorUgcReplicationWorkflow(
      user?.id,
      selectedModel,
      effectiveImageModel,
      updateCredits,
      refetchCredits,
      elementsCount,
      format,
      format as "16:9" | "9:16",
      effectiveVideoDuration,
      selectedLanguage,
      false, // Always use auto mode now
      "",
    );

  const updateGenerationFromStatus = useCallback(
    (projectId: string, payload: CompetitorUgcReplicationStatusPayload) => {
      if (!payload?.success) {
        console.log(
          "❌ [updateGenerationFromStatus] Payload not successful:",
          projectId,
          payload?.error,
        );
        return;
      }

      const normalized = (
        payload.status ||
        payload.workflowStatus ||
        ""
      ).toLowerCase();
      const status =
        STATUS_MAP[normalized] ||
        (payload.isCompleted
          ? "completed"
          : payload.isFailed
            ? "failed"
            : "processing");

      console.log(
        `✨ [updateGenerationFromStatus] Updating project ${projectId}:`,
        {
          normalized,
          status,
          isCompleted: payload.isCompleted,
          isFailed: payload.isFailed,
          current_step: payload.current_step,
          progress_percentage: payload.progress_percentage,
          error_message: payload.data?.errorMessage,
          segmentStatus: !!payload.data?.segmentStatus,
        },
      );

      const payloadData = payload.data;
      setGenerations((prev) =>
        prev.map((gen) => {
          if (gen.projectId !== projectId) return gen;
          const nextSegmentCount = (() => {
            if (payload.data) {
              if (
                typeof payload.data.segmentCount === "number" &&
                payload.data.segmentCount > 0
              ) {
                return payload.data.segmentCount;
              }
              if (payload.data.isSegmented) {
                return getSegmentCountFromDuration(
                  payload.data.videoDuration,
                  payload.data?.videoModel as VideoModel | undefined,
                );
              }
            }
            return gen.segmentCount;
          })();
          const hasSegmentStatus = Boolean(
            payloadData &&
              Object.prototype.hasOwnProperty.call(
                payloadData,
                "segmentStatus",
              ),
          );
          const hasSegmentPlan = Boolean(
            payloadData &&
              Object.prototype.hasOwnProperty.call(payloadData, "segmentPlan"),
          );
          const hasSegmentsArray = Boolean(
            payloadData &&
              Object.prototype.hasOwnProperty.call(payloadData, "segments"),
          );

          console.log(
            `📋 [updateGenerationFromStatus] Segment data detection for ${projectId}:`,
            {
              hasSegmentStatus,
              hasSegmentPlan,
              hasSegmentsArray,
              segmentStatusExists: !!payloadData?.segmentStatus,
              segmentPlanExists: !!payloadData?.segmentPlan,
              segmentsArrayExists: !!payloadData?.segments,
              segmentsLength:
                (payloadData?.segments as unknown[])?.length ?? null,
              segmentPlanSegmentsLength:
                (payloadData?.segmentPlan as { segments?: unknown[] })?.segments
                  ?.length ?? null,
            },
          );

          const nextIsSegmented =
            typeof payloadData?.isSegmented === "boolean"
              ? payloadData.isSegmented
              : gen.isSegmented;
          const awaitingMerge =
            typeof payloadData?.awaitingMerge === "boolean"
              ? payloadData.awaitingMerge
              : gen.awaitingMerge;
          const mergeTaskId =
            typeof payloadData?.mergeTaskId === "string"
              ? payloadData.mergeTaskId
              : gen.mergeTaskId;
          const nextSegmentStatus = hasSegmentStatus
            ? (payloadData?.segmentStatus ?? null)
            : gen.segmentStatus;

          let effectiveStep = payload.current_step?.toLowerCase() ?? "";
          const placeholderStep =
            !effectiveStep ||
            effectiveStep === "generating_cover" ||
            effectiveStep === "ready_for_video" ||
            effectiveStep === "processing";

          if (nextIsSegmented) {
            if (awaitingMerge) {
              effectiveStep = "awaiting_merge";
            } else if (
              mergeTaskId &&
              effectiveStep !== "merging_segments" &&
              effectiveStep !== "completed"
            ) {
              effectiveStep = "merging_segments";
            } else if (placeholderStep) {
              const totalSegments =
                nextSegmentStatus?.total ||
                nextSegmentCount ||
                gen.segmentCount ||
                0;
              const framesReady = nextSegmentStatus?.framesReady || 0;
              const videosReady = nextSegmentStatus?.videosReady || 0;

              if (videosReady > 0 && totalSegments > 0) {
                effectiveStep = "generating_segment_videos";
              } else if (framesReady > 0 || totalSegments > 0) {
                effectiveStep = "generating_segment_frames";
              }
            }
          }

          const progressKey =
            effectiveStep || (payload.current_step?.toLowerCase() ?? "");
          const baseProgress =
            typeof payload.progress_percentage === "number"
              ? payload.progress_percentage
              : typeof payload.progress === "number"
                ? payload.progress
                : progressKey && STEP_PROGRESS_HINTS[progressKey] !== undefined
                  ? STEP_PROGRESS_HINTS[progressKey]
                  : status === "completed"
                    ? 100
                    : status === "failed"
                      ? 0
                      : STEP_PROGRESS_HINTS.processing;

          const hasVideoReady = Boolean(payloadData?.videoUrl);
          const totalSegments =
            nextSegmentStatus?.total ||
            nextSegmentCount ||
            gen.segmentCount ||
            0;
          const videosReady = nextSegmentStatus?.videosReady || 0;
          const singleSegmentCompleted =
            nextIsSegmented && totalSegments === 1 && videosReady === 1;
          const resolvedStatus =
            hasVideoReady || singleSegmentCompleted
              ? ("completed" as Generation["status"])
              : status;
          let resolvedProgress =
            hasVideoReady || singleSegmentCompleted ? 100 : baseProgress;
          let stageLabel = getStageLabel(
            resolvedStatus,
            effectiveStep || payload.current_step,
          );
          if (resolvedStatus === "awaiting_review") {
            stageLabel = payloadData?.videoGenerationRequested
              ? "Video queued…"
              : "Awaiting Manual Review";
          }
          const resolvedStage = hasVideoReady ? "Completed" : stageLabel;

          if (nextIsSegmented) {
            const framesReady = nextSegmentStatus?.framesReady || 0;

            if (awaitingMerge) {
              resolvedProgress = Math.max(
                resolvedProgress,
                STEP_PROGRESS_HINTS.awaiting_merge,
              );
            } else if (mergeTaskId) {
              resolvedProgress = Math.max(
                resolvedProgress,
                STEP_PROGRESS_HINTS.merging_segments || 80,
              );
            } else if (videosReady > 0 && totalSegments > 0) {
              const ratio = Math.min(videosReady / totalSegments, 1);
              const videoProgress = 70 + Math.round(ratio * 25);
              resolvedProgress = Math.max(resolvedProgress, videoProgress);
            } else if (framesReady > 0 && totalSegments > 0) {
              const ratio = Math.min(framesReady / totalSegments, 1);
              const frameProgress = 35 + Math.round(ratio * 25);
              resolvedProgress = Math.max(resolvedProgress, frameProgress);

              // Add granular stage description during frame generation
              if (
                effectiveStep === "generating_segment_frames" &&
                framesReady < totalSegments
              ) {
                stageLabel = `Designing frame ${framesReady + 1} of ${totalSegments}...`;
              }
            } else if (totalSegments > 0) {
              resolvedProgress = Math.max(resolvedProgress, 35);
            }
          }

          const nextSegmentPlan = hasSegmentPlan
            ? (payloadData?.segmentPlan ?? null)
            : gen.segmentPlan;
          const nextSegments = hasSegmentsArray
            ? (payloadData?.segments ?? null)
            : gen.segments;

          const segmentsAsArray = nextSegments as unknown as {
            [key: string]: unknown;
          }[];
          console.log(
            `💾 [updateGenerationFromStatus] Saving segment data for ${projectId}:`,
            {
              nextSegmentPlanLength:
                (nextSegmentPlan as { segments?: unknown[] })?.segments
                  ?.length ?? null,
              nextSegmentsLength:
                (nextSegments as unknown as unknown[])?.length ?? null,
              nextSegmentsFirstItemKeys: segmentsAsArray?.[0]
                ? Object.keys(segmentsAsArray[0])
                : null,
            },
          );

          return {
            ...gen,
            status: resolvedStatus,
            stage: resolvedStage,
            progress: resolvedProgress,
            videoUrl: payload.data?.videoUrl || gen.videoUrl,
            coverUrl: payload.data?.coverImageUrl || gen.coverUrl,
            videoModel:
              (payload.data?.videoModel as VideoModel) ||
              (payload.data?.video_model as VideoModel) ||
              gen.videoModel,
            downloaded:
              typeof payload.data?.downloaded === "boolean"
                ? payload.data.downloaded
                : gen.downloaded,
            videoDuration: payload.data?.videoDuration || gen.videoDuration,
            videoAspectRatio:
              typeof payload.data?.videoAspectRatio === "string"
                ? payload.data.videoAspectRatio
                : gen.videoAspectRatio,
            segmentCount:
              typeof nextSegmentCount === "number" && nextSegmentCount > 0
                ? nextSegmentCount
                : gen.segmentCount,
            isSegmented: nextIsSegmented,
            segmentStatus: nextSegmentStatus,
            segmentPlan: nextSegmentPlan,
            segments: nextSegments,
            awaitingMerge,
            mergeTaskId,
            videoGenerationRequested:
              typeof payloadData?.videoGenerationRequested === "boolean"
                ? payloadData.videoGenerationRequested
                : gen.videoGenerationRequested,
            isPhotoOnly:
              typeof payloadData?.photoOnly === "boolean"
                ? payloadData.photoOnly
                : gen.isPhotoOnly,
            creditsCost: payloadData?.credits_cost ?? gen.creditsCost,
            error:
              payload.data?.errorMessage ||
              (resolvedStatus === "failed"
                ? payload.error || "Video generation failed"
                : undefined),
          };
        }),
      );
    },
    [],
  );

  // Track ongoing status fetches to prevent duplicate requests
  const statusFetchesRef = useRef<Set<string>>(new Set());

  const fetchStatusForProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return;

      // Prevent duplicate concurrent requests for the same project
      if (statusFetchesRef.current.has(projectId)) {
        console.log(
          `⏭️ [fetchStatusForProject] Skipping duplicate status fetch for project ${projectId}`,
        );
        return;
      }

      statusFetchesRef.current.add(projectId);
      console.log(
        `📡 [fetchStatusForProject] Fetching status for project: ${projectId}`,
      );

      try {
        const response = await fetch(
          `/api/competitor-ugc-replication/${projectId}/status`,
          {
            cache: "no-store",
          },
        );

        console.log(
          `📡 [fetchStatusForProject] Response status for ${projectId}:`,
          response.status,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch status for ${projectId}`);
        }

        const payload: CompetitorUgcReplicationStatusPayload =
          await response.json();
        const segmentsAsArray = payload.data?.segments as unknown as Record<
          string,
          unknown
        >[];
        console.log(
          `📡 [fetchStatusForProject] Received payload for ${projectId}:`,
          {
            success: payload.success,
            status: payload.status || payload.workflowStatus,
            progress_percentage: payload.progress_percentage,
            hasDataSegments: !!payload.data?.segments,
            dataSegmentsLength: segmentsAsArray?.length ?? null,
            dataSegmentsFirstItemKeys: segmentsAsArray?.[0]
              ? Object.keys(segmentsAsArray[0])
              : null,
          },
        );

        console.log(
          `🔍 [fetchStatusForProject] isMountedRef.current check for ${projectId}:`,
          {
            isMounted: isMountedRef.current,
            willCallUpdate: !!isMountedRef.current,
          },
        );
        if (!isMountedRef.current) {
          console.log(
            `⚠️ [fetchStatusForProject] Component unmounted, skipping updateGenerationFromStatus for ${projectId}`,
          );
          return;
        }
        updateGenerationFromStatus(projectId, payload);
      } catch (error) {
        if (isMountedRef.current) {
          console.error(
            `❌ [fetchStatusForProject] Failed to fetch project status ${projectId}:`,
            error,
          );
        }
      } finally {
        statusFetchesRef.current.delete(projectId);
      }
    },
    [updateGenerationFromStatus],
  );

  const generationHasActiveSegments = useCallback((gen: SessionGeneration) => {
    const statusPayload = gen.segmentStatus;
    if (!statusPayload) return false;
    const totalSegments = statusPayload.total ?? gen.segmentCount ?? 0;
    const videosReady = statusPayload.videosReady ?? 0;
    if (totalSegments > 0 && videosReady < totalSegments) {
      return true;
    }
    const segments =
      (statusPayload.segments as SegmentCardSummary[] | undefined) ||
      gen.segments ||
      [];
    return segments.some((segment) => {
      const normalized = (segment.status || "").toLowerCase();
      return (
        normalized === "pending_first_frame" ||
        normalized === "generating_first_frame" ||
        normalized === "generating_video"
      );
    });
  }, []);

  const activeProjectIds = useMemo(() => {
    const ids = generations
      .filter((gen) => {
        if (!gen.projectId) {
          console.log(
            "🚫 [activeProjectIds Filter] Filtering out generation - no projectId:",
            {
              generationId: gen.id,
              status: gen.status,
              projectId: gen.projectId,
              hasActiveSegments: generationHasActiveSegments(gen),
            },
          );
          return false;
        }
        if (gen.status === "pending" || gen.status === "processing") {
          console.log(
            "✅ [activeProjectIds Include] Including pending/processing generation:",
            gen.projectId,
          );
          return true;
        }
        const hasActive = generationHasActiveSegments(gen);
        if (hasActive) {
          console.log(
            "✅ [activeProjectIds Include] Including generation with active segments:",
            gen.projectId,
          );
        }
        return hasActive;
      })
      .map((gen) => gen.projectId as string);

    const deduped = Array.from(new Set(ids));
    console.log(
      "📊 [activeProjectIds] Total generations:",
      generations.length,
      "Active:",
      deduped.length,
      "IDs:",
      deduped,
    );
    return deduped;
  }, [generations, generationHasActiveSegments]);

  const displayedGenerations = useMemo(
    () =>
      generations.map((gen) => ({
        ...gen,
        isDownloading: gen.projectId
          ? !!downloadingProjects[gen.projectId]
          : false,
        mergeLoading: gen.projectId ? !!mergeSubmitting[gen.projectId] : false,
      })),
    [generations, downloadingProjects, mergeSubmitting],
  );

  const inspectorContext = useMemo(() => {
    if (!segmentInspector) return null;
    const generation = generations.find(
      (gen) => gen.id === segmentInspector.generationId,
    );
    if (!generation) return null;

    // Try to find segment from two possible sources:
    // 1. generation.segments (from API response payload.data.segments)
    // 2. generation.segmentStatus?.segments (fallback from segment status)
    let segment =
      generation.segments?.find(
        (seg) => seg.index === segmentInspector.segmentIndex,
      ) || null;

    // Fallback to segmentStatus.segments if generation.segments is empty/null
    if (!segment && generation.segmentStatus?.segments) {
      segment =
        (generation.segmentStatus.segments as SegmentCardSummary[]).find(
          (seg) => seg.index === segmentInspector.segmentIndex,
        ) || null;
    }

    const planEntry = ((
      generation.segmentPlan as { segments?: SegmentPrompt[] | undefined }
    )?.segments?.[segmentInspector.segmentIndex] ??
      null) as SegmentPrompt | null;

    console.log(
      `🔍 [inspectorContext] Segment data for index ${segmentInspector.segmentIndex}:`,
      {
        hasSegment: !!segment,
        segmentKeys: segment ? Object.keys(segment) : null,
        hasPrompt: !!segment?.prompt,
        promptKeys: segment?.prompt
          ? Object.keys(segment.prompt as object)
          : null,
        hasPlanEntry: !!planEntry,
        planEntryKeys: planEntry ? Object.keys(planEntry) : null,
        segmentSource: !segment
          ? "none"
          : generation.segments?.find(
                (s) => s.index === segmentInspector.segmentIndex,
              )
            ? "generation.segments"
            : "segmentStatus.segments",
      },
    );

    return {
      generation,
      segment,
      planEntry: planEntry || undefined,
    };
  }, [segmentInspector, generations]);
  const inspectorPrompt = inspectorContext?.segment?.prompt as
    | Partial<SegmentPrompt>
    | undefined;

  const handleSegmentRegenerate = useCallback(
    async ({
      type,
      prompt,
      productIds,
      characterIds,
    }: {
      type: "photo" | "video";
      prompt: SegmentPromptPayload;
      productIds?: string[];
      characterIds?: string[];
    }) => {
      try {
        // Validate segmentInspector
        if (!segmentInspector) {
          console.error("[DEBUG] segmentInspector is null");
          showError("Segment inspector not initialized");
          return;
        }

        const projectId = segmentInspector.projectId;
        const segmentIndex = segmentInspector.segmentIndex;

        console.log("[DEBUG] Regenerate started", {
          type,
          projectId,
          segmentIndex,
        });

        // Validate projectId
        if (
          !projectId ||
          typeof projectId !== "string" ||
          projectId === "undefined"
        ) {
          console.error("[DEBUG] Invalid projectId:", projectId);
          showError(
            "Project ID missing. Please refresh the page and try again.",
          );
          return;
        }

        // Validate prompt data
        if (!prompt || !prompt.shots || !Array.isArray(prompt.shots)) {
          console.error("[DEBUG] Invalid prompt data:", prompt);
          showError("Invalid prompt data");
          return;
        }

        // Execute composeSegmentPromptUpdate with error handling
        let mergedPrompt;
        try {
          mergedPrompt = composeSegmentPromptUpdate(prompt, inspectorPrompt);
          console.log("[DEBUG] Merged prompt created successfully");
        } catch (error) {
          console.error("[DEBUG] composeSegmentPromptUpdate failed:", error);
          showError("Failed to prepare prompt data");
          return;
        }

        // Validate serializable
        try {
          JSON.stringify(mergedPrompt);
          console.log("[DEBUG] mergedPrompt is serializable");
        } catch (error) {
          console.error("[DEBUG] mergedPrompt not serializable:", error);
          showError("Invalid prompt data (not serializable)");
          return;
        }

        setSegmentInspectorSubmitting((prev) => ({ ...prev, [type]: true }));

        const requestBody: Record<string, unknown> = {
          prompt: mergedPrompt,
          regenerate: type,
        };

        if (type === "photo") {
          if (productIds?.length) {
            requestBody.productIds = productIds.slice(0, 8);
          }
          if (characterIds?.length) {
            requestBody.characterIds = characterIds.slice(0, 8);
          }
        }

        const url = `/api/competitor-ugc-replication/${projectId}/segments/${segmentIndex}`;
        console.log("[DEBUG] Sending request:", {
          url,
          method: "PATCH",
          bodyKeys: Object.keys(requestBody),
        });

        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        console.log("[DEBUG] Response received:", response.status);

        if (!response.ok) {
          let message = "Failed to update segment";
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
            console.error("[DEBUG] Error response:", data);
          } catch (parseError) {
            console.error(
              "[DEBUG] Failed to parse error response:",
              parseError,
            );
          }
          throw new Error(message);
        }

        await fetchStatusForProject(projectId);
        const successText =
          type === "photo"
            ? "First frame regeneration queued."
            : "Video regeneration queued.";
        showSuccess(successText);
      } catch (error) {
        console.error(
          "[DEBUG] Caught error in handleSegmentRegenerate:",
          error,
        );
        const message =
          error instanceof Error
            ? error.message
            : "Segment regeneration failed";
        showError(message);
      } finally {
        setSegmentInspectorSubmitting((prev) => ({ ...prev, [type]: false }));
      }
    },
    [
      segmentInspector,
      inspectorPrompt,
      fetchStatusForProject,
      showSuccess,
      showError,
    ],
  );

  // Modal version of segment regeneration handler (doesn't depend on segmentInspector state)
  const handleModalSegmentRegenerate = useCallback(
    async ({
      projectId,
      segmentIndex,
      type,
      prompt,
      productIds,
      characterIds,
    }: {
      projectId: string;
      segmentIndex: number;
      type: "photo" | "video";
      prompt: SegmentPromptPayload;
      productIds?: string[];
      characterIds?: string[];
    }) => {
      try {
        console.log("[DEBUG] Modal Regenerate started", {
          type,
          projectId,
          segmentIndex,
        });

        // Validate projectId
        if (
          !projectId ||
          typeof projectId !== "string" ||
          projectId === "undefined"
        ) {
          console.error("[DEBUG] Invalid projectId:", projectId);
          showError(
            "Project ID missing. Please refresh the page and try again.",
          );
          return;
        }

        // Validate prompt data
        if (!prompt || !prompt.shots || !Array.isArray(prompt.shots)) {
          console.error("[DEBUG] Invalid prompt data:", prompt);
          showError("Invalid prompt data");
          return;
        }

        // Find the generation and get current prompt
        const gen = generations.find((g) => (g as any).projectId === projectId);
        const currentSegment = gen?.segments?.find(
          (s) => s.index === segmentIndex,
        );
        const currentPrompt = currentSegment?.prompt as
          | Partial<SegmentPrompt>
          | undefined;

        // Execute composeSegmentPromptUpdate with error handling
        let mergedPrompt;
        try {
          mergedPrompt = composeSegmentPromptUpdate(prompt, currentPrompt);
          console.log("[DEBUG] Merged prompt created successfully");
        } catch (error) {
          console.error("[DEBUG] composeSegmentPromptUpdate failed:", error);
          showError("Failed to prepare prompt data");
          return;
        }

        // Validate serializable
        try {
          JSON.stringify(mergedPrompt);
          console.log("[DEBUG] mergedPrompt is serializable");
        } catch (error) {
          console.error("[DEBUG] mergedPrompt not serializable:", error);
          showError("Invalid prompt data (not serializable)");
          return;
        }

        const requestBody: Record<string, unknown> = {
          prompt: mergedPrompt,
          regenerate: type,
        };

        if (type === "photo") {
          if (productIds?.length) {
            requestBody.productIds = productIds.slice(0, 8);
          }
          if (characterIds?.length) {
            requestBody.characterIds = characterIds.slice(0, 8);
          }
        }

        const url = `/api/competitor-ugc-replication/${projectId}/segments/${segmentIndex}`;
        console.log("[DEBUG] Sending request:", {
          url,
          method: "PATCH",
          bodyKeys: Object.keys(requestBody),
        });

        const response = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        console.log("[DEBUG] Response received:", response.status);

        if (!response.ok) {
          let message = "Failed to update segment";
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
            console.error("[DEBUG] Error response:", data);
          } catch (parseError) {
            console.error(
              "[DEBUG] Failed to parse error response:",
              parseError,
            );
          }
          throw new Error(message);
        }

        await fetchStatusForProject(projectId);
        const successText =
          type === "photo"
            ? "First frame regeneration queued."
            : "Video regeneration queued.";
        showSuccess(successText);
      } catch (error) {
        console.error(
          "[DEBUG] Caught error in handleModalSegmentRegenerate:",
          error,
        );
        const message =
          error instanceof Error
            ? error.message
            : "Segment regeneration failed";
        showError(message);
      }
    },
    [generations, fetchStatusForProject, showSuccess, showError],
  );

  const handleMergeProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return;
      setMergeSubmitting((prev) => ({ ...prev, [projectId]: true }));
      try {
        const response = await fetch(
          `/api/competitor-ugc-replication/${projectId}/merge`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (!response.ok) {
          let message = "Failed to start merge";
          try {
            const data = await response.json();
            message = data?.error || data?.message || message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        showSuccess("Merge started. We will notify you when it is ready.");
        await fetchStatusForProject(projectId);
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Failed to start merge",
        );
      } finally {
        setMergeSubmitting((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
      }
    },
    [fetchStatusForProject, showError, showSuccess],
  );

  // ✅ Event-Driven: Realtime subscriptions instead of polling
  useMultipleProjectsRealtime(
    activeProjectIds,
    // Project update callback
    useCallback(
      (projectId: string, project: Record<string, unknown>) => {
        console.log(
          "[UGC Realtime] Project update received:",
          projectId,
          project,
        );
        // Fetch full status to update UI (includes segments data)
        fetchStatusForProject(projectId);
      },
      [fetchStatusForProject],
    ),
    // Segment update callback
    useCallback(
      (projectId: string, segment: Record<string, unknown>) => {
        console.log(
          "[UGC Realtime] Segment update received:",
          projectId,
          segment,
        );
        // Fetch full status to update UI (includes all segments)
        fetchStatusForProject(projectId);
      },
      [fetchStatusForProject],
    ),
  );

  // Initial fetch for active projects (once)
  useEffect(() => {
    if (!activeProjectIds.length) {
      console.log("⏸️ [Realtime] No active projects");
      return;
    }

    console.log(
      "🔄 [Realtime] Initial fetch for",
      activeProjectIds.length,
      "projects:",
      activeProjectIds,
    );

    // Initial fetch after a short delay to avoid race conditions
    const initialTimer = setTimeout(() => {
      activeProjectIds.forEach((projectId) => {
        fetchStatusForProject(projectId);
      });
    }, 1000);

    return () => {
      clearTimeout(initialTimer);
      console.log("⏹️ [Realtime] Cleanup complete");
    };
  }, [activeProjectIds.join(","), fetchStatusForProject]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadGeneration = useCallback(
    async (generation: SessionGeneration) => {
      if (!user?.id) {
        showError("Please sign in to download videos");
        return;
      }

      const projectId = generation.projectId;
      if (!projectId) {
        showError("Video is still being prepared. Please try again shortly.");
        return;
      }

      if (downloadingProjects[projectId]) {
        return;
      }

      setDownloadingProjects((prev) => ({ ...prev, [projectId]: true }));

      try {
        // ✅ STEP 1: Fast validation (check auth + credits) without downloading
        const validationResponse = await fetch("/api/download-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            historyId: projectId,
            userId: user.id,
            validateOnly: true, // Only validate, don't download yet
          }),
        });

        if (!validationResponse.ok) {
          const result = await validationResponse.json();
          throw new Error(result.message || "Failed to authorize download");
        }

        // ✅ STEP 2: Validation passed - trigger instant streaming download via hidden form
        // This allows browser to handle download natively without waiting for blob

        // Create or reuse hidden iframe for downloads
        let iframe = document.getElementById(
          "download-iframe",
        ) as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement("iframe");
          iframe.id = "download-iframe";
          iframe.style.display = "none";
          document.body.appendChild(iframe);
        }

        // Submit download via hidden form (bypasses CORS and enables streaming)
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/api/download-video";
        form.target = "download-iframe";
        form.style.display = "none";

        const historyIdInput = document.createElement("input");
        historyIdInput.type = "hidden";
        historyIdInput.name = "historyId";
        historyIdInput.value = projectId;
        form.appendChild(historyIdInput);

        const userIdInput = document.createElement("input");
        userIdInput.type = "hidden";
        userIdInput.name = "userId";
        userIdInput.value = user.id;
        form.appendChild(userIdInput);

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        // Update UI immediately (download started in background)
        setGenerations((prev) =>
          prev.map((gen) =>
            gen.projectId === projectId ? { ...gen, downloaded: true } : gen,
          ),
        );

        if (refetchCredits) {
          await refetchCredits();
        }

        showSuccess("Video download started");
      } catch (error) {
        console.error("Competitor UGC Replication download failed:", error);
        showError(
          error instanceof Error ? error.message : "Failed to download video",
        );
      } finally {
        setDownloadingProjects((prev) => {
          const next = { ...prev };
          delete next[projectId];
          return next;
        });
      }
    },
    [user?.id, downloadingProjects, refetchCredits, showError, showSuccess],
  );

  const handleRequestVideoGeneration = useCallback(
    async (generation: SessionGeneration) => {
      if (!generation.projectId) {
        showError("Cover is still preparing. Please try again soon.");
        return;
      }

      setGenerations((prev) =>
        prev.map((gen) =>
          gen.projectId === generation.projectId
            ? { ...gen, videoGenerationRequested: true, stage: "Video queued…" }
            : gen,
        ),
      );

      try {
        const response = await fetch(
          `/api/competitor-ugc-replication/${generation.projectId}/start-video`,
          {
            method: "POST",
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Failed to start video generation",
          );
        }

        showSuccess(
          "Video generation resumed. We will notify you once it is ready.",
        );
        fetchStatusForProject(generation.projectId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start video generation";
        showError(message);
        setGenerations((prev) =>
          prev.map((gen) =>
            gen.projectId === generation.projectId
              ? { ...gen, videoGenerationRequested: false }
              : gen,
          ),
        );
      }
    },
    [fetchStatusForProject, showError, showSuccess],
  );

  // Platform change handler has been removed (platform feature deprecated)

  // Check KIE API credits
  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch("/api/check-kie-credits");
        if (response.ok) {
          const data = await response.json();
          setKieCreditsStatus({
            sufficient: data.sufficient,
            loading: false,
            currentCredits: data.currentCredits,
            threshold: data.threshold,
          });
        } else {
          setKieCreditsStatus({ sufficient: false, loading: false });
        }
      } catch (error) {
        console.error("Failed to check KIE credits:", error);
        setKieCreditsStatus({ sufficient: false, loading: false });
      }
    };

    checkKieCredits();
  }, []);

  // Generate button handler
  const handleStartWorkflow = async () => {
    if (!selectedReferenceVideo) {
      setValidationMessage(
        "Select a viral video or photo to clone before generating.",
      );
      setShowValidationModal(true);
      return;
    }

    if (!selectedReferenceVideo.analysis_result) {
      setValidationMessage(
        "Video analysis is still running. Please wait for it to finish.",
      );
      setShowValidationModal(true);
      return;
    }

    if (isCompetitorPhotoMode && !competitorImageUrl) {
      setValidationMessage(
        "Select a source photo in the Assets panel before generating.",
      );
      setShowValidationModal(true);
      return;
    }

    const referenceDurationSeconds = Number(
      selectedReferenceVideo.duration_seconds || 0,
    );
    if (
      selectedModel === "kling_3" &&
      Number.isFinite(referenceDurationSeconds) &&
      referenceDurationSeconds > 60
    ) {
      setValidationMessage(
        "Kling 3.0 clone supports reference videos up to 60 seconds.",
      );
      setShowValidationModal(true);
      return;
    }

    if (isGenerating) return;

    setIsGenerating(true);

    const initialSegmentCount = shouldGenerateVideo
      ? getSegmentCountFromDuration(effectiveVideoDuration, selectedModel)
      : null;

    const selectedVideoAspectRatio =
      !isCompetitorPhotoMode && (format === "16:9" || format === "9:16")
        ? (format as "16:9" | "9:16")
        : "16:9";

    // Create new generation entry
    // Initialize with proper segment status structure to ensure polling is triggered
    const initialSegmentStatus =
      initialSegmentCount && initialSegmentCount > 0
        ? {
            total: initialSegmentCount,
            framesReady: 0,
            videosReady: 0,
            segments: Array.from({ length: initialSegmentCount }, (_, i) => ({
              index: i,
              status: "pending_first_frame",
              firstFrameUrl: null,
              closingFrameUrl: null,
              videoUrl: null,
              errorMessage: null,
            })),
            mergedVideoUrl: null,
          }
        : null;

    const newGeneration: SessionGeneration = {
      id: Date.now().toString(),
      timestamp: new Date(),
      status: "pending",
      progress: 5,
      stage: isCompetitorPhotoMode
        ? "Preparing replica photo…"
        : "Initializing…",
      brand: undefined,
      videoModel: shouldGenerateVideo ? selectedModel : undefined,
      videoAspectRatio: shouldGenerateVideo ? selectedVideoAspectRatio : null,
      downloaded: false,
      segmentCount: initialSegmentCount ?? undefined,
      videoDuration: shouldGenerateVideo ? effectiveVideoDuration : null,
      isSegmented: Boolean(initialSegmentCount && initialSegmentCount > 1),
      segmentStatus: initialSegmentStatus, // Properly initialized segment status
      segmentPlan: null,
      segments: null,
      awaitingMerge: false,
      mergeTaskId: null,
      mergeLoading: false,
      videoGenerationRequested: false,
      isPhotoOnly: isCompetitorPhotoMode,
      creditsCost: generationCost,
    };

    setGenerations((prev) => [newGeneration, ...prev]);

    try {
      const replicaPayload = isCompetitorPhotoMode
        ? {
            photoOnly: true,
            replicaMode: true,
            referenceImageUrls: competitorImageUrl ? [competitorImageUrl] : [],
            photoAspectRatio,
            photoResolution,
            photoOutputFormat,
          }
        : undefined;

      const workflowResult = await startWorkflowWithSelectedProduct({
        elementsCountOverride: elementsCount,
        imageSizeOverride: format,
        generateVideo: shouldGenerateVideo,
        creatorSourceVideoId:
          selectedReferenceVideo.source_type === "competitor_ad"
            ? undefined
            : selectedReferenceVideo.id,
        competitorAdId:
          selectedReferenceVideo.source_type === "competitor_ad"
            ? selectedReferenceVideo.competitor_ad_id ||
              selectedReferenceVideo.id
            : undefined,
        replicaOptions: replicaPayload,
      });

      console.log("🔍 [Workflow Result] workflowResult:", {
        ...workflowResult,
        // Don't log sensitive data, just the structure
        resultKeys: workflowResult ? Object.keys(workflowResult) : null,
      });

      const projectId = workflowResult?.historyId || workflowResult?.projectId;
      console.log(
        "🆔 [ProjectID Extract] historyId:",
        workflowResult?.historyId,
        "projectId:",
        workflowResult?.projectId,
        "resolved:",
        projectId,
      );

      const startedSegmented = Boolean(
        initialSegmentCount && initialSegmentCount > 1,
      );
      const nextStage = isCompetitorPhotoMode
        ? "Generating replica photo…"
        : startedSegmented
          ? STEP_DESCRIPTIONS.generating_segment_frames
          : STEP_DESCRIPTIONS.generating_cover;
      const nextProgress = isCompetitorPhotoMode
        ? 30
        : startedSegmented
          ? STEP_PROGRESS_HINTS.generating_segment_frames
          : STEP_PROGRESS_HINTS.generating_cover;

      console.log(
        "📝 [Before setGenerations] projectId:",
        projectId,
        "newGeneration.id:",
        newGeneration.id,
      );

      setGenerations((prev) =>
        prev.map((gen) =>
          gen.id === newGeneration.id
            ? {
                ...gen,
                status: "processing",
                stage: nextStage,
                progress: nextProgress,
                projectId: projectId || gen.projectId,
              }
            : gen,
        ),
      );

      console.log(
        "✅ [After setGenerations] Updated generation with projectId:",
        projectId,
      );

      if (projectId) {
        fetchStatusForProject(projectId);
      }

      showSuccess(
        isCompetitorPhotoMode
          ? "Replica photo generation started!"
          : "Cover generation started! Review the result above before generating the video.",
      );
    } catch (error: unknown) {
      console.error("Failed to start workflow:", error);
      const message =
        error instanceof Error ? error.message : "Failed to start generation";
      showError(message);

      // Update generation status to failed
      setGenerations((prev) => {
        return prev.map((gen) =>
          gen.id === newGeneration.id
            ? { ...gen, status: "failed", stage: "Failed", error: message }
            : gen,
        );
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate cost for generate button
  const replicaPhotoCredits = getReplicaPhotoCredits(photoResolution);
  const generationCost = isCompetitorPhotoMode
    ? replicaPhotoCredits
    : getGenerationCost(selectedModel, effectiveVideoDuration.toString());
  const downloadCost = 0; // Version 2.0: ALL downloads are FREE
  const canAfford = isCompetitorPhotoMode
    ? (userCredits || 0) >= generationCost
    : canAffordModel(userCredits || 0, selectedModel);
  const replicaSelectionValid =
    !isCompetitorPhotoMode || Boolean(competitorImageUrl);
  const canGenerate =
    !isGenerating &&
    Boolean(selectedReferenceVideo) &&
    replicaSelectionValid &&
    canAfford;

  // Render insufficient credits or maintenance message
  if (!kieCreditsStatus.loading && !kieCreditsStatus.sufficient) {
    return (
      <div className="flex h-screen bg-muted">
        <Sidebar {...sidebarProps} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-background rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                System Maintenance
              </h2>
              <p className="text-muted-foreground">
                Our system is currently under maintenance. Please try again
                later.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Sidebar {...sidebarProps} />
        <div className="md:ml-72 ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
          <div className="flex-1 flex flex-col min-h-0">
            {/* Main Content Area - Progress Display */}
            <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-32 min-h-0">
              <div className="max-w-[1280px] mx-auto flex-1 w-full flex min-h-0">
                <div className="bg-background border border-border rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-hidden min-h-0">
                    <GenerationProgressDisplay
                      generations={displayedGenerations}
                      onDownload={handleDownloadGeneration}
                      onSegmentRegenerate={handleModalSegmentRegenerate}
                      emptyStateRightContent={
                        <blockquote
                          className="tiktok-embed"
                          cite="https://www.tiktok.com/@laolilantian/video/7600702812682587400?lang=en"
                          data-video-id="7600702812682587400"
                          style={{ maxWidth: "605px", minWidth: "280px" }}
                        >
                          <section>
                            <a
                              target="_blank"
                              title="@laolilantian"
                              href="https://www.tiktok.com/@laolilantian?refer=embed"
                            >
                              @laolilantian
                            </a>{" "}
                            Watch how we quickly clone viral videos and swap
                            products using our optimized tool. Adjust every
                            frame and prompt in the editor for perfect results.{" "}
                            <a
                              title="videoai"
                              target="_blank"
                              href="https://www.tiktok.com/tag/videoai?refer=embed"
                            >
                              #VideoAI
                            </a>{" "}
                            <a
                              title="contentcreation"
                              target="_blank"
                              href="https://www.tiktok.com/tag/contentcreation?refer=embed"
                            >
                              #ContentCreation
                            </a>{" "}
                            <a
                              title="productmarketing"
                              target="_blank"
                              href="https://www.tiktok.com/tag/productmarketing?refer=embed"
                            >
                              #ProductMarketing
                            </a>{" "}
                            <a
                              title="techdemo"
                              target="_blank"
                              href="https://www.tiktok.com/tag/techdemo?refer=embed"
                            >
                              #TechDemo
                            </a>{" "}
                            <a
                              target="_blank"
                              title="♬ original sound  - Lantian laoli"
                              href="https://www.tiktok.com/mus/original-sound-Lantian-laoli-7588830007134063381?refer=embed"
                            >
                              ♬ original sound - Lantian laoli
                            </a>
                          </section>
                        </blockquote>
                      }
                      expandedGenerationId={expandedGenerationId}
                      onToggleSegments={(generation) => {
                        setExpandedGenerationId((prev) =>
                          prev === generation.id ? null : generation.id,
                        );
                      }}
                      onSegmentSelect={(generation, segment) => {
                        const projectId = (generation as SessionGeneration)
                          .projectId;
                        if (!projectId) return;

                        console.log(
                          `👆 [onSegmentSelect] User clicked segment ${segment.index}, opening inspector`,
                          {
                            projectId,
                            generationId: generation.id,
                            segmentIndex: segment.index,
                            generationSegmentsCount:
                              (generation as SessionGeneration).segments
                                ?.length ?? null,
                            generationHasSegments: !!(
                              generation as SessionGeneration
                            ).segments,
                            generationSegmentsPlan:
                              (
                                (generation as SessionGeneration)
                                  .segmentPlan as { segments?: unknown[] }
                              )?.segments?.length ?? null,
                          },
                        );

                        setSegmentInspector({
                          projectId,
                          generationId: generation.id,
                          segmentIndex: segment.index,
                        });
                      }}
                      onMerge={(generation) => {
                        const projectId = (generation as SessionGeneration)
                          .projectId;
                        if (!projectId) {
                          showError("Project not ready for merge yet.");
                          return;
                        }
                        const videosReady =
                          generation.segmentStatus?.videosReady || 0;
                        const total =
                          generation.segmentStatus?.total ||
                          generation.segmentCount ||
                          0;
                        if (videosReady !== total || total === 0) {
                          showError(
                            "Segments are still rendering. Please wait until all videos are ready.",
                          );
                          return;
                        }
                        handleMergeProject(projectId);
                      }}
                      projectType="competitor-ugc-replication"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Bottom Composer - Unified */}
      <BottomComposerBar
        compact={true}
        leftControls={
          <>
            <MotionSwapReferenceControls
              videos={assetVideos}
              selectedVideoId={selectedReferenceVideoId}
              onSelectVideoId={setSelectedReferenceVideoId}
              requireFirstFrameForSelection={false}
              variant="inline"
              showLabel={false}
              className="flex-shrink-0"
            />
          </>
        }
        configButton={
          <ConfigPopover
            videoDuration={effectiveVideoDuration}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            userCredits={userCredits || 0}
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            hideLanguageSelector
            hideDurationSelector
            format={format}
            onFormatChange={setFormat}
            disabled={isGenerating}
            variant="minimal"
            mode={isCompetitorPhotoMode ? "photo" : "video"}
            photoAspectRatio={photoAspectRatio}
            onPhotoAspectRatioChange={(value) =>
              setPhotoAspectRatio(value as ReplicaAspectRatio)
            }
            photoAspectRatioOptions={REPLICA_ASPECT_RATIOS}
            photoResolution={photoResolution}
            onPhotoResolutionChange={(value) =>
              setPhotoResolution(value as ReplicaResolution)
            }
            photoResolutionOptions={REPLICA_RESOLUTIONS}
            photoOutputFormat={photoOutputFormat}
            onPhotoOutputFormatChange={(value) =>
              setPhotoOutputFormat(value as ReplicaOutputFormat)
            }
            photoOutputFormatOptions={REPLICA_OUTPUT_FORMATS}
          />
        }
        onGenerate={handleStartWorkflow}
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        generationCost={generationCost}
        userCredits={userCredits || 0}
        generateButtonText="Generate"
      />

      {segmentInspector && inspectorContext && (
        <SegmentInspector
          open
          onClose={() => setSegmentInspector(null)}
          projectId={segmentInspector.projectId}
          segmentIndex={segmentInspector.segmentIndex}
          segment={inspectorContext.segment}
          segmentPlanEntry={inspectorContext.planEntry}
          videoModel={inspectorContext.generation.videoModel}
          videoDuration={inspectorContext.generation.videoDuration}
          videoAspectRatio={inspectorContext.generation.videoAspectRatio}
          onRegenerate={handleSegmentRegenerate}
          isSubmitting={segmentInspectorSubmitting}
        />
      )}

      {/* Validation Modal - Missing selection */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Configuration Required
              </h3>
            </div>
            <p className="text-muted-foreground mb-6">{validationMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowValidationModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-muted-foreground rounded-lg hover:bg-muted transition-colors"
              >
                Got it
              </button>
              <Link
                href="/dashboard/assets"
                onClick={() => setShowValidationModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
              >
                Go to Assets
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function composeSegmentPromptUpdate(
  payload: SegmentPromptPayload,
  current?: Partial<SegmentPrompt>,
): Partial<SegmentPrompt> {
  const normalizedShots = payload.shots.map((shot, index) => ({
    id: shot.id ?? index + 1,
    time_range: shot.time_range.trim(),
    audio: shot.audio.trim(),
    style: shot.style.trim(),
    action: shot.action.trim(),
    subject: shot.subject.trim(),
    dialogue: shot.dialogue.trim(),
    language: shot.language,
    composition: shot.composition.trim(),
    context_environment: shot.context_environment.trim(),
    ambiance_colour_lighting: shot.ambiance_colour_lighting.trim(),
    camera_motion_positioning: shot.camera_motion_positioning.trim(),
  }));
  const primaryShot = normalizedShots[0];
  return {
    ...current,
    first_frame_description: payload.first_frame_description,
    action: primaryShot?.action || current?.action || "",
    subject: primaryShot?.subject || current?.subject || "",
    style: primaryShot?.style || current?.style || "",
    dialogue: primaryShot?.dialogue || current?.dialogue || "",
    audio: primaryShot?.audio || current?.audio || "",
    composition: primaryShot?.composition || current?.composition || "",
    context_environment:
      primaryShot?.context_environment || current?.context_environment || "",
    camera_motion_positioning:
      primaryShot?.camera_motion_positioning ||
      current?.camera_motion_positioning ||
      "",
    ambiance_colour_lighting:
      primaryShot?.ambiance_colour_lighting ||
      current?.ambiance_colour_lighting ||
      "",
    language: primaryShot?.language || current?.language || "en",
    is_continuation_from_prev: payload.is_continuation_from_prev,
    shots: normalizedShots,
  };
}
