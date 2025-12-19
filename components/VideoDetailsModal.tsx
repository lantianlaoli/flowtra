'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, Check, ChevronDown, ChevronUp, Clock, Coins, Settings, FileText, AlertCircle } from 'lucide-react';
import VideoPlayer from '@/components/ui/VideoPlayer';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { VideoModel } from '@/lib/constants';

// Type definitions matching HistoryPage
interface CompetitorUgcReplicationItem {
  id: string;
  coverImageUrl?: string;
  videoUrl?: string;
  coverAspectRatio?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  imagePrompt?: string;
  videoModel: VideoModel;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'competitor-ugc-replication';
  videoAspectRatio?: string;
  isSegmented?: boolean;
  segmentCount?: number;
  videoDuration?: string;
  videoQuality?: string;
  language?: string;
  customScript?: string;
  useCustomScript?: boolean;
  videoPrompts?: any;
}

interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  coverAspectRatio?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: 'veo3' | 'veo3_fast' | 'sora2';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'character';
  videoDurationSeconds?: number;
  videoAspectRatio?: string;
  language?: string;
  customDialogue?: string;
  generatedPrompts?: any;
}

interface WatermarkRemovalItem {
  id: string;
  originalVideoUrl: string;
  videoUrl?: string;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  adType: 'watermark-removal';
  errorMessage?: string;
  completedAt?: string;
}

type HistoryItem = CompetitorUgcReplicationItem | CharacterAdsItem | WatermarkRemovalItem;

interface VideoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: HistoryItem | null;
  onDownload: (id: string, videoModel: VideoModel) => Promise<void>;
  isDownloading: boolean;
}

// Helper function to check ad types
const isCompetitorUgcReplication = (item: HistoryItem): item is CompetitorUgcReplicationItem => {
  return item.adType === 'competitor-ugc-replication';
};

const isCharacterAds = (item: HistoryItem): item is CharacterAdsItem => {
  return item.adType === 'character';
};

const isWatermarkRemoval = (item: HistoryItem): item is WatermarkRemovalItem => {
  return item.adType === 'watermark-removal';
};

// Helper function: Get model display name
const getModelDisplayName = (model: VideoModel): string => {
  const modelNames: Record<VideoModel, string> = {
    'veo3': 'Veo3 High Quality',
    'veo3_fast': 'Veo3 Fast',
    'sora2': 'Sora2',
    'sora2_pro': 'Sora2 Pro',
    'grok': 'Grok',
    'kling_2_6': 'Kling 2.6'
  };
  return modelNames[model] || model;
};

// Helper function: Format duration
const formatDuration = (item: HistoryItem): string => {
  if (isWatermarkRemoval(item)) {
    return 'N/A';
  }

  if (isCharacterAds(item)) {
    return `${item.videoDurationSeconds || 8} seconds`;
  }

  if (isCompetitorUgcReplication(item)) {
    if (item.isSegmented && item.segmentCount) {
      return `${item.segmentCount} segments × 8s`;
    }
    return `${item.videoDuration || '8'} seconds`;
  }

  return 'N/A';
};

// Helper function: Format aspect ratio
const formatAspectRatio = (item: HistoryItem): string => {
  if (isWatermarkRemoval(item)) {
    return 'N/A';
  }

  const ratio = 'videoAspectRatio' in item ? item.videoAspectRatio : undefined;
  return ratio || '9:16';
};

// Helper function: Format date
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Helper function: Calculate processing time
const calculateProcessingTime = (created: string, completed?: string): string => {
  const start = new Date(created).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  const durationMs = end - start;

  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export default function VideoDetailsModal({ isOpen, onClose, item, onDownload, isDownloading }: VideoDetailsModalProps) {
  const [promptsExpanded, setPromptsExpanded] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDownloading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isDownloading, onClose]);

  if (!item) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDownloading) {
      onClose();
    }
  };

  const handleDownloadClick = async () => {
    if (!item.videoUrl || item.status !== 'completed') return;

    if (isWatermarkRemoval(item)) {
      await onDownload(item.id, 'sora2'); // Watermark removal uses sora2
    } else if (isCompetitorUgcReplication(item) || isCharacterAds(item)) {
      await onDownload(item.id, item.videoModel);
    }
  };

  // Get prompts content
  const getPromptsContent = () => {
    if (isWatermarkRemoval(item)) {
      return null;
    }

    if (isCompetitorUgcReplication(item)) {
      if (item.useCustomScript && item.customScript) {
        return {
          type: 'Custom Script',
          content: item.customScript
        };
      }
      if (item.videoPrompts) {
        return {
          type: 'AI Generated Prompts',
          content: JSON.stringify(item.videoPrompts, null, 2)
        };
      }
    }

    if (isCharacterAds(item)) {
      if (item.customDialogue) {
        return {
          type: 'Custom Dialogue',
          content: item.customDialogue
        };
      }
      if (item.generatedPrompts) {
        return {
          type: 'AI Generated Prompts',
          content: JSON.stringify(item.generatedPrompts, null, 2)
        };
      }
    }

    return null;
  };

  const promptsContent = getPromptsContent();
  const canDownload = item.status === 'completed' && item.videoUrl;

  // Calculate left panel width based on aspect ratio
  const getLeftPanelWidth = () => {
    const ratio = formatAspectRatio(item);
    const normalized = ratio.toLowerCase();

    if (normalized === '16:9' || normalized === 'landscape') {
      return 'w-[640px]'; // Wide for horizontal videos
    } else if (normalized === '1:1' || normalized === 'square') {
      return 'w-[480px]'; // Medium for square
    } else {
      // 9:16 or portrait (default)
      return 'w-[360px]'; // Narrow for vertical videos
    }
  };

  const leftPanelWidth = getLeftPanelWidth();

  // Get aspect ratio class for video container
  const getAspectRatioClass = () => {
    const ratio = formatAspectRatio(item);
    const normalized = ratio.toLowerCase();

    if (normalized === '16:9' || normalized === 'landscape') {
      return 'aspect-[16/9]';
    } else if (normalized === '1:1' || normalized === 'square') {
      return 'aspect-square';
    } else {
      // 9:16 or portrait (default)
      return 'aspect-[9/16]';
    }
  };

  const aspectRatioClass = getAspectRatioClass();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Card */}
          <motion.div
            className="relative bg-white rounded-lg shadow-xl border border-[#E5E5E5] w-full max-w-[1280px] h-[90vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold text-black">Video Details</h3>
              <button
                onClick={onClose}
                disabled={isDownloading}
                className="text-[#666666] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Split Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT: Video Preview */}
              <div className={cn(leftPanelWidth, "shrink-0 bg-[#F7F7F7] border-r border-[#E5E5E5] flex flex-col overflow-y-auto")}>
                <div className="p-6 space-y-4">
                  {/* Video Player */}
                  <div className={cn("relative bg-black rounded-lg overflow-hidden", aspectRatioClass)}>
                    {isWatermarkRemoval(item) ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black text-white">
                        <div className="text-center space-y-3 px-4">
                          <AlertCircle className="w-8 h-8 mx-auto" />
                          <p className="text-sm">Preview unavailable for watermark removal</p>
                        </div>
                      </div>
                    ) : item.status === 'completed' && item.videoUrl ? (
                      <VideoPlayer
                        src={item.videoUrl}
                        className="w-full h-full object-contain"
                        autoPlay={false}
                        loop={true}
                        playsInline={true}
                        showControls={true}
                      />
                    ) : 'coverImageUrl' in item && item.coverImageUrl ? (
                      <div className="absolute inset-0">
                        <Image
                          src={item.coverImageUrl}
                          alt="Cover"
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#E5E5E5]">
                        <p className="text-[#666666] text-sm">No preview available</p>
                      </div>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border',
                        item.status === 'completed' && 'bg-black text-white border-black',
                        item.status === 'processing' && 'bg-white text-black border-[#E5E5E5]',
                        item.status === 'failed' && 'bg-white text-black border-black'
                      )}
                    >
                      {item.status === 'completed' && 'Completed'}
                      {item.status === 'processing' && `Processing ${'progress' in item ? (item.progress || 0) : 0}%`}
                      {item.status === 'failed' && 'Failed'}
                    </span>
                  </div>

                  {/* Quick Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[#666666]">Aspect Ratio</span>
                      <span className="font-medium text-black">{formatAspectRatio(item)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#666666]">Duration</span>
                      <span className="font-medium text-black">{formatDuration(item)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Details (Scrollable) */}
              <div className="flex-1 overflow-y-auto bg-white">
                <div className="p-6 space-y-6">

                  {/* Generation Parameters Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-black">
                      <Settings className="w-5 h-5" />
                      <h4 className="font-semibold">Generation Parameters</h4>
                    </div>
                    <div className="space-y-2 text-sm border border-[#E5E5E5] rounded-lg p-4 bg-[#F7F7F7]">
                      {!isWatermarkRemoval(item) && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Video Model</span>
                            <span className="font-medium text-black">
                              {isCompetitorUgcReplication(item) || isCharacterAds(item)
                                ? getModelDisplayName(item.videoModel)
                                : 'Sora2'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Duration</span>
                            <span className="font-medium text-black">{formatDuration(item)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Aspect Ratio</span>
                            <span className="font-medium text-black">{formatAspectRatio(item)}</span>
                          </div>
                        </>
                      )}

                      {isCompetitorUgcReplication(item) && item.language && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Language</span>
                          <span className="font-medium text-black">{item.language.toUpperCase()}</span>
                        </div>
                      )}

                      {isCharacterAds(item) && item.language && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Language</span>
                          <span className="font-medium text-black">{item.language.toUpperCase()}</span>
                        </div>
                      )}

                      {isCompetitorUgcReplication(item) && item.videoQuality && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Quality</span>
                          <span className="font-medium text-black capitalize">{item.videoQuality}</span>
                        </div>
                      )}

                      {isCompetitorUgcReplication(item) && item.isSegmented && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Segments</span>
                          <span className="font-medium text-black">{item.segmentCount || 1} segments</span>
                        </div>
                      )}

                      {isWatermarkRemoval(item) && (
                        <div className="flex justify-between">
                          <span className="text-[#666666]">Service</span>
                          <span className="font-medium text-black">Sora2 Watermark Removal</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credit Details Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-black">
                      <Coins className="w-5 h-5" />
                      <h4 className="font-semibold">Credit Details</h4>
                    </div>
                    <div className="space-y-2 text-sm border border-[#E5E5E5] rounded-lg p-4 bg-[#F7F7F7]">
                      {isWatermarkRemoval(item) ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Service Cost</span>
                            <span className="font-medium text-black">{item.creditsUsed} credits</span>
                          </div>
                          <div className="flex justify-between border-t border-[#E5E5E5] pt-2">
                            <span className="font-medium text-black">Total Used</span>
                            <span className="font-bold text-black">{item.creditsUsed} credits</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Generation Cost</span>
                            <span className="font-medium text-black">
                              {'generationCreditsUsed' in item ? item.generationCreditsUsed || 0 : 0} credits
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Download Cost</span>
                            <span className="font-medium text-black">0 credits (FREE)</span>
                          </div>
                          <div className="flex justify-between border-t border-[#E5E5E5] pt-2">
                            <span className="font-medium text-black">Total Used</span>
                            <span className="font-bold text-black">{item.creditsUsed} credits</span>
                          </div>
                          {'downloaded' in item && item.downloaded && (
                            <div className="flex items-center gap-2 text-[#666666] text-xs pt-2 border-t border-[#E5E5E5]">
                              <Check className="w-3.5 h-3.5" />
                              <span>Downloaded</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time Information Section */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-black">
                      <Clock className="w-5 h-5" />
                      <h4 className="font-semibold">Time Information</h4>
                    </div>
                    <div className="space-y-2 text-sm border border-[#E5E5E5] rounded-lg p-4 bg-[#F7F7F7]">
                      <div className="flex justify-between">
                        <span className="text-[#666666]">Created</span>
                        <span className="font-medium text-black">{formatDateTime(item.createdAt)}</span>
                      </div>
                      {item.status === 'completed' && (
                        <>
                          {isWatermarkRemoval(item) && item.completedAt && (
                            <div className="flex justify-between">
                              <span className="text-[#666666]">Completed</span>
                              <span className="font-medium text-black">{formatDateTime(item.completedAt)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[#666666]">Processing Time</span>
                            <span className="font-medium text-black">
                              {calculateProcessingTime(
                                item.createdAt,
                                isWatermarkRemoval(item) ? item.completedAt : undefined
                              )}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Error Message (if failed) */}
                  {item.status === 'failed' && 'errorMessage' in item && item.errorMessage && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-black">
                        <AlertCircle className="w-5 h-5" />
                        <h4 className="font-semibold">Error Details</h4>
                      </div>
                      <div className="text-sm border border-black rounded-lg p-4 bg-white">
                        <p className="text-[#666666] leading-relaxed">{item.errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* AI Prompts/Scripts Section (Collapsible) */}
                  {promptsContent && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setPromptsExpanded(!promptsExpanded)}
                        className="flex items-center justify-between w-full text-black hover:text-black/80 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          <h4 className="font-semibold">{promptsContent.type}</h4>
                        </div>
                        {promptsExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>

                      {promptsExpanded && (
                        <div className="text-sm border border-[#E5E5E5] rounded-lg p-4 bg-[#F7F7F7]">
                          <pre className="whitespace-pre-wrap text-[#666666] leading-relaxed font-mono text-xs overflow-x-auto">
                            {promptsContent.content}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E5E5E5] flex items-center justify-end gap-3 flex-shrink-0 bg-white">
              <button
                onClick={onClose}
                disabled={isDownloading}
                className="px-4 py-2.5 border border-[#E5E5E5] text-black rounded-lg hover:border-black transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Close
              </button>
              <button
                onClick={handleDownloadClick}
                disabled={!canDownload || isDownloading || item.status === 'processing'}
                className={cn(
                  "px-4 py-2.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  canDownload && !isDownloading
                    ? "bg-black text-white hover:bg-black/90"
                    : "bg-[#E5E5E5] text-[#666666]"
                )}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Downloading...</span>
                  </>
                ) : 'downloaded' in item && item.downloaded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Video</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
