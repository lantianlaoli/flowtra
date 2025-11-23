'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { CheckCircle, XCircle, Loader2, Download, Play, X, Boxes } from 'lucide-react';
import { getDownloadCost, type VideoModel } from '@/lib/constants';

export interface Generation {
  id: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  stage?: string; // e.g., "Generating cover image...", "Creating video..."
  videoUrl?: string;
  coverUrl?: string;
  platform?: string;
  brand?: string;
  product?: string;
  error?: string;
  videoModel?: VideoModel;
  downloaded?: boolean;
  isDownloading?: boolean;
  segmentCount?: number | null;
  videoDuration?: string | null;
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
  onRetry?: (generation: Generation) => void;
  emptyStateSteps?: EmptyStateStep[];
  emptyStateRightContent?: React.ReactNode;
}

export default function GenerationProgressDisplay({
  generations,
  onDownload,
  onRetry,
  emptyStateSteps,
  emptyStateRightContent,
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
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">
          {/* Left Side: Steps */}
          <div className="flex-1 max-w-md">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                Get started
              </h3>
              <p className="text-sm text-gray-500">
                Follow these steps to create your first video
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {steps.map((step, index) => (
                <div key={step.title} className="flex items-start gap-3 py-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs font-medium text-gray-400">
                    {index + 1}.
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/dashboard/assets"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Go to Assets
            </Link>
          </div>

          {/* Right Side: Video Tutorial */}
          {emptyStateRightContent && (
            <div className="flex-1 max-w-sm">
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
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}

interface GenerationCardProps {
  generation: Generation;
  onDownload?: (generation: Generation) => void;
  onRetry?: (generation: Generation) => void;
}

function GenerationCard({ generation, onDownload, onRetry }: GenerationCardProps) {
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
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'pending':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'processing':
        return stage || 'Processing...';
      case 'pending':
        return 'Queued';
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
        {(status === 'processing' || status === 'pending') && (
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

        {/* Error message */}
        {status === 'failed' && error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {error}
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

        {/* Actions */}
        {status === 'failed' && onRetry && (
          <div className="flex items-center justify-end">
            <button
              onClick={() => onRetry(generation)}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-full hover:bg-gray-800"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
