'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { ChevronLeft, ChevronRight, Clock, Coins, FileVideo, RotateCcw, Loader2, Play, Image as ImageIcon, Video as VideoIcon, HelpCircle, Download, Check, Droplets, AlertCircle, Volume2, CalendarClock, Send } from 'lucide-react';
import { getCreditCost, type VideoModel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import TikTokPublishDialog from '@/components/TikTokPublishDialog';

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
  // Segment information for cost calculation
  isSegmented?: boolean;
  segmentCount?: number;
  videoDuration?: string;
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
}

type HistoryItem = CompetitorUgcReplicationItem | CharacterAdsItem | WatermarkRemovalItem;

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
    label: 'Competitor UGC Replication',
    icon: ImageIcon,
    description: 'Segmented UGC workflows cloned from real competitors',
  },
  {
    value: 'character',
    label: 'Character',
    icon: VideoIcon,
    description: 'Character-driven videos and image sets',
  },
  {
    value: 'watermark-removal',
    label: 'Watermark Removal',
    icon: Droplets,
    description: 'Processed videos with Sora2 watermark removal',
  },
] as const;

type AdTypeFilterValue = (typeof AD_TYPE_OPTIONS)[number]['value'];

const interactiveCardActionClasses =
  'cursor-pointer transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0';

const paginationButtonClasses =
  'cursor-pointer transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0 disabled:pointer-events-none';

const isCharacterAds = (item: HistoryItem): item is CharacterAdsItem => {
  return 'adType' in item && item.adType === 'character';
};

const isCompetitorUgcReplication = (item: HistoryItem): item is CompetitorUgcReplicationItem => {
  return 'adType' in item && item.adType === 'competitor-ugc-replication';
};

const isWatermarkRemoval = (item: HistoryItem): item is WatermarkRemovalItem => {
  return 'adType' in item && item.adType === 'watermark-removal';
};

type DownloadCreditEligibleModel = Exclude<VideoModel, 'sora2_pro'>;

const getBaseDownloadCost = (model: VideoModel) => {
  if (model === 'sora2_pro') {
    return 0;
  }
  return getCreditCost(model as DownloadCreditEligibleModel);
};

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [adTypeFilter, setAdTypeFilter] = useState<AdTypeFilterValue>('all');
  const { credits: userCredits, refetchCredits } = useCredits();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setDownloadStates] = useState<Record<string, 'idle' | 'processing' | 'success'>>({});
  // Cover UI transient state: 'packing' -> 'done' -> cleared
  const [coverStates, setCoverStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // Video UI transient state: 'packing' -> 'done' -> cleared
  const [videoStates, setVideoStates] = useState<Record<string, 'packing' | 'done' | null>>({});

  // TikTok publish dialog state
  const [tiktokDialogOpen, setTiktokDialogOpen] = useState(false);
  const [selectedItemForTikTok, setSelectedItemForTikTok] = useState<HistoryItem | null>(null);

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
        (adTypeFilter === 'watermark-removal' && isWatermarkRemoval(item))
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

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [adTypeFilter]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
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
        return 'bg-gray-900 text-white border border-gray-900';
      case 'processing':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      case 'failed':
        return 'bg-white text-gray-900 border border-gray-900';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
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

  // Download function for videos (supports V1, V2, and Character Ads)
const downloadVideo = async (historyId: string, videoModel: VideoModel) => {
    if (!user?.id || !userCredits) return;

    const item = history.find(h => h.id === historyId);
    const isFirstDownload = item && 'downloaded' in item ? !item.downloaded : false;

    if (!item) return;

    // Check if VEO3 prepaid (credits already deducted at generation)
    const isPrepaid = item && 'generationCreditsUsed' in item ? (item.generationCreditsUsed || 0) > 0 : false;

    // Version 2.0: ALL downloads are FREE (credits charged at generation time)
    const downloadCost = 0;

    // For prepaid VEO3, no credit check needed
    if (!isPrepaid && isFirstDownload && userCredits < downloadCost) {
      alert(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
      return;
    }

    // Start download animation
    setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));

    try {
      // Use different API endpoint for Character Ads
      const apiEndpoint = isCharacterAds(item) ? '/api/character-ads/download' : '/api/download-video';

      // ✅ STEP 1: Fast validation (check auth + credits) without downloading
      const validationResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          historyId,
          userId: user.id,
          validateOnly: true, // Only validate, don't download yet
          ...(isCharacterAds(item) && { videoDurationSeconds: item.videoDurationSeconds })
        }),
      });

      if (!validationResponse.ok) {
        const result = await validationResponse.json();
        alert(result.message || 'Failed to authorize download');
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        return;
      }

      // ✅ STEP 2: Validation passed - trigger instant streaming download via hidden iframe
      // This allows browser to handle download natively without navigating away from current page

      // Create or reuse hidden iframe for downloads
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
      form.action = apiEndpoint;
      form.target = 'download-iframe'; // Submit to hidden iframe
      form.style.display = 'none';

      // Add form fields
      const fields: Record<string, string> = {
        historyId,
        userId: user.id,
      };

      if (isCharacterAds(item)) {
        fields.videoDurationSeconds = String(item.videoDurationSeconds || 8);
      }

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

      // Show success state immediately (download started)
      setDownloadStates(prev => ({ ...prev, [historyId]: 'success' }));

      // Update history
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

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
      }, 3000);

    } catch (error) {
      console.error('Error downloading video:', error);
      alert('An error occurred while downloading the video');
      setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
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

  // Watermark removal video download function (free - credits already charged at generation)
  const downloadWatermarkRemovalVideo = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || !isWatermarkRemoval(item) || !item.videoUrl) return;

    try {
      // Fetch as blob to force background download without navigation
      const res = await fetch(item.videoUrl, { mode: 'cors' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `watermark-removed-${historyId}.mp4`;
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
      if (isWatermarkRemoval(item)) {
        await downloadWatermarkRemovalVideo(item.id);
      } else if (isCompetitorUgcReplication(item) || isCharacterAds(item)) {
        await downloadVideo(item.id, item.videoModel);
      }
      setVideoStates(prev => ({ ...prev, [id]: 'done' }));
    } finally {
      setTimeout(() => {
        setVideoStates(prev => ({ ...prev, [id]: null }));
      }, 1200);
    }
  };

  // Note: Cover button is always free and uses static icon in the UI.

  // Handler for opening TikTok publish dialog
  const handleTikTokPublish = (item: HistoryItem) => {
    setSelectedItemForTikTok(item);
    setTiktokDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Play className="w-4 h-4 text-gray-700" />
                </div>
                <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                  My Ads
                </h1>
              </div>
              <div className="relative md:max-w-sm">
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-white via-white to-amber-50/80 px-3.5 py-3 shadow-sm backdrop-blur-sm">
                  <div className="mt-0.5">
                    <CalendarClock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs md:text-sm font-semibold text-amber-900 tracking-wide uppercase">
                      Download within 15 days
                    </p>
                    <p className="text-[11px] md:text-xs text-amber-800 leading-relaxed max-w-xs">
                      Every ad stays live for 15 days only. We automatically purge expired assets, so please download anything you love before it disappears.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <div className="mb-4 md:mb-6">
            <div className="flex w-full flex-wrap items-center gap-2 md:inline-flex md:w-auto md:gap-3 rounded-2xl border border-gray-200 bg-white/80 p-3 md:p-4 shadow-sm">
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
                      'inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10',
                      isActive
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                    )}
                  >
                    <option.icon
                      className={cn(
                        'h-4 w-4',
                        isActive ? 'text-white' : 'text-gray-500'
                      )}
                    />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-gray-200"></div>
                  <div className="p-2 md:p-4">
                    <div className="h-3 md:h-4 bg-gray-200 rounded mb-1.5 md:mb-2"></div>
                    <div className="h-2.5 md:h-3 bg-gray-200 rounded w-3/4 mb-2 md:mb-3"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 md:h-6 bg-gray-200 rounded w-12 md:w-16"></div>
                      <div className="h-6 md:h-8 bg-gray-200 rounded w-16 md:w-20"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FileVideo className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-500 mb-6">Start creating your first AI-powered advertisement</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2 mx-auto"
              >
                <FileVideo className="w-4 h-4" />
                Create Project
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {currentHistory.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: visibleItems.has(item.id) ? 1 : 0,
                      y: visibleItems.has(item.id) ? 0 : 20
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-all duration-200 hover:shadow-md flex flex-col"
                  >
                    <div className="absolute top-1.5 md:top-3 left-1.5 md:left-3 flex items-center gap-1 md:gap-2 pointer-events-none z-20">
                      <div className="flex items-center gap-0.5 md:gap-1">
                        <span
                          className={cn(
                            'px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold flex items-center gap-0.5 md:gap-1 pointer-events-auto',
                            getStatusBadgeClasses(item.status)
                          )}
                        >
                          {getStatusText(item.status)}
                          {item.status === 'failed' && (
                            <div className="group">
                              <HelpCircle className="w-3 h-3 md:w-4 md:h-4" aria-label="Failed generation details" />
                              <div className="absolute left-0 right-auto top-full mt-2 w-[calc(100%-0.75rem)] max-w-[16rem] sm:max-w-[18rem] rounded-lg bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto z-50 whitespace-normal break-words">
                                <div className="font-medium mb-2">Generation Failed</div>
                                <div className="space-y-2 mb-3">
                                  <p>
                                    {('coverImageUrl' in item && item.coverImageUrl)
                                      ? 'We couldn\'t complete the video generation due to some technical issues. However, your cover image has been successfully generated and is ready to download.'
                                      : 'We couldn\'t complete the generation due to some technical issues. Please try again with a different product photo.'}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push('/dashboard/support');
                                  }}
                                  className={cn(
                                    'w-full text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-center transition-colors',
                                    interactiveCardActionClasses
                                  )}
                                >
                                  Contact Support →
                                </button>
                              </div>
                            </div>
                          )}
                        </span>
                      </div>
                      <span className={`px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300`}>
                        {isWatermarkRemoval(item)
                          ? 'Sora2 Watermark Removal'
                          : isCharacterAds(item)
                          ? 'Character'
                          : 'Competitor UGC Replication'
                        }
                      </span>
                    </div>
                    {/* Video Preview on Hover */}
                    <div
                      className="relative bg-black overflow-hidden"
                    >
                      <div
                        className={cn(
                          "w-full bg-black relative flex items-center justify-center",
                          getAspectRatioClass('videoAspectRatio' in item ? item.videoAspectRatio : '9:16')
                        )}
                        onMouseEnter={() => {
                          if (!isWatermarkRemoval(item) && item.status === 'completed' && item.videoUrl) {
                            setHoveredVideo(item.id);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredVideo(null);
                        }}
                      >
                        {
                          // Watermark removal cards show a static placeholder to match layout
                          isWatermarkRemoval(item) ? (
                            <div className="w-full h-full bg-gray-900 text-white flex flex-col items-center justify-center gap-3 px-4 text-center">
                              <AlertCircle className="w-8 h-8 text-white" />
                              <div className="text-sm leading-snug text-gray-100">
                                Sorry that we cannot preview newly de-watermarked videos. Please download to view the result.
                              </div>
                            </div>
                          ) :
                          // Regular video ad display
                          item.status === 'completed' && 'videoUrl' in item && item.videoUrl &&
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
                            <Image
                              src="/placeholder-image.png"
                              alt="Placeholder"
                              width={400}
                              height={300}
                              className="w-full h-full object-contain"
                            />
                          )
                        }
                        {hoveredVideo === item.id &&
                          !isWatermarkRemoval(item) &&
                          item.status === 'completed' &&
                          'videoUrl' in item && item.videoUrl &&
                          (('photoOnly' in item && !item.photoOnly) || isCharacterAds(item)) && (
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white pointer-events-none shadow-lg backdrop-blur-sm">
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Click for sound</span>
                            </div>
                          )}
                        {/* Unified processing overlay with circular progress */}
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
                            {isWatermarkRemoval(item) ? (
                              <Loader2 className="w-12 h-12 animate-spin text-gray-800" />
                            ) : (() => {
                              const pct = Math.round(Math.max(0, Math.min(100, item.progress ?? 0)));
                              return (
                                <div className="relative w-20 h-20">
                                  <div
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: `conic-gradient(#111 ${pct}%, #e5e7eb 0)` }}
                                  />
                                  <div className="absolute inset-1 rounded-full bg-white/70 backdrop-blur-sm" />
                                  <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                                    <span className="text-sm font-semibold text-gray-800 tabular-nums">{pct}%</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                      
                    </div>

                    {/* Card Content */}
                    <div className="p-2 md:p-4 flex-1 flex flex-col">

                      {/* Enhanced metadata display */}
                      <div className="space-y-1 md:space-y-2 mb-1 md:mb-2">
                        <div className="flex items-center text-xs md:text-sm text-gray-500 gap-1 md:gap-2">
                          <Clock className="w-3 h-3 md:w-4 md:h-4" />
                          <span className="font-medium">
                            {formatDate(item.createdAt)}
                          </span>
                          <span className="text-gray-300 hidden md:inline">•</span>
                          <span className="text-gray-400 hidden md:inline">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>


                      {/* Bottom action area - pinned to bottom for alignment */}
                      <div className="mt-auto">
                        <div className="border-t border-gray-200 bg-white -mx-2 md:-mx-4 -mb-2 md:-mb-4 px-2 md:px-4 py-2 md:py-3 flex items-center">
                          {item.status === 'processing' && (
                            <div className="flex flex-col gap-1.5 md:gap-2 w-full">
                              {/* Watermark Removal: Only show processing video button */}
                              {isWatermarkRemoval(item) ? (
                                <button
                                  disabled
                                  className="w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-gray-100 text-gray-500 rounded-lg border border-gray-200 cursor-not-allowed disabled:pointer-events-none"
                                >
                                  <div className="flex items-center gap-1.5 md:gap-2">
                                    <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    <span>Processing...</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-500">
                                    <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                  </div>
                                </button>
                              ) : (
                                <>
                                  {/* Cover button: enabled if cover is ready during processing */}
                                  <button
                                    onClick={() => { if ('coverImageUrl' in item && item.coverImageUrl) handleCoverClick(item); }}
                                    disabled={!('coverImageUrl' in item && item.coverImageUrl)}
                                    className={cn(
                                      'w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm rounded-lg border transition-colors disabled:pointer-events-none',
                                      'coverImageUrl' in item && item.coverImageUrl
                                        ? cn('bg-black text-white hover:bg-gray-800 border-black', interactiveCardActionClasses)
                                        : 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <ImageIcon className={cn('w-3.5 h-3.5 md:w-4 md:h-4', ('coverImageUrl' in item && item.coverImageUrl) ? 'text-white' : 'text-gray-500')} />
                                      <span>{('coverImageUrl' in item && item.coverImageUrl) ? (coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover') : 'Cover'}</span>
                                    </div>
                                    <div className={cn('flex items-center gap-1', ('coverImageUrl' in item && item.coverImageUrl) ? 'text-green-400' : 'text-gray-500')}>
                                      <span className="text-[10px] md:text-xs font-bold">FREE</span>
                                    </div>
                                  </button>

                                  {/* Video button: always disabled while processing */}
                                  <button
                                    disabled
                                    className="w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-gray-100 text-gray-500 rounded-lg border border-gray-200 cursor-not-allowed disabled:pointer-events-none"
                                  >
                                    <div className="flex items-center gap-1.5 md:gap-2">
                                      <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                      <span>Video</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-gray-500">
                                      <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                    </div>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {item.status === 'failed' && (
                            <div className="flex flex-col gap-1.5 md:gap-2 w-full">
                              {/* Watermark Removal & Regular Ads: Show no charge info */}
                              {isWatermarkRemoval(item) ? (
                                <div className="w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm border border-gray-300 rounded-lg">
                                  <div className="flex items-center gap-1.5 md:gap-2.5">
                                    <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
                                    <span className="font-medium text-gray-900">Credits refunded</span>
                                  </div>
                                  <div className="flex items-center gap-1 md:gap-1.5 text-gray-700">
                                    <Coins className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                    <span className="font-bold">0</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Cover Download Button */}
                                  {'coverImageUrl' in item && item.coverImageUrl && (
                                    <button
                                      onClick={() => handleCoverClick(item)}
                                      className={cn(
                                        'w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black',
                                        interactiveCardActionClasses
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        <span>{coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover'}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-green-400">
                                        <span className="text-[10px] md:text-xs font-bold">FREE</span>
                                      </div>
                                    </button>
                                  )}

                                  {/* No charge info */}
                                  <div className="w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm border border-gray-300 rounded-lg">
                                    <div className="flex items-center gap-1.5 md:gap-2.5">
                                      <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
                                      <span className="font-medium text-gray-900">No charge</span>
                                    </div>
                                    <div className="flex items-center gap-1 md:gap-1.5 text-gray-700">
                                      <Coins className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                      <span className="font-bold">0</span>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {item.status === 'completed' && (
                            <div className="flex flex-col gap-1.5 md:gap-2 w-full">
                              {/* Watermark Removal: Only show video download (free) */}
                              {isWatermarkRemoval(item) ? (
                                <>
                                  {item.videoUrl && (
                                    <button
                                      onClick={() => handleVideoClick(item)}
                                      disabled={videoStates[item.id] === 'packing'}
                                      className={cn(
                                        'w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black disabled:pointer-events-none',
                                        interactiveCardActionClasses
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <Download className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        <span className="truncate">
                                          {videoStates[item.id] ? getPackingText(videoStates[item.id]!) : 'Download'}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-green-400 flex-shrink-0">
                                        <span className="text-[10px] md:text-xs font-bold">FREE</span>
                                      </div>
                                    </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Cover Download Button (always free) */}
                                  {'coverImageUrl' in item && item.coverImageUrl && (
                                    <button
                                      onClick={() => handleCoverClick(item)}
                                      className={cn(
                                        'w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black',
                                        interactiveCardActionClasses
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <ImageIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        <span>{coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover'}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-green-400">
                                        <span className="text-[10px] md:text-xs font-bold">FREE</span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Video Download Button (paid on first download) */}
                                  {'videoUrl' in item && item.videoUrl && (
                                    <button
                                      onClick={() => handleVideoClick(item)}
                                      disabled={videoStates[item.id] === 'packing'}
                                      className={cn(
                                        'w-full flex items-center justify-between px-2 md:px-3 py-1.5 md:py-2.5 text-xs md:text-sm bg-white text-gray-900 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:pointer-events-none',
                                        interactiveCardActionClasses
                                      )}
                                    >
                                      <div className="flex items-center gap-1.5 md:gap-2">
                                        <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                        <span>{videoStates[item.id] ? getPackingText(videoStates[item.id]!) : 'Video'}</span>
                                      </div>
                                      {videoStates[item.id] === 'packing' ? (
                                        <div className="flex items-center gap-1 md:gap-1.5 text-gray-600">
                                          <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                                        </div>
                                      ) : item.downloaded ? (
                                        <div className="flex items-center gap-1 md:gap-1.5 text-green-600">
                                          <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                          <span className="text-[10px] md:text-xs font-semibold">Downloaded</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 md:gap-1.5 text-gray-800">
                                          {(() => {
                                            // Check if VEO3 prepaid (credits already deducted at generation)
                                            const isPrepaid = (item.generationCreditsUsed || 0) > 0;

                                            if (isPrepaid) {
                                              return (
                                                <span className="text-[10px] md:text-xs font-bold text-green-600">Prepaid</span>
                                              );
                                            }

                                            // Version 2.0: ALL downloads are FREE
                                            const cost = 0;
                                            return (
                                              <>
                                                <Coins className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                                <span className="font-bold">{cost}</span>
                                              </>
                                            );
                                          })()}
                                        </div>
                                      )}
                                    </button>
                                  )}

                                  {/* TikTok feature temporarily disabled - can be re-enabled by removing "false &&" */}
                                  {/* TikTok Publish Button - Only for ads with videos */}
                                  {false && 'videoUrl' in item && item.videoUrl && (
                                    <button
                                      onClick={() => handleTikTokPublish(item)}
                                      className={cn(
                                        'group relative w-full overflow-hidden rounded-lg transition-all duration-300',
                                        interactiveCardActionClasses
                                      )}
                                    >
                                      {/* Gradient background with animation */}
                                      <div className={cn(
                                        "absolute inset-0 bg-gradient-to-r from-[#00f2ea] via-[#ff0050] to-[#00f2ea] bg-[length:200%_100%]",
                                        "animate-tiktok-shimmer"
                                      )} />

                                      {/* Dark overlay */}
                                      <div className={cn(
                                        "absolute inset-0 bg-black/80 transition-colors",
                                        "group-hover:bg-black/70"
                                      )} />

                                      {/* Content */}
                                      <div className="relative flex items-center justify-center gap-2 px-2 md:px-3 py-2 md:py-2.5">
                                        {/* TikTok icon with music note style */}
                                        <svg
                                          className={cn(
                                            "w-4 h-4 md:w-5 md:h-5 fill-white transition-transform",
                                            "group-hover:scale-110"
                                          )}
                                          viewBox="0 0 24 24"
                                        >
                                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                                        </svg>

                                        {/* Text with gradient */}
                                        <span className={cn(
                                          "text-xs md:text-sm font-bold bg-gradient-to-r from-[#00f2ea] to-[#ff0050] bg-clip-text text-transparent transition-all duration-500",
                                          "group-hover:from-[#ff0050] group-hover:to-[#00f2ea]"
                                        )}>
                                          Post to TikTok
                                        </span>

                                        {/* Arrow icon */}
                                        <Send className={cn(
                                          "w-3 h-3 md:w-3.5 md:h-3.5 text-white transition-transform",
                                          "group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                        )} />
                                      </div>

                                      {/* Shine effect on hover - only if enabled */}
                                      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Pagination - Always show if there are items */}
              {filteredHistory.length > 0 && (
                <div className="mt-8 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={cn(
                        'px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                        paginationButtonClasses
                      )}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Page numbers with smart truncation */}
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 7;
                      
                      if (totalPages <= maxVisiblePages) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        // Smart truncation for many pages
                        if (currentPage <= 4) {
                          // Near start: show 1,2,3,4,5,...,last
                          for (let i = 1; i <= 5; i++) {
                            pages.push(i);
                          }
                          pages.push('...');
                          pages.push(totalPages);
                        } else if (currentPage >= totalPages - 3) {
                          // Near end: show 1,...,last-4,last-3,last-2,last-1,last
                          pages.push(1);
                          pages.push('...');
                          for (let i = totalPages - 4; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Middle: show 1,...,current-1,current,current+1,...,last
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
                            <span className="px-3 py-2 text-sm text-gray-400">...</span>
                          ) : (
                            <button
                              onClick={() => goToPage(page as number)}
                              className={cn(
                                'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                currentPage === page
                                  ? 'bg-gray-900 text-white'
                                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50',
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
                        'px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
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

      {/* TikTok feature temporarily disabled - can be re-enabled by removing "false &&" */}
      {/* TikTok Publish Dialog */}
      {false && (
      <TikTokPublishDialog
        isOpen={tiktokDialogOpen}
        onClose={() => {
          setTiktokDialogOpen(false);
          setSelectedItemForTikTok(null);
        }}
        historyId={selectedItemForTikTok?.id || ''}
        coverImageUrl={
          (selectedItemForTikTok && 'coverImageUrl' in (selectedItemForTikTok || {}))
            ? (selectedItemForTikTok as CompetitorUgcReplicationItem | CharacterAdsItem).coverImageUrl
            : undefined
        }
      />
      )}
    </div>
  );
}
