'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import { LanguageCode } from '@/components/ui/LanguageSelector';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import GenerationProgressDisplay, { type Generation } from '@/components/ui/GenerationProgressDisplay';
import { User, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import BottomComposerBar from '@/components/ui/BottomComposerBar';
import ConfigPopover from '@/components/ui/ConfigPopover';
import BottomBarDropdown from '@/components/ui/BottomBarDropdown';
import { type VideoDurationOption } from '@/components/ui/VideoDurationSelector';
import { UserProduct, UserAvatar } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { getGenerationCost, type VideoDuration } from '@/lib/constants';
import { AvatarAdsDuration, AVATAR_ADS_DURATION_OPTIONS } from '@/lib/avatar-ads-dialogue';
import { AvatarAdInspector, StructuredVideoPrompt } from '@/components/avatar-ads/AvatarAdInspector';
import {
  clampDialogueToWordLimit,
  countDialogueWords,
  getAvatarAdsDialogueWordLimit
} from '@/lib/avatar-ads-dialogue';
import { type Format } from '@/components/ui/FormatSelector';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}


const DEFAULT_VIDEO_MODEL = 'veo3_fast' as const;
const SESSION_STORAGE_KEY = 'flowtra_avatar_ads_generations';
const AVATAR_ADS_TUTORIAL_EMBED_URL = 'https://www.youtube.com/embed/B_UjnFsbitk?rel=0';

// Format AVATAR_ADS_DURATION_OPTIONS for ConfigPopover
const AVATAR_ADS_DURATION_OPTIONS_FORMATTED: VideoDurationOption[] = AVATAR_ADS_DURATION_OPTIONS.map((seconds) => ({
  value: seconds.toString() as VideoDuration,
  label: `${seconds}s`
  // No hardcoded 'recommended' - let recommendedDuration prop control it dynamically
}));

const generateClientProjectId = () => {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Ignore and fall back
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

type AvatarGeneration = Generation & {
  projectId?: string;
  coverUrl?: string | null;
  isOptimistic?: boolean;
};
const sortGenerations = (items: AvatarGeneration[]) =>
  [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
const CHARACTER_EMPTY_STEPS = [
  {
    number: 1,
    description: 'Upload custom character portrait (optional)',
  },
  {
    number: 2,
    description: 'Select product (optional)',
  },
  {
    number: 3,
    description: 'Enter character dialogue (optional)',
  },
  {
    number: 4,
    description: 'Click Generate',
  },
  {
    number: 5,
    description: 'Adjust frames and prompts',
  },
  {
    number: 6,
    description: 'Generate final video',
  },
];

const STATUS_MAP: Record<string, Generation['status']> = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
  processing: 'processing',
  analyzing_images: 'processing',
  generating_prompts: 'processing',
  generating_image: 'processing',
  awaiting_review: 'awaiting_review', // Preserve status to trigger review UI
  generating_videos: 'processing',
  merging_videos: 'processing'
};

interface CharacterAdsStatusPayload {
  success?: boolean;
  project: {
    id: string;
    status: string;
    current_step?: string | null;
    progress_percentage?: number | null;
    video_duration_seconds?: number | null;
    video_model?: string | null;
    video_aspect_ratio?: string | null;
    credits_cost?: number | null;
    person_image_urls?: string[] | null;
    product_image_urls?: string[] | null;
    generated_image_url?: string | null;
    generated_video_urls?: string[] | null;
    merged_video_url?: string | null;
    downloaded?: boolean | null;
    generated_prompts?: { scenes: Array<{ prompt: StructuredVideoPrompt }>; language?: string }; // Include generated_prompts
    image_prompt?: string;
  };
  stepMessages?: Record<string, string>;
  isCompleted?: boolean;
  isFailed?: boolean;
}
const CHARACTER_STAGE_HINTS: Record<string, string> = {
  analyzing_images: 'Understanding your character – finding the perfect persona…',
  generating_prompts: 'Writing the script that sells – crafting compelling dialogue…',
  generating_image: 'Perfecting the first impression – your character\'s best shot…',
  awaiting_review: 'Your character is ready! Review and approve to generate videos',
  reviewing: 'Fine-tuning the narrative – making sure every word matters…',
  generating_videos: 'Bringing personality to life – making your character irresistible…',
  merging_videos: 'Assembling the full character story – the final touch…'
};


const isActiveGeneration = (generation: AvatarGeneration) =>
  generation.status === 'pending' || generation.status === 'processing';

const getStageLabel = (status: Generation['status'], step?: string | null) => {
  if (status === 'completed') return '✅ Your character video is ready to shine!';
  if (status === 'failed') return '⚠️ Let\'s try generating this again…';
  if (step) {
    const normalized = step.toLowerCase();
    if (CHARACTER_STAGE_HINTS[normalized]) {
      return CHARACTER_STAGE_HINTS[normalized];
    }
  }
  if (status === 'processing') return '⚙️ Working magic behind the scenes…';
  if (status === 'pending') return '⏳ Queued – your turn is coming!';
  return 'Unknown';
};

export default function AvatarAdsPage() {
  const supabase = useSupabaseBrowserClient();
  const { user, isLoaded } = useUser();
  const { credits: userCredits, creditsData, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();

  // Form state
  const [selectedPersonPhotoUrl, setSelectedPersonPhotoUrl] = useState<string>('');
  const [avatarOptions, setAvatarOptions] = useState<Array<UserAvatar & { isSystem?: boolean }>>([]);
  const [productOptions, setProductOptions] = useState<UserProduct[]>([]);
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('8');
  const [format, setFormat] = useState<Format>('9:16');
  const [customDialogue, setCustomDialogue] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [hasAIGeneratedDialogue, setHasAIGeneratedDialogue] = useState(false);
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const userHasManuallyCollapsed = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showExpandCollapseIcon, setShowExpandCollapseIcon] = useState(false);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const [avatarsRes, productsRes] = await Promise.all([
          fetch('/api/user-avatars', { cache: 'no-store' }),
          fetch('/api/user-products', { cache: 'no-store' })
        ]);

        if (avatarsRes.ok) {
          const data = await avatarsRes.json();
          const loaded = Array.isArray(data.avatars) ? data.avatars : [];
          setAvatarOptions(loaded);
        }

        if (productsRes.ok) {
          const data = await productsRes.json();
          const loaded = Array.isArray(data.products) ? data.products : [];
          setProductOptions(loaded);
        }
      } catch (error) {
        console.error('[AvatarAds] Failed to load assets:', error);
      } finally {
        setIsLoadingAssets(false);
      }
    };

    loadAssets();
  }, []);

  // Inspector state
  const [inspectorProjectId, setInspectorProjectId] = useState<string | null>(null);
  const isInspectorOpen = useMemo(() => !!inspectorProjectId, [inspectorProjectId]);

  const handleCloseInspector = useCallback(() => {
    setInspectorProjectId(null);
  }, []);

  const maxDurationOption = AVATAR_ADS_DURATION_OPTIONS[AVATAR_ADS_DURATION_OPTIONS.length - 1];
const maxWordLimit = getAvatarAdsDialogueWordLimit(maxDurationOption);
const formatDurationLabel = (seconds: number) => {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
};

  const [generations, setGenerations] = useState<AvatarGeneration[]>([]);
  const [downloadingProjects, setDownloadingProjects] = useState<Record<string, boolean>>({});
  const isMountedRef = useRef(true);
  const notifiedProjectsRef = useRef<Record<string, Generation['status']>>({});
  const trackedAvatarSelectionRef = useRef<string>('');
  const trackedProductSelectionRef = useRef<string>('');

  useEffect(() => {
    if (!user?.id) return;
    trackEvent(ANALYTICS_EVENTS.asset_library_viewed, {
      feature: 'avatar_ads',
      surface: 'avatar_ads_page',
    });
  }, [user?.id]);

  useEffect(() => {
    if (!selectedPersonPhotoUrl || trackedAvatarSelectionRef.current === selectedPersonPhotoUrl) {
      return;
    }
    trackedAvatarSelectionRef.current = selectedPersonPhotoUrl;
    trackEvent(ANALYTICS_EVENTS.avatar_selected, {
      feature: 'avatar_ads',
      surface: 'avatar_ads_page',
    });
  }, [selectedPersonPhotoUrl]);

  useEffect(() => {
    const productId = selectedProduct?.id;
    if (!productId || trackedProductSelectionRef.current === productId) {
      return;
    }
    trackedProductSelectionRef.current = productId;
    trackEvent(ANALYTICS_EVENTS.product_selected, {
      feature: 'avatar_ads',
      surface: 'avatar_ads_page',
      product_id: productId,
    });
  }, [selectedProduct?.id]);

  const dialogueWordLimit = useMemo(
    () => getAvatarAdsDialogueWordLimit(Number(videoDuration)),
    [videoDuration]
  );
  const productPhotoUrls = useMemo(() => {
    if (!selectedProduct?.user_product_photos?.length) return [] as string[];
    return selectedProduct.user_product_photos
      .map((photo) => photo.photo_url)
      .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);
  }, [selectedProduct]);
  const primaryProductPhoto = useMemo(() => productPhotoUrls[0] || '', [productPhotoUrls]);
  const selectedAvatar = useMemo(
    () => avatarOptions.find(avatar => avatar.photo_url === selectedPersonPhotoUrl) || null,
    [avatarOptions, selectedPersonPhotoUrl]
  );
  const avatarMentionOptions = useMemo(
    () =>
      avatarOptions.map((avatar) => ({
        id: avatar.id,
        label: avatar.avatar_name || 'Character',
        imageUrl: avatar.photo_url || null,
      })),
    [avatarOptions]
  );
  const productMentionOptions = useMemo(
    () =>
      productOptions.map((product) => ({
        id: product.id,
        label: product.product_name || 'Product',
        imageUrl:
          product.user_product_photos?.find((photo) => photo.is_primary)?.photo_url ||
          product.user_product_photos?.[0]?.photo_url ||
          null,
      })),
    [productOptions]
  );

  const getProductCover = useCallback((product: UserProduct | null) => {
    if (!product?.user_product_photos?.length) return '';
    const primary = product.user_product_photos.find(photo => photo.is_primary && photo.photo_url);
    const fallback = product.user_product_photos.find(photo => photo.photo_url);
    return primary?.photo_url || fallback?.photo_url || '';
  }, []);

  const notifyProjectStatus = useCallback((projectId: string, status: Generation['status']) => {
    if (status !== 'completed' && status !== 'failed') {
      return;
    }
    const previous = notifiedProjectsRef.current[projectId];
    if (previous === status) {
      return;
    }
    notifiedProjectsRef.current[projectId] = status;
    if (status === 'completed') {
      showSuccess('Character ad finished! Download it from History.');
    } else {
      showError('Character ad failed. Please try again.');
    }
  }, [showError, showSuccess]);

  // KIE credits state
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });

  const isTalkingHeadMode = !selectedProduct;

  // Calculate required credits for the current duration selection
  const requiredCredits = useMemo(() => {
    const actualModel = DEFAULT_VIDEO_MODEL;
    if (!actualModel) return 0;

    const scenesCount = Math.ceil(Number(videoDuration) / 8);
    return getGenerationCost(actualModel) * scenesCount;
  }, [videoDuration, userCredits]);

  // Check if user has sufficient credits
  const hasInsufficientCredits = useMemo(() => {
    return (userCredits || 0) < requiredCredits;
  }, [userCredits, requiredCredits]);

  const canStartGeneration = !!selectedPersonPhotoUrl && !hasInsufficientCredits;

  // Check KIE credits on page load
  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch('/api/check-kie-credits');
        const result = await response.json();

        setKieCreditsStatus({
          sufficient: result.success && result.sufficient,
          loading: false,
          currentCredits: result.currentCredits,
          threshold: result.threshold
        });
      } catch (error) {
        console.error('Failed to check KIE credits:', error);
        setKieCreditsStatus({
          sufficient: false,
          loading: false
        });
      }
    };

    checkKieCredits();
  }, []);

  const adjustDialogueTextareaHeight = useCallback(() => {
    const target = textareaRef.current;
    if (!target) return;
    target.style.height = 'auto';
    const maxHeight = isTextareaExpanded ? 180 : 24;
    target.style.height = `${Math.min(target.scrollHeight, maxHeight)}px`;
  }, [isTextareaExpanded]);

  const hasMultiLineDialogue = useCallback(() => {
    const target = textareaRef.current;
    if (!target) return false;
    const lineHeight = Number.parseFloat(window.getComputedStyle(target).lineHeight) || 20;
    return target.scrollHeight > lineHeight * 1.45;
  }, []);

  // Show toast notification when generation starts
  const handleStartGeneration = async () => {
    if (!canStartGeneration || !user?.id) return;

    try {
      const productId = selectedProduct?.id;

      // Create optimistic generation immediately with a client-side project ID
      const clientProjectId = generateClientProjectId();
      const optimisticGeneration: AvatarGeneration = {
        id: clientProjectId,
        projectId: clientProjectId,
        isOptimistic: true,
        timestamp: new Date(),
        status: 'pending',
        progress: 5,
        stage: 'Queued',
        product: selectedProductName || undefined,
        videoModel: DEFAULT_VIDEO_MODEL,
        videoDuration: `${videoDuration}`,
        videoAspectRatio: format,
        coverUrl: undefined,
        videoUrl: undefined,
        downloaded: false,
        creditsCost: requiredCredits
      };

      // Add to generations list immediately
      trackEvent(ANALYTICS_EVENTS.avatar_ads_generation_requested, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        workflow: isTalkingHeadMode ? 'talking_head' : 'product_avatar_ads',
        video_model: DEFAULT_VIDEO_MODEL,
        duration_seconds: Number(videoDuration),
        aspect_ratio: format,
        credits_cost: requiredCredits
      });
      setGenerations((prev) => {
        const filtered = prev.filter((gen) => gen.id !== clientProjectId);
        return sortGenerations([optimisticGeneration, ...filtered]);
      });

      // Prepare form data
      const formData = new FormData();
      if (selectedPersonPhotoUrl) {
        formData.append('selected_person_photo_url', selectedPersonPhotoUrl);
      }
      if (productId) {
        formData.append('selected_product_id', productId);
      }
      formData.append('talking_head_mode', isTalkingHeadMode ? 'true' : 'false');
      formData.append('video_duration_seconds', videoDuration.toString());
      formData.append('video_model', DEFAULT_VIDEO_MODEL);
      formData.append('video_aspect_ratio', format);
      formData.append('language', selectedLanguage);
      if (customDialogue && customDialogue.trim()) {
        formData.append('custom_dialogue', customDialogue.trim());
      }
      formData.append('user_id', user.id);
      formData.append('project_id', clientProjectId);

      // Fire API call asynchronously (no await!)
      fetch('/api/avatar-ads/create', {
        method: 'POST',
        body: formData,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Failed to start generation');
          }
          return response.json();
        })
        .then((project) => {
          if (!project?.id) return;
          setGenerations((prev) =>
            prev.map((gen) =>
              gen.id === clientProjectId
                ? {
                    ...gen,
                    id: project.id,
                    projectId: project.id,
                    isOptimistic: false,
                  }
                : gen
            )
          );
        })
        .catch((error) => {
          console.error('Failed to start generation:', error);
          showError(error instanceof Error ? error.message : 'Failed to start generation');
          // Remove failed generation
          setGenerations((prev) => prev.filter((gen) => gen.id !== clientProjectId));
        });

      // Show success message immediately
      showSuccess('Character ad added to the queue. Track progress below.');

    } catch (error) {
      // Only catches errors from temporary image upload
      console.error('Failed to start generation:', error);
      showError(error instanceof Error ? error.message : 'Failed to start generation');
    }
  };

  const selectedProductName = selectedProduct?.product_name;
  const hasPersonPhoto = Boolean(selectedPersonPhotoUrl);
  const showMaintenance = !kieCreditsStatus.loading && !kieCreditsStatus.sufficient;
  const composerVisible = !showMaintenance;
  const composerDisabled = !canStartGeneration;

  const canUseDialogueAI = !!selectedProduct && productPhotoUrls.length > 0;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkState = () => {
      const target = textareaRef.current;
      if (!target) return;

      const isContentLong = hasMultiLineDialogue();

      // 1. Icon Visibility: Always show if content is long enough to warrant collapsing/expanding
      setShowExpandCollapseIcon(isContentLong);

      // 2. Auto-Expand Logic:
      if (isContentLong) {
        // If content is long, not expanded, and user hasn't explicitly collapsed it -> Expand
        if (!isTextareaExpanded && !userHasManuallyCollapsed.current) {
          setIsTextareaExpanded(true);
        }
      } else {
        // If content is short, always collapse and reset manual flag
        if (isTextareaExpanded) setIsTextareaExpanded(false);
        userHasManuallyCollapsed.current = false;
      }

      adjustDialogueTextareaHeight();
    };

    checkState(); // Initial check

    // Re-check when customDialogue changes or window resizes
    const resizeObserver = new ResizeObserver(checkState);
    const currentTextarea = textareaRef.current;
    if (currentTextarea) {
      resizeObserver.observe(currentTextarea);
    }
    window.addEventListener('resize', checkState);

    return () => {
      if (currentTextarea) {
        resizeObserver.unobserve(currentTextarea);
      }
      window.removeEventListener('resize', checkState);
    };
  }, [customDialogue, isTextareaExpanded, adjustDialogueTextareaHeight, hasMultiLineDialogue]); // Re-run when dialogue or expansion changes

  useEffect(() => {
    adjustDialogueTextareaHeight();
  }, [adjustDialogueTextareaHeight, customDialogue]);

  // Click outside to collapse
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isTextareaExpanded && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsTextareaExpanded(false);
        userHasManuallyCollapsed.current = true; // Treat click-outside as a manual collapse action
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTextareaExpanded]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const restored = (parsed as AvatarGeneration[])
        .map((item) => ({
          ...item,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
        }));
      if (!restored.length) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      setGenerations(sortGenerations(restored));
    } catch (error) {
      console.error('Failed to restore character ads session state:', error);
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!generations.length) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    try {
      const serializable = generations.map((gen) => ({
        ...gen,
        timestamp: gen.timestamp instanceof Date ? gen.timestamp.toISOString() : gen.timestamp
      }));
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error('Failed to persist character ads session state:', error);
    }
  }, [generations]);

  const updateGenerationFromStatus = useCallback((projectId: string, payload: CharacterAdsStatusPayload) => {
    console.log(`📝 [Avatar Ads Realtime] updateGenerationFromStatus called for ${projectId}`, payload?.project?.status);
    if (!payload?.project) {
      console.warn(`⚠️ [Avatar Ads Realtime] No project data in payload for ${projectId}`);
      return;
    }
    const project = payload.project;
    setGenerations((prev) => {
      console.log(`📊 [Avatar Ads Realtime] Current generations count: ${prev.length}, looking for projectId: ${projectId}`);
      let found = false;
      const next = prev.map((gen) => {
        if (gen.projectId !== projectId) return gen;
        found = true;
        const rawStatus = (project.status || '').toLowerCase();
        const computedStatus: Generation['status'] =
          payload.isFailed || rawStatus === 'failed'
            ? 'failed'
            : payload.isCompleted || rawStatus === 'completed'
              ? 'completed'
              : STATUS_MAP[rawStatus] || 'processing';
        const progressValue = computedStatus === 'completed'
          ? 100
          : typeof project.progress_percentage === 'number'
            ? project.progress_percentage
            : gen.progress;
        const stageLabel = payload.stepMessages?.[project.current_step ?? '']
          || getStageLabel(computedStatus, project.current_step);
        console.log(`✏️ [Avatar Ads Realtime] Updating generation: status ${gen.status} → ${computedStatus}, progress ${gen.progress} → ${progressValue}`);
        return {
          ...gen,
          status: computedStatus,
          progress: progressValue ?? gen.progress,
          stage: stageLabel,
          currentStep: project.current_step || undefined,
          videoUrl: project.merged_video_url || project.generated_video_urls?.[0] || gen.videoUrl,
          coverUrl: project.generated_image_url || gen.coverUrl,
          videoModel: (project.video_model as Generation['videoModel']) || gen.videoModel,
          videoDuration: project.video_duration_seconds?.toString() || gen.videoDuration,
          videoAspectRatio: project.video_aspect_ratio || gen.videoAspectRatio,
          downloaded: project.downloaded ?? gen.downloaded,
          creditsCost: project.credits_cost ?? gen.creditsCost
        };
      });
      if (!found) {
        console.error(`❌ [Avatar Ads Realtime] Project ${projectId} not found in generations array! Available IDs:`, prev.map(g => g.projectId || g.id));
        return prev;
      }
      console.log(`✅ [Avatar Ads Realtime] Successfully updated generation for ${projectId}`);
      return sortGenerations(next);
    });
  }, [notifyProjectStatus]);

  useEffect(() => {
    generations.forEach((gen) => {
      const projectId = gen.projectId || gen.id;
      if (projectId) {
        notifyProjectStatus(projectId, gen.status);
      }
    });
  }, [generations, notifyProjectStatus]);

  // ✅ fetchStatusForProject REMOVED - replaced by Realtime subscriptions (line 730-787)

  const activeProjectIds = useMemo(() => {
    const ids = generations
      .filter((gen) =>
        !gen.isOptimistic &&
        (gen.status === 'pending' || gen.status === 'processing' || gen.status === 'awaiting_review') &&
        gen.projectId
      )
      .map((gen) => gen.projectId as string);
    return Array.from(new Set(ids));
  }, [generations]);

  // ✅ Realtime subscription for active projects (NO MORE POLLING!)
  useEffect(() => {
    if (!activeProjectIds.length) {
      console.log('[Avatar Ads Realtime] No active projects to monitor');
      return;
    }

    console.log('[Avatar Ads Realtime] Setting up subscriptions for', activeProjectIds.length, 'projects:', activeProjectIds);

    const channels: RealtimeChannel[] = [];
    const abortController = new AbortController();

    // Shared fetch function with retry logic (used by both initial fetch and Realtime callback)
    const fetchProjectStatus = async (projectId: string, attempt = 1, maxAttempts = 3): Promise<CharacterAdsStatusPayload | null> => {
      try {
        console.log(`🔍 [Avatar Ads Realtime] Fetching project ${projectId} status (attempt ${attempt}/${maxAttempts})...`);
        const response = await fetch(`/api/avatar-ads/${projectId}/status`, {
          cache: 'no-store',
          signal: abortController.signal
        });

        console.log(`📡 [Avatar Ads Realtime] Response for ${projectId}: HTTP ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);

        if (!response.ok) {
          // If 404 and not the last attempt, retry after delay
          if (response.status === 404 && attempt < maxAttempts) {
            console.log(`⏳ [Avatar Ads Realtime] Project ${projectId} not found (attempt ${attempt}/${maxAttempts}), retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
            return fetchProjectStatus(projectId, attempt + 1, maxAttempts);
          }
          console.warn(`⚠️ [Avatar Ads Realtime] Failed to fetch project ${projectId} after ${attempt} attempts (HTTP ${response.status})`);
          return null;
        }

        const payload = await response.json();
        console.log(`✅ [Avatar Ads Realtime] Successfully fetched ${projectId}: ${payload?.project?.status}`);
        return payload;
      } catch (error) {
        if ((error as any)?.name === 'AbortError') {
          console.log(`🛑 [Avatar Ads Realtime] Fetch aborted for ${projectId}`);
          return null;
        }
        console.error(`❌ [Avatar Ads Realtime] Fetch error for ${projectId}:`, error);
        return null;
      }
    };

    // Initial fetch + subscribe pattern for each project
    activeProjectIds.forEach((projectId) => {
      // 1) Fetch initial state (in case project was updated while page was closed)
      const initialFetch = async () => {
        console.log(`🚀 [Avatar Ads Realtime] Starting initial fetch for ${projectId}...`);
        const payload = await fetchProjectStatus(projectId);
        console.log(`📦 [Avatar Ads Realtime] Payload received for ${projectId}:`, payload ? 'valid' : 'null', 'mounted:', isMountedRef.current);
        if (payload && isMountedRef.current) {
          console.log(`🔄 [Avatar Ads Realtime] About to call updateGenerationFromStatus for ${projectId}`);
          updateGenerationFromStatus(projectId, payload);
          console.log(`✅ [Avatar Ads Realtime] Initial fetch for project ${projectId}:`, payload.project.status);
        } else {
          console.warn(`⚠️ [Avatar Ads Realtime] Skipping update - payload: ${!!payload}, mounted: ${isMountedRef.current}`);
        }
      };

      initialFetch();

      // 2) Subscribe to realtime updates
      const channel: RealtimeChannel = supabase
        .channel(`avatar-ads-project-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'avatar_ads_projects',
            filter: `id=eq.${projectId}`,
          },
          async (payload) => {
            console.log('[Avatar Ads Realtime] Project updated:', projectId, payload.new);

            // Supabase Realtime only returns partial data by default
            // Fetch the full project status from the API (with retry!)
            const fullPayload = await fetchProjectStatus(projectId);
            if (!fullPayload) {
              console.warn(`⚠️ [Avatar Ads Realtime] Failed to fetch full payload for ${projectId} after realtime update`);
              return;
            }

            if (isMountedRef.current) {
              updateGenerationFromStatus(projectId, fullPayload);
              console.log(`🔄 [Avatar Ads Realtime] Updated project ${projectId} to status: ${fullPayload.project.status} (${fullPayload.project.progress_percentage}%)`);
            } else {
              console.warn(`⚠️ [Avatar Ads Realtime] Component unmounted, skipping update for ${projectId}`);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [Avatar Ads Realtime] Subscribed to project ${projectId}`);
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`❌ [Avatar Ads Realtime] Failed to subscribe to project ${projectId}`);
          }
        });

      channels.push(channel);
    });

    // Cleanup all subscriptions when dependencies change
    return () => {
      abortController.abort();
      console.log('[Avatar Ads Realtime] Cleaning up', channels.length, 'subscriptions');
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [activeProjectIds, supabase, updateGenerationFromStatus]);

  const handleDownloadGeneration = useCallback(async (generation: AvatarGeneration) => {
    if (!user?.id) {
      showError('Please sign in to download videos');
      return;
    }

    const projectId = generation.projectId || generation.id;
    if (!projectId) {
      showError('Video is still preparing. Please try again later.');
      return;
    }

    if (downloadingProjects[projectId]) {
      return;
    }

    setDownloadingProjects((prev) => ({ ...prev, [projectId]: true }));

    try {
      const response = await fetch('/api/avatar-ads/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: projectId })
      });

      if (!response.ok) {
        let message = 'Failed to download video';
        try {
          const data = await response.json();
          message = data?.error || message;
        } catch (err) {
          console.error('Failed to parse download error response:', err);
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowtra-character-ads-${projectId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setGenerations((prev) => prev.map((gen) =>
        gen.projectId === projectId ? { ...gen, downloaded: true } : gen
      ));

      if (refetchCredits) {
        await refetchCredits();
      }

      trackEvent(ANALYTICS_EVENTS.avatar_ads_download_started, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        project_id: projectId,
      });
      showSuccess('Video download started');
    } catch (error) {
      console.error('Character ads download failed:', error);
      trackEvent(ANALYTICS_EVENTS.avatar_ads_download_failed, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        project_id: projectId,
      });
      showError(error instanceof Error ? error.message : 'Failed to download video');
    } finally {
      setDownloadingProjects((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  }, [user?.id, downloadingProjects, refetchCredits, showError, showSuccess]);

  const handleConfirmGeneration = useCallback(async (projectId: string, updatedPrompts: any) => {
    try {
      const response = await fetch(`/api/avatar-ads/${projectId}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updatedPrompts }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to confirm generation');
      }

      trackEvent(ANALYTICS_EVENTS.avatar_ads_cover_confirmed, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        project_id: projectId,
      });
      showSuccess('Video generation successfully resumed!');
      // ✅ No manual refresh needed - Realtime will auto-update
      refetchCredits(); // Credits might have changed
    } catch (error) {
      console.error('Error confirming generation:', error);
      showError(error instanceof Error ? error.message : 'Failed to confirm generation.');
      throw error; // Re-throw to allow component to handle submitting state
    }
  }, [showSuccess, showError, refetchCredits]);

  const handleRegenerateImage = useCallback(async (projectId: string, imagePrompt: string) => {
    try {
      const response = await fetch(`/api/avatar-ads/${projectId}/regenerate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imagePrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate image');
      }

      trackEvent(ANALYTICS_EVENTS.avatar_ads_cover_regenerated, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        project_id: projectId,
      });
      showSuccess('Image regeneration started!');
      // ✅ No manual refresh needed - Realtime will auto-update
      refetchCredits(); // In case image regeneration costs credits
    } catch (error) {
      console.error('Error regenerating image:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate image.');
    }
  }, [showSuccess, showError, refetchCredits]);

  const displayedGenerations = useMemo(() =>
    sortGenerations(generations).map((gen) => ({
      ...gen,
      isDownloading: gen.projectId ? !!downloadingProjects[gen.projectId] : false,
      coverUrl: gen.coverUrl ?? undefined
    })),
  [generations, downloadingProjects]);

  const handleGenerateAIDialogue = async () => {
    if (!selectedProduct) {
      setDialogueError('Select a product before generating a dialogue.');
      return;
    }

    if (productPhotoUrls.length === 0) {
      setDialogueError('Please add product photos first so AI can understand your item.');
      return;
    }

    setDialogueError(null);
    setIsGeneratingDialogue(true);

    const productName = selectedProduct.product_name || '';
    try {
      const response = await fetch('/api/avatar-ads/dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productName,
          productImageUrls: productPhotoUrls,
          language: selectedLanguage,
          videoDurationSeconds: videoDuration
        })
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to generate dialogue.');
      }

      const limitedDialogue = clampDialogueToWordLimit(result.dialogue || '', maxWordLimit);
      setCustomDialogue(limitedDialogue);
      const generatedWordCount = countDialogueWords(limitedDialogue);
      const autoDuration = getDurationForWordCount(generatedWordCount);
      if (autoDuration !== videoDuration) {
        setVideoDuration(autoDuration);
      }
      setHasAIGeneratedDialogue(true);
      trackEvent(ANALYTICS_EVENTS.avatar_ads_dialogue_generated, {
        feature: 'avatar_ads',
        surface: 'avatar_ads_page',
        duration_seconds: Number(videoDuration),
        language: selectedLanguage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate dialogue.';
      setDialogueError(message);
      setHasAIGeneratedDialogue(false);
    } finally {
      setIsGeneratingDialogue(false);
    }
  };

  const getDurationForWordCount = (words: number): VideoDuration => {
    if (words <= 0) {
      return AVATAR_ADS_DURATION_OPTIONS[0].toString() as VideoDuration;
    }
    for (const option of AVATAR_ADS_DURATION_OPTIONS) {
      if (words <= getAvatarAdsDialogueWordLimit(option)) {
        return option.toString() as VideoDuration;
      }
    }
    return AVATAR_ADS_DURATION_OPTIONS[AVATAR_ADS_DURATION_OPTIONS.length - 1].toString() as VideoDuration;
  };

  const recommendedDuration = useMemo(() => {
    const words = countDialogueWords(customDialogue);
    if (words === 0) return null; // No recommendation for empty script
    return getDurationForWordCount(words);
  }, [customDialogue]);

  const handleCustomDialogueChange = (value: string) => {
    setCustomDialogue(value);
    setDialogueError(null);

    if (hasAIGeneratedDialogue) {
      setHasAIGeneratedDialogue(false);
    }
  };

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen flex flex-col min-h-0 pt-16 md:pt-12">
        <div className="flex-1 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            {showMaintenance ? (
              <motion.div
                key="maintenance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex items-center justify-center px-8 md:px-12 lg:px-16"
              >
                <MaintenanceMessage />
              </motion.div>
            ) : (
              <motion.section
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex px-6 sm:px-8 lg:px-10 pb-48 min-h-0"
              >
                <div className="dashboard-main-shell flex-1 flex min-h-0">
                  <div className="rounded-[26px] bg-background border border-border shadow-lg flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-hidden min-h-0">
                        <GenerationProgressDisplay
                        generations={displayedGenerations}
                        onDownload={handleDownloadGeneration}
                        emptyStateSteps={CHARACTER_EMPTY_STEPS}
                        emptyStateRightContent={
                          <div className="w-full max-w-[605px] overflow-hidden rounded-[24px] border border-border bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
                            <div className="aspect-video w-full">
                              <iframe
                                className="h-full w-full"
                                src={AVATAR_ADS_TUTORIAL_EMBED_URL}
                                title="Flowtra Avatar Ads tutorial"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        }
                        onReview={(generation) => setInspectorProjectId((generation as AvatarGeneration).projectId!)}
                        projectType="avatar-ads"
                      />
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </DashboardContentTransition>

      {composerVisible && (
        <BottomComposerBar
          leftControls={
            <>
              <BottomBarDropdown
                open={personDropdownOpen}
                onOpenChange={setPersonDropdownOpen}
                triggerClassName="min-w-[200px] sm:min-w-[232px]"
                panelWidthClassName="w-[280px] sm:w-[300px]"
                disabled={isLoadingAssets || avatarOptions.length === 0}
                trigger={
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#d8d8d3] bg-[#f6f6f3]">
                      {selectedAvatar?.photo_url ? (
                        <Image
                          src={selectedAvatar.photo_url}
                          alt={selectedAvatar.avatar_name}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4 text-[#7a7a74]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight text-black">
                        {selectedAvatar?.avatar_name || 'Select character'}
                      </p>
                      <p className="mt-0.5 text-xs text-[#7a7a74]">
                        {selectedAvatar ? 'Character ready' : 'Choose the on-screen character'}
                      </p>
                    </div>
                  </div>
                }
              >
                {avatarOptions.length > 0 ? (
                  <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    {avatarOptions.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setSelectedPersonPhotoUrl(avatar.photo_url);
                          setPersonDropdownOpen(false);
                        }}
                        className={`w-full rounded-[20px] border px-3 py-2.5 text-left transition-all ${
                          selectedPersonPhotoUrl === avatar.photo_url
                            ? 'border-black bg-[#f8f8f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_0_rgba(232,232,228,0.98)]'
                            : 'border-[#e1e1dc] bg-white hover:border-black/45 hover:bg-[#fcfcfa]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-[15px] border border-[#d8d8d3] bg-[#f4f4f1]">
                            <Image
                              src={avatar.photo_url}
                              alt={avatar.avatar_name}
                              width={48}
                              height={48}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold tracking-tight text-black">{avatar.avatar_name}</p>
                            {avatar.isSystem && (
                              <p className="mt-0.5 text-xs text-[#7a7a74]">System avatar</p>
                            )}
                            {!avatar.isSystem && (
                              <p className="mt-0.5 text-xs text-[#7a7a74]">Custom character</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground px-3 py-2">No avatars yet.</div>
                )}
              </BottomBarDropdown>

              <BottomBarDropdown
                open={productDropdownOpen}
                onOpenChange={setProductDropdownOpen}
                triggerClassName="min-w-[220px] sm:min-w-[260px]"
                panelWidthClassName="w-[320px] sm:w-[360px]"
                disabled={isLoadingAssets || productOptions.length === 0}
                trigger={
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[#d8d8d3] bg-[#f6f6f3]">
                      {primaryProductPhoto ? (
                        <Image
                          src={primaryProductPhoto}
                          alt={selectedProductName || 'Product'}
                          width={44}
                          height={44}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-4 w-4 text-[#7a7a74]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold tracking-tight text-black">
                        {selectedProductName || 'Select product'}
                      </p>
                      <p className="mt-0.5 text-xs text-[#7a7a74]">
                        {selectedProduct ? 'Product linked' : 'Optional product context'}
                      </p>
                    </div>
                  </div>
                }
              >
                {productOptions.length > 0 ? (
                  <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setProductDropdownOpen(false);
                      }}
                      className={`w-full rounded-[22px] border px-3 py-3 text-left transition-all ${
                        !selectedProduct
                          ? 'border-black bg-[#f8f8f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_0_rgba(232,232,228,0.98)]'
                          : 'border-[#e1e1dc] bg-white hover:border-black/45 hover:bg-[#fcfcfa]'
                      }`}
                      >
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[16px] border border-[#d8d8d3] bg-[#f4f4f1]">
                          <ShoppingBag className="h-4 w-4 text-[#7a7a74]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold tracking-tight text-black">No product</p>
                          <p className="mt-1 text-xs text-[#7a7a74]">Talking-head mode without product context</p>
                        </div>
                      </div>
                    </button>
                    {productOptions.map((product) => {
                      const cover = getProductCover(product);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(product);
                            setProductDropdownOpen(false);
                          }}
                          className={`w-full rounded-[22px] border px-3 py-3 text-left transition-all ${
                            selectedProduct?.id === product.id
                              ? 'border-black bg-[#f8f8f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_2px_0_rgba(232,232,228,0.98)]'
                              : 'border-[#e1e1dc] bg-white hover:border-black/45 hover:bg-[#fcfcfa]'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-14 w-[72px] items-center justify-center overflow-hidden rounded-[16px] border border-[#d8d8d3] bg-[#f4f4f1]">
                              {cover ? (
                                <Image
                                  src={cover}
                                  alt={product.product_name || 'Product'}
                                  width={72}
                                  height={56}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ShoppingBag className="h-4 w-4 text-[#7a7a74]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-semibold tracking-tight text-black">{product.product_name || 'Untitled product'}</p>
                              <p className="mt-1 text-xs text-[#7a7a74]">Product context for script and visuals</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground px-3 py-2">No products yet.</div>
                )}
              </BottomBarDropdown>
            </>
          }
                              centerInput={
                                <div className="flex-1 min-w-[200px]">
                                  {/* Placeholder div to hold space in the flex row */}
                                  <div className="relative h-[48px] w-full">
                                    {/* Actual Input Container - Always absolute, anchored to bottom for smooth animation */}
                                    <div 
                                      ref={containerRef}
                                      className={`
                                        absolute bottom-0 left-0 right-0 bg-background border rounded-[16px] px-4 py-3 flex flex-col justify-center
                                        transition-[max-height,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] origin-bottom overflow-hidden will-change-[max-height]
                                        ${isTextareaExpanded 
                                          ? 'max-h-[240px] shadow-xl border-foreground/20 z-50' 
                                          : 'max-h-[48px] shadow-sm border-border z-0'
                                        }
                                        focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground/30
                                      `}
                                      onMouseDown={(event) => {
                                        if ((event.target as HTMLElement).closest('button')) return;
                                        if (!textareaRef.current) return;
                                        textareaRef.current.focus();
                                        if (hasMultiLineDialogue()) {
                                          setIsTextareaExpanded(true);
                                          userHasManuallyCollapsed.current = false;
                                        }
                                      }}
                                    >
                                      <textarea
                                        ref={textareaRef}
                                        value={customDialogue}
                                        onChange={(e) => handleCustomDialogueChange(e.target.value)}
                                        onInput={adjustDialogueTextareaHeight}
                                        placeholder="Type your custom script here (AI will generate if left blank)"
                                        rows={1}
                                        onFocus={() => {
                                          if (hasMultiLineDialogue()) {
                                            setIsTextareaExpanded(true);
                                            userHasManuallyCollapsed.current = false;
                                          }
                                        }}
                                        className={`w-full bg-transparent border-none !outline-none !ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-sm text-foreground placeholder:text-muted-foreground pr-8 resize-none leading-relaxed ${
                                          isTextareaExpanded ? 'overflow-y-auto' : 'overflow-y-hidden'
                                        }`}
                                        style={{ height: 'auto', minHeight: '24px', maxHeight: isTextareaExpanded ? '180px' : '24px' }}
                                      />
                                      <div className="absolute bottom-2.5 right-2 flex items-center bg-background/80 backdrop-blur-sm rounded-md">
                                        {showExpandCollapseIcon && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newState = !isTextareaExpanded;
                                              setIsTextareaExpanded(newState);
                                              if (!newState) {
                                                userHasManuallyCollapsed.current = true; // User explicitly collapsed
                                              } else {
                                                userHasManuallyCollapsed.current = false; // User expanded (reset flag)
                                              }
                                            }}
                                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                            title={isTextareaExpanded ? 'Collapse' : 'Expand'}
                                          >
                                            {isTextareaExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {dialogueError && <div className="text-[11px] text-red-500 mt-1 ml-2 absolute bottom-[-20px] left-0">{dialogueError}</div>}
                                </div>
                              }          configButton={
            <ConfigPopover
              videoDuration={videoDuration}
              onDurationChange={setVideoDuration}
              durationOptions={AVATAR_ADS_DURATION_OPTIONS_FORMATTED}
              recommendedDuration={recommendedDuration}
              selectedModel={DEFAULT_VIDEO_MODEL}
              onModelChange={() => {}}
              userCredits={userCredits || 0}
              hideModelSelector={true}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              format={format}
              onFormatChange={setFormat}
              variant="minimal"
            />
          }
          onGenerate={handleStartGeneration}
          canGenerate={canStartGeneration}
          isGenerating={false}
          generationCost={requiredCredits}
          userCredits={userCredits || 0}
          generateButtonText="Start"
        />
      )}

      {/* Character Ad Inspector */}
      {inspectorProjectId && (
        <AvatarAdInspector
          projectId={inspectorProjectId}
          open={isInspectorOpen}
          onClose={handleCloseInspector}
          onConfirmGeneration={handleConfirmGeneration}
          onRegenerateImage={handleRegenerateImage}
          characterMentions={avatarMentionOptions}
          productMentions={productMentionOptions}
        />
      )}
    </div>
  );
}
