"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  ArrowRight,
  Coins,
} from "lucide-react";
import GenerationProgressDisplay, {
  type Generation,
} from "@/components/ui/GenerationProgressDisplay";
import { getSupabase, UserAvatar, UserProduct } from "@/lib/supabase";
import { useToast } from "@/contexts/ToastContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import BottomComposerBar from "@/components/ui/BottomComposerBar";
import ConfigPopover from "@/components/ui/ConfigPopover";
import MotionSwapEditorSplitPane from "@/components/motion-swap/MotionSwapEditorSplitPane";
import MotionSwapEditorFormColumn from "@/components/motion-swap/MotionSwapEditorFormColumn";
import MotionSwapReferenceControls from "@/components/motion-swap/MotionSwapReferenceControls";
import Sidebar from "@/components/layout/Sidebar";
import { useUser } from "@clerk/nextjs";
import { useCredits } from "@/contexts/CreditsContext";
import * as Dialog from "@radix-ui/react-dialog";
import type { Format } from "@/components/ui/FormatSelector";
import { useSearchParams } from "next/navigation";
import { MENTION_TOKEN_REGEX, buildMentionToken, normalizeMentionLabel, parseMentionToken } from "@/lib/prompt-mention-tokens";
import {
  getMotionSwapGenerationCost,
  normalizeMotionSwapQuality,
  type CloneVideoQuality,
} from "@/lib/constants";

interface MotionSwapVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  stats?: Record<string, unknown> | null;
  source_id?: string | null;
}

interface MotionSwapProject {
  id: string;
  status: string;
  progress_percentage: number;
  mode?: string | null;
  creator_source_id?: string | null;
  creator_source_video_id?: string | null;
  avatar_id?: string | null;
  product_id?: string | null;
  reference_cover_url?: string | null;
  preview_image_url?: string | null;
  output_video_url?: string | null;
  reference_duration_seconds?: number | null;
  photo_prompt?: string | null;
  video_prompt?: string | null;
  credits_cost?: number | null;
  error_message?: string | null;
  downloaded?: boolean | null;
  created_at?: string | null;
}

type PersistedMotionSwapProject = Pick<
  MotionSwapProject,
  | "id"
  | "status"
  | "progress_percentage"
  | "mode"
  | "creator_source_video_id"
  | "avatar_id"
  | "product_id"
  | "reference_cover_url"
  | "preview_image_url"
  | "output_video_url"
  | "reference_duration_seconds"
  | "photo_prompt"
  | "video_prompt"
  | "credits_cost"
  | "error_message"
  | "downloaded"
  | "created_at"
>;

interface MotionSwapSessionState {
  projects?: PersistedMotionSwapProject[];
  activeProjectId?: string | null;
  selectedVideoId?: string;
  selectedSize?: Format;
  selectedVideoQuality?: CloneVideoQuality;
}

interface MotionSwapPromptDraft {
  photoPrompt: string;
  videoPrompt: string;
}

const TUTORIAL_TIKTOK_URL =
  "https://www.tiktok.com/@laolilantian/video/7600705503555095816?lang=en";
const TUTORIAL_TIKTOK_ID = "7600705503555095816";
const SESSION_STORAGE_KEY = "motion_swap_session_state";
const MOTION_SWAP_QUALITY_OPTIONS = [
  { value: "720p" as const, label: "720p", creditsPerSecondLabel: "12 credits / s" },
  { value: "1080p" as const, label: "1080p", creditsPerSecondLabel: "20 credits / s" },
];
const DEFAULT_FEMALE_MENTION = buildMentionToken({
  type: "character",
  label: "Default Female",
});
const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Replace the man in the reference video with ${DEFAULT_FEMALE_MENTION}. Keep the same framing, lighting, background, and overall look.`;
const DEFAULT_VIDEO_PROMPT =
  "Keep all elements the same as the reference video. Only swap the person and product.";
const EDITABLE_MOTION_SWAP_STATUSES = [
  "pending",
  "preview_ready",
  "completed",
  "failed",
] as const;

const serializeMotionSwapProject = (
  project: MotionSwapProject,
): PersistedMotionSwapProject => ({
  id: project.id,
  status: project.status,
  progress_percentage: project.progress_percentage,
  mode: project.mode ?? null,
  creator_source_video_id: project.creator_source_video_id ?? null,
  avatar_id: project.avatar_id ?? null,
  product_id: project.product_id ?? null,
  reference_cover_url: project.reference_cover_url ?? null,
  preview_image_url: project.preview_image_url ?? null,
  output_video_url: project.output_video_url ?? null,
  reference_duration_seconds: project.reference_duration_seconds ?? null,
  photo_prompt: project.photo_prompt ?? null,
  video_prompt: project.video_prompt ?? null,
  credits_cost: project.credits_cost ?? null,
  error_message: project.error_message ?? null,
  downloaded: project.downloaded ?? null,
  created_at: project.created_at ?? null,
});

const isPersistedMotionSwapProject = (
  value: unknown,
): value is PersistedMotionSwapProject => {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return (
    typeof project.id === "string" &&
    typeof project.status === "string"
  );
};

export default function MotionSwapPage() {
  const searchParams = useSearchParams();
  const { showError, showSuccess } = useToast();
  const { user } = useUser();
  const { credits: userCredits, creditsData, refetchCredits } = useCredits();
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<MotionSwapVideo[]>([]);
  const [avatars, setAvatars] = useState<UserAvatar[]>([]);
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [projects, setProjects] = useState<MotionSwapProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<Format>("9:16");
  const [selectedVideoQuality, setSelectedVideoQuality] =
    useState<CloneVideoQuality>("720p");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAction, setEditAction] = useState<"image" | "video" | null>(null);
  const [editPhotoPrompt, setEditPhotoPrompt] = useState("");
  const [editVideoPrompt, setEditVideoPrompt] = useState("");
  const [promptDrafts, setPromptDrafts] = useState<
    Record<string, MotionSwapPromptDraft>
  >({});
  const [downloadStates, setDownloadStates] = useState<
    Record<string, "idle" | "processing" | "success">
  >({});
  const invalidSelectionToastRef = useRef<string | null>(null);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId),
    [videos, selectedVideoId],
  );
  const selectedVideoHasFirstFrame = Boolean(selectedVideo?.cover_url);
  const activeProject = useMemo(() => {
    if (activeProjectId) {
      return projects.find((item) => item.id === activeProjectId) || null;
    }
    return projects[0] || null;
  }, [projects, activeProjectId]);
  const editingProject = useMemo(() => {
    if (!editingProjectId) return null;
    return projects.find((item) => item.id === editingProjectId) || null;
  }, [projects, editingProjectId]);
  const projectInEditor = editingProject || activeProject;
  const videoById = useMemo(
    () => new Map(videos.map((video) => [video.id, video])),
    [videos],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const getMentionedIds = useCallback((text: string) => {
    const characterIds = new Set<string>();
    const productIds = new Set<string>();
    const avatarsByKey = new Map(avatars.map((item) => [normalizeMentionLabel(item.avatar_name || ""), item]));
    const productsByKey = new Map(products.map((item) => [normalizeMentionLabel(item.product_name || ""), item]));
    let match: RegExpExecArray | null;
    MENTION_TOKEN_REGEX.lastIndex = 0;
    while ((match = MENTION_TOKEN_REGEX.exec(text)) !== null) {
      const parsed = parseMentionToken(match[0]);
      const mentionKey = parsed?.key;
      if (!mentionKey) continue;
      if (parsed.type === "character") {
        const avatar = avatarsByKey.get(mentionKey);
        if (avatar) characterIds.add(avatar.id);
      }
      if (parsed.type === "product") {
        const product = productsByKey.get(mentionKey);
        if (product) productIds.add(product.id);
      }
      if (parsed.type === "unknown") {
        const avatar = avatarsByKey.get(mentionKey);
        const product = productsByKey.get(mentionKey);
        if (avatar && !product) characterIds.add(avatar.id);
        if (product && !avatar) productIds.add(product.id);
      }
    }
    return {
      characterIds: Array.from(characterIds),
      productIds: Array.from(productIds),
    };
  }, [avatars, products]);
  const mentionSelections = useMemo(() => {
    const characterIds = new Set<string>();
    const productIds = new Set<string>();

    [editPhotoPrompt, editVideoPrompt].forEach((prompt) => {
      const ids = getMentionedIds(prompt);
      ids.characterIds.forEach((id) => characterIds.add(id));
      ids.productIds.forEach((id) => productIds.add(id));
    });

    return {
      characterIds: Array.from(characterIds),
      productIds: Array.from(productIds),
    };
  }, [editPhotoPrompt, editVideoPrompt, getMentionedIds]);
  const editAvatarId = mentionSelections.characterIds[0] || "";
  const editProductId = mentionSelections.productIds[0] || "";

  const estimatedCredits = getMotionSwapGenerationCost(
    selectedVideo?.duration_seconds,
    selectedVideoQuality,
  );

  const loadAssets = useCallback(async () => {
    try {
      const [assetsResponse, avatarsResponse] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/user-avatars"),
      ]);

      if (assetsResponse.ok) {
        const data = await assetsResponse.json();
        const allVideos = data.videos || [];
        const motionSwapVideos = allVideos.filter(
          (video: { source_type?: string }) =>
            video.source_type !== "competitor_ad",
        );
        setVideos(motionSwapVideos);
        setProducts(data.products || []);
      }

      if (avatarsResponse.ok) {
        const data = await avatarsResponse.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error("[Motion Swap] Failed to load assets:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as MotionSwapSessionState;
      if (Array.isArray(parsed.projects)) {
        setProjects(
          parsed.projects.filter(isPersistedMotionSwapProject),
        );
      }
      if (parsed.activeProjectId) {
        setActiveProjectId(parsed.activeProjectId);
      }
      if (parsed.selectedVideoId) {
        setSelectedVideoId(parsed.selectedVideoId);
      }
      if (parsed.selectedSize) {
        setSelectedSize(parsed.selectedSize);
      }
      if (parsed.selectedVideoQuality) {
        setSelectedVideoQuality(
          normalizeMotionSwapQuality(parsed.selectedVideoQuality),
        );
      }
    } catch (error) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // Read URL parameters and set initial state
  useEffect(() => {
    if (isLoading) return; // Wait for assets to load first

    const videoId = searchParams.get("videoId");

    if (videoId) {
      const video = videos.find((item) => item.id === videoId);
      if (video) {
        if (video.cover_url) {
          setSelectedVideoId(videoId);
        } else {
          setSelectedVideoId("");
          showError("This video needs a first-frame image before Motion Swap.");
        }
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/dashboard/motion-swap");
        }
      }
    }
  }, [isLoading, searchParams, showError, videos]);

  // Preselect video from sessionStorage (for Motion Swap)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoading) return;

    const stored = window.sessionStorage.getItem("preselect_motion_swap_video");
    if (!stored) return;

    window.sessionStorage.removeItem("preselect_motion_swap_video");

    try {
      const parsed = JSON.parse(stored) as { videoId?: string };
      const targetId = parsed.videoId;
      if (!targetId) return;

      const video = videos.find((item) => item.id === targetId);
      if (video) {
        if (video.cover_url) {
          setSelectedVideoId(targetId);
          showSuccess("Video selected for Motion Swap.");
        } else {
          setSelectedVideoId("");
          showError("This video needs a first-frame image before Motion Swap.");
        }
      } else {
        setSelectedVideoId("");
      }
    } catch (error) {
      console.error("[MotionSwapPage] Failed to preselect video:", error);
    }
  }, [isLoading, videos, showError, showSuccess]);

  useEffect(() => {
    if (!selectedVideoId) {
      invalidSelectionToastRef.current = null;
      return;
    }
    if (!selectedVideo) return;
    if (selectedVideo.cover_url) {
      invalidSelectionToastRef.current = null;
      return;
    }
    if (invalidSelectionToastRef.current !== selectedVideo.id) {
      showError("This video needs a first-frame image before Motion Swap.");
      invalidSelectionToastRef.current = selectedVideo.id;
    }
    setSelectedVideoId("");
  }, [selectedVideoId, selectedVideo, showError]);

  useEffect(() => {
    if (!projects.length) {
      if (activeProjectId !== null) {
        setActiveProjectId(null);
      }
      return;
    }
    if (!activeProjectId || !projects.some((item) => item.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (!projectInEditor) return;
    setSelectedVideoQuality(normalizeMotionSwapQuality(projectInEditor.mode));
  }, [projectInEditor?.id, projectInEditor?.mode, projectInEditor]);

  useEffect(() => {
    if (!editDialogOpen || !editingProjectId) return;
    setPromptDrafts((prev) => ({
      ...prev,
      [editingProjectId]: {
        photoPrompt: editPhotoPrompt,
        videoPrompt: editVideoPrompt,
      },
    }));
  }, [editDialogOpen, editingProjectId, editPhotoPrompt, editVideoPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!projects.length) {
      if (
        !selectedVideoId &&
        selectedSize === "9:16" &&
        selectedVideoQuality === "720p"
      ) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
    }
    const payload: MotionSwapSessionState = {
      projects: projects.map(serializeMotionSwapProject),
      activeProjectId: activeProject?.id ?? activeProjectId ?? null,
      selectedVideoId,
      selectedSize,
      selectedVideoQuality,
    };
    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error("Failed to persist Motion Swap session state:", error);
    }
  }, [
    projects,
    activeProject?.id,
    activeProjectId,
    selectedVideoId,
    selectedSize,
    selectedVideoQuality,
  ]);

  const watchedProjectId = editingProjectId || activeProject?.id || null;

  useEffect(() => {
    if (!watchedProjectId) return;

    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
      const response = await fetch(
        `/api/motion-swap/${watchedProjectId}/status`,
      );
      if (!response.ok) return null;
      return response.json();
    };

    const init = async () => {
      const payload = await fetchStatus();
      if (payload?.project && isMounted) {
        setProjects((prev) =>
          prev.map((item) =>
            item.id === payload.project.id ? payload.project : item,
          ),
        );
      }
    };

    init();

    channel = supabase
      .channel(`motion-swap-${watchedProjectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "motion_swap_projects",
          filter: `id=eq.${watchedProjectId}`,
        },
        async () => {
          const payload = await fetchStatus();
          if (payload?.project && isMounted) {
            setProjects((prev) =>
              prev.map((item) =>
                item.id === payload.project.id ? payload.project : item,
              ),
            );
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [watchedProjectId]);

  const buildDefaultPrompt = (
    avatarName?: string | null,
    productName?: string | null,
  ) => {
    if (!avatarName && !productName) {
      return DEFAULT_IMAGE_PROMPT_TEMPLATE;
    }
    const tokens = [];
    if (avatarName) tokens.push(buildMentionToken({ type: "character", label: avatarName }));
    if (productName) tokens.push(buildMentionToken({ type: "product", label: productName }));
    return `Replace the subject in the reference video with ${tokens.join(" and ")}. Keep the same framing, lighting, background, and overall look.`;
  };

  const isNewPendingProject = (project: MotionSwapProject) =>
    project.status === "pending" &&
    !project.photo_prompt &&
    !project.video_prompt &&
    !project.preview_image_url &&
    !project.output_video_url;

  const openEditModal = (projectToEdit?: MotionSwapProject | null) => {
    const targetProject = projectToEdit || activeProject;
    if (!targetProject) return;
    setEditingProjectId(targetProject.id);
    if (targetProject.creator_source_video_id) {
      setSelectedVideoId(targetProject.creator_source_video_id);
    }
    setSelectedVideoQuality(normalizeMotionSwapQuality(targetProject.mode));
    const avatarName =
      avatars.find((avatar) => avatar.id === targetProject.avatar_id)
        ?.avatar_name || null;
    const productName =
      products.find((product) => product.id === targetProject.product_id)
        ?.product_name || null;
    const defaultPrompt = buildDefaultPrompt(avatarName, productName);
    const draft = promptDrafts[targetProject.id];
    const initialPhotoPrompt = draft
      ? draft.photoPrompt
      : targetProject.photo_prompt ||
        (isNewPendingProject(targetProject) ? defaultPrompt : "");
    const initialVideoPrompt = draft
      ? draft.videoPrompt
      : targetProject.video_prompt ||
        (isNewPendingProject(targetProject) ? DEFAULT_VIDEO_PROMPT : "");

    setEditPhotoPrompt(initialPhotoPrompt);
    setEditVideoPrompt(initialVideoPrompt);
    setEditDialogOpen(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/motion-swap/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start Motion Swap");
      }

      setProjects((prev) => [data.project, ...prev]);
      setActiveProjectId(data.project?.id || null);
      showSuccess(
        "Motion Swap started. You will see updates here as it completes.",
      );
    } catch (error) {
      console.error("[Motion Swap] Create failed:", error);
      showError(
        error instanceof Error ? error.message : "Failed to start Motion Swap",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !isGenerating;
  const canEditProject = projects.length > 0;

  const editFirstFrameUrl =
    projectInEditor?.preview_image_url ||
    projectInEditor?.reference_cover_url ||
    selectedVideo?.cover_url ||
    null;
  const effectiveSegmentStatus = useMemo(() => {
    if (projectInEditor?.status === "generating_preview")
      return "generating_first_frame";
    if (projectInEditor?.status === "preview_ready") return "first_frame_ready";
    return projectInEditor?.status || "pending";
  }, [projectInEditor?.status]);
  const showGeneratingImageState =
    editAction === "image" || effectiveSegmentStatus === "generating_first_frame";
  const displayFirstFramePreviewUrl = showGeneratingImageState
    ? null
    : editFirstFrameUrl;
  const isSubmittingEdit = editAction !== null;
  const hasSwapTarget = Boolean(editAvatarId || editProductId);
  const isEditableMotionSwapStatus = projectInEditor
    ? EDITABLE_MOTION_SWAP_STATUSES.includes(
        projectInEditor.status as (typeof EDITABLE_MOTION_SWAP_STATUSES)[number],
      )
    : false;
  const canGenerateImage = Boolean(
    projectInEditor?.id &&
      selectedVideoId &&
      selectedVideoHasFirstFrame &&
      editPhotoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      isEditableMotionSwapStatus,
  );
  const canGenerateVideo = Boolean(
    projectInEditor?.id &&
      selectedVideoId &&
      selectedVideoHasFirstFrame &&
      editPhotoPrompt.trim().length > 0 &&
      editVideoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      isEditableMotionSwapStatus,
  );

  const productDisplayName = useMemo(() => {
    if (!projectInEditor?.product_id) return null;
    const product = productById.get(projectInEditor.product_id);
    return product?.product_name || null;
  }, [productById, projectInEditor?.product_id]);

  const projectVideo = useMemo(() => {
    if (!projectInEditor?.creator_source_video_id) return null;
    return (
      videos.find(
        (video) => video.id === projectInEditor.creator_source_video_id,
      ) || null
    );
  }, [videos, projectInEditor?.creator_source_video_id]);

  const displayDurationSeconds =
    projectInEditor?.reference_duration_seconds ??
    projectVideo?.duration_seconds ??
    selectedVideo?.duration_seconds ??
    null;

  const displayCreditsCost =
    typeof projectInEditor?.credits_cost === "number" &&
    projectInEditor.credits_cost > 0
      ? projectInEditor.credits_cost
      : getMotionSwapGenerationCost(
          displayDurationSeconds,
          projectInEditor?.mode || selectedVideoQuality,
        ) || null;

  const displayedGenerations = useMemo<Generation[]>(() => {
    return projects.map((item) => {
      const status: Generation["status"] =
        item.status === "failed"
          ? "failed"
          : item.status === "completed"
            ? "completed"
            : item.status === "pending"
              ? "pending"
              : "processing";
      const stage =
        item.status === "pending"
          ? "Initializing"
          : item.status === "generating_preview"
            ? "Generating Preview"
            : item.status === "generating_video"
              ? "Generating Video"
              : undefined;
      const fallbackVideo = item.creator_source_video_id
        ? videoById.get(item.creator_source_video_id)
        : null;
      const durationSeconds =
        item.reference_duration_seconds ??
        fallbackVideo?.duration_seconds ??
        (item.id === activeProject?.id
          ? selectedVideo?.duration_seconds
          : null) ??
        null;
      const creditsCost =
        typeof item.credits_cost === "number" && item.credits_cost > 0
          ? item.credits_cost
          : getMotionSwapGenerationCost(
              durationSeconds,
              item.mode || selectedVideoQuality,
            ) || undefined;

      return {
        id: item.id,
        timestamp: item.created_at ? new Date(item.created_at) : new Date(),
        status,
        progress: item.progress_percentage || 0,
        stage,
        videoUrl:
          item.status === "completed" ? item.output_video_url || undefined : undefined,
        coverUrl:
          item.preview_image_url ||
          item.reference_cover_url ||
          fallbackVideo?.cover_url ||
          (item.id === activeProject?.id
            ? selectedVideo?.cover_url
            : undefined) ||
          undefined,
        product: item.product_id
          ? productById.get(item.product_id)?.product_name || undefined
          : undefined,
        downloaded: Boolean(item.downloaded),
        isDownloading: downloadStates[item.id] === "processing",
        videoAspectRatio: selectedSize,
        videoDuration: durationSeconds ? String(durationSeconds) : null,
        creditsCost,
      };
    });
  }, [
    projects,
    videoById,
    productById,
    activeProject?.id,
    downloadStates,
    selectedVideo?.duration_seconds,
    selectedVideo?.cover_url,
    selectedSize,
    selectedVideoQuality,
  ]);

  const emptyStateSteps = useMemo(
    () => [
      {
        number: 1,
        description: "Import a TikTok video in",
        link: { text: "Assets", href: "/dashboard/assets" },
      },
      {
        number: 2,
        description: "Open Edit to choose a reference video",
      },
      {
        number: 3,
        description: "Use @ to select the character or product in Edit",
      },
      {
        number: 4,
        description: "Generate image or video",
      },
    ],
    [],
  );

  const handleStartEditPreview = async (action: "image" | "video") => {
    if (!projectInEditor?.id) return;
    if (!editPhotoPrompt.trim()) {
      showError("Enter an image prompt to continue.");
      return;
    }
    if (action === "video" && !editVideoPrompt.trim()) {
      showError("Enter a video prompt to continue.");
      return;
    }
    if (!selectedVideoId) {
      showError("Select a reference video to continue.");
      return;
    }
    if (!selectedVideoHasFirstFrame) {
      showError("This video needs a first-frame image before Motion Swap.");
      return;
    }
    if (!hasSwapTarget) {
      showError(
        "Use @character or @product in the image or video prompt to select a swap target.",
      );
      return;
    }

    setEditAction(action);

    try {
      const response = await fetch(
        `/api/motion-swap/${projectInEditor.id}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference_video_id: selectedVideoId,
            avatar_id: editAvatarId,
            product_id: editProductId,
            photo_prompt: editPhotoPrompt,
            video_prompt: editVideoPrompt,
            mode: selectedVideoQuality,
            action: action,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start Motion Swap");
      }

      setProjects((prev) =>
        prev.map((item) => (item.id === data.project.id ? data.project : item)),
      );
      setPromptDrafts((prev) => ({
        ...prev,
        [data.project.id]: {
          photoPrompt: editPhotoPrompt,
          videoPrompt: editVideoPrompt,
        },
      }));
      setEditingProjectId(data.project.id);
      const successMessage =
        action === "image"
          ? "Generating preview image..."
          : "Generating preview and video...";
      showSuccess(successMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start Motion Swap";
      showError(message);
    } finally {
      setEditAction(null);
    }
  };

  const startDownloadForm = useCallback(
    (action: string, fields: Record<string, string>) => {
      if (typeof document === "undefined") return;

      let iframe = document.getElementById("download-iframe") as
        | HTMLIFrameElement
        | null;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "download-iframe";
        iframe.name = "download-iframe";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      form.target = "download-iframe";
      form.style.display = "none";

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    },
    [],
  );

  const handleDownload = useCallback(
    async (generation: Generation) => {
      if (!user?.id) {
        showError("Please sign in to download videos.");
        return;
      }

      const project = projects.find((item) => item.id === generation.id);
      if (!project?.output_video_url || project.status !== "completed") {
        showError("Video generation is not completed yet.");
        return;
      }

      const historyId = project.id;
      const isFirstDownload = !project.downloaded;

      setDownloadStates((prev) => ({ ...prev, [historyId]: "processing" }));

      try {
        const validationResponse = await fetch("/api/download-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            historyId,
            userId: user.id,
            validateOnly: true,
          }),
        });
        const result = await validationResponse.json();

        if (!validationResponse.ok) {
          showError(result.message || "Failed to authorize download.");
          setDownloadStates((prev) => ({ ...prev, [historyId]: "idle" }));
          return;
        }

        startDownloadForm("/api/download-video", {
          historyId,
          userId: user.id,
        });

        setProjects((prev) =>
          prev.map((item) =>
            item.id === historyId ? { ...item, downloaded: true } : item,
          ),
        );
        setDownloadStates((prev) => ({ ...prev, [historyId]: "success" }));

        if (isFirstDownload) {
          await refetchCredits();
        }

        window.setTimeout(() => {
          setDownloadStates((prev) => ({ ...prev, [historyId]: "idle" }));
        }, 2500);
      } catch (error) {
        console.error("[Motion Swap] Download failed:", error);
        showError("An error occurred while downloading the video.");
        setDownloadStates((prev) => ({ ...prev, [historyId]: "idle" }));
      }
    },
    [projects, refetchCredits, showError, startDownloadForm, user?.id],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar
          credits={userCredits}
          creditsData={creditsData}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userImageUrl={user?.imageUrl}
        />
        <div className="dashboard-content-offset ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
          <div className="flex-1 flex flex-col min-h-0">
            <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-32 min-h-0">
              <div className="max-w-[1280px] mx-auto flex-1 w-full flex min-h-0">
                <div className="bg-background border border-border rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      <div className="dashboard-content-offset ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
        <div className="flex-1 flex flex-col min-h-0">
          <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-32 min-h-0">
            <div className="max-w-[1280px] mx-auto flex-1 w-full flex min-h-0">
              <div className="bg-background border border-border rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-hidden min-h-0">
                  <GenerationProgressDisplay
                    generations={displayedGenerations}
                    onDownload={handleDownload}
                    emptyStateSteps={emptyStateSteps}
                    emptyStateRightContent={
                      <blockquote
                        className="tiktok-embed"
                        cite={TUTORIAL_TIKTOK_URL}
                        data-video-id={TUTORIAL_TIKTOK_ID}
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
                          products using our optimized tool. Adjust every frame
                          and prompt in the editor for perfect results.{" "}
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
                    primaryActionLabel={canEditProject ? "Edit" : undefined}
                    onPrimaryAction={
                      canEditProject
                        ? (generation) => {
                            const projectForEdit =
                              projects.find(
                                (item) => item.id === generation.id,
                              ) || null;
                            openEditModal(projectForEdit);
                          }
                        : undefined
                    }
                    projectType="motion-swap"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <BottomComposerBar
          compact={true}
          leftControls={
            <MotionSwapReferenceControls
              videos={videos}
              selectedVideoId={selectedVideoId}
              onSelectVideoId={(id) => {
                const targetVideo = videos.find((video) => video.id === id);
                if (targetVideo?.cover_url) {
                  setSelectedVideoId(id);
                  return;
                }
                setSelectedVideoId("");
                showError("This video needs a first-frame image before Motion Swap.");
              }}
              variant="inline"
              showLabel={false}
            />
          }
          configButton={
            <ConfigPopover
              videoDuration="8"
              onDurationChange={() => {}}
              selectedModel="kling_3"
              onModelChange={() => {}}
              userCredits={userCredits || 0}
              selectedVideoQuality={selectedVideoQuality}
              onVideoQualityChange={(value) =>
                setSelectedVideoQuality(normalizeMotionSwapQuality(value))
              }
              videoQualityOptions={MOTION_SWAP_QUALITY_OPTIONS}
              hideModelSelector
              hideLanguageSelector
              hideDurationSelector
              format={selectedSize}
              onFormatChange={(value) => setSelectedSize(value)}
              variant="minimal"
            />
          }
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
          isGenerating={isGenerating}
          generationCost={estimatedCredits || 0}
          userCredits={userCredits}
          generateButtonText="Start"
        />

        <Dialog.Root
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) {
              setEditingProjectId(null);
              setEditAction(null);
              setEditPhotoPrompt("");
              setEditVideoPrompt("");
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="motion-swap-editor-dialog fixed left-[50%] top-[50%] z-50 h-[61vh] w-[calc(100vw-3rem)] max-w-[1680px] translate-x-[-50%] translate-y-[-50%] bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden rounded-2xl">
              <div className="motion-swap-editor-header flex items-center justify-between border-b border-border px-5 py-2.5">
                <div className="flex items-center gap-4">
                  <Dialog.Title className="motion-swap-editor-title text-lg font-semibold text-foreground">
                    Edit Motion Swap
                  </Dialog.Title>
                  <div className="motion-swap-editor-steps flex items-center gap-4">
                    {/* Step 1: Image Prompt */}
                    <div className="flex items-center gap-2">
                      <span className="motion-swap-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        1
                      </span>
                      <div className="motion-swap-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Edit image prompt + generate image</span>
                      </div>
                    </div>

                    <ArrowRight className="motion-swap-editor-step-divider w-3 h-3 text-gray-300" />

                    {/* Step 2: Video Prompt */}
                    <div className="flex items-center gap-2">
                      <span className="motion-swap-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        2
                      </span>
                      <div className="motion-swap-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <VideoIcon className="w-3.5 h-3.5" />
                        <span>Edit video prompt + generate video</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="motion-swap-editor-close inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </div>
              <div className="h-[calc(61vh-58px)]">
                <MotionSwapEditorSplitPane
                  firstFrameUrl={displayFirstFramePreviewUrl}
                  originalVideoUrl={selectedVideo?.video_cdn_url || null}
                  generatedVideoUrl={
                    projectInEditor?.status === "completed"
                      ? projectInEditor.output_video_url || null
                      : null
                  }
                  videoAspectRatio="9:16"
                  isGeneratingImage={showGeneratingImageState}
                  isGeneratingVideo={
                    editAction === "video" ||
                    effectiveSegmentStatus === "generating_video"
                  }
                  form={
                    <MotionSwapEditorFormColumn
                      photoPrompt={editPhotoPrompt}
                      onPhotoPromptChange={setEditPhotoPrompt}
                      videoPrompt={editVideoPrompt}
                      onVideoPromptChange={setEditVideoPrompt}
                      avatars={avatars}
                      products={products}
                      onGenerateImage={() => handleStartEditPreview("image")}
                      onGenerateVideo={() => handleStartEditPreview("video")}
                      canGenerateImage={canGenerateImage}
                      canGenerateVideo={canGenerateVideo}
                      isGeneratingImage={editAction === "image"}
                      isGeneratingVideo={editAction === "video"}
                      videoCreditsCost={displayCreditsCost || estimatedCredits}
                      creditsIcon={<Coins className="h-3.5 w-3.5" />}
                    />
                  }
                />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
