'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Download,
  Play,
  X,
  Boxes,
  Rocket,
  ChevronDown,
  ChevronUp,
  Film,
  Image as ImageIcon,
  PenSquare,
  Package,
  User,
  AlertCircle,
  Eye,
  Sparkles,
  Coins,
  Clock,
  Maximize,
  ScanFace,
  PencilLine,
  Clapperboard,
  Layers,
  CirclePause,
  ArrowRight,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { getDownloadCost, type VideoModel, getVideoModelDisplayName } from '@/lib/constants';
import type { SegmentStatusPayload } from '@/lib/video-clone-workflow';
import SegmentEditorSplitPane from '@/components/video-clone/SegmentEditorSplitPane';
import type { LanguageCode } from '@/components/ui/LanguageSelector';
import { useI18n } from '@/providers/I18nProvider';

const ACTION_BUTTON_BASE =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35';
const ACTION_BUTTON_DARK =
  `${ACTION_BUTTON_BASE} border border-zinc-900 bg-gradient-to-b from-zinc-900 to-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_8px_rgba(0,0,0,0.18)] hover:from-black hover:to-zinc-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_6px_12px_rgba(0,0,0,0.2)] hover:-translate-y-[1px]`;
const ACTION_BUTTON_DARK_DISABLED =
  `${ACTION_BUTTON_BASE} border border-zinc-900/60 bg-zinc-900/75 text-white/75 cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`;

export interface Generation {
  id: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_review';
  progress?: number; // 0-100
  stage?: string; // e.g., "Generating cover image...", "Creating video..."
  currentStep?: string; // Internal step ID for icon mapping
  videoUrl?: string;
  coverUrl?: string;
  platform?: string;
  product?: string;
  error?: string;
  videoModel?: VideoModel;
  downloaded?: boolean;
  isDownloading?: boolean;
  segmentCount?: number | null;
  videoDuration?: string | null;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  isSegmented?: boolean;
  segmentStatus?: SegmentStatusPayload | null;
  segments?: SegmentCardSummary[] | null;
  segmentPlan?: Record<string, unknown> | null;
  awaitingMerge?: boolean;
  mergeTaskId?: string | null;
  mergeLoading?: boolean;
  videoGenerationRequested?: boolean;
  isPhotoOnly?: boolean;
  creditsCost?: number;
}

export interface SegmentCardSummary {
  index: number;
  status: string;
  firstFrameUrl?: string | null;
  closingFrameUrl?: string | null;
  videoUrl?: string | null;
  prompt?: Record<string, unknown> | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
  retryCount?: number | null;
}

interface EmptyStateStep {
  number: number;
  description: string;
  link?: { text: string; href: string };
}

const DEFAULT_STEPS: EmptyStateStep[] = [
  {
    number: 1,
    description: 'Add products and upload viral videos in',
    link: { text: 'Assets', href: '/dashboard/assets' }
  },
  {
    number: 2,
    description: 'Select a viral video'
  },
  {
    number: 3,
    description: 'Review settings and start generation'
  },
  {
    number: 4,
    description: 'When ready, click "Edit" to manually refine photos and prompts for each segment'
  },
  {
    number: 5,
    description: 'Once satisfied, trigger video generation for each segment and merge the final result'
  },
];

interface GenerationProgressDisplayProps {
  generations: Generation[];
  onDownload?: (generation: Generation) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: (generation: Generation) => void;
  emptyStateSteps?: EmptyStateStep[];
  emptyStateRightContent?: React.ReactNode;
  expandedGenerationId?: string | null;
  onToggleSegments?: (generation: Generation) => void;
  onSegmentSelect?: (generation: Generation, segment: SegmentCardSummary) => void;
  onMerge?: (generation: Generation, updatedPlan?: any) => void;
  onReview?: (generation: Generation) => void;
  reviewCtaLabel?: string;
  onSegmentRegenerate?: (options: {
    projectId: string;
    segmentIndex: number;
    type: 'photo' | 'video';
    prompt: any;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  projectType?: 'avatar-ads' | 'video-clone' | 'motion-clone';
  selectedLanguage?: LanguageCode;
}

export default function GenerationProgressDisplay({
  generations,
  onDownload,
  primaryActionLabel,
  onPrimaryAction,
  emptyStateSteps,
  emptyStateRightContent,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview,
  reviewCtaLabel,
  onSegmentRegenerate,
  projectType,
  selectedLanguage
}: GenerationProgressDisplayProps) {
  const { locale } = useI18n();
  const copy = useMemo(() => ({
    reviewEdit: locale === 'zh' ? '编辑' : 'Edit',
    getStarted: locale === 'zh' ? '开始使用' : 'Get started',
    followSteps: locale === 'zh' ? '按照这些步骤创建你的第一个视频' : 'Follow these steps to create your first video',
    readyToDownload: locale === 'zh' ? '可下载' : 'Ready to Download',
    generationFailed: locale === 'zh' ? '生成失败' : 'Generation Failed',
    needsReview: locale === 'zh' ? '需要检查' : 'Needs Review',
    generating: locale === 'zh' ? '生成中...' : 'Generating...',
    inQueue: locale === 'zh' ? '排队中' : 'In Queue',
    unknown: locale === 'zh' ? '未知状态' : 'Unknown',
    free: locale === 'zh' ? '免费' : 'Free',
    credits: locale === 'zh' ? '积分' : 'Credits',
    reviewNeeded: locale === 'zh' ? '需要检查' : 'Review Needed',
    previewAlt: locale === 'zh' ? '预览' : 'Preview',
    reviewYourVideo: locale === 'zh' ? '检查视频' : 'Review Your Video',
    composeYourVideo: locale === 'zh' ? '编排视频' : 'Compose Your Video',
    finalMergeAvailable: locale === 'zh' ? '最终合并结果已可用' : 'Final merge available',
    waitingSegmentData: locale === 'zh' ? '等待分镜数据…' : 'Waiting for segment data…',
    noImage: locale === 'zh' ? '无图片' : 'No Image',
    segmentGenerationFailed: locale === 'zh' ? '生成失败' : 'Generation failed',
    retrying: locale === 'zh' ? '重试中' : 'Retrying',
    thanks: locale === 'zh' ? '感谢反馈！' : 'Thanks!',
    good: locale === 'zh' ? '好' : 'Good',
    bad: locale === 'zh' ? '差' : 'Bad',
    feedbackFailed: locale === 'zh' ? '提交反馈失败，请重试。' : 'Failed to submit feedback. Please try again.',
  }), [locale]);
  const localizedDefaultSteps: EmptyStateStep[] = useMemo(() => (
    locale === 'zh'
      ? [
          { number: 1, description: '在', link: { text: 'Assets', href: '/dashboard/assets' } },
          { number: 2, description: '选择一个爆款视频' },
          { number: 3, description: '检查设置并开始生成' },
          { number: 4, description: '准备好后，点击“编辑”手动微调每个分镜的图片和提示词' },
          { number: 5, description: '满意后，逐段触发视频生成并合并最终结果' },
        ]
      : DEFAULT_STEPS
  ), [locale]);
  const resolvedReviewCtaLabel = reviewCtaLabel ?? copy.reviewEdit;
  // Load TikTok script when in empty state
  useEffect(() => {
    if (generations.length === 0) {
      const script = document.createElement('script');
      script.src = 'https://www.tiktok.com/embed.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [generations.length]);

  // Empty state
  if (generations.length === 0) {
    const steps = emptyStateSteps || localizedDefaultSteps;
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
          {/* Left Side: Steps */}
          <div className="flex-1 max-w-lg">
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h3 className="text-3xl font-semibold text-black">
                    {copy.getStarted}
                  </h3>
                </div>
              </div>
              <p className="text-base text-[#666666] mt-3">
                {copy.followSteps}
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {steps.map((step) => (
                <div key={step.number} className="flex items-start gap-3 py-2">
                  <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-sm font-semibold text-[#666666] bg-[#F7F7F7] border border-[#E5E5E5] rounded-full">
                    {step.number}
                  </span>
                  <p className="text-base text-black leading-relaxed pt-0.5">
                    {step.description}
                    {step.link && (
                      <>
                        {' '}
                        <Link
                          href={step.link.href}
                          className="font-semibold text-black underline hover:no-underline transition-all"
                        >
                          {step.link.text}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side: Video Tutorial */}
          {emptyStateRightContent && (
            <div className="flex-1 max-w-md">
              <div className="rounded-xl overflow-hidden">
                {emptyStateRightContent}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {generations.map((generation) => (
        <GenerationCard
          key={generation.id}
          generation={generation}
          onDownload={onDownload}
          primaryActionLabel={primaryActionLabel}
          onPrimaryAction={onPrimaryAction}
          expandedGenerationId={expandedGenerationId}
          onToggleSegments={onToggleSegments}
          onSegmentSelect={onSegmentSelect}
          onMerge={onMerge}
          onReview={onReview}
          reviewCtaLabel={reviewCtaLabel}
          onSegmentRegenerate={onSegmentRegenerate}
          projectType={projectType}
          selectedLanguage={selectedLanguage}
        />
      ))}
    </div>
  );
}

interface GenerationCardProps {
  generation: Generation;
  onDownload?: (generation: Generation) => void;
  primaryActionLabel?: string;
  onPrimaryAction?: (generation: Generation) => void;
  expandedGenerationId?: string | null;
  onToggleSegments?: (generation: Generation) => void;
  onSegmentSelect?: (generation: Generation, segment: SegmentCardSummary) => void;
  onMerge?: (generation: Generation) => void;
  onReview?: (generation: Generation) => void;
  reviewCtaLabel?: string;
  onSegmentRegenerate?: (options: {
    projectId: string;
    segmentIndex: number;
    type: 'photo' | 'video';
    prompt: any;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  projectType?: 'avatar-ads' | 'video-clone' | 'motion-clone';
  selectedLanguage?: LanguageCode;
}

function GenerationCard({
  generation,
  onDownload,
  primaryActionLabel,
  onPrimaryAction,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview,
  reviewCtaLabel,
  onSegmentRegenerate,
  projectType,
  selectedLanguage
}: GenerationCardProps) {
  const { locale } = useI18n();
  const copy = useMemo(() => ({
    reviewEdit: locale === 'zh' ? '编辑' : 'Edit',
    readyToDownload: locale === 'zh' ? '可下载' : 'Ready to Download',
    generationFailed: locale === 'zh' ? '生成失败' : 'Generation Failed',
    needsReview: locale === 'zh' ? '需要检查' : 'Needs Review',
    generating: locale === 'zh' ? '生成中...' : 'Generating...',
    inQueue: locale === 'zh' ? '排队中' : 'In Queue',
    unknown: locale === 'zh' ? '未知状态' : 'Unknown',
    free: locale === 'zh' ? '免费' : 'Free',
    credits: locale === 'zh' ? '积分' : 'Credits',
    reviewNeeded: locale === 'zh' ? '需要检查' : 'Review Needed',
    previewAlt: locale === 'zh' ? '预览' : 'Preview',
    reviewYourVideo: locale === 'zh' ? '检查视频' : 'Review Your Video',
    composeYourVideo: locale === 'zh' ? '编排视频' : 'Compose Your Video',
  }), [locale]);
  const resolvedReviewCtaLabel = reviewCtaLabel ?? copy.reviewEdit;
  const {
    status,
    progress = 0,
    stage,
    videoUrl,
    coverUrl,
    platform,
    product,
    error,
    videoModel,
    isDownloading,
    downloaded,
    segmentCount,
    videoDuration,
    videoAspectRatio,
    videoGenerationRequested,
    isPhotoOnly,
    creditsCost
  } = generation;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSegmentEditor, setShowSegmentEditor] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const hasSegments = Boolean(
    generation.isSegmented &&
    ((generation.segmentStatus?.total && generation.segmentStatus.total > 0) ||
      (generation.segments && generation.segments.length > 0))
  );
  const isExpanded = expandedGenerationId === generation.id;
  const videosReady = generation.segmentStatus?.videosReady ?? 0;
  const framesReady = generation.segmentStatus?.framesReady ?? 0;
  const totalSegments = generation.segmentStatus?.total ?? generation.segmentCount ?? 0;
  const awaitingUserMerge = generation.awaitingMerge === true;
  const mergedVideoUrl =
    generation.segmentStatus?.mergedVideoUrl ||
    (!awaitingUserMerge ? generation.videoUrl : undefined);
  const mergeComplete = Boolean(mergedVideoUrl);
  const mergeInProgress = Boolean((generation.mergeTaskId && !mergeComplete) || generation.mergeLoading);
  const canMerge = Boolean(
    awaitingUserMerge &&
    !mergeComplete &&
    !mergeInProgress &&
    totalSegments > 0 &&
    videosReady === totalSegments
  );
  const editorFlowLabels = projectType === 'video-clone'
    ? {
        step1: locale === 'zh' ? '编辑提示词' : 'Edit Prompts',
        step2: locale === 'zh' ? '生成首帧' : 'Generate First Frames',
        step3: locale === 'zh' ? '生成视频' : 'Generate Videos',
        step4: locale === 'zh' ? '合并最终视频' : 'Merge Final Video'
      }
    : {
        step1: locale === 'zh' ? '微调画面和素材' : 'Refine Frames & Assets',
        step2: locale === 'zh' ? '生成分镜片段' : 'Generate Segment Clips',
        step3: locale === 'zh' ? '合并最终视频' : 'Merge Final Video'
      };

  const downloadMetaLabel = useMemo(() => {
    if (downloaded) return locale === 'zh' ? '已下载' : 'Downloaded';
    if (!videoModel) {
      return locale === 'zh' ? '费用待定' : 'Cost pending';
    }
    const cost = getDownloadCost(videoModel, videoDuration, segmentCount ?? undefined);
    return cost === 0 ? copy.free : `${cost} ${locale === 'zh' ? '积分' : 'credits'}`;
  }, [videoModel, downloaded, videoDuration, segmentCount, locale, copy.free]);

  const downloadActionLabel = useMemo(() => {
    if (isDownloading) return locale === 'zh' ? '下载中…' : 'Downloading…';
    if (downloaded) return locale === 'zh' ? '再次下载' : 'Download Again';
    return locale === 'zh' ? '下载' : 'Download';
  }, [isDownloading, downloaded, locale]);

  const hasSegmentFailure = Boolean(
    generation.segmentStatus?.segments?.some(seg => seg.status === 'failed')
  );
  const displayStatus: Generation['status'] | 'attention' =
    hasSegmentFailure && status !== 'completed' ? 'attention' : status;
  const displayStage = hasSegmentFailure ? 'Needs attention' : stage;
  const errorMessage = generation.error;

  const handlePlay = () => {
    if (!videoUrl) return;
    setIsPlaying(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        setIsPlaying(false);
      });
    });
  };

  const handleStop = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const getStatusIcon = () => {
    switch (displayStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-gray-900" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-gray-900" />;
      case 'attention':
        return <AlertCircle className="w-5 h-5 text-gray-900" />;
      case 'awaiting_review':
        return <Eye className="w-5 h-5 text-gray-900" />;
      case 'processing':
      case 'pending':
        if (generation.currentStep) {
          switch (generation.currentStep.toLowerCase()) {
            case 'analyzing_images':
              return <ScanFace className="w-5 h-5 text-gray-900" />;
            case 'generating_prompts':
              return <PencilLine className="w-5 h-5 text-gray-900" />;
            case 'generating_image':
              return <ImageIcon className="w-5 h-5 text-gray-900" />;
            case 'reviewing':
              return <Eye className="w-5 h-5 text-gray-900" />;
            case 'generating_videos':
              return <Clapperboard className="w-5 h-5 text-gray-900" />;
            case 'merging_videos':
              return <Layers className="w-5 h-5 text-gray-900" />;
          }
        }
        return <Sparkles className="w-5 h-5 text-gray-900" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    const formatStage = (s?: string) => {
      if (!s) return s;
      return s
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    switch (displayStatus) {
      case 'completed':
        return copy.readyToDownload;
      case 'failed':
        return copy.generationFailed;
      case 'attention':
        return copy.needsReview;
      case 'processing':
        return formatStage(displayStage) || copy.generating;
      case 'pending':
      case 'awaiting_review':
        return formatStage(displayStage) || copy.inQueue;
      default:
        return copy.unknown;
    }
  };

  const showBody = (displayStatus === 'attention' && hasSegmentFailure) ||
    (displayStatus === 'failed' && Boolean(errorMessage)) ||
    hasSegments ||
    (status === 'completed' && (Boolean(videoUrl) || Boolean(coverUrl)));
  const showPreviewAction =
    Boolean(coverUrl) &&
    Boolean(onReview) &&
    (displayStatus === 'awaiting_review' || status === 'completed');

  const MetaTag = ({ icon: Icon, text }: { icon?: React.ElementType; text: string }) => (
    <div className="generation-progress-meta inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[11px] font-medium text-gray-600">
      {Icon && <Icon className="w-3 h-3 opacity-70" />}
      <span>{text}</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="generation-progress-card bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {/* Header: Status and Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="generation-progress-icon p-2 rounded-xl bg-gray-50">
              {getStatusIcon()}
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <div>
                <h4 className="generation-progress-title text-[15px] font-semibold text-gray-900 leading-tight truncate">
                  {getStatusText()}
                </h4>
                <p className="generation-progress-time text-[12px] text-gray-500 mt-0.5 font-medium">
                  {new Date(generation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showPreviewAction && (
              <button
                onClick={() => onReview?.(generation)}
                className={`generation-progress-action ${ACTION_BUTTON_DARK}`}
              >
                <PencilLine className="w-3.5 h-3.5" />
                {resolvedReviewCtaLabel}
              </button>
            )}
            {primaryActionLabel && onPrimaryAction && (
              <button
                onClick={() => onPrimaryAction(generation)}
                className={`generation-progress-action ${ACTION_BUTTON_DARK}`}
              >
                <PencilLine className="w-3.5 h-3.5" />
                <span>{primaryActionLabel}</span>
              </button>
            )}
            {hasSegments && generation.segments && generation.segments.length > 0 && (
              <div className="flex flex-col gap-1.5 items-end">
                <button
                  onClick={() => {
                    setEditorReadOnly(false);
                    setShowSegmentEditor(true);
                  }}
                  className={`generation-progress-edit ${ACTION_BUTTON_DARK}`}
                >
                  <PencilLine className="w-3.5 h-3.5" />
                  <span>{copy.reviewEdit}</span>
                </button>
              </div>
            )}
            {status === 'completed' && videoUrl && (
              <>
                <button
                  onClick={() => !isDownloading && onDownload?.(generation)}
                  disabled={isDownloading}
                  className={`${
                    isDownloading
                      ? `${ACTION_BUTTON_DARK_DISABLED} animate-pulse`
                      : `${ACTION_BUTTON_DARK} cursor-pointer`
                  }`}
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                  <span>{downloadActionLabel}</span>
                </button>
                {projectType && (
                  <FeedbackButtons
                    projectId={generation.id}
                    projectType={projectType}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {product && <MetaTag icon={Package} text={product} />}
          {videoAspectRatio && <MetaTag icon={Maximize} text={videoAspectRatio} />}
          {videoDuration && <MetaTag icon={Clock} text={`${videoDuration}s`} />}
          {videoModel && <MetaTag icon={Rocket} text={getVideoModelDisplayName(videoModel)} />}
          {typeof creditsCost === 'number' && (
            <MetaTag icon={Coins} text={creditsCost === 0 ? copy.free : `${creditsCost} ${copy.credits}`} />
          )}
        </div>

        {/* Progress Section */}
        {(displayStatus === 'processing' || displayStatus === 'pending' || displayStatus === 'awaiting_review' || displayStatus === 'attention') && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {displayStatus === 'attention' ? (
                  <div className="generation-progress-dot w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <CirclePause className="w-2.5 h-2.5 text-white" />
                  </div>
                ) : (displayStatus === 'processing' || displayStatus === 'pending') ? (
                  <div className="generation-progress-dot w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="generation-progress-dot w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="generation-progress-percent text-[13px] font-bold text-gray-900">{progress}%</span>
                  {hasSegments && generation.segments && generation.segments.length > 0 && !mergeComplete && (
                    <div className="generation-progress-badge inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-medium text-gray-900 whitespace-nowrap">
                      <AlertCircle className="w-2.5 h-2.5 flex-shrink-0" />
                      <span>{copy.reviewNeeded}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="generation-progress-track relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="generation-progress-fill absolute inset-y-0 left-0 bg-gray-900 overflow-hidden"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              >
                {/* Wave shimmer effect */}
                <motion.div
                  className="absolute inset-0 w-1/2 h-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                  }}
                  animate={{
                    x: ['-100%', '300%'],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </motion.div>
            </div>
          </div>
        )}

        {/* Error/Body */}
        {showBody && (
          <div className="pt-2">
            {displayStatus === 'failed' && errorMessage && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-gray-900 mt-0.5" />
                <p className="text-[12px] text-gray-600 leading-relaxed font-medium">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Video Preview Area */}
            {status === 'completed' && (videoUrl || coverUrl) && (
              <div className="mt-2 relative aspect-video bg-gray-50 rounded-xl overflow-hidden group border border-gray-100">
                {videoUrl && isPlaying ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    poster={coverUrl}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                    onEnded={handleStop}
                  />
                ) : coverUrl ? (
                  <Image src={coverUrl} alt={copy.previewAlt} fill className="object-contain" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-8 h-8 text-gray-200" />
                  </div>
                )}

                {videoUrl && !isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handlePlay}
                      className="w-14 h-14 bg-white text-gray-900 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform cursor-pointer"
                    >
                      <Play className="w-6 h-6 ml-1 fill-current" />
                    </button>
                  </div>
                )}

                {videoUrl && isPlaying && (
                  <button
                    onClick={handleStop}
                    className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Segment Editor Modal */}
      {showSegmentEditor && hasSegments && generation.segments && generation.segments.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-5 h-5 text-black" />
                  <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                    {editorReadOnly ? copy.reviewYourVideo : copy.composeYourVideo}
                  </h2>
                </div>

                {!editorReadOnly && (
                  <div className="hidden lg:flex items-center gap-5">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">1</span>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <PencilLine className="w-3.5 h-3.5" />
                        <span>{editorFlowLabels.step1}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">2</span>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{editorFlowLabels.step2}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">3</span>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <Clapperboard className="w-3.5 h-3.5" />
                        <span>{editorFlowLabels.step3}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-gray-300" />
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold">4</span>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{editorFlowLabels.step4}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowSegmentEditor(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 min-h-0">
              <SegmentEditorSplitPane
                projectId={(generation as any).projectId || generation.id}
                segments={generation.segments}
                segmentPlan={generation.segmentPlan}
                videoModel={generation.videoModel}
                videoDuration={generation.videoDuration}
                videoAspectRatio={generation.videoAspectRatio}
                selectedLanguage={selectedLanguage}
                onRegenerate={editorReadOnly ? undefined : (onSegmentRegenerate ? (options) => {
                  const projectId = (generation as any).projectId || generation.id;
                  if (!projectId) return;
                  return onSegmentRegenerate({
                    projectId,
                    ...options
                  });
                } : undefined)}
                onMerge={editorReadOnly ? undefined : (onMerge ? () => {
                  // Close editor modal when merge starts (merge completes in 4-5 seconds)
                  setShowSegmentEditor(false);
                  onMerge(generation);
                } : undefined)}
                onDownload={editorReadOnly ? undefined : (onDownload ? () => {
                  onDownload(generation);
                } : undefined)}
                isMerging={generation.mergeLoading}
                isDownloading={generation.isDownloading}
                readOnly={editorReadOnly}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SegmentBoard({
  generation,
  segmentStatus,
  segments,
  onSelectSegment
}: {
  generation: Generation;
  segmentStatus?: SegmentStatusPayload | null;
  segments?: SegmentCardSummary[] | null;
  onSelectSegment?: (generation: Generation, segment: SegmentCardSummary) => void;
}) {
  const { locale } = useI18n();
  const derivedSegments = segments && segments.length > 0
    ? segments
    : ((segmentStatus?.segments as SegmentCardSummary[]) || []);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        {segmentStatus?.mergedVideoUrl && (
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            {locale === 'zh' ? '最终合并结果已可用' : 'Final merge available'}
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {derivedSegments.length === 0 ? (
          <div className="col-span-full border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
            {locale === 'zh' ? '等待分镜数据…' : 'Waiting for segment data…'}
          </div>
        ) : (
          derivedSegments.map(segment => (
            <SegmentSummaryCard
              key={segment.index}
              segment={segment}
              onSelect={() => onSelectSegment?.(generation, segment)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SegmentSummaryCard({
  segment,
  onSelect
}: {
  segment: SegmentCardSummary;
  onSelect?: () => void;
}) {
  const { locale } = useI18n();
  const prompt = (segment.prompt || {}) as Record<string, unknown>;
  const title =
    (typeof (prompt as { segment_title?: string }).segment_title === 'string' && (prompt as { segment_title?: string }).segment_title) ||
    (typeof (prompt as { segment_goal?: string }).segment_goal === 'string' && (prompt as { segment_goal?: string }).segment_goal) ||
    `Segment ${segment.index + 1}`;
  const summary =
    (typeof (prompt as { action?: string }).action === 'string' && (prompt as { action?: string }).action) ||
    (typeof (prompt as { description?: string }).description === 'string' && (prompt as { description?: string }).description) ||
    'Awaiting prompt details.';

  const statusBadge = getSegmentStatusBadge(segment.status, locale);

  return (
    <div 
      onClick={onSelect}
      className="group relative flex gap-4 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50/50 hover:border-gray-300 transition-all cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="relative w-32 aspect-video bg-gray-100 rounded-md overflow-hidden flex-shrink-0 border border-gray-100/50">
        {segment.firstFrameUrl ? (
          <Image
            src={segment.firstFrameUrl}
            alt={title}
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-gray-400 gap-1.5 bg-gray-50">
            <ImageIcon className="w-4 h-4 opacity-50" />
            <span>{locale === 'zh' ? '无图片' : 'No Image'}</span>
          </div>
        )}
        {segment.videoUrl && (
          <div className="absolute bottom-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 backdrop-blur-[2px] text-white">
            <Film className="w-3 h-3" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <h4 className="text-[13px] font-semibold text-gray-900 truncate leading-none">{title}</h4>
          <span className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
        </div>
        
        <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">
          {summary}
        </p>

        {(segment.status === 'failed' || (segment.status === 'retrying_first_frame' && segment.retryCount)) && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            {segment.status === 'failed' ? (
              <span className="text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {segment.errorMessage || (locale === 'zh' ? '生成失败' : 'Generation failed')}
              </span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                {locale === 'zh' ? `重试中 (${segment.retryCount}/5)` : `Retrying (${segment.retryCount}/5)`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover Action */}
      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
          <PenSquare className="w-3 h-3" />
          {locale === 'zh' ? '编辑' : 'Edit'}
        </span>
      </div>
    </div>
  );
}

function FeedbackButtons({
  projectId,
  projectType
}: {
  projectId: string;
  projectType: 'avatar-ads' | 'video-clone' | 'motion-clone';
}) {
  const { locale } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState<'positive' | 'negative' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFeedback = async (feedbackType: 'positive' | 'negative') => {
    setSubmitting(feedbackType);
    setError(null);

    try {
      const response = await fetch('/api/projects/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectType, feedbackType })
      });

      if (!response.ok) {
        throw new Error(locale === 'zh' ? '提交反馈失败，请重试。' : 'Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Feedback error:', err);
      setError(locale === 'zh' ? '提交反馈失败，请重试。' : 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(null);
    }
  };

  if (submitted) {
    return (
      <span className="text-[12px] text-gray-500">{locale === 'zh' ? '感谢反馈！' : 'Thanks!'}</span>
    );
  }

  return (
    <>
      <button
        onClick={() => handleFeedback('positive')}
        disabled={submitting !== null}
        className={`${submitting !== null ? ACTION_BUTTON_DARK_DISABLED : ACTION_BUTTON_DARK}`}
      >
        {submitting === 'positive' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="w-3.5 h-3.5" />
        )}
        <span>{locale === 'zh' ? '好' : 'Good'}</span>
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        disabled={submitting !== null}
        className={`${submitting !== null ? ACTION_BUTTON_DARK_DISABLED : ACTION_BUTTON_DARK}`}
      >
        {submitting === 'negative' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ThumbsDown className="w-3.5 h-3.5" />
        )}
        <span>{locale === 'zh' ? '差' : 'Bad'}</span>
      </button>
    </>
  );
}

function getSegmentStatusBadge(status: string, locale: 'en' | 'zh') {
  const normalized = status?.toLowerCase() || '';
  switch (normalized) {
    case 'first_frame_ready':
      return { label: locale === 'zh' ? '可生成视频' : 'Ready for Video', className: 'bg-gray-100 text-gray-900 border border-gray-200' };
    case 'generating_first_frame':
      return { label: locale === 'zh' ? '生成中...' : 'Generating...', className: 'bg-gray-50 text-gray-600 border border-gray-100' };
    case 'retrying_first_frame':
      return { label: locale === 'zh' ? '重试中' : 'Retrying', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    case 'generating_video':
      return { label: locale === 'zh' ? '渲染视频中' : 'Rendering Video', className: 'bg-gray-900 text-white border border-transparent' };
    case 'video_ready':
      return { label: locale === 'zh' ? '完成' : 'Complete', className: 'bg-black text-white border border-transparent' };
    case 'failed':
      return { label: locale === 'zh' ? '失败' : 'Failed', className: 'bg-gray-200 text-gray-900 border border-gray-300' };
    default:
      return { label: locale === 'zh' ? '排队中' : 'Queued', className: 'bg-gray-50 text-gray-500 border border-gray-100' };
  }
}
