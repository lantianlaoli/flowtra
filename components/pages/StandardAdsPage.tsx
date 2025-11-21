'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useStandardAdsWorkflow } from '@/hooks/useStandardAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import { Sparkles, Coins, TrendingUp, AlertCircle, Boxes } from 'lucide-react';

// New components for redesigned UX
import PlatformSelector, { type Platform } from '@/components/ui/PlatformSelector';
import BrandProductSelector from '@/components/ui/BrandProductSelector';
import CompetitorAdSelector from '@/components/ui/CompetitorAdSelector';
import RequirementsInput from '@/components/ui/RequirementsInput';
import ConfigPopover from '@/components/ui/ConfigPopover';
import GenerationProgressDisplay, { type Generation } from '@/components/ui/GenerationProgressDisplay';
import type { VideoDurationOption } from '@/components/ui/VideoDurationSelector';

import {
  PLATFORM_PRESETS,
  canAffordModel,
  modelSupports,
  getAvailableDurations,
  getAvailableQualities,
  isFreeGenerationModel,
  getGenerationCost,
  getSegmentCountFromDuration,
  type VideoModel,
  type VideoDuration,
  REPLICA_PHOTO_CREDITS
} from '@/lib/constants';
import { Format } from '@/components/ui/FormatSelector';
import { LanguageCode } from '@/components/ui/LanguageSelector';
import { UserProduct, UserBrand, CompetitorAd } from '@/lib/supabase';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

type ReplicaAspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
type ReplicaResolution = '1K' | '2K' | '4K';
type ReplicaOutputFormat = 'png' | 'jpg';

const MAX_REPLICA_ASSETS = 9;
const REPLICA_ASPECT_RATIOS: ReplicaAspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const REPLICA_RESOLUTIONS: ReplicaResolution[] = ['1K', '2K', '4K'];
const REPLICA_OUTPUT_FORMATS: ReplicaOutputFormat[] = ['png', 'jpg'];

const STEP_DESCRIPTIONS: Record<string, string> = {
  generating_cover: 'Generating cover image…',
  generating_segment_frames: 'Generating scene keyframes…',
  generating_segment_videos: 'Rendering segmented clips…',
  merging_segments: 'Stitching clips…',
  ready_for_video: 'Preparing video prompts…',
  generating_video: 'Generating video…',
  processing: 'Processing…',
  completed: 'Completed',
  failed: 'Failed'
};

const STATUS_MAP: Record<string, Generation['status']> = {
  completed: 'completed',
  failed: 'failed',
  processing: 'processing',
  generating_cover: 'processing',
  generating_segment_frames: 'processing',
  generating_segment_videos: 'processing',
  merging_segments: 'processing',
  ready_for_video: 'processing',
  generating_video: 'processing'
};

type SessionGeneration = Generation & { projectId?: string };

interface StandardAdsStatusPayload {
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
    segmentCount?: number | null;
    segmentDurationSeconds?: number | null;
    isSegmented?: boolean | null;
  };
  error?: string;
}

const STEP_PROGRESS_HINTS: Record<string, number> = {
  generating_cover: 20,
  ready_for_video: 50,
  generating_segment_frames: 25,
  generating_segment_videos: 70,
  merging_segments: 80,
  generating_video: 85,
  processing: 25,
  completed: 100,
  failed: 0
};

const getStageLabel = (status: Generation['status'], step?: string | null) => {
  const key = step?.toLowerCase() ?? '';
  if (key && STEP_DESCRIPTIONS[key]) {
    return STEP_DESCRIPTIONS[key];
  }
  if (status === 'completed') return 'Completed';
  if (status === 'failed') return 'Failed';
  if (status === 'processing') return 'Processing…';
  return 'Queued';
};

const ALL_VIDEO_QUALITIES: Array<'standard' | 'high'> = ['standard', 'high'];
const ALL_VIDEO_DURATIONS: VideoDuration[] = ['6', '8', '10', '12', '15', '16', '18', '24', '30', '32', '36', '40', '42', '48', '54', '56', '60', '64'];
const ALL_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'grok', 'sora2', 'sora2_pro'];
const SESSION_STORAGE_KEY = 'flowtra_standard_ads_generations';

const STANDARD_ADS_DURATION_OPTIONS: VideoDurationOption[] = [
  {
    value: '6',
    label: '6 seconds',
    description: 'Micro Grok hook',
    features: 'Single rapid-fire beat'
  },
  {
    value: '8',
    label: '8 seconds',
    description: 'Single-scene spotlight',
    features: 'Perfect for quick hooks'
  },
  {
    value: '10',
    label: '10 seconds',
    description: 'Extended presentation',
    features: 'Great for highlights'
  },
  {
    value: '12',
    label: '12 seconds',
    description: 'Two Grok segments',
    features: 'Double-beat comparison'
  },
  {
    value: '15',
    label: '15 seconds',
    description: 'Longer script support',
    features: 'Room for storytelling'
  },
  {
    value: '16',
    label: '16 seconds',
    description: 'Dual-scene storyline',
    features: 'Smooth two-beat arc'
  },
  {
    value: '18',
    label: '18 seconds',
    description: 'Three Grok segments',
    features: 'Layered demo flow'
  },
  {
    value: '24',
    label: '24 seconds',
    description: 'Mid-length narrative arc',
    features: 'Balanced multi-beat flow'
  },
  {
    value: '30',
    label: '30 seconds',
    description: 'Five Grok segments',
    features: 'Extended benefit breakdown'
  },
  {
    value: '32',
    label: '32 seconds',
    description: 'Full-funnel sequence',
    features: 'Complete top-to-bottom story'
  },
  {
    value: '36',
    label: '36 seconds',
    description: 'Six segment arc',
    features: 'Deep dive walkthrough'
  },
  {
    value: '40',
    label: '40 seconds',
    description: 'Extended narrative',
    features: 'Rich storytelling arc'
  },
  {
    value: '42',
    label: '42 seconds',
    description: 'Seven segment path',
    features: 'High-detail comparison'
  },
  {
    value: '48',
    label: '48 seconds',
    description: 'Comprehensive showcase',
    features: 'Full product journey'
  },
  {
    value: '54',
    label: '54 seconds',
    description: 'Nine segment campaign',
    features: 'Education-first pacing'
  },
  {
    value: '56',
    label: '56 seconds',
    description: 'Long-form content',
    features: 'Deep engagement'
  },
  {
    value: '60',
    label: '60 seconds',
    description: 'Ten segment Grok story',
    features: 'Broadcast-ready spot'
  },
  {
    value: '64',
    label: '64 seconds',
    description: 'Full commercial',
    features: 'Complete brand story'
  }
];

export default function StandardAdsPage() {
  const { user } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();
  const sidebarProps = {
    credits: userCredits,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    userImageUrl: user?.imageUrl
  };

  // NEW: Platform state
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('tiktok');

  // NEW: Additional requirements input
  const [additionalRequirements, setAdditionalRequirements] = useState('');

  // NEW: Generation history
  const [generations, setGenerations] = useState<SessionGeneration[]>([]);
  const [downloadingProjects, setDownloadingProjects] = useState<Record<string, boolean>>({});

  // Video configuration states
  const [videoQuality, setVideoQuality] = useState<'standard' | 'high'>('standard');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('8');
  const [selectedModel, setSelectedModel] = useState<VideoModel>('veo3_fast');
  const [format, setFormat] = useState<Format>('9:16');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true); // NEW: Watermark toggle

  // Image and language
  const [selectedImageModel] = useState<'nano_banana' | 'seedream'>('nano_banana');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  // Other states
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  const elementsCount = 1;
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [selectedCompetitorAd, setSelectedCompetitorAd] = useState<CompetitorAd | null>(null);
  const isCompetitorPhotoMode = selectedCompetitorAd?.file_type === 'image';
  const competitorImageUrl = isCompetitorPhotoMode ? selectedCompetitorAd?.ad_file_url ?? null : null;
  const [replicaSelectedProducts, setReplicaSelectedProducts] = useState<UserProduct[]>([]);
  const [photoAspectRatio, setPhotoAspectRatio] = useState<ReplicaAspectRatio>('9:16');
  const [photoResolution, setPhotoResolution] = useState<ReplicaResolution>('2K');
  const [photoOutputFormat, setPhotoOutputFormat] = useState<ReplicaOutputFormat>('png');
  const [isGenerating, setIsGenerating] = useState(false);
  const isMountedRef = useRef(true);
  const effectiveImageModel = isCompetitorPhotoMode ? 'nano_banana_pro' : selectedImageModel;

  // Modal states for user guidance
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // Show welcome modal for first-time visitors with no selections
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('flowtra_standard_ads_welcome_seen');
    const hasNoSelections = !selectedBrand && !selectedProduct;

    if (!hasSeenWelcome && hasNoSelections && generations.length === 0) {
      // Wait a bit before showing to let the page load
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem('flowtra_standard_ads_welcome_seen', 'true');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [selectedBrand, selectedProduct, generations.length]);

  // Auto-switch language when competitor ad with language is selected
  useEffect(() => {
    if (selectedCompetitorAd?.language && selectedCompetitorAd.language !== selectedLanguage) {
      console.log(`🌍 Auto-switching language from ${selectedLanguage} to ${selectedCompetitorAd.language}`);
      setSelectedLanguage(selectedCompetitorAd.language as LanguageCode);
    }
  }, [selectedCompetitorAd, selectedLanguage]);

  const selectedBrandId = selectedBrand?.id || null;
  const selectedCompetitorAdId = selectedCompetitorAd?.id || null;

  useEffect(() => {
    if (!selectedBrandId || !isCompetitorPhotoMode) {
      setReplicaSelectedProducts(() => []);
      return;
    }
    setReplicaSelectedProducts(() => []);
    setSelectedProduct(prev => (prev ? null : prev));
  }, [selectedBrandId, selectedCompetitorAdId, isCompetitorPhotoMode]);

  const selectedReplicaAssetUrls = useMemo(() => {
    if (!isCompetitorPhotoMode) {
      return [];
    }

    const urls: string[] = [];
    const seen = new Set<string>();

    const addUrl = (url?: string | null) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      urls.push(url);
    };

    addUrl(selectedBrand?.brand_logo_url || null);

    replicaSelectedProducts.forEach((product) => {
      const photo = product.user_product_photos?.find((p) => p.is_primary) || product.user_product_photos?.[0];
      addUrl(photo?.photo_url);
    });

    return urls.slice(0, MAX_REPLICA_ASSETS);
  }, [isCompetitorPhotoMode, replicaSelectedProducts, selectedBrand?.brand_logo_url]);

  const replicaSelectedProductIds = useMemo(
    () => replicaSelectedProducts.map(product => product.id),
    [replicaSelectedProducts]
  );

  const handleReplicaSelectionChange = useCallback((products: UserProduct[]) => {
    setReplicaSelectedProducts(products);
    setSelectedProduct(products[0] ?? null);
  }, []);

  const handleReplicaSelectionLimitReached = useCallback((limit: number) => {
    showError(`You can select up to ${limit} products.`);
  }, [showError]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed: SessionGeneration[] = JSON.parse(saved);
      setGenerations(
        parsed.map(gen => ({
          ...gen,
          timestamp: new Date(gen.timestamp),
          downloaded: gen.downloaded ?? false
        }))
      );
    } catch (error) {
      console.error('Failed to restore Standard Ads session state:', error);
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
      const serialized = generations.map(gen => ({
        ...gen,
        timestamp: gen.timestamp instanceof Date ? gen.timestamp.toISOString() : gen.timestamp
      }));
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to persist Standard Ads session state:', error);
    }
  }, [generations]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-derive brand info
  const derivedAdCopy = selectedBrand?.brand_slogan || '';
  const derivedWatermark = selectedBrand?.brand_name || '';
  const shouldGenerateVideo = !isCompetitorPhotoMode;

  // Build final prompt with additional requirements
  const buildFinalPrompt = useCallback(() => {
    const basePrompt = derivedAdCopy;
    if (!additionalRequirements.trim()) {
      return basePrompt;
    }
    return `${basePrompt}\n\nAdditional requirements: ${additionalRequirements}`;
  }, [derivedAdCopy, additionalRequirements]);

  const { startWorkflowWithSelectedProduct } = useStandardAdsWorkflow(
    user?.id,
    selectedModel,
    effectiveImageModel,
    updateCredits,
    refetchCredits,
    elementsCount,
    format,
    format as '16:9' | '9:16',
    videoQuality,
    videoDuration,
    buildFinalPrompt(),
    selectedLanguage,
    false, // Always use auto mode now
    ''
  );

  const updateGenerationFromStatus = useCallback((projectId: string, payload: StandardAdsStatusPayload) => {
    if (!payload?.success) return;

    const normalized = (payload.status || payload.workflowStatus || '').toLowerCase();
    const status = STATUS_MAP[normalized] ||
      (payload.isCompleted ? 'completed' : payload.isFailed ? 'failed' : 'processing');

    console.log(`[StandardAdsPage] Updating project ${projectId}:`, {
      normalized,
      status,
      isCompleted: payload.isCompleted,
      isFailed: payload.isFailed,
      current_step: payload.current_step,
      error_message: payload.data?.errorMessage
    });

    const stageLabel = getStageLabel(status, payload.current_step);
    const normalizedStep = payload.current_step?.toLowerCase() ?? '';
    const progress = typeof payload.progress_percentage === 'number'
      ? payload.progress_percentage
      : typeof payload.progress === 'number'
        ? payload.progress
        : normalizedStep && STEP_PROGRESS_HINTS[normalizedStep] !== undefined
          ? STEP_PROGRESS_HINTS[normalizedStep]
          : status === 'completed'
            ? 100
            : status === 'failed'
              ? 0
              : STEP_PROGRESS_HINTS.processing;

    const hasVideoReady = Boolean(payload.data?.videoUrl);
    const resolvedStatus = hasVideoReady ? 'completed' as Generation['status'] : status;
    const resolvedStage = hasVideoReady ? 'Completed' : stageLabel;
    const resolvedProgress = hasVideoReady ? 100 : progress;

    setGenerations(prev => prev.map(gen => {
      if (gen.projectId !== projectId) return gen;
      const nextSegmentCount = (() => {
        if (payload.data) {
          if (typeof payload.data.segmentCount === 'number' && payload.data.segmentCount > 0) {
            return payload.data.segmentCount;
          }
          if (payload.data.isSegmented) {
            return getSegmentCountFromDuration(payload.data.videoDuration, payload.data?.videoModel as VideoModel | undefined);
          }
        }
        return gen.segmentCount;
      })();
      return {
        ...gen,
        status: resolvedStatus,
        stage: resolvedStage,
        progress: resolvedProgress,
        videoUrl: payload.data?.videoUrl || gen.videoUrl,
        coverUrl: payload.data?.coverImageUrl || gen.coverUrl,
        videoModel: (payload.data?.videoModel as VideoModel) || (payload.data?.video_model as VideoModel) || gen.videoModel,
        downloaded: typeof payload.data?.downloaded === 'boolean' ? payload.data.downloaded : gen.downloaded,
        videoDuration: payload.data?.videoDuration || gen.videoDuration,
        segmentCount: typeof nextSegmentCount === 'number' && nextSegmentCount > 0 ? nextSegmentCount : gen.segmentCount,
        error: resolvedStatus === 'failed'
          ? (payload.data?.errorMessage || payload.error || 'Video generation failed')
          : undefined
      };
    }));
  }, []);

  const fetchStatusForProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/standard-ads/${projectId}/status`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status for ${projectId}`);
      }

      const payload: StandardAdsStatusPayload = await response.json();
      if (!isMountedRef.current) return;
      updateGenerationFromStatus(projectId, payload);
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to fetch project status:', error);
      }
    }
  }, [updateGenerationFromStatus]);

  const activeProjectIds = useMemo(() => {
    const ids = generations
      .filter(gen => {
        // Poll if pending, processing, or if status just changed to failed/completed (to ensure final status is fetched)
        const shouldPoll = (gen.status === 'pending' || gen.status === 'processing') && gen.projectId;
        return shouldPoll;
      })
      .map(gen => gen.projectId as string);
    return Array.from(new Set(ids));
  }, [generations]);

  const displayedGenerations = useMemo(() =>
    generations.map(gen => ({
      ...gen,
      isDownloading: gen.projectId ? !!downloadingProjects[gen.projectId] : false
    })),
  [generations, downloadingProjects]);

  useEffect(() => {
    if (!activeProjectIds.length) return;

    const poll = () => {
      activeProjectIds.forEach(projectId => {
        fetchStatusForProject(projectId);
      });
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [activeProjectIds, fetchStatusForProject]);

  const handleDownloadGeneration = useCallback(async (generation: SessionGeneration) => {
    if (!user?.id) {
      showError('Please sign in to download videos');
      return;
    }

    const projectId = generation.projectId;
    if (!projectId) {
      showError('Video is still being prepared. Please try again shortly.');
      return;
    }

    if (downloadingProjects[projectId]) {
      return;
    }

    setDownloadingProjects(prev => ({ ...prev, [projectId]: true }));

    try {
      const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ historyId: projectId, userId: user.id })
      });

      if (!response.ok) {
        let message = 'Failed to download video';
        try {
          const data = await response.json();
          message = data?.message || message;
        } catch (err) {
          console.error('Failed to parse download error response:', err);
        }
        throw new Error(message);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        throw new Error(data?.message || 'Failed to download video');
      }

      const downloadCostHeader = response.headers.get('x-flowtra-download-cost');
      const parsedDownloadCost = downloadCostHeader !== null ? Number(downloadCostHeader) : undefined;
      const downloadCostApplied = Number.isFinite(parsedDownloadCost) ? Number(parsedDownloadCost) : undefined;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flowtra-video-${projectId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setGenerations(prev => prev.map(gen =>
        gen.projectId === projectId
          ? { ...gen, downloaded: true }
          : gen
      ));

      if (typeof downloadCostApplied === 'number' && downloadCostApplied > 0 && typeof userCredits === 'number') {
        updateCredits(Math.max(0, userCredits - downloadCostApplied));
      }

      if (refetchCredits) {
        await refetchCredits();
      }

      showSuccess('Video download started');
    } catch (error) {
      console.error('Standard Ads download failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to download video');
    } finally {
      setDownloadingProjects(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  }, [user?.id, downloadingProjects, refetchCredits, showError, showSuccess, userCredits, updateCredits]);

  // Handle platform change - auto-set recommended config
  const handlePlatformChange = useCallback((platform: Platform) => {
    setSelectedPlatform(platform);
    const preset = PLATFORM_PRESETS[platform];
    setFormat(preset.format);
    setVideoDuration(preset.duration);
  }, []);

  // Calculate available and disabled options
  const availableDurations = useMemo(
    () => getAvailableDurations(videoQuality),
    [videoQuality]
  );

  const availableQualities = useMemo(
    () => getAvailableQualities(videoDuration),
    [videoDuration]
  );

  const disabledDurations = useMemo(
    () => ALL_VIDEO_DURATIONS.filter(d => !availableDurations.includes(d)),
    [availableDurations]
  );

  const disabledQualities = useMemo(
    () => ALL_VIDEO_QUALITIES.filter(q => !availableQualities.includes(q)),
    [availableQualities]
  );

  const disabledModels = useMemo(
    () => ALL_VIDEO_MODELS.filter(m => !modelSupports(m, videoQuality, videoDuration)),
    [videoQuality, videoDuration]
  );


  // Auto-adjust quality and duration when they become invalid
  useEffect(() => {
    if (!availableQualities.includes(videoQuality)) {
      setVideoQuality(availableQualities[0]);
    }
  }, [videoQuality, availableQualities]);

  useEffect(() => {
    if (!availableDurations.includes(videoDuration)) {
      setVideoDuration(availableDurations[0]);
    }
  }, [videoDuration, availableDurations]);

  // Auto-switch model when it becomes disabled
  useEffect(() => {
    if (disabledModels.includes(selectedModel)) {
      const firstAvailable = ALL_VIDEO_MODELS.find(m => !disabledModels.includes(m));
      if (firstAvailable) {
        setSelectedModel(firstAvailable);
      }
    }
  }, [selectedModel, disabledModels]);

  // Check KIE API credits
  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch('/api/check-kie-credits');
        if (response.ok) {
          const data = await response.json();
          setKieCreditsStatus({
            sufficient: data.sufficient,
            loading: false,
            currentCredits: data.currentCredits,
            threshold: data.threshold
          });
        } else {
          setKieCreditsStatus({ sufficient: false, loading: false });
        }
      } catch (error) {
        console.error('Failed to check KIE credits:', error);
        setKieCreditsStatus({ sufficient: false, loading: false });
      }
    };

    checkKieCredits();
  }, []);

  // Generate button handler
  const handleStartWorkflow = async () => {
    // Validation: Check if brand is selected
    if (!selectedBrand) {
      setValidationMessage('Please select a brand before generating. Go to Assets page to create one if needed.');
      setShowValidationModal(true);
      return;
    }

    // Validation: Check if product is selected
    if (!selectedProduct) {
      setValidationMessage('Please select a product before generating. Go to Assets page to create one if needed.');
      setShowValidationModal(true);
      return;
    }

    if (isCompetitorPhotoMode) {
      if (!competitorImageUrl) {
        setValidationMessage('Select a competitor photo in the Assets panel before generating.');
        setShowValidationModal(true);
        return;
      }
      if (replicaSelectedProducts.length === 0) {
        setValidationMessage('Select at least one of your products to replace the competitor assets.');
        setShowValidationModal(true);
        return;
      }
      if (selectedReplicaAssetUrls.length === 0) {
        setValidationMessage('Add brand or product photos in Assets before running competitor replicas.');
        setShowValidationModal(true);
        return;
      }
    }

    if (isGenerating) return;

    setIsGenerating(true);

    const initialSegmentCount = shouldGenerateVideo
      ? getSegmentCountFromDuration(videoDuration, selectedModel)
      : null;

    // Create new generation entry
    const newGeneration: SessionGeneration = {
      id: Date.now().toString(),
      timestamp: new Date(),
      status: 'pending',
      progress: 5,
      stage: isCompetitorPhotoMode ? 'Preparing replica photo…' : 'Initializing…',
      platform: selectedPlatform,
      brand: selectedBrand.brand_name,
      product: selectedProduct.product_name,
      videoModel: shouldGenerateVideo ? selectedModel : undefined,
      downloaded: false,
      segmentCount: initialSegmentCount ?? undefined,
      videoDuration: shouldGenerateVideo ? videoDuration : null
    };

    setGenerations(prev => [newGeneration, ...prev]);

    try {
      const watermarkConfig = watermarkEnabled ? {
        enabled: true,
        text: derivedWatermark,
        location: 'bottom-right' as const,
      } : {
        enabled: false,
        text: '',
        location: 'bottom-right' as const,
      };

      const replicaPayload = isCompetitorPhotoMode ? {
        photoOnly: true,
        replicaMode: true,
        referenceImageUrls: [competitorImageUrl!, ...selectedReplicaAssetUrls].slice(0, MAX_REPLICA_ASSETS + 1),
        photoAspectRatio,
        photoResolution,
        photoOutputFormat
      } : undefined;

      const workflowResult = await startWorkflowWithSelectedProduct(
        selectedProduct.id,
        watermarkConfig,
        elementsCount,
        format,
        shouldGenerateVideo,
        selectedBrand.id,
        selectedCompetitorAd?.id || null,
        replicaPayload
      );

      const projectId = workflowResult?.historyId || workflowResult?.projectId;

      setGenerations(prev => prev.map(gen =>
        gen.id === newGeneration.id
          ? {
              ...gen,
              status: 'processing',
              stage: isCompetitorPhotoMode ? 'Generating replica photo…' : STEP_DESCRIPTIONS.generating_cover,
              progress: isCompetitorPhotoMode ? 30 : 20,
              projectId: projectId || gen.projectId
            }
          : gen
      ));

      if (projectId) {
        fetchStatusForProject(projectId);
      }

      showSuccess(isCompetitorPhotoMode ? 'Replica photo generation started!' : 'Video generation started! Check progress above.');

    } catch (error: unknown) {
      console.error('Failed to start workflow:', error);
      const message = error instanceof Error ? error.message : 'Failed to start generation';
      showError(message);

      // Update generation status to failed
      setGenerations(prev => {
        return prev.map(gen =>
          gen.id === newGeneration.id
            ? { ...gen, status: 'failed', stage: 'Failed', error: message }
            : gen
        );
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate cost for generate button
  const generationCost = isCompetitorPhotoMode
    ? REPLICA_PHOTO_CREDITS
    : getGenerationCost(selectedModel, videoDuration.toString(), videoQuality);
  const isFreeGen = !isCompetitorPhotoMode && isFreeGenerationModel(selectedModel);
  const canAfford = isCompetitorPhotoMode
    ? (userCredits || 0) >= generationCost
    : canAffordModel(userCredits || 0, selectedModel);
  const hasReplicaAssetSelection = selectedReplicaAssetUrls.length > 0;
  const hasReplicaProductsSelected = replicaSelectedProducts.length > 0;
  const replicaSelectionValid = !isCompetitorPhotoMode || (competitorImageUrl && hasReplicaProductsSelected && hasReplicaAssetSelection);
  const canGenerate = !isGenerating && selectedProduct && selectedBrand && replicaSelectionValid;

  // Render insufficient credits or maintenance message
  if (!kieCreditsStatus.loading && !kieCreditsStatus.sufficient) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar {...sidebarProps} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">System Maintenance</h2>
              <p className="text-gray-600">
                Our system is currently under maintenance. Please try again later.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!canAfford) {
    const insufficientMessage = isCompetitorPhotoMode
      ? `Replica photo mode requires ${generationCost} credits but you only have ${userCredits || 0} credits.`
      : `You need ${generationCost} credits but only have ${userCredits || 0} credits.`;
    const insufficientAction = isCompetitorPhotoMode
      ? 'Please top up credits to continue generating competitor replica photos.'
      : `Please purchase more credits to continue using ${selectedModel}.`;
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar {...sidebarProps} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-lg shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Insufficient Credits</h2>
              <p className="text-gray-600 mb-2">
                {insufficientMessage}
              </p>
              <p className="text-gray-600">
                {insufficientAction}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      <Sidebar {...sidebarProps} />
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen flex flex-col pt-14 md:pt-0 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          {/* Page Header */}
          <header className="px-6 sm:px-8 lg:px-10 py-6 sticky top-0 z-50 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="max-w-7xl mx-auto flex w-full flex-wrap items-center gap-3">
              <div className="w-12 h-12 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm">
                <TrendingUp className="w-5 h-5 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Standard Ads</h1>
            </div>
          </header>

          {/* Main Content Area - Progress Display */}
          <section className="flex-1 flex px-6 sm:px-8 lg:px-10 pb-32 min-h-0">
            <div className="max-w-7xl mx-auto flex-1 w-full flex min-h-0">
              <div className="bg-white border border-gray-200 rounded-3xl shadow-lg flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex-1 overflow-hidden min-h-0">
                  <GenerationProgressDisplay
                    generations={displayedGenerations}
                    onDownload={handleDownloadGeneration}
                    onRetry={(gen) => {
                      // TODO: Implement retry handler
                      console.log('Retry:', gen);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    {/* Bottom Composer */}
    <div className="fixed bottom-0 left-0 right-0 md:left-72 z-40 px-4 sm:px-8 lg:px-10 pb-4">
      <div className="max-w-7xl mx-auto space-y-3">
        <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-[34px] shadow-xl px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3">
          {/* Left controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <PlatformSelector
              selectedPlatform={selectedPlatform}
              onPlatformChange={handlePlatformChange}
              disabled={isGenerating}
              label=""
              variant="compact"
            />

            <BrandProductSelector
              selectedBrand={selectedBrand}
              selectedProduct={selectedProduct}
              onBrandSelect={setSelectedBrand}
              onProductSelect={setSelectedProduct}
              className="flex items-center gap-2"
              variant="compact"
              replicaMode={isCompetitorPhotoMode}
              replicaSelectedProductIds={replicaSelectedProductIds}
              onReplicaSelectionChange={handleReplicaSelectionChange}
              replicaSelectionLimit={MAX_REPLICA_ASSETS}
              onReplicaSelectionLimitReached={handleReplicaSelectionLimitReached}
            />
          </div>

          {/* Conversational Input */}
          <RequirementsInput
            value={additionalRequirements}
            onChange={setAdditionalRequirements}
            disabled={isGenerating}
            className="flex-1 min-w-[240px]"
            textareaClassName="px-0"
            variant="ghost"
            hideCounter
          />

          {/* Replica asset selector */}
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <ConfigPopover
              videoDuration={videoDuration}
              onDurationChange={setVideoDuration}
              disabledDurations={disabledDurations}
              durationOptions={STANDARD_ADS_DURATION_OPTIONS}
              videoQuality={videoQuality}
              onQualityChange={setVideoQuality}
              disabledQualities={disabledQualities}
              selectedModel={selectedModel}
              onModelChange={(model) => model !== 'auto' && setSelectedModel(model as VideoModel)}
              userCredits={userCredits || 0}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              format={format}
              onFormatChange={setFormat}
              watermarkEnabled={watermarkEnabled}
              onWatermarkEnabledChange={setWatermarkEnabled}
              disabled={isGenerating}
              variant="minimal"
              mode={isCompetitorPhotoMode ? 'photo' : 'video'}
              photoAspectRatio={photoAspectRatio}
              onPhotoAspectRatioChange={(value) => setPhotoAspectRatio(value as ReplicaAspectRatio)}
              photoAspectRatioOptions={REPLICA_ASPECT_RATIOS}
              photoResolution={photoResolution}
              onPhotoResolutionChange={(value) => setPhotoResolution(value as ReplicaResolution)}
              photoResolutionOptions={REPLICA_RESOLUTIONS}
              photoOutputFormat={photoOutputFormat}
              onPhotoOutputFormatChange={(value) => setPhotoOutputFormat(value as ReplicaOutputFormat)}
              photoOutputFormatOptions={REPLICA_OUTPUT_FORMATS}
            />

            <div className="flex flex-col items-end gap-1">
              <button
                onClick={handleStartWorkflow}
                disabled={!canGenerate}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-full cursor-pointer
                  font-semibold text-sm whitespace-nowrap
                  transition-all duration-200
                  ${canGenerate
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate</span>
                {!isFreeGen && generationCost > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded">
                    <Coins className="w-3 h-3" />
                    {generationCost}
                  </span>
                )}
                {isFreeGen && (
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-100 rounded text-xs font-bold">
                    FREE
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Competitor Ad Selector - Shows above composer when brand is selected */}
    {selectedBrand && (
      <div className="fixed bottom-[108px] left-0 right-0 md:left-72 px-4 sm:px-8 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <CompetitorAdSelector
            brandId={selectedBrand.id}
            brandName={selectedBrand.brand_name}
            selectedCompetitorAd={selectedCompetitorAd}
            onSelect={setSelectedCompetitorAd}
          />
        </div>
      </div>
    )}

    {/* Welcome Modal - First time visitors with no assets */}
    {showWelcomeModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Boxes className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Welcome to Standard Ads!</h3>
          </div>
          <p className="text-gray-600 mb-6">
            To create amazing videos, you need to set up your brands and products first.
            Would you like to go to the Assets page now?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Maybe Later
            </button>
            <Link
              href="/dashboard/assets"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              Go to Assets
            </Link>
          </div>
        </div>
      </div>
    )}

    {/* Validation Modal - Missing brand/product selection */}
    {showValidationModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Configuration Required</h3>
          </div>
          <p className="text-gray-600 mb-6">{validationMessage}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowValidationModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
