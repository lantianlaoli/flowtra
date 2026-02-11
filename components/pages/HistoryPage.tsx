'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Sidebar from '@/components/layout/Sidebar';
import { ChevronLeft, ChevronRight, Clock, Coins, FileVideo, RotateCcw, Loader2, Play, Image as ImageIcon, Video as VideoIcon, HelpCircle, Download, Check, Droplets, AlertCircle, Volume2, CalendarClock, Send, ArrowRight, Shuffle } from 'lucide-react';
import { getCreditCost, type HighResResolution, type VideoModel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import VideoDetailsModal from '@/components/VideoDetailsModal';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import { useToast } from '@/contexts/ToastContext';
import { getSupabase } from '@/lib/supabase';

interface CompetitorUgcReplicationItem {
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
  adType: 'competitor-ugc-replication';
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

interface MotionSwapItem {
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
  adType: 'motion-swap';
  videoAspectRatio?: string;
  videoDurationSeconds?: number;
  photoPrompt?: string;
  videoPrompt?: string;
  errorMessage?: string;
}

type HistoryItem = CompetitorUgcReplicationItem | AvatarAdsItem | MotionSwapItem;

const ITEMS_PER_PAGE = 8; // 2 rows × 4 columns (desktop) = 8 items per page

const AD_TYPE_OPTIONS = [
  {
    value: 'all',
    label: 'All Ads',
    icon: ImageIcon,
    description: 'Every campaign you have generated so far',
  },
  {
    value: 'competitor-ugc-replication',
    label: 'Viral Clone',
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
    value: 'motion-swap',
    label: 'Motion Swap',
    icon: Shuffle,
    description: 'Kling motion-controlled swaps from reference videos',
  },
] as const;

type AdTypeFilterValue = (typeof AD_TYPE_OPTIONS)[number]['value'];

const interactiveCardActionClasses =
  'cursor-pointer transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0';

const paginationButtonClasses =
  'cursor-pointer transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 disabled:pointer-events-none';

const isCharacterAds = (item: HistoryItem): item is AvatarAdsItem => {
  return 'adType' in item && item.adType === 'character';
};

const isCompetitorUgcReplication = (item: HistoryItem): item is CompetitorUgcReplicationItem => {
  return 'adType' in item && item.adType === 'competitor-ugc-replication';
};

const isMotionSwap = (item: HistoryItem): item is MotionSwapItem => {
  return 'adType' in item && item.adType === 'motion-swap';
};

const getBaseDownloadCost = (model: VideoModel) => {
  // Version 2.0: ALL downloads are FREE
  return 0;
};


export default function HistoryPage() {
  const { user, isLoaded } = useUser();
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
        (adTypeFilter === 'competitor-ugc-replication' && isCompetitorUgcReplication(item)) ||
        (adTypeFilter === 'character' && isCharacterAds(item)) ||
        (adTypeFilter === 'motion-swap' && isMotionSwap(item))
      );
    });
  }, [history, adTypeFilter]);

  const filteredHistory = adTypeFilteredHistory;

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

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;

      setIsLoading(true);
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

        // Reset visible items when data changes
        setVisibleItems(new Set());

        // Progressively show items with staggered animation
        if (combinedHistory.length > 0) {
          combinedHistory.slice(0, Math.min(currentPage * ITEMS_PER_PAGE, combinedHistory.length)).forEach((item, index) => {
            setTimeout(() => {
              setVisibleItems(prev => new Set([...prev, item.id]));
            }, index * 100); // 100ms delay between each item
          });
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

    const supabase = getSupabase();
    const channels: RealtimeChannel[] = [];

    const updateHighResUrls = (
      item: AvatarAdsItem | CompetitorUgcReplicationItem,
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
          if (!isCompetitorUgcReplication(item) || item.id !== projectId) return item;
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
          table: 'competitor_ugc_replication_projects',
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
  }, [user?.id]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [adTypeFilter]);

  // Loading state
  if (!isLoaded) {
    return <FlowtraLoading />;
  }






  const getStatusText = (status: string) => {
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

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-primary text-primary-foreground border border-primary';
      case 'processing':
        return 'bg-muted text-foreground border border-border';
      case 'failed':
        return 'bg-red-950/40 text-red-200 border border-red-900/40';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
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
    if (!user?.id || !userCredits) return 'error';

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

        if (isCharacterAds(item)) {
          fields.videoDurationSeconds = String(item.videoDurationSeconds || 8);
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
        return 'ready';
      } catch (error) {
        console.error('Error downloading video:', error);
        showError('An error occurred while downloading the video');
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        return 'error';
      }
      return 'error';
    }

    if (!isCompetitorUgcReplication(item) && !isCharacterAds(item)) {
      showError('High-resolution downloads are only available for Avatar Ads and Clone Video.');
      return 'error';
    }

    setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));

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
              if (resolution === '1080p' && (isCharacterAds(current) || isCompetitorUgcReplication(current))) {
                return { ...current, videoUrl1080p: result.videoUrl };
              }
              if (resolution === '4k' && (isCharacterAds(current) || isCompetitorUgcReplication(current))) {
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
        return 'ready';
      }

      showSuccess(result.message || `${resolution.toUpperCase()} is warming up. This takes a few minutes. Come back to download.`);
      setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));
      return 'processing';
    } catch (error) {
      console.error('Error downloading high-res video:', error);
      showError('An error occurred while starting the high-res download');
      setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
      return 'error';
    }
  };

  // Generate a short emotional phrase for the Cover button
  const getPackingText = (stage: 'packing' | 'done') =>
    stage === 'packing' ? 'Packing…' : 'Ready!';

  // Competitor UGC Replication cover download function (free) — show phrase only, no video download state
  const downloadCompetitorUgcReplicationCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !('coverImageUrl' in item) || !item.coverImageUrl) return;

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

  // Character ads cover download function (free) — similar to Competitor UGC Replication
  const downloadCharacterAdsCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !isCharacterAds(item) || !item.coverImageUrl) return;

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

  const downloadMotionSwapCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !isMotionSwap(item) || !item.coverImageUrl) return;

    try {
      const res = await fetch(item.coverImageUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

      const link = document.createElement('a');
      link.href = url;
      link.download = `motion-swap-cover-${historyId}.${ext}`;
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
      if (isCompetitorUgcReplication(item)) {
        await downloadCompetitorUgcReplicationCover(item.id);
      } else if (isCharacterAds(item)) {
        await downloadCharacterAdsCover(item.id);
      } else if (isMotionSwap(item)) {
        await downloadMotionSwapCover(item.id);
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
      if (isCompetitorUgcReplication(item) || isCharacterAds(item) || isMotionSwap(item)) {
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
    setSelectedItem(item);
    setIsModalOpen(true);
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

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="dashboard-content-offset ml-0 bg-background min-h-screen ">
        <div className="px-6 md:px-8 pb-6 md:pb-8 max-w-[1280px] mx-auto pt-14 md:pt-8">
          {/* Header Section */}
          <div className="mb-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              {/* Title */}
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-3">
                  My Ads
                </h1>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Your complete library of generated advertisements
                </p>
              </div>

              {/* Warning Notice */}
              <div className="md:max-w-md">
                <div className="flex items-start gap-4 rounded-lg border border-border bg-background px-5 py-4">
                  <CalendarClock className="w-5 h-5 text-foreground flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground tracking-wide uppercase">
                      15-Day Retention
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      All assets expire after 15 days. Download important files before automatic deletion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
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
                      'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:border-foreground'
                    )}
                  >
                    <option.icon className="h-4 w-4" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
                className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium inline-flex items-center gap-2"
              >
                <FileVideo className="w-4 h-4" />
                Create Project
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {currentHistory.map((item) => (
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
                    {/* Status Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-20">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 pointer-events-auto',
                          getStatusBadgeClasses(item.status)
                        )}
                      >
                        {getStatusText(item.status)}
                        {item.status === 'failed' && (
                          <div className="group">
                            <HelpCircle className="w-3.5 h-3.5" aria-label="Failed generation details" />
                            <div className="absolute left-0 top-full mt-2 w-64 rounded-lg bg-foreground text-background text-xs leading-relaxed p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto z-50">
                              <div className="font-semibold mb-2">Generation Failed</div>
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
                                  'w-full text-xs bg-background/20 hover:bg-background/30 px-2 py-1.5 rounded transition-colors',
                                  interactiveCardActionClasses
                                )}
                              >
                                Contact Support →
                              </button>
                            </div>
                          </div>
                        )}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-background text-foreground border border-border">
                        {isCharacterAds(item) ? 'Character' : isMotionSwap(item) ? 'Motion Swap' : 'UGC Clone'}
                      </span>
                    </div>

                    {/* Video Preview */}
                    <div className="relative bg-[#F1F1F1] overflow-hidden">
                      <div
                        className={cn(
                          "w-full relative flex items-center justify-center",
                          getAspectRatioClass('videoAspectRatio' in item ? item.videoAspectRatio : '9:16')
                        )}
                        onMouseEnter={() => {
                          if (item.status === 'completed' && item.videoUrl) {
                            setHoveredVideo(item.id);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredVideo(null);
                        }}
                      >
                        {item.status === 'completed' && 'videoUrl' in item && item.videoUrl &&
                          (('photoOnly' in item && !item.photoOnly) || isCharacterAds(item)) &&
                          hoveredVideo === item.id ? (
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
                              'w-full flex items-center justify-between px-3 py-2.5 text-sm bg-background text-foreground rounded-lg border border-border hover:border-foreground transition-all',
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
                ))}
              </div>

              {/* Pagination */}
              {filteredHistory.length > 0 && (
                <div className="mt-12 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'px-3 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all',
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
                                'px-3 py-2 text-sm font-medium rounded-lg transition-all',
                                currentPage === page
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-foreground bg-background border border-border hover:border-foreground',
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
                        'px-3 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:border-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all',
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
      </div>

      {/* Video Details Modal */}
      <VideoDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onDownload={handleModalDownload}
        isDownloading={isModalDownloading}
      />
    </div>
  );
}
