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
  User,
  AlertCircle,
  Eye
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
  videoGenerationRequested?: boolean;
  isPhotoOnly?: boolean;
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
  reviewCtaLabel = 'Review & Generate'
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
}

function GenerationCard({
  generation,
  onDownload,
  expandedGenerationId,
  onToggleSegments,
  onSegmentSelect,
  onMerge,
  onReview,
  reviewCtaLabel
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
    videoGenerationRequested,
    isPhotoOnly
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
      case 'awaiting_review':
        return <Eye className="w-5 h-5 text-blue-500" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-5 h-5 text-white animate-spin" />;
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
      {/* --- PROGRESS HEADER SECTION --- */}
      <div className="relative overflow-hidden border-b border-gray-100">
        {/* High-Contrast Progress Fill with Wavy Edge */}
        {(displayStatus === 'processing' || displayStatus === 'pending') && (
          <div className="absolute inset-0 z-0 overflow-visible">
            <motion.div
              className="absolute inset-y-0 left-0 bg-black"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
               {/* Wave Sweep Animation inside */}
              <motion.div 
                className="absolute inset-0 w-full h-full"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
                }}
              />
              
              {/* Wavy Edge - SVG Pattern */}
              <div 
                className="absolute top-0 bottom-0 right-[-12px] w-[12px] overflow-hidden"
              >
                 <div className="w-full h-full animate-wave-slide" 
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 24'%3E%3Cpath fill='black' d='M0,0 c8,0 12,6 12,12 c0,6 -4,12 -12,12 V0 z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'repeat-y',
                        backgroundSize: '100% 24px',
                        height: '200%'
                      }} 
                 />
              </div>
            </motion.div>
            <style jsx>{`
              @keyframes wave-slide {
                0% { transform: translateY(0); }
                100% { transform: translateY(-24px); }
              }
              .animate-wave-slide {
                animation: wave-slide 1s linear infinite;
              }
            `}</style>
          </div>
        )}

        <div className="relative z-10 p-5" style={{ mixBlendMode: 'difference' }}>
          {/* Header Content */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center text-white">
                  {getStatusIcon()}
                </div>
                <span className="text-[17px] font-semibold text-white leading-none">
                  {getStatusText()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {(displayStatus === 'processing' || displayStatus === 'pending') && (
                <span className="text-[17px] font-bold text-white leading-none tabular-nums">
                  {progress}%
                </span>
              )}
              {/* Review Button for Character Ads - Hide during processing/video generation */}
              {onReview &&
                !isPhotoOnly &&
                !videoGenerationRequested &&
                (status === 'pending' || status === 'awaiting_review') &&
                coverUrl &&
                !videoUrl && (
                <button
                  onClick={() => onReview(generation)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg transition-all cursor-pointer animate-pulse"
                >
                  <PenSquare className="w-4 h-4" />
                  <span>{reviewCtaLabel}</span>
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
        </div>
      </div>

      {/* --- CONTENT BODY SECTION --- */}
      <div className="p-5 bg-white">
        {/* Progress bar removed for minimalist design */}

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

        {/* Segment breakdown toggle - hide for single segments */}
        {hasSegments && segmentCount !== 1 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => onToggleSegments?.(generation)}
              className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-100 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="font-semibold">Segment breakdown</span>
                <span className="text-[11px] text-[#666666] font-normal leading-tight">
                  Expand and edit prompts until satisfied, then manually confirm to generate video
                </span>
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
        {/* Merge button section - hide for single segments */}
        {hasSegments && segmentCount !== 1 && (
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
            ) : null}
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