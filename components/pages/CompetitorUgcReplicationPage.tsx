'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useCompetitorUgcReplicationWorkflow } from '@/hooks/useCompetitorUgcReplicationWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import { Sparkles, Coins, TrendingUp, AlertCircle, Boxes } from 'lucide-react';

// New components for redesigned UX
import PlatformSelector, { type Platform } from '@/components/ui/PlatformSelector';
import BrandDropdownSelector from '@/components/ui/BrandDropdownSelector';
import CompetitorAdSelector from '@/components/ui/CompetitorAdSelector';
import RequirementsInput from '@/components/ui/RequirementsInput';
import ConfigPopover from '@/components/ui/ConfigPopover';
import GenerationProgressDisplay, { type Generation, type SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import SegmentInspector, { type SegmentPromptPayload } from '@/components/competitor-ugc-replication/SegmentInspector';
import type { VideoDurationOption } from '@/components/ui/VideoDurationSelector';

import {
  PLATFORM_PRESETS,
  canAffordModel,
  getAvailableQualities,
  getModelSupportedDurations,
  getGenerationCost,
  getSegmentCountFromDuration,
  snapDurationToModel,
  MODEL_CAPABILITIES,
  type VideoModel,
  type VideoQuality,
  type VideoDuration,
  getReplicaPhotoCredits
} from '@/lib/constants';
import { Format } from '@/components/ui/FormatSelector';
import { LanguageCode } from '@/components/ui/LanguageSelector';
import type { SegmentStatusPayload, SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import type { UserBrand, CompetitorAd } from '@/lib/supabase';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

type ReplicaAspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
type ReplicaResolution = '1K' | '2K' | '4K';
type ReplicaOutputFormat = 'png' | 'jpg';

const REPLICA_ASPECT_RATIOS: ReplicaAspectRatio[] = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const REPLICA_RESOLUTIONS: ReplicaResolution[] = ['1K', '2K', '4K'];
const REPLICA_OUTPUT_FORMATS: ReplicaOutputFormat[] = ['png', 'jpg'];

const STEP_DESCRIPTIONS: Record<string, string> = {
  generating_cover: 'Generating cover image…',
  generating_segment_frames: 'Generating scene keyframes…',
  generating_segment_videos: 'Rendering segmented clips…',
  merging_segments: 'Stitching clips…',
  awaiting_merge: 'Segments ready – awaiting merge',
  ready_for_video: 'Awaiting approval to generate video…',
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
  ready_for_video: 'awaiting_review',
  generating_video: 'processing'
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
    videoAspectRatio?: '16:9' | '9:16' | string | null;
    segmentCount?: number | null;
    segmentDurationSeconds?: number | null;
    isSegmented?: boolean | null;
    segmentStatus?: SegmentStatusPayload | null;
    segmentPlan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
    segments?: SegmentCardSummary[] | null;
    awaitingMerge?: boolean;
    mergeTaskId?: string | null;
    selectedBrandId?: string | null;
    photoOnly?: boolean | null;
    videoGenerationRequested?: boolean | null;
  };
  error?: string;
}

const STEP_PROGRESS_HINTS: Record<string, number> = {
  generating_cover: 20,
  ready_for_video: 60,
  generating_segment_frames: 25,
  generating_segment_videos: 70,
  merging_segments: 80,
  awaiting_merge: 95,
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
const ALL_VIDEO_DURATIONS: VideoDuration[] = ['5', '6', '8', '10', '12', '15', '16', '18', '20', '24', '30', '32', '36', '40', '42', '48', '50', '54', '56', '60', '64', '70', '80'];
const ALL_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'grok', 'sora2', 'sora2_pro', 'kling_2_6'];
const SESSION_STORAGE_KEY = 'flowtra_competitor_ugc_replication_generations';

const COMPETITOR_UGC_REPLICATION_DURATION_OPTIONS: VideoDurationOption[] = [
  {
    value: '5',
    label: '5 seconds',
    description: 'Micro hook format',
    features: 'Kling 2.6 base block'
  },
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
  },
  {
    value: '70',
    label: '70 seconds',
    description: 'Extended narrative',
    features: 'Multi-scene storytelling'
  },
  {
    value: '80',
    label: '80 seconds',
    description: 'Full commercial length',
    features: 'Complete brand story'
  }
];

export default function CompetitorUgcReplicationPage() {
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
  const [expandedGenerationId, setExpandedGenerationId] = useState<string | null>(null);
  const [segmentInspector, setSegmentInspector] = useState<{
    projectId: string;
    segmentIndex: number;
    generationId: string;
  } | null>(null);
  const [segmentInspectorSubmitting, setSegmentInspectorSubmitting] = useState({ photo: false, video: false });
  const [mergeSubmitting, setMergeSubmitting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSegmentInspectorSubmitting({ photo: false, video: false });
  }, [segmentInspector?.generationId, segmentInspector?.segmentIndex]);
  const [downloadingProjects, setDownloadingProjects] = useState<Record<string, boolean>>({});

  // Video configuration states
  const [videoQuality, setVideoQuality] = useState<'standard' | 'high'>('standard');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('8');
  const [selectedModel, setSelectedModel] = useState<VideoModel>('veo3_fast');
  const [format, setFormat] = useState<Format>('9:16');

  // Auto-adjust quality when model changes
  useEffect(() => {
    const capability = MODEL_CAPABILITIES.find(cap => cap.model === selectedModel);
    const supportedQualities = capability?.supportedQualities || ['standard'];

    // If current quality is not supported by selected model, switch to 'standard'
    if (!supportedQualities.includes(videoQuality)) {
      setVideoQuality('standard');
    }
  }, [selectedModel, videoQuality]);

  // Image and language
  const [selectedImageModel] = useState<'nano_banana' | 'seedream'>('nano_banana');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  // Other states
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  const elementsCount = 1;
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [selectedCompetitorAd, setSelectedCompetitorAd] = useState<CompetitorAd | null>(null);
  const hasCompetitorReference = Boolean(selectedCompetitorAd);
  const isCompetitorPhotoMode = selectedCompetitorAd?.file_type === 'image';
  const competitorImageUrl = isCompetitorPhotoMode ? selectedCompetitorAd?.ad_file_url ?? null : null;
  const [photoAspectRatio, setPhotoAspectRatio] = useState<ReplicaAspectRatio>('9:16');
  const [photoResolution, setPhotoResolution] = useState<ReplicaResolution>('2K');
  const [photoOutputFormat, setPhotoOutputFormat] = useState<ReplicaOutputFormat>('png');
  const [isGenerating, setIsGenerating] = useState(false);
  const isMountedRef = useRef(true);
  const lastAutoDurationRef = useRef<{ competitorId: string | null; model: VideoModel | null; duration: VideoDuration | null }>({
    competitorId: null,
    model: null,
    duration: null
  });
  const effectiveImageModel = hasCompetitorReference ? 'nano_banana_pro' : selectedImageModel;

  // Modal states for user guidance
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  // Show welcome modal for first-time visitors with no selections
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('flowtra_competitor_ugc_replication_welcome_seen');
    const hasNoSelections = !selectedBrand && !selectedCompetitorAd;

    if (!hasSeenWelcome && hasNoSelections && generations.length === 0) {
      // Wait a bit before showing to let the page load
      const timer = setTimeout(() => {
        setShowWelcomeModal(true);
        localStorage.setItem('flowtra_competitor_ugc_replication_welcome_seen', 'true');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [selectedBrand, selectedCompetitorAd, generations.length]);

  // Auto-switch language when competitor ad with language is selected
  useEffect(() => {
    if (selectedCompetitorAd?.language && selectedCompetitorAd.language !== selectedLanguage) {
      console.log(`🌍 Auto-switching language from ${selectedLanguage} to ${selectedCompetitorAd.language}`);
      setSelectedLanguage(selectedCompetitorAd.language as LanguageCode);
    }
  }, [selectedCompetitorAd, selectedLanguage]);

  useEffect(() => {
    if (!selectedCompetitorAd || selectedCompetitorAd.file_type !== 'video') {
      lastAutoDurationRef.current = { competitorId: null, model: null, duration: null };
      return;
    }

    // Use actual video duration for direct time matching
    const targetDurationSeconds = selectedCompetitorAd.video_duration_seconds || 0;

    if (!targetDurationSeconds) return;

    const snapped = snapDurationToModel(selectedModel, targetDurationSeconds);
    if (
      snapped &&
      (lastAutoDurationRef.current.competitorId !== selectedCompetitorAd.id ||
        lastAutoDurationRef.current.model !== selectedModel ||
        lastAutoDurationRef.current.duration !== snapped)
    ) {
      console.log(
        `⏱️ Auto-selecting ${snapped}s duration based on ${targetDurationSeconds}s video to mirror ${selectedCompetitorAd.competitor_name} (${selectedModel})`
      );
      setVideoDuration(snapped);
      lastAutoDurationRef.current = { competitorId: selectedCompetitorAd.id, model: selectedModel, duration: snapped };
    }
  }, [selectedCompetitorAd, selectedModel]);


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
      console.error('Failed to restore Competitor UGC Replication session state:', error);
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
      console.error('Failed to persist Competitor UGC Replication session state:', error);
    }
  }, [generations]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto-derive brand info
  const derivedAdCopy = selectedBrand?.brand_slogan || '';
  const shouldGenerateVideo = !isCompetitorPhotoMode;

  // Build final prompt with additional requirements
  const buildFinalPrompt = useCallback(() => {
    const basePrompt = derivedAdCopy;
    if (!additionalRequirements.trim()) {
      return basePrompt;
    }
    return `${basePrompt}\n\nAdditional requirements: ${additionalRequirements}`;
  }, [derivedAdCopy, additionalRequirements]);

  const { startWorkflowWithSelectedProduct } = useCompetitorUgcReplicationWorkflow(
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

  const updateGenerationFromStatus = useCallback((projectId: string, payload: CompetitorUgcReplicationStatusPayload) => {
    if (!payload?.success) return;

    const normalized = (payload.status || payload.workflowStatus || '').toLowerCase();
    const status = STATUS_MAP[normalized] ||
      (payload.isCompleted ? 'completed' : payload.isFailed ? 'failed' : 'processing');

    console.log(`[CompetitorUgcReplicationPage] Updating project ${projectId}:`, {
      normalized,
      status,
      isCompleted: payload.isCompleted,
      isFailed: payload.isFailed,
      current_step: payload.current_step,
      error_message: payload.data?.errorMessage
    });

    const payloadData = payload.data;
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
      const hasSegmentStatus = Boolean(payloadData && Object.prototype.hasOwnProperty.call(payloadData, 'segmentStatus'));
      const hasSegmentPlan = Boolean(payloadData && Object.prototype.hasOwnProperty.call(payloadData, 'segmentPlan'));
      const hasSegmentsArray = Boolean(payloadData && Object.prototype.hasOwnProperty.call(payloadData, 'segments'));
      const nextIsSegmented = typeof payloadData?.isSegmented === 'boolean'
        ? payloadData.isSegmented
        : gen.isSegmented;
      const awaitingMerge = typeof payloadData?.awaitingMerge === 'boolean'
        ? payloadData.awaitingMerge
        : gen.awaitingMerge;
      const mergeTaskId = typeof payloadData?.mergeTaskId === 'string'
        ? payloadData.mergeTaskId
        : gen.mergeTaskId;
      const nextSegmentStatus = hasSegmentStatus ? (payloadData?.segmentStatus ?? null) : gen.segmentStatus;

      let effectiveStep = payload.current_step?.toLowerCase() ?? '';
      const placeholderStep = !effectiveStep || effectiveStep === 'generating_cover' || effectiveStep === 'ready_for_video' || effectiveStep === 'processing';

      if (nextIsSegmented) {
        if (awaitingMerge) {
          effectiveStep = 'awaiting_merge';
        } else if (mergeTaskId && effectiveStep !== 'merging_segments' && effectiveStep !== 'completed') {
          effectiveStep = 'merging_segments';
        } else if (placeholderStep) {
          const totalSegments = nextSegmentStatus?.total || nextSegmentCount || gen.segmentCount || 0;
          const framesReady = nextSegmentStatus?.framesReady || 0;
          const videosReady = nextSegmentStatus?.videosReady || 0;

          if (videosReady > 0 && totalSegments > 0) {
            effectiveStep = 'generating_segment_videos';
          } else if ((framesReady > 0 || totalSegments > 0)) {
            effectiveStep = 'generating_segment_frames';
          }
        }
      }

      const progressKey = effectiveStep || (payload.current_step?.toLowerCase() ?? '');
      const baseProgress = typeof payload.progress_percentage === 'number'
        ? payload.progress_percentage
        : typeof payload.progress === 'number'
          ? payload.progress
          : progressKey && STEP_PROGRESS_HINTS[progressKey] !== undefined
            ? STEP_PROGRESS_HINTS[progressKey]
            : status === 'completed'
              ? 100
              : status === 'failed'
                ? 0
                : STEP_PROGRESS_HINTS.processing;

      const hasVideoReady = Boolean(payloadData?.videoUrl);
      const resolvedStatus = hasVideoReady ? 'completed' as Generation['status'] : status;
      let resolvedProgress = hasVideoReady ? 100 : baseProgress;
      let stageLabel = getStageLabel(resolvedStatus, effectiveStep || payload.current_step);
      if (resolvedStatus === 'awaiting_review') {
        stageLabel = payloadData?.videoGenerationRequested
          ? 'Video queued…'
          : 'Awaiting approval…';
      }
      const resolvedStage = hasVideoReady ? 'Completed' : stageLabel;

      if (nextIsSegmented) {
        const totalSegments = nextSegmentStatus?.total || nextSegmentCount || gen.segmentCount || 0;
        const framesReady = nextSegmentStatus?.framesReady || 0;
        const videosReady = nextSegmentStatus?.videosReady || 0;

        if (awaitingMerge) {
          resolvedProgress = Math.max(resolvedProgress, STEP_PROGRESS_HINTS.awaiting_merge);
        } else if (mergeTaskId) {
          resolvedProgress = Math.max(resolvedProgress, STEP_PROGRESS_HINTS.merging_segments || 80);
        } else if (videosReady > 0 && totalSegments > 0) {
          const ratio = Math.min(videosReady / totalSegments, 1);
          const videoProgress = 70 + Math.round(ratio * 25);
          resolvedProgress = Math.max(resolvedProgress, videoProgress);
        } else if (framesReady > 0 && totalSegments > 0) {
          const ratio = Math.min(framesReady / totalSegments, 1);
          const frameProgress = 25 + Math.round(ratio * 45);
          resolvedProgress = Math.max(resolvedProgress, frameProgress);
        } else if (totalSegments > 0) {
          resolvedProgress = Math.max(resolvedProgress, STEP_PROGRESS_HINTS.generating_segment_frames);
        }
      }

      return {
        ...gen,
        status: resolvedStatus,
        stage: resolvedStage,
        progress: resolvedProgress,
        videoUrl: payload.data?.videoUrl || gen.videoUrl,
        coverUrl: payload.data?.coverImageUrl || gen.coverUrl,
        videoModel: (payload.data?.videoModel as VideoModel) || (payload.data?.video_model as VideoModel) || gen.videoModel,
        brandId: typeof payload.data?.selectedBrandId === 'string' ? payload.data.selectedBrandId : gen.brandId,
        downloaded: typeof payload.data?.downloaded === 'boolean' ? payload.data.downloaded : gen.downloaded,
        videoDuration: payload.data?.videoDuration || gen.videoDuration,
        videoAspectRatio: typeof payload.data?.videoAspectRatio === 'string'
          ? payload.data.videoAspectRatio
          : gen.videoAspectRatio,
        segmentCount: typeof nextSegmentCount === 'number' && nextSegmentCount > 0 ? nextSegmentCount : gen.segmentCount,
        isSegmented: nextIsSegmented,
        segmentStatus: nextSegmentStatus,
        segmentPlan: hasSegmentPlan ? (payloadData?.segmentPlan ?? null) : gen.segmentPlan,
        segments: hasSegmentsArray ? (payloadData?.segments ?? null) : gen.segments,
        awaitingMerge,
        mergeTaskId,
        videoGenerationRequested: typeof payloadData?.videoGenerationRequested === 'boolean'
          ? payloadData.videoGenerationRequested
          : gen.videoGenerationRequested,
        isPhotoOnly: typeof payloadData?.photoOnly === 'boolean'
          ? payloadData.photoOnly
          : gen.isPhotoOnly,
        error: payload.data?.errorMessage || (resolvedStatus === 'failed'
          ? (payload.error || 'Video generation failed')
          : undefined)
      };
    }));
  }, []);

  // Track ongoing status fetches to prevent duplicate requests
  const statusFetchesRef = useRef<Set<string>>(new Set());

  const fetchStatusForProject = useCallback(async (projectId: string) => {
    if (!projectId) return;

    // Prevent duplicate concurrent requests for the same project
    if (statusFetchesRef.current.has(projectId)) {
      console.log(`[DEBUG] Skipping duplicate status fetch for project ${projectId}`);
      return;
    }

    statusFetchesRef.current.add(projectId);

    try {
      const response = await fetch(`/api/competitor-ugc-replication/${projectId}/status`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status for ${projectId}`);
      }

      const payload: CompetitorUgcReplicationStatusPayload = await response.json();
      if (!isMountedRef.current) return;
      updateGenerationFromStatus(projectId, payload);
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Failed to fetch project status:', error);
      }
    } finally {
      statusFetchesRef.current.delete(projectId);
    }
  }, [updateGenerationFromStatus]);

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
    return segments.some(segment => {
      const normalized = (segment.status || '').toLowerCase();
      return normalized === 'pending_first_frame' ||
        normalized === 'generating_first_frame' ||
        normalized === 'generating_video';
    });
  }, []);

  const activeProjectIds = useMemo(() => {
    const ids = generations
      .filter(gen => {
        if (!gen.projectId) return false;
        if (gen.status === 'pending' || gen.status === 'processing') {
          return true;
        }
        return generationHasActiveSegments(gen);
      })
      .map(gen => gen.projectId as string);
    return Array.from(new Set(ids));
  }, [generations, generationHasActiveSegments]);

  const displayedGenerations = useMemo(() =>
    generations.map(gen => ({
      ...gen,
      isDownloading: gen.projectId ? !!downloadingProjects[gen.projectId] : false,
      mergeLoading: gen.projectId ? !!mergeSubmitting[gen.projectId] : false
    })),
  [generations, downloadingProjects, mergeSubmitting]);


  const inspectorContext = useMemo(() => {
    if (!segmentInspector) return null;
    const generation = generations.find(gen => gen.id === segmentInspector.generationId);
    if (!generation) return null;
    const segment =
      generation.segments?.find(seg => seg.index === segmentInspector.segmentIndex) || null;
    const planEntry = ((generation.segmentPlan as { segments?: SegmentPrompt[] | undefined })?.segments?.[
      segmentInspector.segmentIndex
    ] ?? null) as SegmentPrompt | null;
    return {
      generation,
      segment,
      planEntry: planEntry || undefined
    };
  }, [segmentInspector, generations]);
  const inspectorPrompt = inspectorContext?.segment?.prompt as Partial<SegmentPrompt> | undefined;

  const handleSegmentRegenerate = useCallback(async ({ type, prompt, productIds }: { type: 'photo' | 'video'; prompt: SegmentPromptPayload; productIds?: string[]; }) => {
    try {
      // Validate segmentInspector
      if (!segmentInspector) {
        console.error('[DEBUG] segmentInspector is null');
        showError('Segment inspector not initialized');
        return;
      }

      const projectId = segmentInspector.projectId;
      const segmentIndex = segmentInspector.segmentIndex;

      console.log('[DEBUG] Regenerate started', { type, projectId, segmentIndex });

      // Validate projectId
      if (!projectId || typeof projectId !== 'string' || projectId === 'undefined') {
        console.error('[DEBUG] Invalid projectId:', projectId);
        showError('Project ID missing. Please refresh the page and try again.');
        return;
      }

      // Validate prompt data
      if (!prompt || !prompt.shots || !Array.isArray(prompt.shots)) {
        console.error('[DEBUG] Invalid prompt data:', prompt);
        showError('Invalid prompt data');
        return;
      }

      // Execute composeSegmentPromptUpdate with error handling
      let mergedPrompt;
      try {
        mergedPrompt = composeSegmentPromptUpdate(prompt, inspectorPrompt);
        console.log('[DEBUG] Merged prompt created successfully');
      } catch (error) {
        console.error('[DEBUG] composeSegmentPromptUpdate failed:', error);
        showError('Failed to prepare prompt data');
        return;
      }

      // Validate serializable
      try {
        JSON.stringify(mergedPrompt);
        console.log('[DEBUG] mergedPrompt is serializable');
      } catch (error) {
        console.error('[DEBUG] mergedPrompt not serializable:', error);
        showError('Invalid prompt data (not serializable)');
        return;
      }

      setSegmentInspectorSubmitting(prev => ({ ...prev, [type]: true }));

      const requestBody: Record<string, unknown> = {
        prompt: mergedPrompt,
        regenerate: type
      };

      if (type === 'photo' && productIds?.length) {
        requestBody.productIds = productIds.slice(0, 10);
      }

      const url = `/api/competitor-ugc-replication/${projectId}/segments/${segmentIndex}`;
      console.log('[DEBUG] Sending request:', {
        url,
        method: 'PATCH',
        bodyKeys: Object.keys(requestBody)
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('[DEBUG] Response received:', response.status);

      if (!response.ok) {
        let message = 'Failed to update segment';
        try {
          const data = await response.json();
          message = data?.error || data?.message || message;
          console.error('[DEBUG] Error response:', data);
        } catch (parseError) {
          console.error('[DEBUG] Failed to parse error response:', parseError);
        }
        throw new Error(message);
      }

      await fetchStatusForProject(projectId);
      const successText = type === 'photo' ? 'First frame regeneration queued.' : 'Video regeneration queued.';
      showSuccess(successText);
    } catch (error) {
      console.error('[DEBUG] Caught error in handleSegmentRegenerate:', error);
      const message = error instanceof Error ? error.message : 'Segment regeneration failed';
      showError(message);
    } finally {
      setSegmentInspectorSubmitting(prev => ({ ...prev, [type]: false }));
    }
  }, [segmentInspector, inspectorPrompt, fetchStatusForProject, showSuccess, showError]);

  const handleMergeProject = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setMergeSubmitting(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await fetch(`/api/competitor-ugc-replication/${projectId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        let message = 'Failed to start merge';
        try {
          const data = await response.json();
          message = data?.error || data?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      showSuccess('Merge started. We will notify you when it is ready.');
      await fetchStatusForProject(projectId);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to start merge');
    } finally {
      setMergeSubmitting(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  }, [fetchStatusForProject, showError, showSuccess]);

  useEffect(() => {
    if (!activeProjectIds.length) return;

    const poll = () => {
      console.log(`[DEBUG] Polling status for ${activeProjectIds.length} project(s)`);
      activeProjectIds.forEach(projectId => {
        fetchStatusForProject(projectId);
      });
    };

    // Initial poll after a short delay to avoid race conditions
    const initialTimer = setTimeout(poll, 1000);

    // Poll every 15 seconds (increased from 8s for better readability)
    const interval = setInterval(poll, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
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
      // ✅ STEP 1: Fast validation (check auth + credits) without downloading
      const validationResponse = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          historyId: projectId,
          userId: user.id,
          validateOnly: true // Only validate, don't download yet
        })
      });

      if (!validationResponse.ok) {
        const result = await validationResponse.json();
        throw new Error(result.message || 'Failed to authorize download');
      }

      // ✅ STEP 2: Validation passed - trigger instant streaming download via hidden form
      // This allows browser to handle download natively without waiting for blob

      // Create or reuse hidden iframe for downloads
      let iframe = document.getElementById('download-iframe') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'download-iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
      }

      // Submit download via hidden form (bypasses CORS and enables streaming)
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/download-video';
      form.target = 'download-iframe';
      form.style.display = 'none';

      const historyIdInput = document.createElement('input');
      historyIdInput.type = 'hidden';
      historyIdInput.name = 'historyId';
      historyIdInput.value = projectId;
      form.appendChild(historyIdInput);

      const userIdInput = document.createElement('input');
      userIdInput.type = 'hidden';
      userIdInput.name = 'userId';
      userIdInput.value = user.id;
      form.appendChild(userIdInput);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      // Update UI immediately (download started in background)
      setGenerations(prev => prev.map(gen =>
        gen.projectId === projectId
          ? { ...gen, downloaded: true }
          : gen
      ));

      if (refetchCredits) {
        await refetchCredits();
      }

      showSuccess('Video download started');
    } catch (error) {
      console.error('Competitor UGC Replication download failed:', error);
      showError(error instanceof Error ? error.message : 'Failed to download video');
    } finally {
      setDownloadingProjects(prev => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
    }
  }, [user?.id, downloadingProjects, refetchCredits, showError, showSuccess]);

  const handleRequestVideoGeneration = useCallback(async (generation: SessionGeneration) => {
    if (!generation.projectId) {
      showError('Cover is still preparing. Please try again soon.');
      return;
    }

    setGenerations(prev => prev.map(gen =>
      gen.projectId === generation.projectId
        ? { ...gen, videoGenerationRequested: true, stage: 'Video queued…' }
        : gen
    ));

    try {
      const response = await fetch(`/api/competitor-ugc-replication/${generation.projectId}/start-video`, {
        method: 'POST'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start video generation');
      }

      showSuccess('Video generation resumed. We will notify you once it is ready.');
      fetchStatusForProject(generation.projectId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start video generation';
      showError(message);
      setGenerations(prev => prev.map(gen =>
        gen.projectId === generation.projectId
          ? { ...gen, videoGenerationRequested: false }
          : gen
      ));
    }
  }, [fetchStatusForProject, showError, showSuccess]);

  // Handle platform change - auto-set recommended config
  const handlePlatformChange = useCallback((platform: Platform) => {
    setSelectedPlatform(platform);
    const preset = PLATFORM_PRESETS[platform];
    setFormat(preset.format);
    setVideoDuration(preset.duration);
  }, []);

  // Calculate available and disabled options
  const isKlingModel = selectedModel === 'kling_2_6';

  useEffect(() => {
    if (isKlingModel && format !== '16:9') {
      setFormat('16:9');
    }
  }, [isKlingModel, format]);

  useEffect(() => {
    if (isKlingModel && videoQuality !== 'standard') {
      setVideoQuality('standard');
    }
  }, [isKlingModel, videoQuality]);

  const availableDurations = useMemo(
    () => getModelSupportedDurations(selectedModel, videoQuality),
    [selectedModel, videoQuality]
  );

  const availableQualities = useMemo<VideoQuality[]>(
    () => {
      const capability = MODEL_CAPABILITIES.find(cap => cap.model === selectedModel);
      return capability?.supportedQualities || ['standard'];
    },
    [selectedModel]
  );

  const disabledDurations = useMemo(
    () => ALL_VIDEO_DURATIONS.filter(d => !availableDurations.includes(d)),
    [availableDurations]
  );

  // Filter duration options to only show supported durations for current model
  const filteredDurationOptions = useMemo(
    () => COMPETITOR_UGC_REPLICATION_DURATION_OPTIONS.filter(option => availableDurations.includes(option.value)),
    [availableDurations]
  );

  const disabledQualities = useMemo(
    () => ALL_VIDEO_QUALITIES.filter(q => !availableQualities.includes(q)),
    [availableQualities]
  );

  const disabledModels = useMemo<VideoModel[]>(
    () => {
      // Models should only be disabled by:
      // 1. User's available credits (handled in VideoModelSelector)
      // 2. Explicit disable props (if any)
      // NOT by quality!
      return [];
    },
    []
  );

  const formatHelperText = isKlingModel ? 'Kling 2.6 outputs landscape (16:9) with audio enabled.' : undefined;

  // Calculate recommended duration based on competitor ad
  const recommendedDuration = useMemo(() => {
    if (selectedCompetitorAd?.file_type === 'video') {
      // Use actual video duration for direct time matching
      const targetDurationSeconds = selectedCompetitorAd.video_duration_seconds || 0;

      if (targetDurationSeconds > 0) {
        return snapDurationToModel(selectedModel, targetDurationSeconds);
      }
    }
    return null;
  }, [selectedCompetitorAd, selectedModel]);

  // Auto-adjust quality and duration when they become invalid
  useEffect(() => {
    if (!availableQualities.includes(videoQuality)) {
      setVideoQuality(availableQualities[0]);
    }
  }, [videoQuality, availableQualities]);

  useEffect(() => {
    if (!availableDurations.includes(videoDuration)) {
      // Use snapDurationToModel to find the closest supported duration
      const closest = snapDurationToModel(selectedModel, Number(videoDuration));
      setVideoDuration(closest);
    }
  }, [videoDuration, availableDurations, selectedModel]);

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

    if (!selectedCompetitorAd) {
      setValidationMessage('Select a competitor video or photo to clone before generating.');
      setShowValidationModal(true);
      return;
    }

    if (isCompetitorPhotoMode && !competitorImageUrl) {
      setValidationMessage('Select a competitor photo in the Assets panel before generating.');
      setShowValidationModal(true);
      return;
    }

    if (isGenerating) return;

    setIsGenerating(true);

    const initialSegmentCount = shouldGenerateVideo
      ? getSegmentCountFromDuration(videoDuration, selectedModel)
      : null;

    const selectedVideoAspectRatio = isKlingModel
      ? '16:9'
      : (!isCompetitorPhotoMode && (format === '16:9' || format === '9:16')
        ? (format as '16:9' | '9:16')
        : '16:9');

    // Create new generation entry
    const newGeneration: SessionGeneration = {
      id: Date.now().toString(),
      timestamp: new Date(),
      status: 'pending',
      progress: 5,
      stage: isCompetitorPhotoMode ? 'Preparing replica photo…' : 'Initializing…',
      platform: selectedPlatform,
      brand: selectedBrand.brand_name,
      brandId: selectedBrand.id,
      videoModel: shouldGenerateVideo ? selectedModel : undefined,
      videoAspectRatio: shouldGenerateVideo ? selectedVideoAspectRatio : null,
      downloaded: false,
      segmentCount: initialSegmentCount ?? undefined,
      videoDuration: shouldGenerateVideo ? videoDuration : null,
      isSegmented: Boolean(initialSegmentCount && initialSegmentCount > 1),
      segmentStatus: null,
      segmentPlan: null,
      segments: null,
      awaitingMerge: false,
      mergeTaskId: null,
      mergeLoading: false,
      videoGenerationRequested: false,
      isPhotoOnly: isCompetitorPhotoMode
    };

    setGenerations(prev => [newGeneration, ...prev]);

    try {
      const replicaPayload = isCompetitorPhotoMode ? {
        photoOnly: true,
        replicaMode: true,
        referenceImageUrls: competitorImageUrl ? [competitorImageUrl] : [],
        photoAspectRatio,
        photoResolution,
        photoOutputFormat
      } : undefined;

      const workflowResult = await startWorkflowWithSelectedProduct({
        elementsCountOverride: elementsCount,
        imageSizeOverride: format,
        generateVideo: shouldGenerateVideo,
        selectedBrandId: selectedBrand.id,
        competitorAdId: selectedCompetitorAd.id,
        replicaOptions: replicaPayload
      });

      const projectId = workflowResult?.historyId || workflowResult?.projectId;

      const startedSegmented = Boolean(initialSegmentCount && initialSegmentCount > 1);
      const nextStage = isCompetitorPhotoMode
        ? 'Generating replica photo…'
        : startedSegmented
          ? STEP_DESCRIPTIONS.generating_segment_frames
          : STEP_DESCRIPTIONS.generating_cover;
      const nextProgress = isCompetitorPhotoMode
        ? 30
        : startedSegmented
          ? STEP_PROGRESS_HINTS.generating_segment_frames
          : STEP_PROGRESS_HINTS.generating_cover;

      setGenerations(prev => prev.map(gen =>
        gen.id === newGeneration.id
          ? {
              ...gen,
              status: 'processing',
              stage: nextStage,
              progress: nextProgress,
              projectId: projectId || gen.projectId
            }
          : gen
      ));

      if (projectId) {
        fetchStatusForProject(projectId);
      }

      showSuccess(isCompetitorPhotoMode ? 'Replica photo generation started!' : 'Cover generation started! Review the result above before generating the video.');

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
  const replicaPhotoCredits = getReplicaPhotoCredits(photoResolution);
  const generationCost = isCompetitorPhotoMode
    ? replicaPhotoCredits
    : getGenerationCost(selectedModel, videoDuration.toString(), videoQuality);
  const downloadCost = 0; // Version 2.0: ALL downloads are FREE
  const canAfford = isCompetitorPhotoMode
    ? (userCredits || 0) >= generationCost
    : canAffordModel(userCredits || 0, selectedModel);
  const replicaSelectionValid = !isCompetitorPhotoMode || Boolean(competitorImageUrl);
  const canGenerate = !isGenerating && Boolean(selectedBrand && selectedCompetitorAd) && replicaSelectionValid;

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
              <h1 className="text-2xl font-semibold text-gray-900">Competitor UGC Replication</h1>
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
                    noticeVariant="competitor-ugc"
                    onReview={handleRequestVideoGeneration}
                    reviewCtaLabel="Generate Video"
                    emptyStateRightContent={
                      <blockquote
                        className="tiktok-embed"
                        cite="https://www.tiktok.com/@laolilantian/video/7575386238564240658"
                        data-video-id="7575386238564240658"
                        style={{ maxWidth: '605px', minWidth: '280px' }}
                      >
                        <section>
                          <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">@laolilantian</a>
                          {' '}Competitor UGC Replication Demo Latest November 2025
                        </section>
                      </blockquote>
                    }
                    expandedGenerationId={expandedGenerationId}
                    onToggleSegments={(generation) => {
                      setExpandedGenerationId(prev => prev === generation.id ? null : generation.id);
                    }}
                    onSegmentSelect={(generation, segment) => {
                      const projectId = (generation as SessionGeneration).projectId;
                      if (!projectId) return;
                      setSegmentInspector({
                        projectId,
                        generationId: generation.id,
                        segmentIndex: segment.index
                      });
                    }}
                    onMerge={(generation) => {
                      const projectId = (generation as SessionGeneration).projectId;
                      if (!projectId) {
                        showError('Project not ready for merge yet.');
                        return;
                      }
                      const videosReady = generation.segmentStatus?.videosReady || 0;
                      const total = generation.segmentStatus?.total || generation.segmentCount || 0;
                      if (videosReady !== total || total === 0) {
                        showError('Segments are still rendering. Please wait until all videos are ready.');
                        return;
                      }
                      handleMergeProject(projectId);
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

            <BrandDropdownSelector
              selectedBrand={selectedBrand}
              onSelect={(brand) => {
                setSelectedBrand(brand);
                setSelectedCompetitorAd(null);
              }}
              disabled={isGenerating}
              className="flex-shrink-0"
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
              durationOptions={filteredDurationOptions}
              recommendedDuration={recommendedDuration}
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
              formatDisabled={isKlingModel}
              formatHelperText={formatHelperText}
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
                  flex items-center gap-2.5 px-5 py-2.5 rounded-full cursor-pointer
                  font-semibold text-sm whitespace-nowrap min-w-[260px]
                  transition-all duration-200
                  ${canGenerate
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate</span>
                {!isCompetitorPhotoMode && (
                  <div className="flex items-center gap-2 ml-auto text-xs">
                    {/* Generation Cost */}
                    <div className="flex items-center gap-1">
                      {generationCost > 0 ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 rounded">
                          <Coins className="w-3 h-3" />
                          <span>{generationCost}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-100 rounded text-[10px] font-bold">
                          FREE
                        </span>
                      )}
                    </div>
                    <span className="text-white/40">+</span>
                    {/* Download Cost */}
                    <div className="flex items-center gap-1">
                      <span className="text-white/80">Download:</span>
                      {downloadCost > 0 ? (
                        <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 rounded">
                          <Coins className="w-3 h-3" />
                          <span>{downloadCost}</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-green-500/20 text-green-100 rounded text-[10px] font-bold">
                          FREE
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {isCompetitorPhotoMode && generationCost > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded ml-auto">
                    <Coins className="w-3 h-3" />
                    {generationCost}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
    </div>
  </div>

    {segmentInspector && inspectorContext && (
      <SegmentInspector
        open
        onClose={() => setSegmentInspector(null)}
        projectId={segmentInspector.projectId}
        segmentIndex={segmentInspector.segmentIndex}
        segment={inspectorContext.segment}
        segmentPlanEntry={inspectorContext.planEntry}
        brandId={inspectorContext.generation.brandId || null}
        brandName={inspectorContext.generation.brand || null}
        videoModel={inspectorContext.generation.videoModel}
        videoDuration={inspectorContext.generation.videoDuration}
        videoAspectRatio={inspectorContext.generation.videoAspectRatio}
        onRegenerate={handleSegmentRegenerate}
        isSubmitting={segmentInspectorSubmitting}
      />
    )}

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
            <h3 className="text-xl font-bold text-gray-900">Welcome to Competitor UGC Replication!</h3>
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

function composeSegmentPromptUpdate(
  payload: SegmentPromptPayload,
  current?: Partial<SegmentPrompt>
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
    camera_motion_positioning: shot.camera_motion_positioning.trim()
  }));
  const primaryShot = normalizedShots[0];
  return {
    ...current,
    first_frame_description: payload.first_frame_description,
    action: primaryShot?.action || current?.action || '',
    subject: primaryShot?.subject || current?.subject || '',
    style: primaryShot?.style || current?.style || '',
    dialogue: primaryShot?.dialogue || current?.dialogue || '',
    audio: primaryShot?.audio || current?.audio || '',
    composition: primaryShot?.composition || current?.composition || '',
    context_environment: primaryShot?.context_environment || current?.context_environment || '',
    camera_motion_positioning: primaryShot?.camera_motion_positioning || current?.camera_motion_positioning || '',
    ambiance_colour_lighting: primaryShot?.ambiance_colour_lighting || current?.ambiance_colour_lighting || '',
    language: primaryShot?.language || current?.language || 'en',
    is_continuation_from_prev: payload.is_continuation_from_prev,
    shots: normalizedShots
  };
}
