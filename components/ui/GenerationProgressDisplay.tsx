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
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Side: Steps */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Get Started in 3 Easy Steps
            </h3>

            <ol className="w-full space-y-4 max-w-md">
              {steps.map((step) => (
                <li key={step.title} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-2xl" aria-hidden>
                    {step.icon}
                  </span>
                  <div className="text-left">
                    <strong className="block text-gray-900 font-semibold mb-1">{step.title}</strong>
                    <span className="text-gray-600 text-sm leading-relaxed">{step.description}</span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="pt-2">
              <Link
                href="/dashboard/assets"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium"
              >
                <Boxes className="w-5 h-5" />
                Go to Assets
              </Link>
            </div>
          </div>

          {/* Right Side: TikTok Video */}
          <div className="flex justify-center w-full">
            <div className="w-full flex justify-center lg:justify-end">
              {emptyStateRightContent || (
                <blockquote
                  className="tiktok-embed"
                  cite="https://www.tiktok.com/@laolilantian/video/7575430395320192263"
                  data-video-id="7575430395320192263"
                  style={{ maxWidth: '605px', minWidth: '325px' }}
                >
                  <section>
                    <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">@laolilantian</a>{' '}
                    Standard Advertising Demo Latest November 2025{' '}
                    <a title="gemini" target="_blank" href="https://www.tiktok.com/tag/gemini?refer=embed">#gemini</a>{' '}
                    <a title="ugc" target="_blank" href="https://www.tiktok.com/tag/ugc?refer=embed">#UGC</a>{' '}
                    <a title="ai" target="_blank" href="https://www.tiktok.com/tag/ai?refer=embed">#ai</a>{' '}
                    <a title="nanobanana2" target="_blank" href="https://www.tiktok.com/tag/nanobanana2?refer=embed">#nanobanana2</a>{' '}
                    <a title="aimarket" target="_blank" href="https://www.tiktok.com/tag/aimarket?refer=embed">#aimarket</a>{' '}
                    <a target="_blank" title="♬ original sound - Lantian laoli" href="https://www.tiktok.com/music/original-sound-7575430470718524167?refer=embed">♬ original sound - Lantian laoli</a>
                  </section>
                </blockquote>
              )}
            </div>
          </div>
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
