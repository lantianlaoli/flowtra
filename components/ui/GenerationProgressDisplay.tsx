'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Download, Play, X } from 'lucide-react';
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
}

interface GenerationProgressDisplayProps {
  generations: Generation[];
  onDownload?: (generation: Generation) => void;
  onRetry?: (generation: Generation) => void;
}

export default function GenerationProgressDisplay({
  generations,
  onDownload,
  onRetry,
}: GenerationProgressDisplayProps) {
  // Empty state
  if (generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Play className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Ready to Create Amazing Videos
        </h3>
        <p className="text-gray-500 max-w-md">
          Select your platform, brand, product, and hit generate to create your first video.
        </p>
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
  const { status, progress = 0, stage, videoUrl, coverUrl, platform, brand, product, error, videoModel, isDownloading, downloaded } = generation;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const downloadMetaLabel = useMemo(() => {
    if (downloaded) return 'Downloaded';
    if (!videoModel) {
      return 'Cost pending';
    }
    const cost = getDownloadCost(videoModel);
    return cost === 0 ? 'Free' : `${cost} credits`;
  }, [videoModel, downloaded]);

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
        <div className="flex items-start justify-between mb-3 gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getStatusIcon()}
              <span className="text-sm font-medium text-gray-900">
                {getStatusText()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
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
                  className={`inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-900 rounded-full text-xs font-semibold shadow-sm transition-colors ${downloaded ? 'opacity-70 cursor-default' : isDownloading ? 'opacity-60 cursor-wait' : 'hover:border-gray-300 cursor-pointer'}`}
                  title={downloaded ? 'Already downloaded' : `Download (${downloadMetaLabel})`}
                  disabled={isDownloading || downloaded}
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-pulse' : ''}`} />
                  <span>{isDownloading ? 'Downloading…' : downloadMetaLabel}</span>
                </button>
              ) : (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 bg-white text-gray-900 rounded-full text-xs font-semibold shadow-sm hover:border-gray-300 transition-colors cursor-pointer"
                  title={`Download (${downloadMetaLabel})`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{downloadMetaLabel}</span>
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
                <img
                  src={coverUrl}
                  alt="Video cover"
                  className="w-full h-full object-contain"
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
