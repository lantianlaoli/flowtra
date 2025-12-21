'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, Check } from 'lucide-react';
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
  errorMessage?: string;
}

interface AvatarAdsItem {
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
  errorMessage?: string;
}

type HistoryItem = CompetitorUgcReplicationItem | AvatarAdsItem;

interface VideoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: HistoryItem | null;
  onDownload: (id: string, videoModel: VideoModel) => Promise<void>;
  isDownloading: boolean;
}

// Helper functions
const isCompetitorUgcReplication = (item: HistoryItem): item is CompetitorUgcReplicationItem => {
  return item.adType === 'competitor-ugc-replication';
};

const isCharacterAds = (item: HistoryItem): item is AvatarAdsItem => {
  return item.adType === 'character';
};

const getModelDisplayName = (model: string): string => {
  // Handle both current and legacy models for display purposes
  const modelNames: Record<string, string> = {
    'veo3': 'Veo3.1',
    'veo3_fast': 'Veo3.1 fast',
    'sora2': 'Sora2 (Legacy)',
    'sora2_pro': 'Sora2 Pro (Legacy)',
    'grok': 'Grok (Legacy)',
    'kling_2_6': 'Kling 2.6 (Legacy)'
  };
  return modelNames[model] || model;
};

const formatDuration = (item: HistoryItem): string => {
  if (isCharacterAds(item)) {
    return `${item.videoDurationSeconds || 8}s`;
  }
  if (isCompetitorUgcReplication(item)) {
    if (item.isSegmented && item.segmentCount) {
      const totalSeconds = item.segmentCount * 8;
      return `${totalSeconds}s`;
    }
    return `${item.videoDuration || '8'}s`;
  }
  return 'N/A';
};

const formatAspectRatio = (item: HistoryItem): string => {
  const ratio = 'videoAspectRatio' in item ? item.videoAspectRatio : undefined;
  return ratio || '9:16';
};

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

export default function VideoDetailsModal({ isOpen, onClose, item, onDownload, isDownloading }: VideoDetailsModalProps) {
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
    if (isCompetitorUgcReplication(item) || isCharacterAds(item)) {
      // Normalize legacy models for download
      const normalizedModel: VideoModel = (item.videoModel === 'sora2' ? 'veo3_fast' : item.videoModel) as VideoModel;
      await onDownload(item.id, normalizedModel);
    }
  };

  // Get prompts content with better formatting
  const getPromptsContent = () => {
    if (isCompetitorUgcReplication(item)) {
      if (item.useCustomScript && item.customScript) {
        return {
          type: 'custom-script',
          title: 'Custom Script',
          data: item.customScript
        };
      }
      if (item.videoPrompts) {
        return {
          type: 'ugc-prompts',
          title: 'AI Generated Video Prompts',
          data: item.videoPrompts
        };
      }
    }

    if (isCharacterAds(item)) {
      if (item.customDialogue) {
        return {
          type: 'custom-dialogue',
          title: 'Custom Dialogue',
          data: item.customDialogue
        };
      }
      if (item.generatedPrompts) {
        return {
          type: 'character-prompts',
          title: 'AI Generated Character Prompts',
          data: item.generatedPrompts
        };
      }
    }

    return null;
  };

  const promptsContent = getPromptsContent();

  // Render formatted prompts based on type
  const renderPromptContent = () => {
    if (!promptsContent) return null;

    // Custom text (script or dialogue)
    if (promptsContent.type === 'custom-script' || promptsContent.type === 'custom-dialogue') {
      return (
        <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
          <div className="p-6 max-h-[calc(90vh-300px)] overflow-y-auto">
            <p className="text-sm leading-relaxed text-black whitespace-pre-wrap">
              {promptsContent.data}
            </p>
          </div>
        </div>
      );
    }

    // UGC Replication Prompts - Segment-based structure
    if (promptsContent.type === 'ugc-prompts') {
      const data = promptsContent.data;
      const segments = data?.segments || [];

      return (
        <div className="space-y-4">
          {segments.map((segment: any, segmentIdx: number) => (
            <div key={segmentIdx} className="border border-[#E5E5E5] rounded-lg bg-white overflow-hidden">
              <div className="bg-[#F7F7F7] px-4 py-3 border-b border-[#E5E5E5]">
                <h4 className="text-sm font-semibold text-black">
                  Segment {segmentIdx + 1}
                </h4>
              </div>

              <div className="p-4 space-y-3">
                {/* Shots - Only show dialogue */}
                {segment.shots && segment.shots.length > 0 && (
                  <div className="space-y-3">
                    {segment.shots.map((shot: any, shotIdx: number) => (
                      <div key={shotIdx} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[#666666]">Shot {shot.id}</span>
                          {shot.time_range && (
                            <>
                              <span className="text-[#E5E5E5]">•</span>
                              <span className="text-xs text-[#666666]">{shot.time_range}</span>
                            </>
                          )}
                        </div>

                        {shot.dialogue && (
                          <p className="text-sm text-black leading-relaxed pl-4 border-l-2 border-[#E5E5E5]">
                            {shot.dialogue}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Character Ads Prompts - Scene-based structure
    if (promptsContent.type === 'character-prompts') {
      const data = promptsContent.data;
      const scenes = data?.scenes || [];

      return (
        <div className="space-y-3">
          {/* Video Scenes - Only show dialogue */}
          {scenes.map((scene: any, idx: number) => {
            const prompt = scene.prompt || {};
            return (
              <div key={idx} className="space-y-2">
                <div className="text-xs font-semibold text-[#666666]">
                  Scene {scene.scene}
                </div>

                {prompt.video_prompt && (
                  <p className="text-sm text-black leading-relaxed pl-4 border-l-2 border-[#E5E5E5]">
                    {prompt.video_prompt.replace('dialogue, the character in the video says: ', '').replace(/^["']|["']$/g, '')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };
  const canDownload = item.status === 'completed' && item.videoUrl;

  // Aspect ratio class - ensure video fills container properly
  const getAspectRatioClass = () => {
    const ratio = formatAspectRatio(item);
    if (ratio === '16:9') return 'aspect-video';
    if (ratio === '1:1') return 'aspect-square';
    return 'aspect-[9/16]';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-[1400px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-[#E5E5E5]">
              <h2 className="text-xl font-semibold text-black tracking-tight">
                {isCharacterAds(item) ? 'Character Ad' : 'UGC Clone'} Details
              </h2>
              <button
                onClick={onClose}
                disabled={isDownloading}
                className="p-2 rounded-lg hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-black" />
              </button>
            </div>

            {/* Content - Split Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT: Video Preview Only - No Download Button */}
              <div className="w-[35%] bg-[#F7F7F7] flex items-center justify-center p-6">
                <div className={cn(
                  "relative w-full max-w-sm rounded-lg overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
                  getAspectRatioClass()
                )}>
                  {item.status === 'completed' && item.videoUrl ? (
                    <VideoPlayer
                      src={item.videoUrl}
                      className="absolute inset-0 w-full h-full object-contain bg-black"
                      autoPlay={false}
                      loop={true}
                      playsInline={true}
                      showControls={true}
                    />
                  ) : 'coverImageUrl' in item && item.coverImageUrl ? (
                    <Image
                      src={item.coverImageUrl}
                      alt="Cover"
                      fill
                      className="object-contain bg-black"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                      <p className="text-[#666666] text-sm font-medium">No preview</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Prompts-First Layout */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-8 space-y-5">

                  {/* Compact Parameters Card */}
                  <div className="border border-[#E5E5E5] rounded-lg p-4 bg-[#FAFAFA]">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-black uppercase tracking-wide">Quick Info</h3>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                          item.status === 'completed' && 'bg-black text-white',
                          item.status === 'processing' && 'bg-white text-black border border-[#E5E5E5]',
                          item.status === 'failed' && 'bg-white text-black border border-black'
                        )}
                      >
                        {item.status === 'completed' && <Check className="w-3 h-3" />}
                        {item.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {item.status === 'completed' && 'Completed'}
                        {item.status === 'processing' && `${item.progress || 0}%`}
                        {item.status === 'failed' && 'Failed'}
                      </span>
                    </div>

                    {/* Compact Grid */}
                    <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
                      <CompactParam label="Model" value={getModelDisplayName(item.videoModel)} />
                      <CompactParam label="Ratio" value={formatAspectRatio(item)} />
                      <CompactParam label="Duration" value={formatDuration(item)} />

                      {(isCompetitorUgcReplication(item) || isCharacterAds(item)) && item.language && (
                        <CompactParam label="Language" value={item.language.toUpperCase()} />
                      )}
                      {isCompetitorUgcReplication(item) && item.videoQuality && (
                        <CompactParam label="Quality" value={item.videoQuality} capitalize />
                      )}

                      <CompactParam label="Credits" value={`${item.creditsUsed}`} />
                      <CompactParam
                        label="Created"
                        value={formatDateTime(item.createdAt).split(',')[0]}
                        className="col-span-2"
                      />
                    </div>
                  </div>

                  {/* Main Content: AI Prompts - Takes Most Space */}
                  {promptsContent && (
                    <section className="space-y-3">
                      <h3 className="text-base font-semibold text-black tracking-tight">
                        {promptsContent.title}
                      </h3>

                      {/* Render formatted content */}
                      <div>
                        {renderPromptContent()}
                      </div>
                    </section>
                  )}

                  {/* Error Details - Only if Failed */}
                  {item.status === 'failed' && 'errorMessage' in item && item.errorMessage && (
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-black tracking-tight">Error Details</h3>
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <p className="text-xs text-red-800 leading-relaxed">{item.errorMessage}</p>
                      </div>
                    </section>
                  )}

                </div>

                {/* Fixed Download Button at Bottom Right */}
                {canDownload && (
                  <div className="border-t border-[#E5E5E5] bg-white px-8 py-4">
                    <div className="flex justify-end">
                      <button
                        onClick={handleDownloadClick}
                        disabled={isDownloading}
                        className={cn(
                          'flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all shadow-sm',
                          !isDownloading
                            ? 'bg-black text-white hover:bg-black/90 hover:shadow-md'
                            : 'bg-[#E5E5E5] text-[#666666] cursor-not-allowed'
                        )}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Download Video
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Compact parameter display component
function CompactParam({
  label,
  value,
  capitalize,
  className
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[#666666] font-medium mb-0.5">{label}</span>
      <span className={cn(
        'text-black font-semibold',
        capitalize && 'capitalize'
      )}>
        {value}
      </span>
    </div>
  );
}
