'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import UserPhotoGallery from '@/components/UserPhotoGallery';
import { LanguageCode } from '@/components/ui/LanguageSelector';
import ProductSelector, { TemporaryProduct } from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import GenerationProgressDisplay, { type Generation } from '@/components/ui/GenerationProgressDisplay';
import { Video, Package, Sparkles, Settings as SettingsIcon, Clock, ChevronDown, ChevronUp, Globe, Coins } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { getActualModel, getGenerationCost } from '@/lib/constants';
import { CharacterAdsDuration, CHARACTER_ADS_DURATION_OPTIONS } from '@/lib/character-ads-dialogue';
import { CharacterAdInspector, StructuredVideoPrompt } from '@/components/character-ads/CharacterAdInspector';
import {
  clampDialogueToWordLimit,
  countDialogueWords,
  getCharacterAdsDialogueWordLimit
} from '@/lib/character-ads-dialogue';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}


const DEFAULT_VIDEO_MODEL = 'veo3_fast' as const;
const DEFAULT_IMAGE_MODEL = 'nano_banana_pro' as const;
const BLURRY_IMAGE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/competitor_videos/user-photos/character_ad_bad.png';
const IMAGE_SIZE_BY_ASPECT: Record<'16:9' | '9:16', 'landscape_16_9' | 'portrait_16_9'> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9'
};
const SESSION_STORAGE_KEY = 'flowtra_character_ads_generations';
const ASPECT_OPTIONS = [
  { value: '16:9', label: 'Landscape', subtitle: '16:9' },
  { value: '9:16', label: 'Portrait', subtitle: '9:16' }
] as const;
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'zh', label: 'Chinese', native: '中文' },
  { value: 'cs', label: 'Czech', native: 'Čeština' },
  { value: 'da', label: 'Danish', native: 'Dansk' },
  { value: 'nl', label: 'Dutch', native: 'Nederlands' },
  { value: 'fi', label: 'Finnish', native: 'Suomi' },
  { value: 'fr', label: 'French', native: 'Français' },
  { value: 'de', label: 'German', native: 'Deutsch' },
  { value: 'el', label: 'Greek', native: 'Ελληνικά' },
  { value: 'it', label: 'Italian', native: 'Italiano' },
  { value: 'no', label: 'Norwegian', native: 'Norsk' },
  { value: 'pl', label: 'Polish', native: 'Polski' },
  { value: 'pt', label: 'Portuguese', native: 'Português' },
  { value: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { value: 'ro', label: 'Romanian', native: 'Română' },
  { value: 'ru', label: 'Russian', native: 'Русский' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'sv', label: 'Swedish', native: 'Svenska' },
  { value: 'tr', label: 'Turkish', native: 'Türkçe' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
] as const;

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

type CharacterGeneration = Generation & { projectId?: string; coverUrl?: string | null };
const sortGenerations = (items: CharacterGeneration[]) =>
  [...items].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
const CHARACTER_EMPTY_STEPS = [
  {
    icon: '👤',
    title: 'Step 1',
    description: 'Upload a clear portrait of your character',
  },
  {
    icon: '🛍️',
    title: 'Step 2',
    description: 'Optionally pick a product or skip for talking head',
  },
  {
    icon: '✨',
    title: 'Step 3',
    description: 'Type or generate dialogue and click Generate',
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
  awaiting_review: 'pending', // New status for review state - visually pending but active
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
    image_model?: string | null;
    video_model?: string | null;
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
  analyzing_images: 'Analyzing uploaded images…',
  generating_prompts: 'Creating dialogue prompts…',
  generating_image: 'Generating character preview…',
  awaiting_review: 'Awaiting your review...', // New hint
  reviewing: 'Reviewing prompts...', // New hint for current_step
  generating_videos: 'Producing video scenes…',
  merging_videos: 'Merging scenes…'
};


const isActiveGeneration = (generation: CharacterGeneration) =>
  generation.status === 'pending' || generation.status === 'processing';

const getStageLabel = (status: Generation['status'], step?: string | null) => {
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (step) {
    const normalized = step.toLowerCase();
    if (CHARACTER_STAGE_HINTS[normalized]) {
      return CHARACTER_STAGE_HINTS[normalized];
    }
  }
  if (status === 'processing') return 'Processing…';
  if (status === 'pending') return 'Queued';
  return 'Unknown';
};

export default function CharacterAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();

  // Form state
  const [selectedPersonPhotoUrl, setSelectedPersonPhotoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<CharacterAdsDuration>(8);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('9:16');
  const [customDialogue, setCustomDialogue] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | TemporaryProduct | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [showProductManager, setShowProductManager] = useState(false);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [hasAIGeneratedDialogue, setHasAIGeneratedDialogue] = useState(false);
  const [isTextareaExpanded, setIsTextareaExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showExpandCollapseIcon, setShowExpandCollapseIcon] = useState(false);

  // Inspector state
  const [inspectorProjectId, setInspectorProjectId] = useState<string | null>(null);
  const isInspectorOpen = useMemo(() => !!inspectorProjectId, [inspectorProjectId]);

  const handleCloseInspector = useCallback(() => {
    setInspectorProjectId(null);
  }, []);

  const maxDurationOption = CHARACTER_ADS_DURATION_OPTIONS[CHARACTER_ADS_DURATION_OPTIONS.length - 1];
const maxWordLimit = getCharacterAdsDialogueWordLimit(maxDurationOption);
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

  const [generations, setGenerations] = useState<CharacterGeneration[]>([]);
  const [downloadingProjects, setDownloadingProjects] = useState<Record<string, boolean>>({});
  const isMountedRef = useRef(true);
  const notifiedProjectsRef = useRef<Record<string, Generation['status']>>({});

  const dialogueWordLimit = useMemo(
    () => getCharacterAdsDialogueWordLimit(videoDuration),
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
  const canStartGeneration = !!selectedPersonPhotoUrl;

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

  useEffect(() => {
    const checkOverflow = () => {
      if (textareaRef.current) {
        setShowExpandCollapseIcon(textareaRef.current.scrollHeight > textareaRef.current.clientHeight);
      }
    };
    checkOverflow(); // Initial check
    window.addEventListener('resize', checkOverflow); // Check on window resize
    return () => window.removeEventListener('resize', checkOverflow);
  }, [customDialogue]); // Re-run when customDialogue changes

  // Show toast notification when generation starts
  const isTemporaryProduct = (product: UserProduct | TemporaryProduct | null): product is TemporaryProduct => {
    return product !== null && 'isTemporary' in product && product.isTemporary === true;
  };

  const handleStartGeneration = async () => {
    if (!canStartGeneration || !user?.id) return;

    try {
      // Upload temporary product images to Supabase first if needed
      let productId = selectedProduct?.id;

      if (selectedProduct && isTemporaryProduct(selectedProduct)) {
        // Upload temporary images first (must wait for this)
        const uploadFormData = new FormData();
        selectedProduct.uploadedFiles.forEach((file, index) => {
          uploadFormData.append(`file_${index}`, file);
        });

        const uploadResponse = await fetch('/api/upload-temp-images', {
          method: 'POST',
          body: uploadFormData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload product images');
        }

        // For character ads, we'll pass the first image URL directly
        // Instead of using product_id, we'll use a temporary product URL
        productId = `temp:${uploadResult.imageUrls[0]}`;
      }

      // Create optimistic generation immediately with a client-side project ID
      const clientProjectId = generateClientProjectId();
      const optimisticGeneration: CharacterGeneration = {
        id: clientProjectId,
        projectId: clientProjectId,
        timestamp: new Date(),
        status: 'pending',
        progress: 5,
        stage: 'Queued',
        platform: 'Character Ads',
        brand: selectedBrandName || undefined,
        product: selectedProductName || undefined,
        videoModel: DEFAULT_VIDEO_MODEL,
        videoDuration: `${videoDuration}`,
        coverUrl: undefined,
        videoUrl: undefined,
        downloaded: false
      };

      // Add to generations list immediately
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
      formData.append('image_model', DEFAULT_IMAGE_MODEL);
      formData.append('image_size', IMAGE_SIZE_BY_ASPECT[videoAspectRatio]);
      formData.append('video_model', DEFAULT_VIDEO_MODEL);
      formData.append('video_aspect_ratio', videoAspectRatio);
      formData.append('language', selectedLanguage);
      if (customDialogue && customDialogue.trim()) {
        formData.append('custom_dialogue', customDialogue.trim());
      }
      formData.append('user_id', user.id);
      formData.append('project_id', clientProjectId);

      // Fire API call asynchronously (no await!)
      fetch('/api/character-ads/create', {
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
          if (project.id === clientProjectId) return;
          // Fallback: ensure optimistic entry matches actual ID if server ignored clientProjectId
          setGenerations((prev) =>
            prev.map((gen) =>
              gen.id === clientProjectId
                ? { ...gen, id: project.id, projectId: project.id }
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

  const selectedBrandName = selectedProduct?.brand?.brand_name;
  const selectedProductName = selectedProduct?.product_name;
  const hasPersonPhoto = Boolean(selectedPersonPhotoUrl);
  const showMaintenance = !kieCreditsStatus.loading && !kieCreditsStatus.sufficient;
  const composerVisible = !showMaintenance && !showProductManager;
  const composerDisabled = !canStartGeneration;

  const canUseDialogueAI = !!selectedProduct && productPhotoUrls.length > 0;

  // Optimization State
  const [optimizationStage, setOptimizationStage] = useState<'upload' | 'optimize'>('upload');
  const [tempSelectedPhotoUrl, setTempSelectedPhotoUrl] = useState<string>('');
  const [tempSelectedPhotoId, setTempSelectedPhotoId] = useState<string | undefined>(undefined);
  const [optimizationPrompt, setOptimizationPrompt] = useState<string>('Generate a clear portrait photo of this person, chest up only, head and shoulders, no hands visible, high quality, photorealistic, 8k resolution, natural lighting.');
  const [optimizedPhotoUrl, setOptimizedPhotoUrl] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const resetOptimizationState = useCallback(() => {
    setOptimizationStage('upload');
    setTempSelectedPhotoUrl('');
    setTempSelectedPhotoId(undefined);
    setOptimizedPhotoUrl(null);
    setIsOptimizing(false);
    setIsSaving(false);
    setOptimizationPrompt('Generate a clear portrait photo of this person, chest up only, head and shoulders, no hands visible, high quality, photorealistic, 8k resolution, natural lighting.');
  }, []);

  const handlePersonPickerSelect = (photoUrl: string, photoId?: string, isNewUpload?: boolean) => {
    setTempSelectedPhotoUrl(photoUrl);
    setTempSelectedPhotoId(photoId);

    if (isNewUpload) { // Only proceed to optimize stage for new uploads
      setOptimizationStage('optimize');
    } else { // For existing photos, directly select and close
      setSelectedPersonPhotoUrl(photoUrl);
      setIsPersonPickerOpen(false);
      resetOptimizationState(); // Reset optimization state for next time
    }
  };

  const handleUseOriginal = () => {
    setSelectedPersonPhotoUrl(tempSelectedPhotoUrl);
    setIsPersonPickerOpen(false);
    resetOptimizationState();
  };

  const handleUseOptimized = async () => {
    if (!optimizedPhotoUrl) return;
    
    setIsSaving(true);

    try {
      // Call API to save photo from URL (backend handles download/upload to avoid CORS)
      const uploadRes = await fetch('/api/user-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: optimizedPhotoUrl })
      });

      if (!uploadRes.ok) throw new Error('Failed to save optimized photo');
      
      const data = await uploadRes.json();
      
      // Use the new Supabase URL
      setSelectedPersonPhotoUrl(data.imageUrl);
      
      // Delete original if needed
      if (tempSelectedPhotoId && !tempSelectedPhotoId.startsWith('default-')) {
        try {
          await fetch(`/api/user-photos?photoId=${tempSelectedPhotoId}`, { method: 'DELETE' });
        } catch (err) {
          console.error('Failed to delete discarded photo:', err);
        }
      }

      setIsPersonPickerOpen(false);
      resetOptimizationState();
      showSuccess('Optimized photo saved and selected!');

    } catch (error) {
      console.error('Error saving optimized photo:', error);
      showError('Failed to save optimized photo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptimize = async () => {
    if (!tempSelectedPhotoUrl) return;
    setIsOptimizing(true);
    setOptimizedPhotoUrl(null);

    try {
      const response = await fetch('/api/character-ads/optimize-portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: tempSelectedPhotoUrl, prompt: optimizationPrompt })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start optimization');

      const taskId = data.taskId;
      
      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/character-ads/optimize-portrait?taskId=${taskId}`);
          const statusData = await statusRes.json();
          
          if (statusData.status === 'success' && statusData.imageUrl) {
            clearInterval(pollInterval);
            setOptimizedPhotoUrl(statusData.imageUrl);
            setIsOptimizing(false);
            showSuccess('Portrait optimized successfully!');
          } else if (statusData.status === 'failed' || statusData.status === 'fail') {
            clearInterval(pollInterval);
            setIsOptimizing(false);
            showError('Optimization failed. Please try again.');
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 3000);

      // Timeout after 60s
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isOptimizing) {
           // Just stop the spinner, user can try again
           setIsOptimizing(false);
        }
      }, 60000);

    } catch (error) {
      console.error('Optimization error:', error);
      showError('Failed to start optimization');
      setIsOptimizing(false);
    }
  };

  const handleProductPickerSelect = (product: UserProduct | null) => {
    setSelectedProduct(product);
    setIsProductPickerOpen(false);
  };

  const configPanelRef = useRef<HTMLDivElement | null>(null);
  const durationMenuRef = useRef<HTMLDivElement | null>(null);
  const aspectMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCustomDialogue(prev => {
      const limited = clampDialogueToWordLimit(prev, dialogueWordLimit);
      return limited === prev ? prev : limited;
    });
  }, [dialogueWordLimit]);

  useEffect(() => {
    const checkOverflow = () => {
      if (textareaRef.current) {
        // We consider it overflowing if scrollHeight is greater than clientHeight + some tolerance (e.g., 1px for rounding)
        // Also ensure it's not expanded, or if expanded, that it actually needs to scroll
        const isOverflowing = textareaRef.current.scrollHeight > (textareaRef.current.clientHeight + 1);
        setShowExpandCollapseIcon(isOverflowing);
      }
    };

    checkOverflow(); // Initial check

    // Re-check when customDialogue changes or window resizes
    const resizeObserver = new ResizeObserver(checkOverflow);
    const currentTextarea = textareaRef.current;
    if (currentTextarea) {
      resizeObserver.observe(currentTextarea);
    }
    window.addEventListener('resize', checkOverflow);

    return () => {
      if (currentTextarea) {
        resizeObserver.unobserve(currentTextarea);
      }
      window.removeEventListener('resize', checkOverflow);
    };
  }, [customDialogue, isTextareaExpanded]); // isTextareaExpanded also affects clientHeight, so re-check then.

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (showConfigPanel && configPanelRef.current && !configPanelRef.current.contains(event.target as Node)) {
        setShowConfigPanel(false);
      }
      if (showDurationMenu && durationMenuRef.current && !durationMenuRef.current.contains(event.target as Node)) {
        setShowDurationMenu(false);
      }
      if (showAspectMenu && aspectMenuRef.current && !aspectMenuRef.current.contains(event.target as Node)) {
        setShowAspectMenu(false);
      }
      if (showLanguageMenu && languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setShowLanguageMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showConfigPanel, showDurationMenu, showAspectMenu, showLanguageMenu]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      const restored = (parsed as CharacterGeneration[])
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
    if (!payload?.project) return;
    const project = payload.project;
    setGenerations((prev) => {
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
        notifyProjectStatus(projectId, computedStatus);
        const progressValue = computedStatus === 'completed'
          ? 100
          : typeof project.progress_percentage === 'number'
            ? project.progress_percentage
            : gen.progress;
        const stageLabel = payload.stepMessages?.[project.current_step ?? '']
          || getStageLabel(computedStatus, project.current_step);
        return {
          ...gen,
          status: computedStatus,
          progress: progressValue ?? gen.progress,
          stage: stageLabel,
          videoUrl: project.merged_video_url || project.generated_video_urls?.[0] || gen.videoUrl,
          coverUrl: project.generated_image_url || gen.coverUrl,
          videoModel: (project.video_model as Generation['videoModel']) || gen.videoModel,
          downloaded: project.downloaded ?? gen.downloaded
        };
      });
      if (!found) {
        return prev;
      }
      return sortGenerations(next);
    });
  }, [notifyProjectStatus]);

  const fetchStatusForProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    
    const fetchWithBackoff = async (retries = 3, delay = 1000) => {
      try {
        const response = await fetch(`/api/character-ads/${projectId}/status`, { cache: 'no-store' });
        
        if (response.status === 404 && retries > 0) {
          // 404 might be a race condition (creation vs read), retry quickly
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithBackoff(retries - 1, delay * 1.5);
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch project status: ${response.status}`);
        }

        const payload: CharacterAdsStatusPayload = await response.json();
        if (!isMountedRef.current) return;
        updateGenerationFromStatus(projectId, payload);
      } catch (error) {
        if (retries > 0) {
           // Retry on network errors too
           await new Promise(resolve => setTimeout(resolve, delay));
           return fetchWithBackoff(retries - 1, delay * 1.5);
        }
        console.error('Failed to fetch character ads status:', error);
      }
    };

    await fetchWithBackoff();
  }, [updateGenerationFromStatus]);

  const activeProjectIds = useMemo(() => {
    const ids = generations
      .filter((gen) =>
        (gen.status === 'pending' || gen.status === 'processing' || gen.status === 'awaiting_review') &&
        gen.projectId
      )
      .map((gen) => gen.projectId as string);
    return Array.from(new Set(ids));
  }, [generations]);

  useEffect(() => {
    if (!activeProjectIds.length) return;

    const poll = () => {
      activeProjectIds.forEach((id) => fetchStatusForProject(id));
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [activeProjectIds, fetchStatusForProject]);

  const handleDownloadGeneration = useCallback(async (generation: CharacterGeneration) => {
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
      const response = await fetch('/api/character-ads/download', {
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

      showSuccess('Video download started');
    } catch (error) {
      console.error('Character ads download failed:', error);
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
      const response = await fetch(`/api/character-ads/${projectId}/confirm`, {
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

      showSuccess('Video generation successfully resumed!');
      setInspectorProjectId(null); // Close inspector
      fetchStatusForProject(projectId); // Refresh status
      refetchCredits(); // Credits might have changed
    } catch (error) {
      console.error('Error confirming generation:', error);
      showError(error instanceof Error ? error.message : 'Failed to confirm generation.');
      throw error; // Re-throw to allow component to handle submitting state
    }
  }, [showSuccess, showError, fetchStatusForProject, refetchCredits]);

  const handleRegenerateImage = useCallback(async (projectId: string, imagePrompt: string) => {
    try {
      const response = await fetch(`/api/character-ads/${projectId}/regenerate-image`, {
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

      showSuccess('Image regeneration started!');
      fetchStatusForProject(projectId); // Refresh status to show new state
      refetchCredits(); // In case image regeneration costs credits
    } catch (error) {
      console.error('Error regenerating image:', error);
      showError(error instanceof Error ? error.message : 'Failed to regenerate image.');
    }
  }, [showSuccess, showError, fetchStatusForProject, refetchCredits]);

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
    const productDescription = selectedProduct.description || '';

    try {
      const response = await fetch('/api/character-ads/dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productName,
          productDescription,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate dialogue.';
      setDialogueError(message);
      setHasAIGeneratedDialogue(false);
    } finally {
      setIsGeneratingDialogue(false);
    }
  };

  const getDurationForWordCount = (words: number): CharacterAdsDuration => {
    if (words <= 0) {
      return CHARACTER_ADS_DURATION_OPTIONS[0];
    }
    for (const option of CHARACTER_ADS_DURATION_OPTIONS) {
      if (words <= getCharacterAdsDialogueWordLimit(option)) {
        return option;
      }
    }
    return CHARACTER_ADS_DURATION_OPTIONS[CHARACTER_ADS_DURATION_OPTIONS.length - 1];
  };

  const handleCustomDialogueChange = (value: string) => {
    const limitedValue = clampDialogueToWordLimit(value, maxWordLimit);
    setCustomDialogue(limitedValue);
    setDialogueError(null);

    const words = countDialogueWords(limitedValue);
    const newDuration = getDurationForWordCount(words);
    if (newDuration !== videoDuration) {
      setVideoDuration(newDuration);
    }

    if (hasAIGeneratedDialogue) {
      setHasAIGeneratedDialogue(false);
    }
  };

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen flex flex-col pt-14 md:pt-0 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <header className="px-6 sm:px-8 lg:px-10 py-6 sticky top-0 z-30 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <div className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                <Video className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Character Ads</h1>

              </div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            {showMaintenance ? (
              <motion.div
                key="maintenance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex items-center justify-center px-6 sm:px-8 lg:px-10"
              >
                <MaintenanceMessage />
              </motion.div>
            ) : showProductManager ? (
              <motion.div
                key="product-manager"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-10 py-8"
              >
                <div className="max-w-7xl mx-auto space-y-6">
                  <button
                    onClick={() => setShowProductManager(false)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    ← Back to Character Ads
                  </button>
                  <ProductManager />
                </div>
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
                <div className="max-w-7xl mx-auto flex-1 w-full flex min-h-0">
                  <div className="bg-white border border-gray-200 rounded-3xl shadow-lg flex-1 flex flex-col overflow-hidden min-h-0">
                    <div className="flex-1 overflow-hidden min-h-0">
                      <GenerationProgressDisplay
                        generations={displayedGenerations}
                        onDownload={handleDownloadGeneration}
                        emptyStateSteps={CHARACTER_EMPTY_STEPS}
                        emptyStateRightContent={
                          <>
                            <blockquote
                              className="tiktok-embed"
                              cite="https://www.tiktok.com/@laolilantian/video/7580211134284745991"
                              data-video-id="7580211134284745991"
                              style={{ maxWidth: '605px', minWidth: '325px' }}
                            >
                              <section>
                                <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">@laolilantian</a>{' '}
                                Flowtra AI supports the generation of videos introducing products held by a single person.{' '}
                                <a title="ugccontentcreator" target="_blank" href="https://www.tiktok.com/tag/ugccontentcreator?refer=embed">#ugccontentcreator</a>{' '}
                                <a title="ugccreator" target="_blank" href="https://www.tiktok.com/tag/ugccreator?refer=embed">#ugccreator</a>{' '}
                                <a title="aiads" target="_blank" href="https://www.tiktok.com/tag/aiads?refer=embed">#aiads</a>{' '}
                                <a title="ugc" target="_blank" href="https://www.tiktok.com/tag/ugc?refer=embed">#ugc</a>{' '}
                                <a title="ai" target="_blank" href="https://www.tiktok.com/tag/ai?refer=embed">#AI</a>{' '}
                                <a target="_blank" title="♬ original sound - Lantian laoli" href="https://www.tiktok.com/music/original-sound-7580211250157292296?refer=embed">♬ original sound - Lantian laoli</a>
                              </section>
                            </blockquote>
                            <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
                          </>
                        }
                        noticeVariant="character-ads"
                        onReview={(generation) => setInspectorProjectId((generation as CharacterGeneration).projectId!)}
                      />
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>

      {composerVisible && (
        <div className="fixed bottom-0 left-0 right-0 md:left-72 z-40 px-6 sm:px-8 lg:px-10 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className="relative bg-white/95 backdrop-blur border border-gray-200 rounded-[60px] shadow-2xl px-4 sm:px-6 py-4">
              <div className="flex items-end gap-3 flex-wrap">
                <button
                  onClick={() => setIsPersonPickerOpen(true)}
                  className={`flex-shrink-0 w-12 h-12 rounded-full border transition flex items-center justify-center text-sm font-medium ${hasPersonPhoto ? 'border-gray-300 bg-white' : 'border-dashed border-gray-400 bg-gray-50'}`}
                  title={hasPersonPhoto ? 'Change character photo' : 'Select character'}
                >
                  {hasPersonPhoto ? (
                    <Image src={selectedPersonPhotoUrl} alt="Character" width={48} height={48} className="object-cover w-full h-full rounded-full" />
                  ) : (
                    <Video className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                <button
                  onClick={() => setIsProductPickerOpen(true)}
                  className={`flex-shrink-0 w-12 h-12 rounded-full border transition flex items-center justify-center ${selectedProduct ? 'border-gray-300 bg-white' : 'border-dashed border-gray-400 bg-gray-50'}`}
                  title={selectedProduct ? 'Change product' : 'Optional: select brand & product'}
                >
                  {primaryProductPhoto ? (
                    <Image src={primaryProductPhoto} alt="Product" width={48} height={48} className="object-cover w-full h-full rounded-full" />
                  ) : (
                    <Package className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                              <div className="flex-1 min-w-[240px]">
                                <div className="relative bg-white border border-gray-200 rounded-3xl px-5 py-3 shadow-sm transition-all flex flex-col justify-end" style={{minHeight: '52px'}}>
                                  <textarea
                                    ref={textareaRef}
                                    value={customDialogue}
                                    onChange={(e) => handleCustomDialogueChange(e.target.value)}
                                    onInput={(e) => {
                                      e.currentTarget.style.height = 'auto';
                                      e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                    }}
                                    placeholder="Type your custom script here (AI will generate if left blank)"
                                    rows={1} // Start with 1, auto-grow
                                    className={`w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:border-none text-sm text-gray-900 placeholder:text-gray-400 pr-10 !outline-none !ring-0 shadow-none resize-none transition-all duration-300 ${isTextareaExpanded ? 'max-h-[300px]' : 'max-h-[72px]'} overflow-y-auto`}
                                    style={{ minHeight: '24px' }}
                                  />
                                  <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                    {showExpandCollapseIcon && (
                                      <button
                                        type="button"
                                        onClick={() => setIsTextareaExpanded(!isTextareaExpanded)}
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                                        title={isTextareaExpanded ? 'Collapse' : 'Expand'}
                                      >
                                        {isTextareaExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {dialogueError && <div className="text-[11px] text-red-500 mt-1">{dialogueError}</div>}
                              </div>
                <button
                  onClick={() => setShowConfigPanel((prev) => !prev)}
                  className={`w-12 h-12 rounded-full border flex items-center justify-center transition ${showConfigPanel ? 'border-gray-800 text-gray-900' : 'border-gray-300 text-gray-500'}`}
                  title="Video settings"
                >
                  <SettingsIcon />
                </button>

                <motion.button
                  onClick={handleStartGeneration}
                  disabled={composerDisabled}
                  className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={{ scale: !composerDisabled ? 1.02 : 1 }}
                  whileTap={{ scale: !composerDisabled ? 0.98 : 1 }}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Ad
                  {(() => {
                    const actualModel = getActualModel(DEFAULT_VIDEO_MODEL, userCredits || 0);
                    if (!actualModel) return null;
                    // Version 2.0: ALL models charge at generation
                    const scenesCount = Math.ceil(videoDuration / 8);
                    const cost = getGenerationCost(actualModel) * scenesCount;
                    return (
                      <span className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-white/20 rounded-full text-xs font-bold backdrop-blur-sm">
                        <Coins className="w-3.5 h-3.5" />
                        {cost}
                      </span>
                    );
                  })()}
                </motion.button>
              </div>
              {showConfigPanel && (
                <div
                  ref={configPanelRef}
                  className="absolute bottom-full right-6 mb-3 bg-white/95 border border-gray-200 rounded-[32px] shadow-2xl p-5 w-[360px] space-y-5"
                >
                  <div className="space-y-2 relative" ref={durationMenuRef}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Clock className="w-3.5 h-3.5" />
                      Duration
                    </label>
                    <button
                      onClick={() => {
                        setShowDurationMenu((prev) => !prev);
                        setShowAspectMenu(false);
                        setShowLanguageMenu(false);
                      }}
                      className="w-full flex items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:border-gray-400"
                    >
                      <span>{formatDurationLabel(videoDuration)}</span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showDurationMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showDurationMenu && (
                      <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-gray-200 bg-white shadow-xl divide-y divide-gray-100 max-h-64 overflow-y-auto z-10">
                        {CHARACTER_ADS_DURATION_OPTIONS.map((seconds) => (
                          <button
                            key={seconds}
                            onClick={() => {
                              setVideoDuration(seconds);
                              setShowDurationMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${videoDuration === seconds ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span>{formatDurationLabel(seconds)}</span>
                            {videoDuration === seconds && <span className="text-xs text-gray-500">Selected</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 relative" ref={aspectMenuRef}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Video className="w-3.5 h-3.5" />
                      Video Size
                    </label>
                    <button
                      onClick={() => {
                        setShowAspectMenu((prev) => !prev);
                        setShowDurationMenu(false);
                        setShowLanguageMenu(false);
                      }}
                      className="w-full flex items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:border-gray-400"
                    >
                      <span>
                        {ASPECT_OPTIONS.find((opt) => opt.value === videoAspectRatio)?.label}
                        <span className="text-xs text-gray-500 ml-1">{videoAspectRatio}</span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showAspectMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showAspectMenu && (
                      <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-gray-200 bg-white shadow-xl divide-y divide-gray-100 z-10">
                        {ASPECT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setVideoAspectRatio(option.value);
                              setShowAspectMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between ${videoAspectRatio === option.value ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span>{option.label}</span>
                            <span className="text-xs text-gray-500">{option.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 relative" ref={languageMenuRef}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <Globe className="w-3.5 h-3.5" />
                      Language
                    </label>
                    <button
                      onClick={() => {
                        setShowLanguageMenu((prev) => !prev);
                        setShowDurationMenu(false);
                        setShowAspectMenu(false);
                      }}
                      className="w-full flex items-center justify-between rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:border-gray-400"
                    >
                      <span>
                        {LANGUAGE_OPTIONS.find((opt) => opt.value === selectedLanguage)?.label}
                        <span className="text-xs text-gray-500 ml-1">
                          {LANGUAGE_OPTIONS.find((opt) => opt.value === selectedLanguage)?.native}
                        </span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showLanguageMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showLanguageMenu && (
                      <div className="absolute left-0 right-0 bottom-full mb-2 rounded-2xl border border-gray-200 bg-white shadow-xl divide-y divide-gray-100 max-h-64 overflow-y-auto z-10">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              setSelectedLanguage(option.value);
                              setShowLanguageMenu(false);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between ${selectedLanguage === option.value ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            <span>{option.label}</span>
                            <span className="text-xs text-gray-500">{option.native}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isPersonPickerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {optimizationStage === 'upload' ? 'Select Character Photo' : 'AI Optimize Portrait'}
                </h3>
                <p className="text-xs text-gray-500">
                  {optimizationStage === 'upload'
                    ? 'Pick an existing shot or upload a new one.'
                    : 'Improve your portrait quality with AI.'}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPersonPickerOpen(false);
                  resetOptimizationState();
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {optimizationStage === 'upload' ? (
                <>
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Portrait Photo Examples:</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-green-500 shadow-md mb-2">
                          <Image
                            src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/character_ad_example.png"
                            alt="Good Example"
                            width={112}
                            height={112}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <span className="text-xs font-medium text-green-700">Good Example</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-red-500 shadow-md mb-2">
                          <Image
                            src={BLURRY_IMAGE_URL}
                            alt="Bad Example (Blurry)"
                            width={112}
                            height={112}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <span className="text-xs font-medium text-red-700">Bad Example (Blurry)</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4">For best results, use a clear, well-lit, front-facing portrait of a single person. Avoid blurry or low-resolution images.</p>
                  </div>
                  <UserPhotoGallery
                    onPhotoSelect={handlePersonPickerSelect}
                    selectedPhotoUrl={selectedPersonPhotoUrl}
                  />
                </>
              ) : (
                <div className="h-full flex flex-col min-h-0">
                  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
                    {/* Left Side: Images (Original + Optimized) */}
                    <div className="lg:col-span-8 grid grid-cols-2 gap-4 h-full min-h-0">
                      {/* Original */}
                      <div className="flex flex-col gap-2 h-full min-h-0">
                        <label className="text-sm font-medium text-gray-700">Original Photo</label>
                        <div className="relative flex-1 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                          {tempSelectedPhotoUrl && (
                            <Image src={tempSelectedPhotoUrl} alt="Original" fill className="object-cover" />
                          )}
                        </div>
                      </div>

                      {/* Optimized */}
                      <div className="flex flex-col gap-2 h-full min-h-0">
                        <label className="text-sm font-medium text-gray-700">AI Result</label>
                        <div className="relative flex-1 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
                          {isOptimizing ? (
                            <div className="flex flex-col items-center gap-2 text-gray-500">
                              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                              <span className="text-sm">Optimizing...</span>
                            </div>
                          ) : optimizedPhotoUrl ? (
                            <Image src={optimizedPhotoUrl} alt="Optimized" fill className="object-cover" />
                          ) : (
                            <div className="text-center p-4 text-gray-400">
                              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-xs">AI optimized version will appear here.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Controls */}
                    <div className="lg:col-span-4 flex flex-col h-full overflow-y-auto">
                      <div className="flex-1">
                         <label className="text-sm font-medium text-gray-700 mb-2 block">Optimization Prompt</label>
                         <textarea
                            value={optimizationPrompt}
                            onChange={(e) => setOptimizationPrompt(e.target.value)}
                            className="w-full rounded-lg border-gray-300 text-sm focus:ring-gray-900 focus:border-gray-900 min-h-[120px]"
                            placeholder="Describe how you want to improve the photo..."
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            Refine the prompt to adjust lighting, background, or style.
                          </p>
                      </div>

                      <div className="mt-6 space-y-3">
                        <button
                          onClick={handleOptimize}
                          disabled={isOptimizing}
                          className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                        >
                          <Sparkles className="w-4 h-4" />
                          {isOptimizing ? 'Optimizing...' : 'Generate AI Portrait'}
                        </button>

                        <div className="grid grid-cols-1 gap-2">
                      {optimizedPhotoUrl && (
                        <button
                          onClick={handleUseOptimized}
                          disabled={isSaving}
                          className="w-full py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving ? 'Saving...' : 'Use Optimized Photo'}
                        </button>
                      )}
                           <button
                             onClick={handleUseOriginal}
                             className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
                           >
                             Use Original
                           </button>
                        </div>

                        <button
                          onClick={() => setOptimizationStage('upload')}
                          className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 transition"
                        >
                          Back to Upload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isProductPickerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Brand & Product</h3>
                <p className="text-xs text-gray-500">
                  Pick a product to unlock AI-scripted dialogue, or close this panel to create a simple talking head video.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsProductPickerOpen(false);
                    setShowProductManager(true);
                  }}
                  className="px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  Manage Products
                </button>
                <button
                  onClick={() => setIsProductPickerOpen(false)}
                  className="px-3 py-1 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <ProductSelector
                selectedProduct={selectedProduct as UserProduct | null}
                onProductSelect={handleProductPickerSelect}
              />
            </div>
          </div>
        </div>
      )}

      {/* Character Ad Inspector */}
      {inspectorProjectId && (
        <CharacterAdInspector
          projectId={inspectorProjectId}
          open={isInspectorOpen}
          onClose={handleCloseInspector}
          onConfirmGeneration={handleConfirmGeneration}
          onRefetchProjectStatus={fetchStatusForProject}
          onRegenerateImage={handleRegenerateImage}
        />
      )}
    </div>
  );
}
