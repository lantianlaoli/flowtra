"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  ArrowRight,
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
  created_at?: string | null;
}

const CREDIT_RATE_PER_SECOND = 9;
const TUTORIAL_TIKTOK_URL =
  "https://www.tiktok.com/@laolilantian/video/7600705503555095816?lang=en";
const TUTORIAL_TIKTOK_ID = "7600705503555095816";
const SESSION_STORAGE_KEY = "motion_swap_session_state";

export default function MotionSwapPage() {
  const searchParams = useSearchParams();
  const { showError, showSuccess } = useToast();
  const { user } = useUser();
  const { credits: userCredits, creditsData } = useCredits();
  const [isLoading, setIsLoading] = useState(true);
  const [videos, setVideos] = useState<MotionSwapVideo[]>([]);
  const [avatars, setAvatars] = useState<UserAvatar[]>([]);
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [projects, setProjects] = useState<MotionSwapProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<Format>("9:16");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAction, setEditAction] = useState<"image" | "video" | null>(null);
  const [editPhotoPrompt, setEditPhotoPrompt] = useState("");
  const [editVideoPrompt, setEditVideoPrompt] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
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
  const videoById = useMemo(
    () => new Map(videos.map((video) => [video.id, video])),
    [videos],
  );
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const getMentionedIds = (text: string) => {
    const characterIds = new Set<string>();
    const productIds = new Set<string>();
    const regex = /@(?<type>character|product)\((?<name>[^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const type = match.groups?.type;
      const name = match.groups?.name?.trim();
      if (!type || !name) continue;
      if (type === "character") {
        const avatar = avatars.find((item) => item.avatar_name === name);
        if (avatar) characterIds.add(avatar.id);
      }
      if (type === "product") {
        const product = products.find((item) => item.product_name === name);
        if (product) productIds.add(product.id);
      }
    }
    return {
      characterIds: Array.from(characterIds),
      productIds: Array.from(productIds),
    };
  };
  const mentionSelections = useMemo(
    () => getMentionedIds(editPhotoPrompt),
    [editPhotoPrompt, avatars, products],
  );
  const editAvatarId = mentionSelections.characterIds[0] || "";
  const editProductId = mentionSelections.productIds[0] || "";

  const estimatedCredits = selectedVideo?.duration_seconds
    ? selectedVideo.duration_seconds * CREDIT_RATE_PER_SECOND
    : null;

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

  const loadProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/motion-swap/list", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("[Motion Swap] Failed to load projects:", error);
    }
  }, []);

  useEffect(() => {
    loadAssets();
    loadProjects();
  }, [loadAssets, loadProjects]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        activeProjectId?: string | null;
        selectedVideoId?: string;
        selectedSize?: Format;
      };
      if (parsed.activeProjectId) {
        setActiveProjectId(parsed.activeProjectId);
      }
      if (parsed.selectedVideoId) {
        setSelectedVideoId(parsed.selectedVideoId);
      }
      if (parsed.selectedSize) {
        setSelectedSize(parsed.selectedSize);
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
    if (!projects.length) return;
    if (
      !activeProjectId ||
      !projects.some((item) => item.id === activeProjectId)
    ) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activeProject) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    const payload = {
      activeProjectId: activeProject.id,
      selectedVideoId,
      selectedSize,
    };
    try {
      window.sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch (error) {
      console.error("Failed to persist Motion Swap session state:", error);
    }
  }, [activeProject, selectedVideoId, selectedSize]);

  useEffect(() => {
    if (!activeProject?.id) return;

    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
      const response = await fetch(
        `/api/motion-swap/${activeProject.id}/status`,
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
      .channel(`motion-swap-${activeProject.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "motion_swap_projects",
          filter: `id=eq.${activeProject.id}`,
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
  }, [activeProject?.id]);

  useEffect(() => {
    setEditPhotoPrompt("");
    setEditVideoPrompt("");
  }, [activeProject?.id]);

  const buildDefaultPrompt = (
    avatarName?: string | null,
    productName?: string | null,
  ) => {
    const tokens = [];
    if (avatarName) tokens.push(`@character(${avatarName})`);
    if (productName) tokens.push(`@product(${productName})`);
    if (tokens.length === 0) return "";
    return `Swap ${tokens.join(" and ")} in the reference video.`;
  };

  const openEditModal = (projectToEdit?: MotionSwapProject | null) => {
    const targetProject = projectToEdit || activeProject;
    if (!targetProject) return;
    if (targetProject.id !== activeProject?.id) {
      setEditPhotoPrompt("");
      setEditVideoPrompt("");
    }
    setActiveProjectId(targetProject.id);
    if (targetProject.creator_source_video_id) {
      setSelectedVideoId(targetProject.creator_source_video_id);
    }
    if (!editPhotoPrompt) {
      const avatarName =
        avatars.find((avatar) => avatar.id === targetProject.avatar_id)
          ?.avatar_name || null;
      const productName =
        products.find((product) => product.id === targetProject.product_id)
          ?.product_name || null;
      const defaultPrompt = buildDefaultPrompt(avatarName, productName);
      const nextPrompt = targetProject.photo_prompt || defaultPrompt;
      if (nextPrompt) {
        setEditPhotoPrompt(nextPrompt);
      }
    }
    if (!editVideoPrompt) {
      setEditVideoPrompt(
        targetProject.video_prompt ||
          "Keep all elements the same as the reference video. Only swap the person and product.",
      );
    }
    setEditError(null);
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
    activeProject?.preview_image_url ||
    activeProject?.reference_cover_url ||
    selectedVideo?.cover_url ||
    null;
  const editVideoUrl =
    activeProject?.output_video_url || selectedVideo?.video_cdn_url || null;
  const effectiveSegmentStatus = useMemo(() => {
    if (activeProject?.status === "generating_preview")
      return "generating_first_frame";
    if (activeProject?.status === "preview_ready") return "first_frame_ready";
    return activeProject?.status || "pending";
  }, [activeProject?.status]);
  const editSegment = useMemo(
    () => ({
      index: 0,
      status: effectiveSegmentStatus,
      firstFrameUrl: editFirstFrameUrl,
      videoUrl: editVideoUrl,
      prompt: {},
    }),
    [editFirstFrameUrl, editVideoUrl, effectiveSegmentStatus],
  );
  const isSubmittingEdit = editAction !== null;
  const hasSwapTarget = Boolean(editAvatarId || editProductId);
  const isPreviewReady = activeProject?.status === "preview_ready";
  const canGenerateImage = Boolean(
    activeProject?.id &&
      selectedVideoId &&
      selectedVideoHasFirstFrame &&
      editPhotoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      (activeProject?.status === "pending" || isPreviewReady),
  );
  const canGenerateVideo = Boolean(
    activeProject?.id &&
      selectedVideoId &&
      selectedVideoHasFirstFrame &&
      editPhotoPrompt.trim().length > 0 &&
      editVideoPrompt.trim().length > 0 &&
      hasSwapTarget &&
      !isSubmittingEdit &&
      (activeProject?.status === "pending" || isPreviewReady),
  );

  const productDisplayName = useMemo(() => {
    if (!activeProject?.product_id) return null;
    const product = productById.get(activeProject.product_id);
    return product?.product_name || null;
  }, [productById, activeProject?.product_id]);

  const projectVideo = useMemo(() => {
    if (!activeProject?.creator_source_video_id) return null;
    return (
      videos.find(
        (video) => video.id === activeProject.creator_source_video_id,
      ) || null
    );
  }, [videos, activeProject?.creator_source_video_id]);

  const displayDurationSeconds =
    activeProject?.reference_duration_seconds ??
    projectVideo?.duration_seconds ??
    selectedVideo?.duration_seconds ??
    null;

  const displayCreditsCost =
    typeof activeProject?.credits_cost === "number" &&
    activeProject.credits_cost > 0
      ? activeProject.credits_cost
      : displayDurationSeconds
        ? displayDurationSeconds * CREDIT_RATE_PER_SECOND
        : null;

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
          : durationSeconds
            ? durationSeconds * CREDIT_RATE_PER_SECOND
            : undefined;

      return {
        id: item.id,
        timestamp: item.created_at ? new Date(item.created_at) : new Date(),
        status,
        progress: item.progress_percentage || 0,
        stage,
        videoUrl: item.output_video_url || undefined,
        coverUrl:
          item.preview_image_url ||
          item.reference_cover_url ||
          fallbackVideo?.cover_url ||
          (item.id === activeProject?.id
            ? selectedVideo?.cover_url
            : undefined) ||
          undefined,
        brand: undefined,
        product: item.product_id
          ? productById.get(item.product_id)?.product_name || undefined
          : undefined,
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
    selectedVideo?.duration_seconds,
    selectedVideo?.cover_url,
    selectedSize,
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
        description: "Select avatar and product in Edit",
      },
      {
        number: 4,
        description: "Start generation and confirm",
      },
    ],
    [],
  );

  const handleStartEditPreview = async (action: "image" | "video") => {
    if (!activeProject?.id) return;
    if (!editPhotoPrompt.trim()) {
      setEditError("Enter a first frame prompt to continue.");
      return;
    }
    if (!editVideoPrompt.trim()) {
      setEditError("Enter a video prompt to continue.");
      return;
    }
    if (!selectedVideoId) {
      setEditError("Select a reference video to continue.");
      return;
    }
    if (!selectedVideoHasFirstFrame) {
      setEditError("This video needs a first-frame image before Motion Swap.");
      return;
    }
    if (!hasSwapTarget) {
      setEditError(
        "Use @character or @product in the first frame prompt to select a swap target.",
      );
      return;
    }

    setEditAction(action);
    setEditError(null);

    try {
      const response = await fetch(
        `/api/motion-swap/${activeProject.id}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reference_video_id: selectedVideoId,
            avatar_id: editAvatarId,
            product_id: editProductId,
            photo_prompt: editPhotoPrompt,
            video_prompt: editVideoPrompt,
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
      setActiveProjectId(data.project.id);
      const successMessage =
        action === "image"
          ? "Generating preview image..."
          : "Generating preview and video...";
      showSuccess(successMessage);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start Motion Swap";
      setEditError(message);
    } finally {
      setEditAction(null);
    }
  };

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
              selectedModel="veo3_fast"
              onModelChange={() => {}}
              userCredits={userCredits || 0}
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
          generateButtonText="Generate"
        />

        <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="motion-swap-editor-dialog fixed left-[50%] top-[50%] z-50 h-[62vh] w-[calc(100%-2rem)] max-w-7xl translate-x-[-50%] translate-y-[-50%] bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden rounded-2xl">
              <div className="motion-swap-editor-header flex items-center justify-between border-b border-border px-6 py-3">
                <div className="flex items-center gap-4">
                  <Dialog.Title className="motion-swap-editor-title text-lg font-semibold text-foreground">
                    Edit Motion Swap
                  </Dialog.Title>
                  <div className="motion-swap-editor-steps flex items-center gap-4">
                    {/* Step 1: Edit First Frame */}
                    <div className="flex items-center gap-2">
                      <span className="motion-swap-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        1
                      </span>
                      <div className="motion-swap-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Edit first frame</span>
                      </div>
                    </div>

                    <ArrowRight className="motion-swap-editor-step-divider w-3 h-3 text-gray-300" />

                    {/* Step 2: Generate Video */}
                    <div className="flex items-center gap-2">
                      <span className="motion-swap-editor-step-badge flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        2
                      </span>
                      <div className="motion-swap-editor-step-text flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <VideoIcon className="w-3.5 h-3.5" />
                        <span>Generate video</span>
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
              <div className="h-[calc(62vh-64px)]">
                <MotionSwapEditorSplitPane
                  segment={editSegment}
                  videoAspectRatio="9:16"
                  videoModel="kling-2.6/motion-control"
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
                      errorMessage={editError}
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
