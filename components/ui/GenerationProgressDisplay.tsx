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
  Layers
} from 'lucide-react';
import { getDownloadCost, type VideoModel, getVideoModelDisplayName } from '@/lib/constants';
import type { SegmentStatusPayload } from '@/lib/competitor-ugc-replication-workflow';
import SegmentEditorSplitPane from '@/components/competitor-ugc-replication/SegmentEditorSplitPane';

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
  brand?: string;
  brandId?: string | null;
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
    description: 'Configure brands, products, and upload viral videos in',
    link: { text: 'Assets', href: '/dashboard/assets' }
  },
  {
    number: 2,
    description: 'Select brand and viral video'
  },
  {
    number: 3,
    description: 'Review settings and start generation'
  },
  {
    number: 4,
    description: 'Edit segment photos and prompts'
  },
  {
    number: 5,
    description: 'Merge final results'
  },
];

interface GenerationProgressDisplayProps {
  generations: Generation[];
  onDownload?: (generation: Generation) => void;
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
}

export default function GenerationProgressDisplay({
  generations,
  onDownload,
  emptyStateSteps,
  emptyStateRightContent,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview,
  reviewCtaLabel = 'Review & Generate',
  onSegmentRegenerate
}: GenerationProgressDisplayProps) {
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
    const steps = emptyStateSteps || DEFAULT_STEPS;
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
                    Get started
                  </h3>
                </div>
              </div>
              <p className="text-base text-[#666666] mt-3">
                Follow these steps to create your first video
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
          expandedGenerationId={expandedGenerationId}
          onToggleSegments={onToggleSegments}
          onSegmentSelect={onSegmentSelect}
          onMerge={onMerge}
          onReview={onReview}
          reviewCtaLabel={reviewCtaLabel}
          onSegmentRegenerate={onSegmentRegenerate}
        />
      ))}
    </div>
  );
}

interface GenerationCardProps {
  generation: Generation;
  onDownload?: (generation: Generation) => void;
  expandedGenerationId?: string | null;
  onToggleSegments?: (generation: Generation) => void;
  onSegmentSelect?: (generation: Generation, segment: SegmentCardSummary) => void;
  onMerge?: (generation: Generation) => void;
  onReview?: (generation: Generation) => void;
  reviewCtaLabel: string;
  onSegmentRegenerate?: (options: {
    projectId: string;
    segmentIndex: number;
    type: 'photo' | 'video';
    prompt: any;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
}

function GenerationCard({
  generation,
  onDownload,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview,
  reviewCtaLabel,
  onSegmentRegenerate
}: GenerationCardProps) {
  const {
    status,
    progress = 0,
    stage,
    videoUrl,
    coverUrl,
    platform,
    brand,
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
  const hasSegments = Boolean(
    generation.isSegmented &&
    ((generation.segmentStatus?.total && generation.segmentStatus.total > 0) ||
      (generation.segments && generation.segments.length > 0))
  );
  const isExpanded = expandedGenerationId === generation.id;
  const videosReady = generation.segmentStatus?.videosReady ?? 0;
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

  const downloadMetaLabel = useMemo(() => {
    if (downloaded) return 'Downloaded';
    if (!videoModel) {
      return 'Cost pending';
    }
    const cost = getDownloadCost(videoModel, videoDuration, segmentCount ?? undefined);
    return cost === 0 ? 'Free' : `${cost} credits`;
  }, [videoModel, downloaded, videoDuration, segmentCount]);

  const downloadActionLabel = useMemo(() => {
    if (isDownloading) return 'Downloading…';
    if (downloaded) return 'Downloaded';
    return 'Download';
  }, [isDownloading, downloaded]);

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
    switch (displayStatus) {
      case 'completed':
        return 'Ready to Download';
      case 'failed':
        return 'Generation Failed';
      case 'attention':
        return 'Action Required';
      case 'processing':
        return displayStage || 'Generating...';
      case 'pending':
      case 'awaiting_review':
        return displayStage || 'In Queue';
      default:
        return 'Unknown';
    }
  };

  const showBody = (displayStatus === 'attention' && hasSegmentFailure) ||
    (displayStatus === 'failed' && Boolean(errorMessage)) ||
    hasSegments ||
    (status === 'completed' && (Boolean(videoUrl) || Boolean(coverUrl)));
  const showPreviewAction = displayStatus === 'awaiting_review' && Boolean(coverUrl) && Boolean(onReview);

  const MetaTag = ({ icon: Icon, text }: { icon?: React.ElementType; text: string }) => (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-lg text-[11px] font-medium text-gray-600">
      {Icon && <Icon className="w-3 h-3 opacity-70" />}
      <span>{text}</span>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      <div className="p-5 space-y-4">
        {/* Header: Status and Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gray-50">
              {getStatusIcon()}
            </div>
            <div className="min-w-0">
              <h4 className="text-[15px] font-semibold text-gray-900 leading-tight truncate">
                {getStatusText()}
              </h4>
              <p className="text-[12px] text-gray-500 mt-0.5 font-medium">
                {new Date(generation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {hasSegments && generation.segments && generation.segments.length > 0 && !mergeComplete && (
              <button
                onClick={() => setShowSegmentEditor(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-900 rounded-xl text-[13px] font-semibold hover:border-gray-900 hover:bg-gray-50 transition-all"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Edit Segments</span>
              </button>
            )}
            {status === 'completed' && videoUrl && (
              <button
                onClick={() => !isDownloading && !downloaded && onDownload?.(generation)}
                disabled={isDownloading || downloaded}
                className={`inline-flex items-center gap-2 px-4 py-2 border rounded-xl text-[13px] font-semibold transition-all ${
                  downloaded
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-default'
                    : isDownloading
                    ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-wait'
                    : 'border-gray-200 bg-white text-gray-900 hover:border-gray-900 hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                <span>{downloadActionLabel}</span>
              </button>
            )}
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {brand && <MetaTag icon={User} text={brand} />}
          {product && <MetaTag icon={Package} text={product} />}
          {videoAspectRatio && <MetaTag icon={Maximize} text={videoAspectRatio} />}
          {videoDuration && <MetaTag icon={Clock} text={`${videoDuration}s`} />}
          {videoModel && <MetaTag icon={Rocket} text={getVideoModelDisplayName(videoModel)} />}
          {typeof creditsCost === 'number' && (
            <MetaTag icon={Coins} text={creditsCost === 0 ? 'Free' : `${creditsCost} Credits`} />
          )}
        </div>

        {/* Progress Section */}
        {(displayStatus === 'processing' || displayStatus === 'pending' || displayStatus === 'awaiting_review') && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(displayStatus === 'processing' || displayStatus === 'pending') ? (
                  <div className="w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <span className="text-[13px] font-bold text-gray-900">{progress}%</span>
              </div>
              {showPreviewAction && (
                <button
                  onClick={() => onReview?.(generation)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-white text-gray-900 rounded-lg text-[12px] font-semibold hover:border-gray-900 hover:bg-gray-50 transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {reviewCtaLabel}
                </button>
              )}
            </div>
            <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gray-900 overflow-hidden"
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
            {displayStatus === 'attention' && hasSegmentFailure && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[12px] text-amber-700 leading-relaxed font-medium">
                  Some segments require your attention. Please review and adjust the prompts.
                </p>
              </div>
            )}
            {displayStatus === 'failed' && errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-rose-600 mt-0.5" />
                <p className="text-[12px] text-rose-700 leading-relaxed font-medium">
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
                  <Image src={coverUrl} alt="Preview" fill className="object-contain" unoptimized />
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

            {/* Merge Action */}
            {hasSegments && segmentCount !== 1 && !mergeComplete && (
              <div className="mt-3">
                {mergeInProgress ? (
                  <div className="flex items-center justify-center gap-3 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-semibold text-[13px]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Merging your masterpiece...
                  </div>
                ) : (
                  <button
                    onClick={() => onMerge?.(generation)}
                    disabled={!canMerge}
                    className={`w-full py-3 rounded-xl font-bold text-[13px] transition-all border ${
                      canMerge
                        ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 shadow-sm'
                        : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    {canMerge ? 'Finalize & Merge Video' : `All segments need videos (${videosReady}/${totalSegments})`}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">Edit Segments</h2>
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
                brandId={generation.brandId}
                brandName={generation.brand}
                onRegenerate={onSegmentRegenerate ? (options) => {
                  const projectId = (generation as any).projectId || generation.id;
                  if (!projectId) return;
                  return onSegmentRegenerate({
                    projectId,
                    ...options
                  });
                } : undefined}
                onMerge={onMerge ? () => onMerge(generation) : undefined}
                isMerging={generation.mergeLoading}
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
  const derivedSegments = segments && segments.length > 0
    ? segments
    : ((segmentStatus?.segments as SegmentCardSummary[]) || []);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        {segmentStatus?.mergedVideoUrl && (
          <div className="flex items-center gap-1 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            Final merge available
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {derivedSegments.length === 0 ? (
          <div className="col-span-full border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
            Waiting for segment data…
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
  const prompt = (segment.prompt || {}) as Record<string, unknown>;
  const title =
    (typeof (prompt as { segment_title?: string }).segment_title === 'string' && (prompt as { segment_title?: string }).segment_title) ||
    (typeof (prompt as { segment_goal?: string }).segment_goal === 'string' && (prompt as { segment_goal?: string }).segment_goal) ||
    `Segment ${segment.index + 1}`;
  const summary =
    (typeof (prompt as { action?: string }).action === 'string' && (prompt as { action?: string }).action) ||
    (typeof (prompt as { description?: string }).description === 'string' && (prompt as { description?: string }).description) ||
    'Awaiting prompt details.';

  const statusBadge = getSegmentStatusBadge(segment.status);

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
            <span>No Image</span>
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
                {segment.errorMessage || 'Generation failed'}
              </span>
            ) : (
              <span className="text-amber-600 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Retrying ({segment.retryCount}/5)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover Action */}
      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
          <PenSquare className="w-3 h-3" />
          Edit
        </span>
      </div>
    </div>
  );
}

function getSegmentStatusBadge(status: string) {
  const normalized = status?.toLowerCase() || '';
  switch (normalized) {
    case 'first_frame_ready':
      return { label: 'Photo Ready', className: 'bg-orange-50 text-orange-700 border border-orange-100' };
    case 'generating_first_frame':
      return { label: 'Generating...', className: 'bg-gray-50 text-gray-600 border border-gray-100' };
    case 'retrying_first_frame':
      return { label: 'Retrying', className: 'bg-yellow-50 text-yellow-700 border border-yellow-100' };
    case 'generating_video':
      return { label: 'Rendering Video', className: 'bg-blue-50 text-blue-700 border border-blue-100' };
    case 'video_ready':
      return { label: 'Complete', className: 'bg-green-50 text-green-700 border border-green-100' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-50 text-red-700 border border-red-100' };
    default:
      return { label: 'Queued', className: 'bg-gray-50 text-gray-500 border border-gray-100' };
  }
}
