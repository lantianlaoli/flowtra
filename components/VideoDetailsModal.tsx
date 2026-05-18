'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Loader2, Check, ChevronDown, ChevronUp, User, MessageSquare, Music, Play, Sparkles, Layout, Camera, Clock, Eye, Video, Sun, Cpu, Maximize, Languages, Coins, Calendar, Film, ThumbsUp, ThumbsDown, Send, ArrowLeft, AlertCircle } from 'lucide-react';
import VideoPlayer from '@/components/ui/VideoPlayer';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { HIGH_RES_DOWNLOAD_COSTS, type HighResResolution, type VideoModel } from '@/lib/constants';
import { MY_ADS_RETENTION_DAYS } from '@/lib/my-ads-retention';
import TikTokPublishDialog from '@/components/TikTokPublishDialog';
import { getVideoModelDisplayName } from '@/lib/video-model-display-name';

// Type definitions matching HistoryPage
interface VideoCloneItem {
  id: string;
  coverImageUrl?: string;
  videoUrl?: string;
  videoUrl1080p?: string;
  videoUrl4k?: string;
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
  adType: 'video-clone';
  videoAspectRatio?: string;
  isSegmented?: boolean;
  segmentCount?: number;
  videoDuration?: string;
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
  videoUrl1080p?: string;
  videoUrl4k?: string;
  coverAspectRatio?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: VideoModel;
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

interface MotionCloneItem {
  id: string;
  coverImageUrl?: string;
  videoUrl?: string;
  coverAspectRatio?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: VideoModel;
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'motion-clone';
  videoAspectRatio?: string;
  videoDurationSeconds?: number;
  quality?: string;
  photoPrompt?: string;
  videoPrompt?: string;
  errorMessage?: string;
}

type HistoryItem = VideoCloneItem | AvatarAdsItem | MotionCloneItem;

interface VideoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: HistoryItem | null;
  onDownload: (item: HistoryItem, resolution: HighResResolution) => Promise<'ready' | 'processing' | 'error'>;
  isDownloading: boolean;
  isExpired: boolean;
  embedded?: boolean;
}

// Helper functions
const isVideoClone = (item: HistoryItem | null): item is VideoCloneItem => {
  return !!item && item.adType === 'video-clone';
};

const isCharacterAds = (item: HistoryItem | null): item is AvatarAdsItem => {
  return !!item && item.adType === 'character';
};

const isMotionClone = (item: HistoryItem | null): item is MotionCloneItem => {
  return !!item && item.adType === 'motion-clone';
};


const getProjectModelDisplayName = (item: HistoryItem): string => {
  if (isMotionClone(item) && item.videoModel === 'kling_3') {
    return getVideoModelDisplayName(item.videoModel, { feature: 'motion_clone' });
  }

  return getVideoModelDisplayName(item.videoModel);
};

const getStatusLabel = (status: HistoryItem['status']): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'processing':
      return 'Processing';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

const getStatusBadgeLabel = (item: HistoryItem): string => {
  if (item.status === 'processing' && typeof item.progress === 'number') {
    const progress = Math.max(0, Math.min(100, Math.round(item.progress)));
    return `Status: Processing ${progress}%`;
  }

  return `Status: ${getStatusLabel(item.status)}`;
};

const getQualityDisplayValue = (item: HistoryItem): string | null => {
  if (isMotionClone(item)) {
    return item.quality?.toUpperCase() || '720P';
  }

  return null;
};

const formatDuration = (item: HistoryItem): string => {
  if (isCharacterAds(item)) {
    return item.videoDurationSeconds ? `${item.videoDurationSeconds}s` : 'N/A';
  }
  if (isVideoClone(item)) {
    return item.videoDuration
      ? `${item.videoDuration}s`
      : item.isSegmented && item.segmentCount
        ? `${item.segmentCount * 15}s`
        : 'N/A';
  }
  if (isMotionClone(item)) {
    return item.videoDurationSeconds ? `${item.videoDurationSeconds}s` : 'N/A';
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

const parseDurationSeconds = (value?: string): number | null => {
  if (!value) return null;
  const match = value.match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const getVideoDurationSeconds = (item: HistoryItem | null): number | null => {
  if (!item) return null;
  if (isCharacterAds(item)) {
    return item.videoDurationSeconds ?? null;
  }
  if (isVideoClone(item)) {
    const explicitDuration = parseDurationSeconds(item.videoDuration);
    if (explicitDuration) return explicitDuration;
    if (item.isSegmented && item.segmentCount) return item.segmentCount * 15;
    return null;
  }
  if (isMotionClone(item)) {
    return item.videoDurationSeconds ?? null;
  }
  return null;
};

export default function VideoDetailsModal({ isOpen, onClose, item, onDownload, isDownloading, isExpired, embedded = false }: VideoDetailsModalProps) {
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set());
  const [selectedResolution, setSelectedResolution] = useState<HighResResolution>('720p');
  const [resolutionMenuOpen, setResolutionMenuOpen] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showTikTokPanel, setShowTikTokPanel] = useState(false);
  const isNativeOnlyModel = item?.videoModel === 'seedance_2_fast' || item?.videoModel === 'seedance_2' || item?.videoModel === 'kling_3';

  const toggleShot = (shotKey: string) => {
    setExpandedShots(prev => {
      const next = new Set(prev);
      if (next.has(shotKey)) {
        next.delete(shotKey);
      } else {
        next.add(shotKey);
      }
      return next;
    });
  };

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDownloading) {
      onClose();
    }
  };

  const handleDownloadClick = async () => {
    if (!item) return;
    if (!item.videoUrl || item.status !== 'completed') return;
    if (isVideoClone(item) || isCharacterAds(item) || isMotionClone(item)) {
      setIsPreparing(true);
      const status = await onDownload(item, selectedResolution);
      if (status !== 'processing') {
        setIsPreparing(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setResolutionMenuOpen(false);
      setShowTikTokPanel(false);
    }
  }, [isOpen]);

  // Get prompts content with better formatting
  const getPromptsContent = () => {
    if (isVideoClone(item)) {
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

    if (isMotionClone(item)) {
      return {
        type: 'motion-clone-prompts',
        title: 'Motion Clone Prompts',
        data: {
          photoPrompt: item.photoPrompt || '',
          videoPrompt: item.videoPrompt || ''
        }
      };
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
        <div className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-white shadow-sm">
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
        <div className="space-y-6">
          {segments.map((segment: any, segmentIdx: number) => (
            <div key={segmentIdx} className="border border-[#E5E5E5] rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="bg-black px-5 py-3.5 border-b border-black flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Film className="w-4 h-4 text-white/70" />
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                    Segment {segmentIdx + 1}
                  </h4>
                </div>
                <div className="flex gap-2">
                   <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded uppercase font-bold tracking-tighter">AI Analysis</span>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {typeof segment.first_frame_description === 'string' && segment.first_frame_description.trim() && (
                  <div className="bg-[#F7F7F7] rounded-lg p-4 border border-[#E5E5E5]">
                    <div className="flex items-center gap-2 mb-2 text-black">
                      <Camera className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">First Frame</span>
                    </div>
                    <p className="text-sm text-black leading-relaxed">
                      {segment.first_frame_description}
                    </p>
                  </div>
                )}

                {/* Shots */}
                {segment.shots && segment.shots.length > 0 && (
                  <div className="space-y-3">
                    {segment.shots.map((shot: any, shotIdx: number) => {
                      const shotKey = `${segmentIdx}-${shotIdx}`;
                      const isExpanded = expandedShots.has(shotKey);
                      
                      return (
                        <div key={shotIdx} className="border border-[#E5E5E5] rounded-lg overflow-hidden transition-all bg-white hover:border-black/20">
                          {/* Shot Header - Collapsible Toggle */}
                          <div 
                            onClick={() => toggleShot(shotKey)}
                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#F7F7F7] transition-colors select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold transition-colors",
                                isExpanded ? "bg-black text-white" : "bg-[#F7F7F7] text-black"
                              )}>
                                {shot.id || shotIdx + 1}
                              </div>
                              <span className="text-sm font-semibold text-black">Shot {shot.id || shotIdx + 1}</span>
                              {shot.time_range && (
                                <span className="text-xs text-[#666666] font-mono bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {shot.time_range}
                                </span>
                              )}
                            </div>
                            <div className={cn(
                              "transition-transform duration-200",
                              isExpanded ? "rotate-180" : ""
                            )}>
                              <ChevronDown className="w-4 h-4 text-[#666666]" />
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="p-4 border-t border-[#E5E5E5] space-y-3 bg-[#FAFAFA]/50">
                                  <DetailRow icon={<Play className="w-3.5 h-3.5" />} label="Action" value={shot.action} />
                                  <DetailRow icon={<User className="w-3.5 h-3.5" />} label="Subject" value={shot.subject} />
                                  <DetailRow icon={<MessageSquare className="w-3.5 h-3.5" />} label="Dialogue" value={shot.dialogue} />
                                  <DetailRow icon={<Music className="w-3.5 h-3.5" />} label="Audio" value={shot.audio} />
                                  <DetailRow icon={<Sparkles className="w-3.5 h-3.5" />} label="Style" value={shot.style} />
                                  <DetailRow icon={<Layout className="w-3.5 h-3.5" />} label="Composition" value={shot.composition} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (promptsContent.type === 'motion-clone-prompts') {
      const data = promptsContent.data as { photoPrompt?: string; videoPrompt?: string };

      return (
        <div className="space-y-4">
          <div className="border border-[#E5E5E5] rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="bg-black px-5 py-3.5 border-b border-black flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-white/70" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">First Frame Prompt</h4>
            </div>
            <div className="p-5">
              <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">
                {data.photoPrompt || 'No prompt provided.'}
              </p>
            </div>
          </div>

          <div className="border border-[#E5E5E5] rounded-xl bg-white overflow-hidden shadow-sm">
            <div className="bg-black px-5 py-3.5 border-b border-black flex items-center gap-2.5">
              <Video className="w-4 h-4 text-white/70" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Video Prompt</h4>
            </div>
            <div className="p-5">
              <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">
                {data.videoPrompt || 'No prompt provided.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    const getPromptText = (prompt: unknown) => {
      if (typeof prompt === 'string' && prompt.trim()) return prompt;
      if (!prompt || typeof prompt !== 'object') return null;
      const promptObj = prompt as Record<string, unknown>;
      if (typeof promptObj.video_prompt === 'string' && promptObj.video_prompt.trim()) {
        return promptObj.video_prompt;
      }
      const parts: string[] = [];
      if (promptObj.subject) parts.push(`Subject: ${promptObj.subject}`);
      if (promptObj.context_environment) parts.push(`Context: ${promptObj.context_environment}`);
      if (promptObj.action) parts.push(`Action: ${promptObj.action}`);
      if (promptObj.style) parts.push(`Style: ${promptObj.style}`);
      if (promptObj.camera_motion_positioning) parts.push(`Camera: ${promptObj.camera_motion_positioning}`);
      if (promptObj.composition) parts.push(`Composition: ${promptObj.composition}`);
      if (promptObj.ambiance_color_lighting) parts.push(`Lighting: ${promptObj.ambiance_color_lighting}`);
      if (promptObj.audio) parts.push(`Audio: ${promptObj.audio}`);
      if (promptObj.dialog) parts.push(`Dialogue: ${promptObj.dialog}`);
      if (promptObj.voice_type) parts.push(`Voice: ${promptObj.voice_type}`);
      return parts.length > 0 ? parts.join('\n') : null;
    };

    const getDialogueText = (prompt: unknown) => {
      if (!prompt || typeof prompt !== 'object') return null;
      const promptObj = prompt as Record<string, unknown>;
      const dialog = typeof promptObj.dialog === 'string' ? promptObj.dialog : null;
      if (dialog && dialog.trim()) return dialog.replace(/^["']|["']$/g, '');
      const legacy = typeof promptObj.video_prompt === 'string' ? promptObj.video_prompt : null;
      if (!legacy) return null;
      const cleaned = legacy.replace('dialogue, the character in the video says: ', '').replace(/^["']|["']$/g, '');
      return cleaned.trim() ? cleaned : null;
    };

    // Character Ads Prompts - Scene-based structure
    if (promptsContent.type === 'character-prompts') {
      const data = promptsContent.data;
      const scenes = data?.scenes || [];

      return (
        <div className="space-y-4">
          {scenes.map((scene: any, idx: number) => {
            const prompt = scene.prompt || {};
            const dialogue = getDialogueText(prompt);
            const promptText = getPromptText(prompt);
              
            return (
              <div key={idx} className="border border-[#E5E5E5] rounded-xl bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#666666]" />
                    <span className="text-sm font-bold text-black uppercase tracking-wider">Scene {scene.scene ?? idx + 1}</span>
                  </div>
                </div>

                {dialogue && (
                  <div className="bg-[#F7F7F7] rounded-lg p-4 border border-[#E5E5E5] flex gap-3">
                    <MessageSquare className="w-4 h-4 text-[#666666] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-black leading-relaxed italic">
                      &ldquo;{dialogue}&rdquo;
                    </p>
                  </div>
                )}

                {promptText && (
                  <div className="border border-[#E5E5E5] rounded-lg p-4 bg-white">
                    <div className="flex items-center gap-2 mb-2 text-[#666666]">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Prompt</span>
                    </div>
                    <p className="text-sm text-black leading-relaxed whitespace-pre-wrap">
                      {promptText}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };
  const supportsHighRes = useMemo(() => {
    if (!item) return false;
    return false;
  }, [item]);

  const segmentCount = useMemo(() => {
    if (!item) return 1;
    if (isVideoClone(item)) return item.segmentCount || 1;
    if (isCharacterAds(item)) return item.videoDurationSeconds ? 1 : 0;
    return 1;
  }, [item]);

  const selectedCost = useMemo(() => {
    if (selectedResolution === '720p') return 0;
    return HIGH_RES_DOWNLOAD_COSTS[selectedResolution] * segmentCount;
  }, [selectedResolution, segmentCount]);

  useEffect(() => {
    if (!item || !supportsHighRes) {
      setSelectedResolution('720p');
    }
  }, [item, supportsHighRes]);

  useEffect(() => {
    if (!item) return;
    if (isNativeOnlyModel) {
      setSelectedResolution('720p');
      return;
    }
    setSelectedResolution('720p');
  }, [item, isNativeOnlyModel]);

  const canDownload = !!item && item.status === 'completed' && item.videoUrl && !isExpired;
  const canPublishToTikTok = useMemo(() => {
    if (!item) return false;
    return (isVideoClone(item) || isCharacterAds(item)) && item.status === 'completed' && !!item.videoUrl;
  }, [item]);
  const isHighResReady = selectedResolution === '720p'
    ? true
    : isVideoClone(item) || isCharacterAds(item)
      ? selectedResolution === '1080p'
        ? !!item.videoUrl1080p
        : !!item.videoUrl4k
      : false;
  const isButtonBusy = isDownloading || (isPreparing && !isHighResReady);
  useEffect(() => {
    if (isHighResReady) {
      setIsPreparing(false);
    }
  }, [isHighResReady]);

  if (!item) return null;
  const resolutionOptions: Array<{
    value: HighResResolution;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    note?: string;
  }> = isNativeOnlyModel
    ? [
        { value: '720p', label: '720p Native', icon: Film, note: 'Native export only' }
      ]
    : [
        { value: '720p', label: '720p Original', icon: Film },
        { value: '1080p', label: '1080p', icon: Maximize },
        { value: '4k', label: '4K Ultra', icon: Sparkles }
      ];

  // Aspect ratio class - ensure video fills container properly
  const getAspectRatioClass = () => {
    const ratio = formatAspectRatio(item);
    if (ratio === '16:9') return 'aspect-video';
    if (ratio === '1:1') return 'aspect-square';
    return 'aspect-[9/16]';
  };

  const detailsContent = isOpen && item ? (
    <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={embedded
              ? 'my-ads-details-modal relative flex h-full w-full flex-col overflow-hidden bg-white'
              : 'my-ads-details-modal relative w-full max-w-[1400px] h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden'}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`my-ads-details-header flex items-center justify-between border-b border-[#E5E5E5] ${embedded ? 'px-5 py-3.5' : 'px-8 py-5'}`}>
              <div className="flex items-center gap-3">
                {embedded ? (
                  <button
                    onClick={onClose}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E5E5] px-3 text-xs font-semibold text-black hover:bg-[#F7F7F7]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                  </button>
                ) : null}
                <h2 className={`my-ads-details-title font-semibold text-black tracking-tight ${embedded ? 'text-base' : 'text-xl'}`}>
                  {isCharacterAds(item) ? 'Character Ad' : 'UGC Clone'} Details
                </h2>
              </div>
              {!embedded ? (
                <button
                  onClick={onClose}
                  disabled={isDownloading}
                  className="my-ads-details-close p-2 rounded-lg hover:bg-[#F7F7F7] transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
              ) : null}
            </div>

            {/* Content - Split Layout */}
            <div className="flex-1 flex overflow-hidden">
              {/* LEFT: Video Preview Only - No Download Button */}
              <div className={`my-ads-details-preview bg-[#F7F7F7] flex items-center justify-center border-r border-[#E5E5E5] ${embedded ? 'w-[36%] p-5' : 'w-[40%] p-8'}`}>
                <div className={cn(
                  "my-ads-details-preview-frame relative rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-black ring-1 ring-black/5",
                  "w-full max-w-full max-h-full",
                  getAspectRatioClass()
                )}>
                  {item.status === 'completed' && item.videoUrl ? (
                    <VideoPlayer
                      src={item.videoUrl}
                      className="absolute inset-0 w-full h-full object-contain"
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
                      className="object-contain"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                      <p className="my-ads-details-muted text-[#666666] text-sm font-medium">No preview</p>
                    </div>
                  )}
                  {isExpired && (
                    <div className="absolute inset-x-4 bottom-4 rounded-xl border border-red-200/70 bg-red-50/95 px-4 py-3 text-red-700 shadow-lg backdrop-blur-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <p className="text-sm font-medium leading-relaxed">
                          This asset has expired after {MY_ADS_RETENTION_DAYS} days. You can still view it here, but downloads are disabled.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Prompts / TikTok Publish */}
              <div className="my-ads-details-content flex-1 flex flex-col overflow-hidden bg-white">
                <AnimatePresence mode="wait">
                  {!showTikTokPanel ? (
                    <motion.div
                      key="details"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className={`flex-1 overflow-y-auto space-y-5 ${embedded ? 'p-5' : 'p-8'}`}
                    >

                    {/* Compact Parameters Card */}
                      <div className="my-ads-details-card border border-[#E5E5E5] rounded-xl p-5 bg-[#FAFAFA] shadow-sm">
                      <div className="mb-4">
                        <h3 className="my-ads-details-section-title text-xs font-bold text-black uppercase tracking-wider">Project Info</h3>
                      </div>

                      {/* Compact Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                        <CompactParam 
                          icon={<Cpu className="w-3.5 h-3.5" />} 
                          label="Video Model" 
                          value={getProjectModelDisplayName(item)} 
                        />
                        <CompactParam 
                          icon={<Maximize className="w-3.5 h-3.5" />} 
                          label="Ratio" 
                          value={formatAspectRatio(item)} 
                        />
                        <CompactParam 
                          icon={<Clock className="w-3.5 h-3.5" />} 
                          label="Duration" 
                          value={formatDuration(item)} 
                        />
                        <CompactParam
                          icon={<Check className="w-3.5 h-3.5" />}
                          label="Status"
                          value={getStatusLabel(item.status)}
                        />
                        {getQualityDisplayValue(item) && (
                          <CompactParam
                            icon={<Video className="w-3.5 h-3.5" />}
                            label="Quality"
                            value={getQualityDisplayValue(item)!}
                          />
                        )}

                        {(isVideoClone(item) || isCharacterAds(item)) && item.language && (
                          <CompactParam 
                            icon={<Languages className="w-3.5 h-3.5" />} 
                            label="Language" 
                            value={item.language.toUpperCase()} 
                          />
                        )}
                        <CompactParam 
                          icon={<Coins className="w-3.5 h-3.5" />} 
                          label="Credits" 
                          value={`${item.creditsUsed}`} 
                        />
                        <CompactParam
                          icon={<Calendar className="w-3.5 h-3.5" />}
                          label="Created At"
                          value={formatDateTime(item.createdAt).split(',')[0]}
                        />
                      </div>
                    </div>

                    {/* Main Content: AI Prompts - Takes Most Space */}
                    {promptsContent && (
                      <section className="space-y-3">
                        <h3 className="my-ads-details-subtitle text-base font-semibold text-black tracking-tight">
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
                        <h3 className="my-ads-details-subtitle text-sm font-semibold text-black tracking-tight">Error Details</h3>
                        <div className="my-ads-details-error border border-red-200 rounded-lg p-4 bg-red-50">
                          <p className="my-ads-details-error-text text-xs text-red-800 leading-relaxed">{item.errorMessage}</p>
                        </div>
                      </section>
                    )}

                    </motion.div>
                  ) : (
                    <motion.div
                      key="tiktok"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 overflow-y-auto p-8"
                    >
                      <div className="mb-4 flex items-center gap-2">
                        <button
                          onClick={() => setShowTikTokPanel(false)}
                          className="my-ads-details-back my-ads-button my-ads-button--secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-black"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to details
                        </button>
                      </div>
                      <TikTokPublishDialog
                        isOpen={true}
                        onClose={() => setShowTikTokPanel(false)}
                        historyId={item.id}
                        coverImageUrl={'coverImageUrl' in item ? item.coverImageUrl : undefined}
                        videoDurationSeconds={getVideoDurationSeconds(item)}
                        isPhotoPost={isVideoClone(item) && !!item.photoOnly}
                        inline
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fixed Download Button at Bottom Right */}
                {(!showTikTokPanel && (canDownload || isExpired)) && (
                  <div className="my-ads-details-footer border-t border-[#E5E5E5] bg-white px-8 py-4">
                    <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Feedback Buttons */}
                      <div className="flex items-center gap-2">
                        <FeedbackButtons
                          projectId={item.id}
                          projectType={
                            item.adType === 'character'
                              ? 'avatar-ads'
                              : item.adType === 'video-clone'
                              ? 'video-clone'
                              : 'motion-clone'
                          }
                        />
                      </div>

                      {/* Download Controls */}
                      <div className="flex items-center gap-3">
                      {isExpired ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                          <AlertCircle className="h-4 w-4" />
                          <span>Expired after {MY_ADS_RETENTION_DAYS} days. Preview only.</span>
                        </div>
                      ) : (
                        <>
                      {canPublishToTikTok && (
                        <button
                          onClick={() => setShowTikTokPanel(true)}
                          className="my-ads-details-secondary my-ads-button my-ads-button--secondary flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E5E5E5] text-sm font-medium text-black bg-white transition-all"
                        >
                          <Send className="w-4 h-4" />
                          <span>Share to TikTok</span>
                        </button>
                      )}
                      {supportsHighRes && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setResolutionMenuOpen((prev) => !prev)}
                            disabled={isDownloading}
                            className={cn(
                              'my-ads-details-secondary flex h-11 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm font-medium text-black shadow-sm transition',
                              'my-ads-button my-ads-button--secondary',
                              isDownloading ? 'cursor-not-allowed opacity-70' : ''
                            )}
                          >
                            {(() => {
                              const current = resolutionOptions.find((option) => option.value === selectedResolution) || resolutionOptions[0];
                              const Icon = current.icon;
                              return (
                                <>
                                  <Icon className="h-4 w-4 text-black" />
                                  <span>{current.label}</span>
                                </>
                              );
                            })()}
                            <ChevronDown className="h-4 w-4 text-[#666666]" />
                          </button>
                          {resolutionMenuOpen && (
                            <div className="my-ads-details-menu absolute right-0 bottom-full mb-2 w-44 overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-lg">
                              {resolutionOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = option.value === selectedResolution;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={option.disabled}
                                    onClick={() => {
                                      if (option.disabled) return;
                                      setSelectedResolution(option.value);
                                      setResolutionMenuOpen(false);
                                    }}
                                    className={cn(
                                      'my-ads-details-menu-item flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                                      option.disabled
                                        ? 'cursor-not-allowed text-[#999999] bg-[#FAFAFA]'
                                        : isSelected
                                          ? 'my-ads-button my-ads-button--primary bg-black text-white'
                                          : 'my-ads-button my-ads-button--secondary text-black'
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon className={cn('h-4 w-4', option.disabled ? 'text-[#999999]' : isSelected ? 'text-white' : 'text-black')} />
                                      <span>{option.label}</span>
                                    </div>
                                    {option.note && (
                                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#999999]">
                                        Unsupported
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={handleDownloadClick}
                        disabled={isButtonBusy}
                        className={cn(
                          'my-ads-details-primary my-ads-button flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all shadow-sm',
                          !isButtonBusy
                            ? 'my-ads-button--primary bg-black text-white'
                            : 'bg-[#E5E5E5] text-[#666666] cursor-not-allowed'
                        )}
                      >
                        {isButtonBusy ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {isPreparing && !isHighResReady ? 'Preparing...' : 'Downloading...'}
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>{selectedResolution === '4k' && !isHighResReady ? 'Prepare' : 'Download'}</span>
                            {selectedResolution === '720p' ? (
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                                Free
                              </span>
                            ) : !isHighResReady ? (
                              <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white">
                                <Coins className="h-3 w-3" />
                                {selectedCost}
                              </span>
                            ) : null}
                          </>
                          )}
                      </button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
  ) : null;

  if (embedded) {
    return detailsContent;
  }

  return (
    <AnimatePresence>
      {isOpen && detailsContent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleBackdropClick}
        >
          {detailsContent}
        </div>
      ) : null}
    </AnimatePresence>
  );
}

// Compact parameter display component
function CompactParam({
  icon,
  label,
  value,
  capitalize,
  className
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <div className="mt-0.5 text-[#666666] flex-shrink-0">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider mb-0.5">{label}</span>
        <span className={cn(
          'text-sm text-black font-semibold leading-tight',
          capitalize && 'capitalize'
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}

// Detail row with icon for prompts
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  if (!value || !value.trim()) return null;
  
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-[#666666] flex-shrink-0">
        {icon}
      </div>
      <div className="space-y-0.5">
        <span className="block text-[10px] font-bold text-[#666666] uppercase tracking-wider">{label}</span>
        <p className="text-sm text-black leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

// Feedback buttons component for video rating
function FeedbackButtons({
  projectId,
  projectType
}: {
  projectId: string;
  projectType: 'avatar-ads' | 'video-clone' | 'motion-clone';
}) {
  const feedbackButtonBase =
    'inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35';
  const feedbackButton =
    `${feedbackButtonBase} border border-zinc-900 bg-gradient-to-b from-zinc-900 to-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_3px_0_rgba(58,58,58,0.92),0_8px_14px_rgba(0,0,0,0.16)] hover:translate-y-[2px] hover:from-black hover:to-zinc-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_0_rgba(58,58,58,0.92),0_6px_10px_rgba(0,0,0,0.12)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0px_0_rgba(58,58,58,0.92),0_4px_8px_rgba(0,0,0,0.1)]`;
  const feedbackButtonDisabled =
    `${feedbackButtonBase} border border-zinc-900/60 bg-zinc-900/75 text-white/75 cursor-not-allowed shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_0_rgba(58,58,58,0.68)]`;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState<'positive' | 'negative' | null>(null);

  const handleFeedback = async (feedbackType: 'positive' | 'negative') => {
    setSubmitting(feedbackType);

    try {
      const response = await fetch('/api/projects/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, projectType, feedbackType })
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(true);
    } catch (err) {
      console.error('Feedback error:', err);
    } finally {
      setSubmitting(null);
    }
  };

  if (submitted) {
    return (
      <span className="text-[12px] text-gray-500">Thanks!</span>
    );
  }

  return (
    <>
      <button
        onClick={() => handleFeedback('positive')}
        disabled={submitting !== null}
        className={submitting !== null ? feedbackButtonDisabled : feedbackButton}
      >
        {submitting === 'positive' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="w-3.5 h-3.5" />
        )}
        <span>Good</span>
      </button>
      <button
        onClick={() => handleFeedback('negative')}
        disabled={submitting !== null}
        className={submitting !== null ? feedbackButtonDisabled : feedbackButton}
      >
        {submitting === 'negative' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ThumbsDown className="w-3.5 h-3.5" />
        )}
        <span>Bad</span>
      </button>
    </>
  );
}
