'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import { ChevronLeft, ChevronRight, Clock, Coins, FileVideo, RotateCcw, Loader2, Play, Image as ImageIcon, Video as VideoIcon, Download, Check, CheckCircle2, Droplets, AlertCircle, Volume2, Send, ArrowRight, Shuffle } from 'lucide-react';
import { getCreditCost, type HighResResolution, type VideoModel } from '@/lib/constants';
import { isMyAdExpired, MY_ADS_RETENTION_DAYS } from '@/lib/my-ads-retention';
import { cn } from '@/lib/utils';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import VideoDetailsModal from '@/components/VideoDetailsModal';
import { getMyAdsDetailSurfaceMode } from '@/lib/my-ads-detail-surface';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import { useToast } from '@/contexts/ToastContext';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';
import { getMyAdsStatusPresentation, shouldShowMyAdsTypeFilters } from '@/lib/my-ads-list-presentation';

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
  // Segment information for cost calculation
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

const ITEMS_PER_PAGE = 8; // 2 rows × 4 columns (desktop) = 8 items per page

const AD_TYPE_OPTIONS = [
  {
    value: 'all',
    label: 'All Ads',
    icon: ImageIcon,
    description: 'Every campaign you have generated so far',
  },
  {
    value: 'video-clone',
    label: 'Video Clone',
    icon: ImageIcon,
    description: 'Segmented UGC workflows cloned from viral videos',
  },
  {
    value: 'character',
    label: 'Character',
    icon: VideoIcon,
    description: 'Character-driven videos and image sets',
  },
  {
    value: 'motion-clone',
    label: 'Motion Clone',
    icon: Shuffle,
    description: 'Kling motion-controlled swaps from reference videos',
  },
] as const;

type AdTypeFilterValue = (typeof AD_TYPE_OPTIONS)[number]['value'];

const interactiveCardActionClasses =
  'my-ads-button cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

const paginationButtonClasses =
  'my-ads-button my-ads-button--compact cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none';

const isCharacterAds = (item: HistoryItem): item is AvatarAdsItem => {
  return 'adType' in item && item.adType === 'character';
};

const isVideoClone = (item: HistoryItem): item is VideoCloneItem => {
  return 'adType' in item && item.adType === 'video-clone';
};

const isMotionClone = (item: HistoryItem): item is MotionCloneItem => {
  return 'adType' in item && item.adType === 'motion-clone';
};

const getBaseDownloadCost = (model: VideoModel) => {
  // Version 2.0: ALL downloads are FREE
  return 0;
};


export default function HistoryPage({ embedded = false, active = true }: { embedded?: boolean; active?: boolean } = {}) {
  const { user, isLoaded } = useUser();
  const supabase = useSupabaseBrowserClient();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [adTypeFilter, setAdTypeFilter] = useState<AdTypeFilterValue>('all');
  const { credits: userCredits, creditsData, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setDownloadStates] = useState<Record<string, 'idle' | 'processing' | 'success'>>({});
  // Cover UI transient state: 'packing' -> 'done' -> cleared
  const [coverStates, setCoverStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // Video UI transient state: 'packing' -> 'done' -> cleared
  const [videoStates, setVideoStates] = useState<Record<string, 'packing' | 'done' | null>>({});


  // Video details modal state
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalDownloading, setIsModalDownloading] = useState(false);
  const detailSurfaceMode = getMyAdsDetailSurfaceMode(embedded);
  const hasLoadedRef = useRef(false);
  const wasActiveRef = useRef(active);
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Helper function to get aspect ratio class
  const getAspectRatioClass = (aspectRatio?: string) => {
    const normalized = aspectRatio?.toLowerCase();
    switch (normalized) {
      case '16:9':
      case '16x9':
      case 'landscape':
        return 'aspect-[16/9]';
      case '1:1':
      case '1x1':
      case 'square':
        return 'aspect-square';
      case '9:16':
      case '9x16':
      case 'portrait':
      default:
        return 'aspect-[9/16]';
    }
  };


  // Memoized filtered history for better performance
  const adTypeFilteredHistory = useMemo(() => {
    return history.filter(item => {
      return (
        adTypeFilter === 'all' ||
        (adTypeFilter === 'video-clone' && isVideoClone(item)) ||
        (adTypeFilter === 'character' && isCharacterAds(item)) ||
        (adTypeFilter === 'motion-clone' && isMotionClone(item))
      );
    });
  }, [history, adTypeFilter]);

  const filteredHistory = adTypeFilteredHistory;

  useEffect(() => {
    if (!user?.id) return;
    trackEvent(ANALYTICS_EVENTS.my_ads_viewed, {
      feature: 'my_ads',
      surface: 'history_page',
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    trackEvent(ANALYTICS_EVENTS.my_ads_filter_changed, {
      feature: 'my_ads',
      surface: 'history_page',
      filter_value: adTypeFilter,
    });
  }, [adTypeFilter, user?.id]);

  // Memoized pagination calculations
  const { totalPages, currentHistory } = useMemo(() => {
    const total = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const current = filteredHistory.slice(startIndex, endIndex);

    return {
      totalPages: total,
      currentHistory: current
    };
  }, [filteredHistory, currentPage]);

  // Memoized goToPage function
  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);

    // Show new items progressively when page changes
    const startIndex = (newPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageItems = filteredHistory.slice(startIndex, endIndex);

    pageItems.forEach((item, index) => {
      setTimeout(() => {
        setVisibleItems(prev => new Set([...prev, item.id]));
      }, index * 100);
    });
  }, [totalPages, filteredHistory]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  const fetchHistory = useCallback(async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (!user?.id) return;

      if (showLoading) {
        setIsLoading(true);
      }
      try {
        const videoResponse = await fetch('/api/history');
        const videoResult = await videoResponse.json();

        const combinedHistory: HistoryItem[] = videoResult.success ? videoResult.history : [];

        // Sort by creation date
        combinedHistory.sort((a, b) => {
          const aDate = a.createdAt;
          const bDate = b.createdAt;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        });

        setHistory(combinedHistory);

        // Only replay the entrance animation on the first visible load.
        if (showLoading) {
          setVisibleItems(new Set());
        }

        if (combinedHistory.length > 0) {
          const visibleCount = currentPageRef.current * ITEMS_PER_PAGE;
          combinedHistory.slice(0, Math.min(visibleCount, combinedHistory.length)).forEach((item, index) => {
            if (showLoading) {
              setTimeout(() => {
                setVisibleItems(prev => new Set([...prev, item.id]));
              }, index * 100); // 100ms delay between each item
              return;
            }

            setVisibleItems(prev => new Set([...prev, item.id]));
          });
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      } finally {
        setIsLoading(false);
        hasLoadedRef.current = true;
      }
  }, [user?.id]);

  useEffect(() => {
    void fetchHistory({ showLoading: true });
  }, [fetchHistory]);

  useEffect(() => {
    const becameActive = active && !wasActiveRef.current;
    wasActiveRef.current = active;
    if (!becameActive || !hasLoadedRef.current) return;
    void fetchHistory();
  }, [active, fetchHistory]);

  // Poll for processing updates while there are in-progress items
  const hasProcessing = history.some(h => h.status === 'processing');
  useEffect(() => {
    if (!user?.id) return;
    if (!hasProcessing) return;

    let isCancelled = false;
    const poll = async () => {
      try {
        const videoResponse = await fetch('/api/history');
        const videoResult = await videoResponse.json();

        if (!isCancelled) {
          const combinedHistory: HistoryItem[] = videoResult.success ? videoResult.history : [];

          // Sort by creation date
          combinedHistory.sort((a, b) => {
            const aDate = a.createdAt;
            const bDate = b.createdAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });

          setHistory(combinedHistory);
        }
      } catch (err) {
        console.warn('Polling history failed:', err);
      }
    };

    const interval = setInterval(poll, 3000);
    // Do an immediate poll to reduce perceived latency
    poll();
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, hasProcessing]);

  useEffect(() => {
    if (!user?.id) return;

    const channels: RealtimeChannel[] = [];

    const updateHighResUrls = (
      item: AvatarAdsItem | VideoCloneItem,
      merged1080p?: string | null,
      merged4k?: string | null
    ) => {
      let changed = false;
      const next = { ...item };

      if (merged1080p && item.videoUrl1080p !== merged1080p) {
        next.videoUrl1080p = merged1080p;
        changed = true;
      }

      if (merged4k && item.videoUrl4k !== merged4k) {
        next.videoUrl4k = merged4k;
        changed = true;
      }

      return changed ? next : item;
    };

    const handleAvatarUpdate = (payload: { new: Record<string, unknown> }) => {
      const record = payload.new;
      const projectId = record?.id as string | undefined;
      if (!projectId) return;

      setHistory((prev) =>
        prev.map((item) => {
          if (!isCharacterAds(item) || item.id !== projectId) return item;
          return updateHighResUrls(
            item,
            record.merged_video_1080p_url as string | undefined,
            record.merged_video_4k_url as string | undefined
          );
        })
      );
    };

    const handleUgcUpdate = (payload: { new: Record<string, unknown> }) => {
      const record = payload.new;
      const projectId = record?.id as string | undefined;
      if (!projectId) return;

      setHistory((prev) =>
        prev.map((item) => {
          if (!isVideoClone(item) || item.id !== projectId) return item;
          return updateHighResUrls(
            item,
            record.merged_video_1080p_url as string | undefined,
            record.merged_video_4k_url as string | undefined
          );
        })
      );
    };

    const avatarChannel = supabase
      .channel(`my-ads-avatar-highres-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'avatar_ads_projects',
          filter: `user_id=eq.${user.id}`
        },
        handleAvatarUpdate
      )
      .subscribe();

    channels.push(avatarChannel);

    const ugcChannel = supabase
      .channel(`my-ads-ugc-highres-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_clone_projects',
          filter: `user_id=eq.${user.id}`
        },
        handleUgcUpdate
      )
      .subscribe();

    channels.push(ugcChannel);

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, user?.id]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [adTypeFilter]);

  // Loading state
  if (!isLoaded) {
    return <FlowtraLoading />;
  }






  const renderStatusIcon = (item: HistoryItem) => {
    const presentation = getMyAdsStatusPresentation(item.status);

    if (presentation.icon === 'completed') {
      return (
        <span
          aria-label={presentation.label}
          title={presentation.label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/92 text-black shadow-sm backdrop-blur"
        >
          <CheckCircle2 className="h-4 w-4" />
        </span>
      );
    }

    if (presentation.icon === 'processing') {
      return (
        <span
          aria-label={presentation.label}
          title={presentation.label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/92 text-black shadow-sm backdrop-blur"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      );
    }

    return (
      <div className="group relative pointer-events-auto">
        <button
          type="button"
          aria-label={presentation.label}
          title={presentation.label}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-white/95 text-red-600 shadow-sm backdrop-blur"
        >
          <AlertCircle className="h-4 w-4" />
        </button>
        <div className="absolute left-0 top-full mt-2 w-64 rounded-lg bg-foreground p-3 text-xs leading-relaxed text-background opacity-0 shadow-lg transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 z-50">
          <div className="mb-2 font-semibold">Generation Failed</div>
          <p className="mb-3">
            {('coverImageUrl' in item && item.coverImageUrl)
              ? 'Video generation failed, but your cover image is ready to download.'
              : 'Generation failed due to technical issues. Please try again with a different product photo.'}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push('/dashboard/support');
            }}
            className={cn(
              'w-full rounded bg-background/20 px-2 py-1.5 text-xs transition-colors hover:bg-background/30',
              interactiveCardActionClasses
            )}
          >
            Contact Support →
          </button>
        </div>
      </div>
    );
  };

  // const getStepLabel = (step?: string) => {
  //   if (!step) return 'Processing';
  //   const map: Record<string, string> = {
  //     analyzing_image: 'Analyzing Image',
  //     generating_cover: 'Generating Cover',
  //     generating_video: 'Generating Video',
  //     merging_video: 'Merging Video',
  //     uploading_assets: 'Uploading Assets',
  //   };
  //   return map[step] || 'Processing';
  // };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };



  // Removed unused getStepMessage helper to satisfy lint

  const startDownloadForm = (action: string, fields: Record<string, string>) => {
    let iframe = document.getElementById('download-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'download-iframe';
      iframe.name = 'download-iframe';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.target = 'download-iframe';
    form.style.display = 'none';

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const downloadVideo = async (item: HistoryItem, resolution: HighResResolution): Promise<'ready' | 'processing' | 'error'> => {
    if (!user?.id) {
      showError('Please sign in to download videos');
      return 'error';
    }

    if (isMyAdExpired(item.createdAt)) {
      showError(`This asset expired after ${MY_ADS_RETENTION_DAYS} days. You can still view it, but downloads are disabled.`);
      return 'error';
    }

    if (typeof userCredits !== 'number') {
      showError('Credits are still loading. Please try again in a moment.');
      return 'error';
    }

    const historyId = item.id;
    const isFirstDownload = item && 'downloaded' in item ? !item.downloaded : false;

    const isPrepaid = item && 'generationCreditsUsed' in item ? (item.generationCreditsUsed || 0) > 0 : false;
    const downloadCost = 0;

    if (resolution === '720p') {
      if (!isPrepaid && isFirstDownload && userCredits < downloadCost) {
        showError(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
        return 'error';
      }

      setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));
      trackEvent(ANALYTICS_EVENTS.export_download_started, {
        feature: item.adType,
        surface: 'my_ads',
        project_id: historyId,
        download_type: resolution,
        is_first_download: isFirstDownload,
      });

      try {
        const apiEndpoint = isCharacterAds(item) ? '/api/avatar-ads/download' : '/api/download-video';
        const validationResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            historyId,
            userId: user.id,
            validateOnly: true,
            ...(isCharacterAds(item) && { videoDurationSeconds: item.videoDurationSeconds })
          }),
        });

        if (!validationResponse.ok) {
          const result = await validationResponse.json();
          showError(result.message || 'Failed to authorize download');
          setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
          return 'error';
        }

        const fields: Record<string, string> = {
          historyId,
          userId: user.id,
        };

        if (isCharacterAds(item) && item.videoDurationSeconds) {
          fields.videoDurationSeconds = String(item.videoDurationSeconds);
        }

        startDownloadForm(apiEndpoint, fields);

        setDownloadStates(prev => ({ ...prev, [historyId]: 'success' }));

        setHistory(prevHistory =>
          prevHistory.map(item =>
            item.id === historyId
              ? {
                    ...item,
                    downloaded: true,
                    downloadCreditsUsed: isFirstDownload ? downloadCost : ('downloadCreditsUsed' in item ? item.downloadCreditsUsed : 0),
                  }
                : item
          )
        );

        if (isFirstDownload) {
          await refetchCredits();
        }

        setTimeout(() => {
          setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        }, 3000);
        trackEvent(ANALYTICS_EVENTS.export_download_completed, {
          feature: item.adType,
          surface: 'my_ads',
          project_id: historyId,
          download_type: resolution,
          is_first_download: isFirstDownload,
        });
        return 'ready';
      } catch (error) {
        console.error('Error downloading video:', error);
        trackEvent(ANALYTICS_EVENTS.export_download_failed, {
          feature: item.adType,
          surface: 'my_ads',
          project_id: historyId,
          download_type: resolution,
        });
        showError('An error occurred while downloading the video');
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        return 'error';
      }
      return 'error';
    }

    if (!isVideoClone(item) && !isCharacterAds(item)) {
      showError('High-resolution downloads are only available for Avatar Ads and Clone Video.');
      return 'error';
    }

    setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));
    trackEvent(ANALYTICS_EVENTS.high_res_upgrade_requested, {
      feature: item.adType,
      surface: 'my_ads',
      project_id: historyId,
      download_type: resolution,
    });

    try {
      const response = await fetch('/api/my-ads/high-res', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          historyId,
          resolution,
          adType: item.adType
        })
      });

      const result = await response.json();
      if (!response.ok) {
        showError(result.error || 'Failed to start high-res download');
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        return 'error';
      }

      if (result.creditsCharged && result.creditsCharged > 0) {
        await refetchCredits();
      }

      if (result.status === 'ready') {
        startDownloadForm('/api/my-ads/high-res-download', {
          historyId,
          resolution,
          adType: item.adType
        });
        if (result.videoUrl) {
          setHistory(prevHistory =>
            prevHistory.map(current => {
              if (current.id !== historyId) return current;
              if (resolution === '1080p' && (isCharacterAds(current) || isVideoClone(current))) {
                return { ...current, videoUrl1080p: result.videoUrl };
              }
              if (resolution === '4k' && (isCharacterAds(current) || isVideoClone(current))) {
                return { ...current, videoUrl4k: result.videoUrl };
              }
              return current;
            })
          );
        }
        setDownloadStates(prev => ({ ...prev, [historyId]: 'success' }));
        setTimeout(() => {
          setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        }, 3000);
        trackEvent(ANALYTICS_EVENTS.high_res_upgrade_completed, {
          feature: item.adType,
          surface: 'my_ads',
          project_id: historyId,
          download_type: resolution,
        });
        return 'ready';
      }

      showSuccess(result.message || `${resolution.toUpperCase()} is warming up. This takes a few minutes. Come back to download.`);
      setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));
      return 'processing';
    } catch (error) {
      console.error('Error downloading high-res video:', error);
      trackEvent(ANALYTICS_EVENTS.high_res_upgrade_failed, {
        feature: item.adType,
        surface: 'my_ads',
        project_id: historyId,
        download_type: resolution,
      });
      showError('An error occurred while starting the high-res download');
      setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
      return 'error';
    }
  };

  // Generate a short emotional phrase for the Cover button
  const getPackingText = (stage: 'packing' | 'done') =>
    stage === 'packing' ? 'Packing…' : 'Ready!';

  // Video Clone cover download function (free) — show phrase only, no video download state
  const downloadVideoCloneCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !('coverImageUrl' in item) || !item.coverImageUrl) return;
    if (isMyAdExpired(item.createdAt)) {
      showError(`This asset expired after ${MY_ADS_RETENTION_DAYS} days. You can still view it, but downloads are disabled.`);
      return;
    }

    try {
      // Fetch as blob to force background download without navigation
      const res = await fetch(item.coverImageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

      const link = document.createElement('a');
      link.href = url;
      link.download = `cover-${historyId}.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed');
    }
  };

  // Character ads cover download function (free) — similar to Video Clone
  const downloadCharacterAdsCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !isCharacterAds(item) || !item.coverImageUrl) return;
    if (isMyAdExpired(item.createdAt)) {
      showError(`This asset expired after ${MY_ADS_RETENTION_DAYS} days. You can still view it, but downloads are disabled.`);
      return;
    }

    try {
      // Fetch as blob to force background download without navigation
      const res = await fetch(item.coverImageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

      const link = document.createElement('a');
      link.href = url;
      link.download = `character-cover-${historyId}.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed');
    }
  };

  const downloadMotionCloneCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !isMotionClone(item) || !item.coverImageUrl) return;
    if (isMyAdExpired(item.createdAt)) {
      showError(`This asset expired after ${MY_ADS_RETENTION_DAYS} days. You can still view it, but downloads are disabled.`);
      return;
    }

    try {
      const res = await fetch(item.coverImageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

      const link = document.createElement('a');
      link.href = url;
      link.download = `motion-clone-cover-${historyId}.${ext}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed');
    }
  };

  // Unified handler to show emotional phrase on Cover click then trigger download
  const handleCoverClick = async (item: HistoryItem) => {
    // only for ads content

    const id = item.id;
    setCoverStates(prev => ({ ...prev, [id]: 'packing' }));
    try {
      if (isVideoClone(item)) {
        await downloadVideoCloneCover(item.id);
      } else if (isCharacterAds(item)) {
        await downloadCharacterAdsCover(item.id);
      } else if (isMotionClone(item)) {
        await downloadMotionCloneCover(item.id);
      }
      // Mark as done to show a pleasant finish message
      setCoverStates(prev => ({ ...prev, [id]: 'done' }));
    } finally {
      // Clear after a brief moment to restore default UI
      setTimeout(() => {
        setCoverStates(prev => ({ ...prev, [id]: null }));
      }, 1200);
    }
  };

  // Unified handler to show emotional text on Video click then trigger download
  const handleVideoClick = async (item: HistoryItem) => {
    const id = item.id;
    setVideoStates(prev => ({ ...prev, [id]: 'packing' }));
    try {
      if (isVideoClone(item) || isCharacterAds(item) || isMotionClone(item)) {
        await downloadVideo(item, '720p');
      }
      setVideoStates(prev => ({ ...prev, [id]: 'done' }));
    } finally {
      setTimeout(() => {
        setVideoStates(prev => ({ ...prev, [id]: null }));
      }, 1200);
    }
  };

  // Note: Cover button is always free and uses static icon in the UI.

  // Handler for opening video details modal
  const handleViewDetails = (item: HistoryItem) => {
    trackEvent(ANALYTICS_EVENTS.my_ads_item_opened, {
      feature: item.adType,
      surface: 'my_ads',
      project_id: item.id,
    });
    setSelectedItem(item);
    if (detailSurfaceMode === 'modal') {
      setIsModalOpen(true);
    }
  };

  // Handler for downloading video from modal
  const handleModalDownload = async (item: HistoryItem, resolution: HighResResolution) => {
    setIsModalDownloading(true);
    try {
      return await downloadVideo(item, resolution);
    } finally {
      setIsModalDownloading(false);
    }
  };

  const content = detailSurfaceMode === 'embedded' && selectedItem ? (
    <VideoDetailsModal
      isOpen
      embedded
      onClose={() => setSelectedItem(null)}
      item={selectedItem}
      onDownload={handleModalDownload}
      isDownloading={isModalDownloading}
      isExpired={isMyAdExpired(selectedItem.createdAt)}
    />
  ) : (
    <>
      <div className={embedded
        ? 'px-5 py-4 md:px-6'
        : 'px-6 md:px-8 pb-6 md:pb-8 max-w-[1280px] mx-auto pt-14 md:pt-8'}
      >
          {/* Header Section */}
          <div className={embedded ? 'mb-5' : 'mb-12'}>
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              {/* Title */}
              <div className={embedded ? 'hidden' : undefined}>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
                  My Ads
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Your complete library of generated advertisements
                </p>
              </div>

              {/* Warning Notice */}
              <div className={embedded ? 'hidden' : 'md:max-w-xl'}>
                <div className="rounded-2xl border border-red-200/80 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
                      <AlertCircle className="h-4.5 w-4.5" />
                    </div>
                    <p className="text-sm font-medium leading-6 text-red-700 md:whitespace-nowrap">
                      Videos expire after {MY_ADS_RETENTION_DAYS} days with viewing and downloads disabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {shouldShowMyAdsTypeFilters(embedded) ? (
            <div className="mb-8">
              <div className="inline-flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-2">
                {AD_TYPE_OPTIONS.map((option) => {
                  const isActive = adTypeFilter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.description}
                      onClick={() => setAdTypeFilter(option.value)}
                      aria-pressed={isActive}
                      className={cn(
                        'my-ads-button inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                        isActive
                          ? 'my-ads-button--primary bg-primary text-primary-foreground border-primary'
                          : 'my-ads-button--secondary bg-background text-foreground border-border hover:border-foreground'
                      )}
                    >
                      <option.icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="bg-muted rounded-lg border border-border overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-border"></div>
                  <div className="p-4">
                    <div className="h-4 bg-border rounded mb-2"></div>
                    <div className="h-3 bg-border rounded w-3/4 mb-3"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-6 bg-border rounded w-16"></div>
                      <div className="h-8 bg-border rounded w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-6 border border-border">
                <FileVideo className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">No projects yet</h3>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">Start creating your first AI-powered advertisement</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="my-ads-button my-ads-button--primary inline-flex items-center gap-2 rounded-lg px-6 py-3 font-medium"
              >
                <FileVideo className="w-4 h-4" />
                Create Project
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {currentHistory.map((item) => {
                  const isExpired = isMyAdExpired(item.createdAt);

                  return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: visibleItems.has(item.id) ? 1 : 0,
                      y: visibleItems.has(item.id) ? 0 : 20
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="relative bg-muted border border-border rounded-lg overflow-hidden hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] transition-shadow duration-200 flex flex-col"
                    style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  >
                    {/* Status */}
                    <div className="pointer-events-none absolute left-3 top-3 z-20">
                      {renderStatusIcon(item)}
                    </div>

                    {/* Video Preview */}
                    <div className="relative bg-[#F1F1F1] overflow-hidden">
                      <div
                        className={cn(
                          "w-full relative flex items-center justify-center",
                          getAspectRatioClass('videoAspectRatio' in item ? item.videoAspectRatio : '9:16')
                        )}
                        onMouseEnter={() => {
                          if (!isExpired && item.status === 'completed' && item.videoUrl) {
                            setHoveredVideo(item.id);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredVideo(null);
                        }}
                      >
                        {item.status === 'completed' && 'videoUrl' in item && item.videoUrl ? (
                          <VideoPlayer
                            src={item.videoUrl}
                            className="w-full h-full object-contain"
                            autoPlay={true}
                            loop={true}
                            playsInline={true}
                            showControls={false}
                          />
                        ) : 'coverImageUrl' in item && item.coverImageUrl ? (
                          <Image
                            src={item.coverImageUrl}
                            alt="Generated cover"
                            width={400}
                            height={300}
                            className="w-full h-full object-contain"
                          />
                        ) : 'originalImageUrl' in item && item.originalImageUrl ? (
                          <Image
                            src={item.originalImageUrl}
                            alt="Original product"
                            width={400}
                            height={300}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full bg-border" />
                        )}

                        {/* Video Hover Indicator */}
                        {hoveredVideo === item.id &&
                          item.status === 'completed' &&
                          'videoUrl' in item && item.videoUrl &&
                          (('photoOnly' in item && !item.photoOnly) || isCharacterAds(item)) && (
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-foreground/80 px-3 py-1.5 text-xs font-medium text-background pointer-events-none">
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Click for sound</span>
                            </div>
                          )}

                        {/* Processing Overlay */}
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-background/50" />
                            {(() => {
                              const pct = Math.round(Math.max(0, Math.min(100, item.progress ?? 0)));
                              return (
                                <div className="relative w-20 h-20">
                                  <div
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: `conic-gradient(var(--foreground) ${pct}%, var(--border) 0)` }}
                                  />
                                  <div className="absolute inset-1 rounded-full bg-background" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-foreground">{pct}%</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {isExpired && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/58 backdrop-blur-[2px]">
                            <div className="rounded-2xl border border-white/15 bg-black/55 px-4 py-3 text-center text-white shadow-lg">
                              <p className="text-sm font-semibold uppercase tracking-[0.18em]">Expired</p>
                              <p className="mt-1 text-xs text-white/80">
                                View only. Downloads are unavailable after {MY_ADS_RETENTION_DAYS} days.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col bg-muted">
                      {/* Metadata */}
                      <div className="space-y-1 mb-3">
                        <div className="flex items-center text-xs text-muted-foreground gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="font-medium">{formatDate(item.createdAt)}</span>
                          <span className="text-border">•</span>
                          <span>{formatTime(item.createdAt)}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="mt-auto">
                        <div className="border-t border-border -mx-4 -mb-4 px-4 py-3 bg-background">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className={cn(
                              'my-ads-button my-ads-button--secondary w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-all hover:border-foreground',
                              interactiveCardActionClasses
                            )}
                          >
                            <span className="font-medium">View Details</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {filteredHistory.length > 0 && (
                <div className="mt-12 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'my-ads-button my-ads-button--secondary rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-foreground disabled:cursor-not-allowed disabled:opacity-30 transition-all',
                        paginationButtonClasses
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 7;

                      if (totalPages <= maxVisiblePages) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        if (currentPage <= 4) {
                          for (let i = 1; i <= 5; i++) {
                            pages.push(i);
                          }
                          pages.push('...');
                          pages.push(totalPages);
                        } else if (currentPage >= totalPages - 3) {
                          pages.push(1);
                          pages.push('...');
                          for (let i = totalPages - 4; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push(1);
                          pages.push('...');
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            pages.push(i);
                          }
                          pages.push('...');
                          pages.push(totalPages);
                        }
                      }

                      return pages.map((page, index) => (
                        <div key={index}>
                          {page === '...' ? (
                            <span className="px-3 py-2 text-sm text-muted-foreground">...</span>
                          ) : (
                            <button
                              onClick={() => goToPage(page as number)}
                              className={cn(
                                'my-ads-button rounded-lg px-3 py-2 text-sm font-medium transition-all',
                                currentPage === page
                                  ? 'my-ads-button--primary bg-primary text-primary-foreground'
                                  : 'my-ads-button--secondary text-foreground bg-background border border-border hover:border-foreground',
                                paginationButtonClasses
                              )}
                            >
                              {page}
                            </button>
                          )}
                        </div>
                      ));
                    })()}

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={cn(
                        'my-ads-button my-ads-button--secondary rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:border-foreground disabled:cursor-not-allowed disabled:opacity-30 transition-all',
                        paginationButtonClasses
                      )}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
      {/* Video Details Modal */}
      {detailSurfaceMode === 'modal' ? (
        <VideoDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onDownload={handleModalDownload}
        isDownloading={isModalDownloading}
        isExpired={selectedItem ? isMyAdExpired(selectedItem.createdAt) : false}
        />
      ) : null}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen ">
        {content}
      </DashboardContentTransition>
    </div>
  );
}
