'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  User
} from 'lucide-react';
import { getDownloadCost, type VideoModel } from '@/lib/constants';
import type { SegmentStatusPayload } from '@/lib/competitor-ugc-replication-workflow';

export interface Generation {
  id: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_review';
  progress?: number; // 0-100
  stage?: string; // e.g., "Generating cover image...", "Creating video..."
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
}

interface EmptyStateStep {
  icon: string;
  title: string;
  description: string;
}

const DEFAULT_STEPS: EmptyStateStep[] = [
  {
    icon: '📦',
    title: 'Step 1',
    description: 'Create your brands & products in Assets',
  },
  {
    icon: '🎯',
    title: 'Step 2',
    description: 'Select platform, brand, and product above',
  },
  {
    icon: '✨',
    title: 'Step 3',
    description: 'Click Generate to create your video',
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
  onReview
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
            {/* Character Ads format guidance */}
            <div className="mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-2xl bg-white/80 border border-blue-100 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Two flexible formats</p>
                  <p className="text-xs text-blue-800">Add a product or keep it as a pure talking head recording.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl bg-white/80 border border-blue-100 p-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Character + Product</p>
                    <p className="text-xs text-blue-700">Let the talent hold or wear your product while delivering the script.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/80 border border-blue-100 p-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Talking Head</p>
                    <p className="text-xs text-blue-700">Skip product assets and have the character share a message directly to camera.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900">
                  Get started
                </h3>
              </div>
              <p className="text-base text-gray-500 ml-13">
                Follow these steps to create your first video
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {steps.map((step, index) => (
                <div key={step.title} className="flex items-center gap-4 py-2">
                  <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-base font-semibold text-gray-500 bg-gray-100 rounded-full">
                    {index + 1}
                  </span>
                  <p className="text-base text-gray-700 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/dashboard/assets"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-base font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Boxes className="w-5 h-5" />
              Go to Assets
            </Link>
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
}

function GenerationCard({
  generation,
  onDownload,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview
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
    videoDuration
  } = generation;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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
    return `Download · ${downloadMetaLabel}`;
  }, [isDownloading, downloaded, downloadMetaLabel]);

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
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'attention':
        return <XCircle className="w-5 h-5 text-amber-500" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (displayStatus) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'attention':
        return 'Needs attention';
      case 'processing':
        return displayStage || 'Processing...';
      case 'pending':
      case 'awaiting_review':
        return displayStage || 'Queued';
      default:
        return 'Unknown';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between mb-3 gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon()}
              <span className="text-sm font-medium text-gray-900">
                {getStatusText()}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              {platform && (
                <span className="px-2 py-0.5 bg-gray-100 rounded capitalize">
                  {platform}
                </span>
              )}
              {brand && <span>• {brand}</span>}
              {product && <span>• {product}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Review Button for Character Ads - Hide during processing/video generation */}
            {onReview && (status === 'pending' || status === 'awaiting_review') && coverUrl && !videoUrl && (
              <button
                onClick={() => onReview(generation)}
                className="inline-flex items-center gap-2 px-3 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold shadow-sm hover:bg-blue-100 hover:border-blue-300 transition-colors cursor-pointer"
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span>Review & Generate</span>
              </button>
            )}

            {status === 'completed' && videoUrl && (
              onDownload ? (
                <button
                  onClick={() => !isDownloading && !downloaded && onDownload(generation)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-900 rounded-full text-xs font-semibold shadow-sm transition-colors whitespace-nowrap ${downloaded ? 'opacity-70 cursor-default' : isDownloading ? 'opacity-60 cursor-wait' : 'hover:border-gray-300 cursor-pointer'}`}
                  title={downloaded ? 'Already downloaded' : `Download (${downloadMetaLabel})`}
                  disabled={isDownloading || downloaded}
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                  <span>{downloadActionLabel}</span>
                </button>
              ) : (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-900 rounded-full text-xs font-semibold shadow-sm hover:border-gray-300 transition-colors cursor-pointer whitespace-nowrap"
                  title={`Download (${downloadMetaLabel})`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadActionLabel}</span>
                </a>
              )
            )}
          </div>
        </div>

        {/* Progress bar for processing */}
        {(displayStatus === 'processing' || displayStatus === 'pending' || displayStatus === 'attention') && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {progress > 0 && (
              <p className="text-xs text-gray-500 mt-1">{progress}% complete</p>
            )}
          </div>
        )}

        {displayStatus === 'attention' && hasSegmentFailure && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            One or more segments failed. Open the segment cards below to adjust and regenerate.
          </div>
        )}
        {displayStatus === 'failed' && errorMessage && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {errorMessage}
          </div>
        )}

        {/* Segment breakdown toggle */}
        {hasSegments && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => onToggleSegments?.(generation)}
              className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 transition"
            >
              <div className="flex flex-col gap-0.5">
                <span>Segment breakdown</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <span className="text-xs">{isExpanded ? 'Hide' : 'Show'}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            <div
              className="transition-all duration-300 ease-in-out overflow-hidden"
              style={{
                maxHeight: isExpanded ? 2000 : 0,
                opacity: isExpanded ? 1 : 0,
                marginTop: isExpanded ? '1rem' : 0
              }}
            >
              {isExpanded && (
                <SegmentBoard
                  generation={generation}
                  segmentStatus={generation.segmentStatus}
                  segments={generation.segments}
                  onSelectSegment={onSegmentSelect}
                />
              )}
            </div>
          </div>
        )}
        {hasSegments && (
          <div className="mb-3">
            {mergeComplete ? (
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                Final video merged. Download from the card above when ready.
              </div>
            ) : mergeInProgress ? (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Merging clips… hang tight.</span>
              </div>
            ) : awaitingUserMerge ? (
              <button
                type="button"
                onClick={() => onMerge?.(generation)}
                className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition border ${canMerge ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                disabled={!canMerge}
                title={
                  canMerge
                    ? 'Merge segments into final video'
                    : `Segments still rendering (${generation.segmentStatus?.videosReady || 0}/${generation.segmentStatus?.total || 0} ready)`
                }
              >
                {canMerge ? 'Merge Final Video' : 'Waiting for segments to finish'}
              </button>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <div className="font-semibold">Segments still rendering</div>
                <p className="text-xs text-amber-700 mt-0.5">
                  Fine-tune each segment until you&apos;re ready to merge.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Video preview */}
        {status === 'completed' && (videoUrl || coverUrl) && (
          <div className="mb-3">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              {videoUrl && isPlaying ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  poster={coverUrl}
                  autoPlay
                  playsInline
                  controls={false}
                  disablePictureInPicture
                  controlsList="nodownload nofullscreen noplaybackrate"
                  className="w-full h-full object-contain"
                  onEnded={handleStop}
                />
              ) : coverUrl ? (
                <Image
                  src={coverUrl}
                  alt="Video cover"
                  fill
                  unoptimized
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full bg-gray-900" />
              )}

              {videoUrl && !isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={handlePlay}
                    className="w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  >
                    <Play className="w-6 h-6 text-gray-900 ml-0.5" />
                  </button>
                </div>
              )}

              {videoUrl && isPlaying && (
                <button
                  onClick={handleStop}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg cursor-pointer"
                >
                  <X className="w-4 h-4 text-gray-900" />
                </button>
              )}
            </div>
          </div>
        )}

      </div>
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
        <div className="font-semibold text-gray-900">
          Shots ready: {segmentStatus?.framesReady ?? 0}/{segmentStatus?.total ?? derivedSegments.length}
        </div>
        <div>Videos ready: {segmentStatus?.videosReady ?? 0}/{segmentStatus?.total ?? derivedSegments.length}</div>
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

function SegmentSummaryCard({ segment, onSelect }: { segment: SegmentCardSummary; onSelect?: () => void }) {
  const prompt = (segment.prompt || {}) as Record<string, unknown>;
  const title =
    (typeof (prompt as { segment_title?: string }).segment_title === 'string' && (prompt as { segment_title?: string }).segment_title) ||
    (typeof (prompt as { segment_goal?: string }).segment_goal === 'string' && (prompt as { segment_goal?: string }).segment_goal) ||
    `Shot ${segment.index + 1}`;
  const summary =
    (typeof (prompt as { action?: string }).action === 'string' && (prompt as { action?: string }).action) ||
    (typeof (prompt as { description?: string }).description === 'string' && (prompt as { description?: string }).description) ||
    'Awaiting prompt details.';

  const statusBadge = getSegmentStatusBadge(segment.status);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_2px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {statusBadge.label}
        </span>
      </div>
      <div className="mt-3 flex gap-3">
        <div className="relative w-28 h-16 flex-shrink-0 rounded-xl overflow-hidden border border-gray-100 bg-gray-50">
          {segment.firstFrameUrl ? (
            <Image
              src={segment.firstFrameUrl}
              alt={title}
              fill
              sizes="112px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px] text-gray-500 gap-1">
              <ImageIcon className="w-4 h-4" />
              Frame pending
            </div>
          )}
          {segment.videoUrl && (
            <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
              <Film className="w-3 h-3" />
              Video
            </div>
          )}
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{summary}</p>
      </div>
      {segment.status === 'failed' && (
        <div className="mt-2 text-[11px] text-red-600">
          {segment.errorMessage || 'Segment failed. Adjust the prompt and regenerate.'}
        </div>
      )}
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        disabled={!onSelect}
        onClick={onSelect}
      >
        <PenSquare className="w-3.5 h-3.5" />
        Edit
      </button>
    </div>
  );
}

function getSegmentStatusBadge(status: string) {
  const normalized = status?.toLowerCase() || '';
  switch (normalized) {
    case 'first_frame_ready':
      return { label: 'Photo ready', className: 'text-amber-600 bg-amber-50' };
    case 'generating_first_frame':
      return { label: 'Photo generating', className: 'text-amber-600 bg-amber-50' };
    case 'generating_video':
      return { label: 'Video rendering', className: 'text-sky-700 bg-sky-50' };
    case 'video_ready':
      return { label: 'Video ready', className: 'text-emerald-700 bg-emerald-50' };
    case 'failed':
      return { label: 'Needs attention', className: 'text-red-700 bg-red-50' };
    default:
      return { label: 'Queued', className: 'text-gray-600 bg-gray-100' };
  }
}
