'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Image as ImageIcon, Video as VideoIcon, ArrowRight } from 'lucide-react';
import GenerationProgressDisplay, { type Generation } from '@/components/ui/GenerationProgressDisplay';
import { getSupabase, UserAvatar, UserProduct } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import BottomComposerBar from '@/components/ui/BottomComposerBar';
import ConfigPopover from '@/components/ui/ConfigPopover';
import MotionSwapEditorSplitPane from '@/components/motion-swap/MotionSwapEditorSplitPane';
import MotionSwapEditorFormColumn from '@/components/motion-swap/MotionSwapEditorFormColumn';
import MotionSwapReferenceControls from '@/components/motion-swap/MotionSwapReferenceControls';
import Sidebar from '@/components/layout/Sidebar';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import * as Dialog from '@radix-ui/react-dialog';
import type { Format } from '@/components/ui/FormatSelector';
import { useSearchParams } from 'next/navigation';

interface CreatorSourcePlatform {
  id: string;
  platform: string;
  handle: string;
  profile_url?: string | null;
  avatar_url?: string | null;
  display_name?: string | null;
}

interface CreatorSourceVideo {
  id: string;
  platform: string;
  platform_video_id?: string | null;
  video_url: string;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  stats?: Record<string, unknown> | null;
}

interface CreatorSource {
  id: string;
  source_name: string;
  creator_source_platforms?: CreatorSourcePlatform[];
  creator_source_videos?: CreatorSourceVideo[];
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
const TUTORIAL_TIKTOK_URL = 'https://www.tiktok.com/@laolilantian/video/7588829935922351378';
const TUTORIAL_TIKTOK_ID = '7588829935922351378';
const SESSION_STORAGE_KEY = 'motion_swap_session_state';

export default function MotionSwapPage() {
  const searchParams = useSearchParams();
  const { showError, showSuccess } = useToast();
  const { user } = useUser();
  const { credits: userCredits, creditsData } = useCredits();
  const [isLoading, setIsLoading] = useState(true);
  const [creatorSources, setCreatorSources] = useState<CreatorSource[]>([]);
  const [avatars, setAvatars] = useState<UserAvatar[]>([]);
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [project, setProject] = useState<MotionSwapProject | null>(null);
  const [selectedSize, setSelectedSize] = useState<Format>('9:16');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editAction, setEditAction] = useState<'image' | 'video' | null>(null);
  const [editPhotoPrompt, setEditPhotoPrompt] = useState('');
  const [editVideoPrompt, setEditVideoPrompt] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const selectedSource = useMemo(
    () => creatorSources.find(source => source.id === selectedSourceId),
    [creatorSources, selectedSourceId]
  );

  const selectedVideo = useMemo(
    () => selectedSource?.creator_source_videos?.find(video => video.id === selectedVideoId),
    [selectedSource, selectedVideoId]
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
      if (type === 'character') {
        const avatar = avatars.find(item => item.avatar_name === name);
        if (avatar) characterIds.add(avatar.id);
      }
      if (type === 'product') {
        const product = products.find(item => item.product_name === name);
        if (product) productIds.add(product.id);
      }
    }
    return { characterIds: Array.from(characterIds), productIds: Array.from(productIds) };
  };
  const mentionSelections = useMemo(
    () => getMentionedIds(editPhotoPrompt),
    [editPhotoPrompt, avatars, products]
  );
  const editAvatarId = mentionSelections.characterIds[0] || '';
  const editProductId = mentionSelections.productIds[0] || '';

  const estimatedCredits = selectedVideo?.duration_seconds
    ? selectedVideo.duration_seconds * CREDIT_RATE_PER_SECOND
    : null;

  const loadAssets = useCallback(async () => {
    try {
      const [assetsResponse, avatarsResponse] = await Promise.all([
        fetch('/api/assets'),
        fetch('/api/user-avatars')
      ]);

      if (assetsResponse.ok) {
        const data = await assetsResponse.json();
        setCreatorSources(data.creatorSources || []);

        const brandedProducts = (data.brands || []).flatMap((brand: any) => brand.products || []);
        const unbrandedProducts = data.unbrandedProducts || [];
        setProducts([...brandedProducts, ...unbrandedProducts]);
      }

      if (avatarsResponse.ok) {
        const data = await avatarsResponse.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error('[Motion Swap] Failed to load assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        project?: MotionSwapProject | null;
        selectedSourceId?: string;
        selectedVideoId?: string;
        selectedSize?: Format;
      };
      if (parsed.project) {
        setProject(parsed.project);
      }
      if (parsed.selectedSourceId) {
        setSelectedSourceId(parsed.selectedSourceId);
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

    const sourceId = searchParams.get('sourceId');
    const videoId = searchParams.get('videoId');

    if (sourceId && videoId) {
      // Verify that the source and video exist
      const source = creatorSources.find(s => s.id === sourceId);
      if (source) {
        const video = source.creator_source_videos?.find(v => v.id === videoId);
        if (video) {
          setSelectedSourceId(sourceId);
          setSelectedVideoId(videoId);
          // Clear URL parameters after setting state
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', '/dashboard/motion-swap');
          }
        }
      }
    }
  }, [isLoading, searchParams, creatorSources]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!project) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    const payload = {
      project,
      selectedSourceId,
      selectedVideoId,
      selectedSize
    };
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to persist Motion Swap session state:', error);
    }
  }, [project, selectedSourceId, selectedVideoId, selectedSize]);

  useEffect(() => {
    if (!selectedSource || selectedVideoId) return;
    const firstVideo = selectedSource.creator_source_videos?.[0];
    if (firstVideo) {
      setSelectedVideoId(firstVideo.id);
    }
  }, [selectedSource, selectedVideoId]);

  useEffect(() => {
    if (!project?.id) return;

    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
      const response = await fetch(`/api/motion-swap/${project.id}/status`);
      if (!response.ok) return null;
      return response.json();
    };

    const init = async () => {
      const payload = await fetchStatus();
      if (payload?.project && isMounted) {
        setProject(payload.project);
      }
    };

    init();

    channel = supabase
      .channel(`motion-swap-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'motion_swap_projects',
          filter: `id=eq.${project.id}`
        },
        async () => {
          const payload = await fetchStatus();
          if (payload?.project && isMounted) {
            setProject(payload.project);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [project?.id]);

  useEffect(() => {
    setEditPhotoPrompt('');
    setEditVideoPrompt('');
  }, [project?.id]);

  const buildDefaultPrompt = (avatarName?: string | null, productName?: string | null) => {
    const tokens = [];
    if (avatarName) tokens.push(`@character(${avatarName})`);
    if (productName) tokens.push(`@product(${productName})`);
    if (tokens.length === 0) return '';
    return `Swap ${tokens.join(' and ')} in the reference video.`;
  };

  const openEditModal = () => {
    if (project?.creator_source_id) {
      setSelectedSourceId(project.creator_source_id);
    }
    if (project?.creator_source_video_id) {
      setSelectedVideoId(project.creator_source_video_id);
    }
    if (!editPhotoPrompt) {
      const avatarName = avatars.find(avatar => avatar.id === project?.avatar_id)?.avatar_name || null;
      const productName = products.find(product => product.id === project?.product_id)?.product_name || null;
      const defaultPrompt = buildDefaultPrompt(avatarName, productName);
      const nextPrompt = project?.photo_prompt || defaultPrompt;
      if (nextPrompt) {
        setEditPhotoPrompt(nextPrompt);
      }
    }
    if (!editVideoPrompt) {
      setEditVideoPrompt(project?.video_prompt || 'Keep all elements the same as the reference video. Only swap the person and product.');
    }
    setEditError(null);
    setEditDialogOpen(true);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch('/api/motion-swap/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Motion Swap');
      }

      setProject(data.project);
      showSuccess('Motion Swap started. You will see updates here as it completes.');
    } catch (error) {
      console.error('[Motion Swap] Create failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to start Motion Swap');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = !isGenerating;
  const canEditProject = Boolean(project?.id);

  const editFirstFrameUrl = project?.preview_image_url || project?.reference_cover_url || selectedVideo?.cover_url || null;
  const editVideoUrl = project?.output_video_url || selectedVideo?.video_cdn_url || null;
  const effectiveSegmentStatus = useMemo(() => {
    if (project?.status === 'generating_preview') return 'generating_first_frame';
    if (project?.status === 'preview_ready') return 'first_frame_ready';
    return project?.status || 'pending';
  }, [project?.status]);
  const editSegment = useMemo(() => ({
    index: 0,
    status: effectiveSegmentStatus,
    firstFrameUrl: editFirstFrameUrl,
    videoUrl: editVideoUrl,
    prompt: {}
  }), [editFirstFrameUrl, editVideoUrl, effectiveSegmentStatus]);
  const isSubmittingEdit = editAction !== null;
  const hasSwapTarget = Boolean(editAvatarId || editProductId);
  const isPreviewReady = project?.status === 'preview_ready';
  const canGenerateImage = Boolean(
    project?.id &&
    selectedVideoId &&
    editPhotoPrompt.trim().length > 0 &&
    hasSwapTarget &&
    !isSubmittingEdit &&
    (project?.status === 'pending' || isPreviewReady)
  );
  const canGenerateVideo = Boolean(
    project?.id &&
    selectedVideoId &&
    editPhotoPrompt.trim().length > 0 &&
    editVideoPrompt.trim().length > 0 &&
    hasSwapTarget &&
    !isSubmittingEdit &&
    (project?.status === 'pending' || isPreviewReady)
  );

  const creatorDisplayName = useMemo(() => {
    if (!project?.creator_source_id) return null;
    const source = creatorSources.find(item => item.id === project.creator_source_id);
    const platform = source?.creator_source_platforms?.[0];
    return platform?.display_name || source?.source_name || null;
  }, [creatorSources, project?.creator_source_id]);

  const productDisplayName = useMemo(() => {
    if (!project?.product_id) return null;
    const product = products.find(item => item.id === project.product_id);
    return product?.product_name || null;
  }, [products, project?.product_id]);

  const projectVideo = useMemo(() => {
    if (!project?.creator_source_id || !project?.creator_source_video_id) return null;
    const source = creatorSources.find(item => item.id === project.creator_source_id);
    return source?.creator_source_videos?.find(video => video.id === project.creator_source_video_id) || null;
  }, [creatorSources, project?.creator_source_id, project?.creator_source_video_id]);

  const displayDurationSeconds = project?.reference_duration_seconds
    ?? projectVideo?.duration_seconds
    ?? selectedVideo?.duration_seconds
    ?? null;

  const displayCreditsCost = typeof project?.credits_cost === 'number' && project.credits_cost > 0
    ? project.credits_cost
    : (displayDurationSeconds ? displayDurationSeconds * CREDIT_RATE_PER_SECOND : null);

  const displayedGenerations = useMemo<Generation[]>(() => {
    if (!project) return [];
    const status: Generation['status'] = project.status === 'failed'
      ? 'failed'
      : project.status === 'completed'
        ? 'completed'
        : project.status === 'pending'
          ? 'pending'
          : 'processing';
    const stage = project.status === 'pending'
      ? 'Initializing'
      : project.status === 'generating_preview'
        ? 'Generating Preview'
        : project.status === 'generating_video'
          ? 'Generating Video'
          : undefined;

    return [{
      id: project.id,
      timestamp: project.created_at ? new Date(project.created_at) : new Date(),
      status,
      progress: project.progress_percentage || 0,
      stage,
      videoUrl: project.output_video_url || undefined,
      coverUrl: project.reference_cover_url || undefined,
      brand: creatorDisplayName || undefined,
      product: productDisplayName || undefined,
      videoAspectRatio: selectedSize,
      videoDuration: displayDurationSeconds ? String(displayDurationSeconds) : null,
      creditsCost: typeof displayCreditsCost === 'number' ? displayCreditsCost : undefined
    }];
  }, [
    project,
    creatorDisplayName,
    productDisplayName,
    selectedSize,
    displayDurationSeconds,
    displayCreditsCost
  ]);

  const emptyStateSteps = useMemo(() => ([
    {
      number: 1,
      description: 'Connect a TikTok creator in',
      link: { text: 'Assets', href: '/dashboard/assets' }
    },
    {
      number: 2,
      description: 'Open Edit to choose creator + reference video'
    },
    {
      number: 3,
      description: 'Select avatar and product in Edit'
    },
    {
      number: 4,
      description: 'Start generation and confirm'
    }
  ]), []);

  const handleStartEditPreview = async (action: 'image' | 'video') => {
    if (!project?.id) return;
    if (!editPhotoPrompt.trim()) {
      setEditError('Enter a first frame prompt to continue.');
      return;
    }
    if (!editVideoPrompt.trim()) {
      setEditError('Enter a video prompt to continue.');
      return;
    }
    if (!selectedVideoId) {
      setEditError('Select a reference video to continue.');
      return;
    }
    if (!hasSwapTarget) {
      setEditError('Use @character or @product in the first frame prompt to select a swap target.');
      return;
    }

    setEditAction(action);
    setEditError(null);

    try {
      const response = await fetch(`/api/motion-swap/${project.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_video_id: selectedVideoId,
          avatar_id: editAvatarId,
          product_id: editProductId,
          photo_prompt: editPhotoPrompt,
          video_prompt: editVideoPrompt,
          action: action
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Motion Swap');
      }

      setProject(data.project);
      const successMessage = action === 'image'
        ? 'Generating preview image...'
        : 'Generating preview and video...';
      showSuccess(successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start Motion Swap';
      setEditError(message);
    } finally {
      setEditAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar
          credits={userCredits}
          creditsData={creditsData}
          userEmail={user?.primaryEmailAddress?.emailAddress}
          userImageUrl={user?.imageUrl}
        />
        <div className="md:ml-72 ml-0 bg-white min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
          <div className="flex-1 flex flex-col min-h-0">
            <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-32 min-h-0">
              <div className="max-w-[1280px] mx-auto flex-1 w-full flex min-h-0">
                <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                  <div className="flex-1 overflow-hidden min-h-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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
    <div className="min-h-screen bg-white">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      <div className="md:ml-72 ml-0 bg-white min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
        <div className="flex-1 flex flex-col min-h-0">
          <section className="flex-1 flex px-8 md:px-12 lg:px-16 pb-32 min-h-0">
            <div className="max-w-[1280px] mx-auto flex-1 w-full flex min-h-0">
              <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.05)] flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-hidden min-h-0">
                  <GenerationProgressDisplay
                    generations={displayedGenerations}
                    emptyStateSteps={emptyStateSteps}
                    emptyStateRightContent={
                      <blockquote
                        className="tiktok-embed"
                        cite={TUTORIAL_TIKTOK_URL}
                        data-video-id={TUTORIAL_TIKTOK_ID}
                        style={{ maxWidth: '605px', minWidth: '280px' }}
                      >
                        <section>
                          <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">
                            @laolilantian
                          </a>{' '}
                          Watch how we quickly clone viral videos and swap products using our optimized tool. Adjust every frame and prompt in the editor for perfect results.{' '}
                          <a title="videoai" target="_blank" href="https://www.tiktok.com/tag/videoai?refer=embed">
                            #VideoAI
                          </a>{' '}
                          <a title="contentcreation" target="_blank" href="https://www.tiktok.com/tag/contentcreation?refer=embed">
                            #ContentCreation
                          </a>{' '}
                          <a title="productmarketing" target="_blank" href="https://www.tiktok.com/tag/productmarketing?refer=embed">
                            #ProductMarketing
                          </a>{' '}
                          <a title="techdemo" target="_blank" href="https://www.tiktok.com/tag/techdemo?refer=embed">
                            #TechDemo
                          </a>{' '}
                          <a target="_blank" title="♬ original sound  - Lantian laoli" href="https://www.tiktok.com/mus/original-sound-Lantian-laoli-7588830007134063381?refer=embed">
                            ♬ original sound  - Lantian laoli
                          </a>
                        </section>
                      </blockquote>
                    }
                    primaryActionLabel={canEditProject ? 'Edit' : undefined}
                    onPrimaryAction={canEditProject ? () => openEditModal() : undefined}
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
              creatorSources={creatorSources}
              selectedSourceId={selectedSourceId}
              onSelectSourceId={setSelectedSourceId}
              selectedVideoId={selectedVideoId}
              onSelectVideoId={setSelectedVideoId}
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
            <Dialog.Content className="fixed left-[50%] top-[50%] z-50 h-[62vh] w-[calc(100%-2rem)] max-w-7xl translate-x-[-50%] translate-y-[-50%] bg-white shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] px-6 py-3">
                <div className="flex items-center gap-4">
                  <Dialog.Title className="text-lg font-semibold text-black">Edit Motion Swap</Dialog.Title>
                  <div className="flex items-center gap-4">
                  {/* Step 1: Edit First Frame */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">1</span>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Edit first frame</span>
                    </div>
                  </div>

                  <ArrowRight className="w-3 h-3 text-gray-300" />

                  {/* Step 2: Generate Video */}
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">2</span>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <VideoIcon className="w-3.5 h-3.5" />
                      <span>Generate video</span>
                    </div>
                  </div>
                </div>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] text-gray-500 transition-colors hover:border-black hover:text-black"
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
                      onGenerateImage={() => handleStartEditPreview('image')}
                      onGenerateVideo={() => handleStartEditPreview('video')}
                      canGenerateImage={canGenerateImage}
                      canGenerateVideo={canGenerateVideo}
                      isGeneratingImage={editAction === 'image'}
                      isGeneratingVideo={editAction === 'video'}
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
