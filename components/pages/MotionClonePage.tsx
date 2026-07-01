"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  ArrowRight,
  Coins,
  AlertCircle,
} from "lucide-react";
import GenerationProgressDisplay, {
  type Generation,
} from "@/components/ui/GenerationProgressDisplay";
import { UserAvatar } from "@/lib/supabase";
import { useSupabaseBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/contexts/ToastContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import BottomComposerBar from "@/components/ui/BottomComposerBar";
import ConfigPopover from "@/components/ui/ConfigPopover";
import MotionCloneEditorSplitPane from "@/components/motion-clone/MotionCloneEditorSplitPane";
import MotionCloneEditorFormColumn from "@/components/motion-clone/MotionCloneEditorFormColumn";
import MotionCloneReferenceControls from "@/components/motion-clone/MotionCloneReferenceControls";
import Sidebar from "@/components/layout/Sidebar";
import DashboardContentTransition from "@/components/layout/DashboardContentTransition";
import { useUser } from "@clerk/nextjs";
import { useCredits } from "@/contexts/CreditsContext";
import * as Dialog from "@radix-ui/react-dialog";
import type { Format } from "@/components/ui/FormatSelector";
import { useSearchParams } from "next/navigation";
import { MENTION_TOKEN_REGEX, buildMentionToken, normalizeMentionLabel, parseMentionToken } from "@/lib/prompt-mention-tokens";
import {
  SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS,
  SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS,
  SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS,
  SEEDANCE_VIDEO_MODELS,
  getMotionCloneGenerationCost,
  normalizeMotionCloneQuality,
  type CloneVideoQuality,
  type VideoModel,
} from "@/lib/constants";
import {
  buildMotionClonePreviewPrompt,
  buildMotionCloneVideoPrompt,
} from "@/lib/motion-clone-prompts";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { trackEvent } from "@/lib/analytics/client";

interface MotionCloneVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_language?: string | null;
  source_name?: string | null;
  stats?: Record<string, unknown> | null;
  source_id?: string | null;
}

interface MotionCloneProject {
  id: string;
  status: string;
  progress_percentage: number;
  mode?: string | null;
  video_model?: string | null;
  creator_source_id?: string | null;
  creator_source_video_id?: string | null;
  avatar_id?: string | null;
  product_id?: string | null;
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

type PersistedMotionCloneProject = Pick<
  MotionCloneProject,
  | "id"
  | "status"
  | "progress_percentage"
  | "mode"
  | "video_model"
  | "creator_source_video_id"
  | "avatar_id"
  | "product_id"
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

interface MotionCloneSessionState {
  projects?: PersistedMotionCloneProject[];
  activeProjectId?: string | null;
  selectedVideoId?: string;
  selectedSize?: Format;
  selectedVideoQuality?: CloneVideoQuality;
  selectedVideoModel?: VideoModel;
}

interface MotionClonePromptDraft {
  photoPrompt: string;
  videoPrompt: string;
}

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

const isMaintenanceModeError = (payload: unknown) => (
  typeof payload === "object" &&
  payload !== null &&
  (payload as { code?: unknown }).code === "MAINTENANCE_MODE"
);

const MOTION_CLONE_TUTORIAL_EMBED_URL =
  "https://www.youtube.com/embed/d_pzzXUj-Lw?rel=0";
const SESSION_STORAGE_KEY = "motion_clone_session_state";
const normalizeMotionCloneVideoModel = (value?: string | null): VideoModel => (
  SEEDANCE_VIDEO_MODELS.includes(value as VideoModel)
    ? value as VideoModel
    : "seedance_2_mini"
);

const getMotionCloneQualityOptions = (model: VideoModel) => {
  const table = model === "seedance_2"
    ? SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS
    : model === "seedance_2_fast"
      ? SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS;
  return [
    { value: "480p" as const, label: "480p", creditsPerSecondLabel: `${table["480p"]} credits / s` },
    { value: "720p" as const, label: "720p", creditsPerSecondLabel: `${table["720p"]} credits / s` },
  ];
};
const DEFAULT_FEMALE_MENTION = buildMentionToken({
  type: "character",
  label: "Lin Yuqing",
});
const DEFAULT_IMAGE_PROMPT_TEMPLATE = buildMotionClonePreviewPrompt({
  hasAvatar: true,
  avatarLabel: DEFAULT_FEMALE_MENTION,
});
const EDITABLE_MOTION_CLONE_STATUSES = [
  "pending",
  "preview_ready",
  "completed",
  "failed",
] as const;

const serializeMotionCloneProject = (
  project: MotionCloneProject,
): PersistedMotionCloneProject => ({
  id: project.id,
  status: project.status,
  progress_percentage: project.progress_percentage,
  mode: project.mode ?? null,
  video_model: project.video_model ?? null,
  creator_source_video_id: project.creator_source_video_id ?? null,
  avatar_id: project.avatar_id ?? null,
  product_id: project.product_id ?? null,
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

const isPersistedMotionCloneProject = (
  value: unknown,
): value is PersistedMotionCloneProject => {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return (
    typeof project.id === "string" &&
    typeof project.status === "string"
  );
};

export default function MotionClonePage() {
  const supabase = useSupabaseBrowserClient();
  const searchParams = useSearchParams();
  const { showError, showSuccess } = useToast();
  const { user } = useUser();
  const { credits: userCredits, creditsData, refetchCredits } = useCredits();
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<MotionCloneVideo[]>([]);
  const [avatars, setAvatars] = useState<UserAvatar[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true,
  });
  const [projects, setProjects] = useState<MotionCloneProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<Format>("9:16");
  const [selectedVideoModel, setSelectedVideoModel] =
    useState<VideoModel>("seedance_2_mini");
  const [selectedVideoQuality, setSelectedVideoQuality] =
    useState<CloneVideoQuality>("480p");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAction, setEditAction] = useState<"image" | "video" | null>(null);
  const [editPhotoPrompt, setEditPhotoPrompt] = useState("");
  const [editVideoPrompt, setEditVideoPrompt] = useState("");
  const [promptDrafts, setPromptDrafts] = useState<
    Record<string, MotionClonePromptDraft>
  >({});
  const [downloadStates, setDownloadStates] = useState<
    Record<string, "idle" | "processing" | "success">
  >({});

  useEffect(() => {
    if (!user?.id) return;
    trackEvent(ANALYTICS_EVENTS.asset_library_viewed, {
      feature: "motion_clone",
      surface: "motion_clone_page",
    });
  }, [user?.id]);

  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch("/api/check-kie-credits");
        if (!response.ok) {
          setKieCreditsStatus({ sufficient: true, loading: false });
          return;
        }
        const data = await response.json();
        setKieCreditsStatus({
          sufficient: Boolean(data?.sufficient),
          loading: false,
          currentCredits: data?.currentCredits,
          threshold: data?.threshold,
        });
      } catch (error) {
        console.error("[Motion Clone] Failed to check KIE credits:", error);
        setKieCreditsStatus({ sufficient: true, loading: false });
      }
    };

    checkKieCredits();
  }, []);

  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedVideoId),
    [videos, selectedVideoId],
  );
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
  const getMentionedIds = useCallback((text: string) => {
    const characterIds = new Set<string>();
    const avatarsByKey = new Map(avatars.map((item) => [normalizeMentionLabel(item.avatar_name || ""), item]));
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
      if (parsed.type === "unknown") {
        const avatar = avatarsByKey.get(mentionKey);
        if (avatar) characterIds.add(avatar.id);
      }
    }
    return {
      characterIds: Array.from(characterIds),
    };
  }, [avatars]);
  const mentionSelections = useMemo(() => {
    const characterIds = new Set<string>();

    [editPhotoPrompt, editVideoPrompt].forEach((prompt) => {
      const ids = getMentionedIds(prompt);
      ids.characterIds.forEach((id) => characterIds.add(id));
    });

    return {
      characterIds: Array.from(characterIds),
    };
  }, [editPhotoPrompt, editVideoPrompt, getMentionedIds]);
  const editAvatarId = mentionSelections.characterIds[0] || "";

  const estimatedCredits = getMotionCloneGenerationCost(
    selectedVideo?.duration_seconds,
    selectedVideoQuality,
    selectedVideoModel,
  );

  const loadAssets = useCallback(async () => {
    try {
      const [assetsResponse, avatarsResponse] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/user-avatars"),
      ]);

      if (assetsResponse.ok) {
        const data = await assetsResponse.json();
        setVideos(data.videos || []);
      }

      if (avatarsResponse.ok) {
        const data = await avatarsResponse.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error("[Motion Clone] Failed to load assets:", error);
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
      const parsed = JSON.parse(saved) as MotionCloneSessionState;
      if (Array.isArray(parsed.projects)) {
        setProjects(
          parsed.projects.filter(isPersistedMotionCloneProject),
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
          normalizeMotionCloneQuality(parsed.selectedVideoQuality),
        );
      }
      if (parsed.selectedVideoModel) {
        setSelectedVideoModel(normalizeMotionCloneVideoModel(parsed.selectedVideoModel));
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
        setSelectedVideoId(videoId);
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/dashboard/motion-clone");
        }
      }
    }
  }, [isLoading, searchParams, videos]);

  // Preselect video from sessionStorage (for Motion Clone)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoading) return;

    const stored = window.sessionStorage.getItem("preselect_motion_clone_video");
    if (!stored) return;

    window.sessionStorage.removeItem("preselect_motion_clone_video");

    try {
      const parsed = JSON.parse(stored) as { videoId?: string };
      const targetId = parsed.videoId;
      if (!targetId) return;

      const video = videos.find((item) => item.id === targetId);
      if (video) {
        setSelectedVideoId(targetId);
        showSuccess("Video selected for Motion Clone.");
      } else {
        setSelectedVideoId("");
      }
    } catch (error) {
      console.error("[MotionClonePage] Failed to preselect video:", error);
    }
  }, [isLoading, videos, showSuccess]);

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
    setSelectedVideoQuality(normalizeMotionCloneQuality(projectInEditor.mode));
    setSelectedVideoModel(normalizeMotionCloneVideoModel(projectInEditor.video_model));
  }, [projectInEditor?.id, projectInEditor?.mode, projectInEditor?.video_model, projectInEditor]);

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
        selectedVideoQuality === "480p" &&
        selectedVideoModel === "seedance_2_mini"
      ) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
    }
    const payload: MotionCloneSessionState = {
      projects: projects.map(serializeMotionCloneProject),
      activeProjectId: activeProject?.id ?? activeProjectId ?? null,
      selectedVideoId,
      selectedSize,
      selectedVideoQuality,
      selectedVideoModel,
    };
    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error("Failed to persist Motion Clone session state:", error);
    }
  }, [
    projects,
    activeProject?.id,
    activeProjectId,
    selectedVideoId,
    selectedSize,
    selectedVideoQuality,
    selectedVideoModel,
  ]);

  const watchedProjectId = editingProjectId || activeProject?.id || null;

  useEffect(() => {
    if (!watchedProjectId) return;

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
      const response = await fetch(
        `/api/motion-clone/${watchedProjectId}/status`,
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
      .channel(`motion-clone-${watchedProjectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "motion_clone_projects",
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
  }, [supabase, watchedProjectId]);

  const buildDefaultPrompt = (avatarName?: string | null) => {
    if (!avatarName) {
      return DEFAULT_IMAGE_PROMPT_TEMPLATE;
    }
    const avatarToken = avatarName
      ? buildMentionToken({ type: "character", label: avatarName })
      : null;
    return buildMotionClonePreviewPrompt({
      hasAvatar: Boolean(avatarToken),
      avatarLabel: avatarToken,
    });
  };

  const buildDefaultVideoPrompt = (avatarName?: string | null) => buildMotionCloneVideoPrompt({
    hasAvatar: Boolean(avatarName?.trim()),
  });

  const isNewPendingProject = (project: MotionCloneProject) =>
    project.status === "pending" &&
    !project.photo_prompt &&
    !project.video_prompt &&
    !project.preview_image_url &&
    !project.output_video_url;

  const openEditModal = (projectToEdit?: MotionCloneProject | null) => {
    const targetProject = projectToEdit || activeProject;
    if (!targetProject) return;
    setEditingProjectId(targetProject.id);
    if (targetProject.creator_source_video_id) {
      setSelectedVideoId(targetProject.creator_source_video_id);
    }
    setSelectedVideoQuality(normalizeMotionCloneQuality(targetProject.mode));
    setSelectedVideoModel(normalizeMotionCloneVideoModel(targetProject.video_model));
    const avatarName =
      avatars.find((avatar) => avatar.id === targetProject.avatar_id)
        ?.avatar_name || null;
    const defaultPrompt = buildDefaultPrompt(avatarName);
    const draft = promptDrafts[targetProject.id];
    const initialPhotoPrompt = draft
      ? draft.photoPrompt
      : targetProject.photo_prompt ||
        (isNewPendingProject(targetProject) ? defaultPrompt : "");
    const initialVideoPrompt = draft
      ? draft.videoPrompt
      : targetProject.video_prompt ||
        (isNewPendingProject(targetProject)
          ? buildDefaultVideoPrompt(avatarName)
          : "");

    setEditPhotoPrompt(initialPhotoPrompt);
    setEditVideoPrompt(initialVideoPrompt);
    setEditDialogOpen(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    trackEvent(ANALYTICS_EVENTS.motion_clone_generation_requested, {
      feature: "motion_clone",
      surface: "motion_clone_page",
      aspect_ratio: selectedSize,
      video_model: selectedVideoModel,
      download_type: selectedVideoQuality,
    });

    try {
      const response = await fetch("/api/motion-clone/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        if (isMaintenanceModeError(data)) {
          setKieCreditsStatus({ sufficient: false, loading: false });
        }
        throw new Error(data.error || "Failed to start Motion Clone");
      }

      setProjects((prev) => [data.project, ...prev]);
      setActiveProjectId(data.project?.id || null);
      showSuccess(
        "Motion Clone started. You will see updates here as it completes.",
      );
    } catch (error) {
      console.error("[Motion Clone] Create failed:", error);
      showError(
        error instanceof Error ? error.message : "Failed to start Motion Clone",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const isMaintenanceMode = !kieCreditsStatus.loading && !kieCreditsStatus.sufficient;
  const canGenerate = !isGenerating && !isMaintenanceMode;
  const canEditProject = projects.length > 0;

  const editFirstFrameUrl =
    projectInEditor?.preview_image_url ||
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
  const hasSwapTarget = Boolean(editAvatarId);
  const isEditableMotionCloneStatus = projectInEditor
    ? EDITABLE_MOTION_CLONE_STATUSES.includes(
        projectInEditor.status as (typeof EDITABLE_MOTION_CLONE_STATUSES)[number],
      )
    : false;
  const canGenerateImage = Boolean(
    projectInEditor?.id &&
      selectedVideoId &&
      editPhotoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      isEditableMotionCloneStatus,
  );
  const canGenerateVideo = Boolean(
    projectInEditor?.id &&
      selectedVideoId &&
      editPhotoPrompt.trim().length > 0 &&
      editVideoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      isEditableMotionCloneStatus,
  );

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
      : getMotionCloneGenerationCost(
          displayDurationSeconds,
          projectInEditor?.mode || selectedVideoQuality,
          normalizeMotionCloneVideoModel(projectInEditor?.video_model || selectedVideoModel),
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
          : getMotionCloneGenerationCost(
              durationSeconds,
              item.mode || selectedVideoQuality,
              normalizeMotionCloneVideoModel(item.video_model || selectedVideoModel),
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
          undefined,
        product: undefined,
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
    activeProject?.id,
    downloadStates,
    selectedVideo?.duration_seconds,
    selectedSize,
    selectedVideoQuality,
    selectedVideoModel,
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
        description: "Use @ to select the character in Edit",
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
    if (!hasSwapTarget) {
      showError(
        "Use @character in the image or video prompt to select a swap target.",
      );
      return;
    }

    setEditAction(action);

    try {
      const response = await fetch(
        `/api/motion-clone/${projectInEditor.id}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference_video_id: selectedVideoId,
            avatar_id: editAvatarId,
            photo_prompt: editPhotoPrompt,
            video_prompt: editVideoPrompt,
            mode: selectedVideoQuality,
            video_model: selectedVideoModel,
            action: action,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        if (isMaintenanceModeError(data)) {
          setKieCreditsStatus({ sufficient: false, loading: false });
        }
        throw new Error(data.error || "Failed to start Motion Clone");
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
        error instanceof Error ? error.message : "Failed to start Motion Clone";
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
      trackEvent(ANALYTICS_EVENTS.motion_clone_download_started, {
        feature: "motion_clone",
        surface: "motion_clone_page",
        project_id: historyId,
        is_first_download: isFirstDownload,
      });

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

        trackEvent(ANALYTICS_EVENTS.motion_clone_download_completed, {
          feature: "motion_clone",
          surface: "motion_clone_page",
          project_id: historyId,
          is_first_download: isFirstDownload,
        });

        window.setTimeout(() => {
          setDownloadStates((prev) => ({ ...prev, [historyId]: "idle" }));
        }, 2500);
      } catch (error) {
        console.error("[Motion Clone] Download failed:", error);
        trackEvent(ANALYTICS_EVENTS.motion_clone_download_failed, {
          feature: "motion_clone",
          surface: "motion_clone_page",
          project_id: historyId,
        });
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
        <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
          <div className="flex-1 flex flex-col min-h-0">
            <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-24 md:pb-28 min-h-0">
              <div className="dashboard-main-shell flex-1 flex min-h-0">
                <div className="rounded-[26px] bg-background border border-border shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </DashboardContentTransition>
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
      <div className="fixed top-0 right-0 bottom-0 z-[90] flex items-center justify-center bg-white/[0.78] px-4 backdrop-blur-[6px]" style={{ left: 'var(--dashboard-sidebar-width, 14rem)' }}>
        <div className="w-full max-w-md rounded-[24px] border border-border bg-white p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.12)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7] text-black">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-black">
            Motion Clone is being upgraded
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#666666]">
            We&apos;re improving motion cloning quality and adding new model options. This workspace will be back soon.
          </p>
        </div>
      </div>
      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
        <div className="flex-1 flex flex-col min-h-0">
          <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-24 md:pb-28 min-h-0">
            <div className="dashboard-main-shell flex-1 flex min-h-0">
              <div className="rounded-[26px] bg-background border border-border shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-hidden min-h-0">
                  <GenerationProgressDisplay
                    generations={displayedGenerations}
                    onDownload={handleDownload}
                    emptyStateSteps={emptyStateSteps}
                    emptyStateRightContent={
                      <div className="w-full max-w-[720px] overflow-hidden rounded-[24px] border border-border bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
                        <div className="aspect-video w-full">
                          <iframe
                            className="h-full w-full"
                            src={MOTION_CLONE_TUTORIAL_EMBED_URL}
                            title="Motion Clone tutorial"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        </div>
                      </div>
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
                    projectType="motion-clone"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <BottomComposerBar
          compact={true}
          leftControls={
            <MotionCloneReferenceControls
              videos={videos}
              selectedVideoId={selectedVideoId}
              onSelectVideoId={(id) => {
                setSelectedVideoId(id);
              }}
              variant="inline"
              showLabel={false}
            />
          }
          configButton={
            <ConfigPopover
              videoDuration="8"
              onDurationChange={() => {}}
              selectedModel={selectedVideoModel}
              onModelChange={(model) => {
                setSelectedVideoModel(model);
                setSelectedVideoQuality(normalizeMotionCloneQuality(selectedVideoQuality));
              }}
              userCredits={userCredits || 0}
              selectedVideoQuality={selectedVideoQuality}
              onVideoQualityChange={(value) =>
                setSelectedVideoQuality(normalizeMotionCloneQuality(value))
              }
              videoQualityOptions={getMotionCloneQualityOptions(selectedVideoModel)}
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
          maintenanceMode={isMaintenanceMode}
          maintenanceLabel="Maintenance"
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
            <Dialog.Content className="motion-clone-editor-dialog fixed left-[50%] top-[50%] z-50 flex h-[78dvh] min-h-[760px] max-h-[920px] w-[calc(100vw-3rem)] max-w-[1680px] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden rounded-2xl bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
              <div className="motion-clone-editor-header flex items-center justify-between border-b border-border px-5 py-2.5">
                <div className="flex items-center gap-4">
                  <Dialog.Title className="motion-clone-editor-title text-lg font-semibold text-foreground">
                    Edit Motion Clone
                  </Dialog.Title>
                  <div className="motion-clone-editor-steps flex items-center gap-4">
                    {/* Step 1: Image Prompt */}
                    <div className="flex items-center gap-2">
                      <span className="motion-clone-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        1
                      </span>
                      <div className="motion-clone-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Edit image prompt + generate image</span>
                      </div>
                    </div>

                    <ArrowRight className="motion-clone-editor-step-divider w-3 h-3 text-gray-300" />

                    {/* Step 2: Video Prompt */}
                    <div className="flex items-center gap-2">
                      <span className="motion-clone-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        2
                      </span>
                      <div className="motion-clone-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <VideoIcon className="w-3.5 h-3.5" />
                        <span>Edit video prompt + generate video</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="motion-clone-editor-close inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1">
                <MotionCloneEditorSplitPane
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
                    <MotionCloneEditorFormColumn
                      photoPrompt={editPhotoPrompt}
                      onPhotoPromptChange={setEditPhotoPrompt}
                      videoPrompt={editVideoPrompt}
                      onVideoPromptChange={setEditVideoPrompt}
                      avatars={avatars}
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
      </DashboardContentTransition>
    </div>
  );
}
