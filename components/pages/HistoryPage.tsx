'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import RetryImage from '@/components/ui/RetryImage';
import { ChevronLeft, ChevronRight, Clock, Coins, FileVideo, RotateCcw, Loader2, Play, Image as ImageIcon, Video, MessageSquare, HelpCircle, Download } from 'lucide-react';
import { getCreditCost } from '@/lib/constants';
import { cn } from '@/lib/utils';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface StandardAdsItem {
  id: string;
  originalImageUrl: string;
  coverImageUrl?: string;
  videoUrl?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  productDescription?: string;
  imagePrompt?: string;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'standard';
}

interface MultiVariantAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  photoOnly?: boolean;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  productDescription?: string;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'multi-variant';
  elementsData?: Record<string, unknown>;
}

interface YoutubeThumbnailItem {
  id: string;
  title: string;
  identity_image_url: string;
  thumbnail_url?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  credits_cost: number;
  downloaded: boolean;
  created_at: string;
  createdAt: string;
  error_message?: string;
  isYoutubeThumbnail: true;
}

interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
  downloaded?: boolean;
  downloadCreditsUsed?: number;
  generationCreditsUsed?: number;
  videoModel: 'veo3' | 'veo3_fast';
  creditsUsed: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
  progress?: number;
  currentStep?: string;
  adType: 'character';
  videoDurationSeconds?: number;
}

type HistoryItem = StandardAdsItem | MultiVariantAdsItem | YoutubeThumbnailItem | CharacterAdsItem;

const ITEMS_PER_PAGE = 6; // 2 rows × 3 columns = 6 items per page

// Helper functions
const isYoutubeThumbnail = (item: HistoryItem): item is YoutubeThumbnailItem => {
  return 'isYoutubeThumbnail' in item && item.isYoutubeThumbnail === true;
};

const isCharacterAds = (item: HistoryItem): item is CharacterAdsItem => {
  return 'adType' in item && item.adType === 'character';
};

const isStandardAds = (item: HistoryItem): item is StandardAdsItem => {
  return 'adType' in item && item.adType === 'standard';
};

const isMultiVariantAds = (item: HistoryItem): item is MultiVariantAdsItem => {
  return 'adType' in item && item.adType === 'multi-variant';
};

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [contentFilter, setContentFilter] = useState<'all' | 'video-ads' | 'youtube-thumbnails'>('all');
  const { credits: userCredits, refetchCredits } = useCredits();
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setDownloadStates] = useState<Record<string, 'idle' | 'processing' | 'success'>>({});
  // Cover UI transient state: 'packing' -> 'done' -> cleared
  const [coverStates, setCoverStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // Video UI transient state: 'packing' -> 'done' -> cleared
  const [videoStates, setVideoStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // YouTube thumbnail UI transient state: 'packing' -> 'done' -> cleared
  const [youtubeThumbnailStates, setYoutubeThumbnailStates] = useState<Record<string, 'packing' | 'done' | null>>({});


  // Memoized filtered history for better performance
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Status filter
      const statusMatch = filter === 'all' || item.status === filter;

      // Content type filter
      let contentMatch = true;
      if (contentFilter === 'video-ads') {
        contentMatch = !isYoutubeThumbnail(item);
      } else if (contentFilter === 'youtube-thumbnails') {
        contentMatch = isYoutubeThumbnail(item);
      }

      return statusMatch && contentMatch;
    });
  }, [history, filter, contentFilter]);

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
        // Fetch both APIs in parallel
        const [videoResponse, thumbnailResponse] = await Promise.all([
          fetch('/api/history'),
          fetch('/api/youtube-thumbnail/history')
        ]);

        const [videoResult, thumbnailResult] = await Promise.all([
          videoResponse.json(),
          thumbnailResponse.json()
        ]);

        let combinedHistory: HistoryItem[] = [];

        if (videoResult.success) {
          combinedHistory = [...combinedHistory, ...videoResult.history];
        }

        if (thumbnailResult.success) {
          const thumbnailItems = thumbnailResult.history.map((item: YoutubeThumbnailItem) => ({
            ...item,
            createdAt: item.created_at,
            isYoutubeThumbnail: true
          }));
          combinedHistory = [...combinedHistory, ...thumbnailItems];
        }

        // Sort by creation date
        combinedHistory.sort((a, b) => {
          const aDate = isYoutubeThumbnail(a) ? a.created_at : a.createdAt;
          const bDate = isYoutubeThumbnail(b) ? b.created_at : b.createdAt;
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
        // Fetch both video ads and YouTube thumbnails
        const [videoResponse, thumbnailResponse] = await Promise.all([
          fetch('/api/history'),
          fetch('/api/youtube-thumbnail/history')
        ]);

        const videoResult = await videoResponse.json();
        const thumbnailResult = await thumbnailResponse.json();

        if (!isCancelled) {
          let combinedHistory: HistoryItem[] = [];

          if (videoResult.success) {
            combinedHistory = [...combinedHistory, ...videoResult.history];
          }

          if (thumbnailResult.success) {
            const thumbnailItems = thumbnailResult.history.map((item: YoutubeThumbnailItem) => ({
              ...item,
              createdAt: item.created_at,
              isYoutubeThumbnail: true
            }));
            combinedHistory = [...combinedHistory, ...thumbnailItems];
          }

          // Sort by creation date
          combinedHistory.sort((a, b) => {
            const aDate = isYoutubeThumbnail(a) ? a.created_at : a.createdAt;
            const bDate = isYoutubeThumbnail(b) ? b.created_at : b.createdAt;
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          });

          setHistory(combinedHistory);
        }
      } catch (err) {
        console.warn('Polling history failed:', err);
      }
    };

    const interval = setInterval(poll, 5000);
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
  }, [filter, contentFilter]);

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
        return 'bg-green-100 text-green-700 border border-green-200';
      case 'processing':
        return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border border-gray-200';
    }
  };

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
  const downloadVideo = async (historyId: string, videoModel: 'veo3' | 'veo3_fast') => {
    if (!user?.id || !userCredits) return;

    const item = history.find(h => h.id === historyId);
    const isFirstDownload = !item?.downloaded;

    if (!item || isYoutubeThumbnail(item)) return; // Skip for YouTube thumbnails

    // Calculate download cost based on video duration for Character Ads
    let downloadCost = getCreditCost(videoModel);
    if (isCharacterAds(item) && item.videoDurationSeconds) {
      // For Character Ads: cost = (duration / 8) * base_cost_per_8s
      const baseCostPer8s = getCreditCost(videoModel);
      downloadCost = Math.round((item.videoDurationSeconds / 8) * baseCostPer8s);
    }

    if (isFirstDownload && userCredits < downloadCost) {
      alert(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
      return;
    }

    // Start download animation
    setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));
    setDownloadingVideo(historyId);

    try {
      // Use different API endpoint for Character Ads
      const apiEndpoint = isCharacterAds(item) ? '/api/character-ads/download' : '/api/download-video';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          historyId,
          userId: user.id,
          ...(isCharacterAds(item) && { videoDurationSeconds: item.videoDurationSeconds })
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('video/mp4')) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `flowtra-video-${historyId}.mp4`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          window.URL.revokeObjectURL(url);
          
          // Show success state
          setDownloadStates(prev => ({ ...prev, [historyId]: 'success' }));
          
          // Update history
          setHistory(prevHistory =>
            prevHistory.map(item =>
              item.id === historyId && !isYoutubeThumbnail(item)
                ? {
                    ...item,
                    downloaded: true,
                    downloadCreditsUsed: isFirstDownload ? downloadCost : item.downloadCreditsUsed,
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

        } else {
          const result = await response.json();
          alert(result.message || 'Failed to download video');
          setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
        }
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to authorize download');
        setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('An error occurred while downloading the video');
      setDownloadStates(prev => ({ ...prev, [historyId]: 'idle' }));
    } finally {
      setDownloadingVideo(null);
    }
  };

  // Generate a short emotional phrase for the Cover button
  const getPackingText = (stage: 'packing' | 'done') =>
    stage === 'packing' ? 'Packing…' : 'Ready!';

  // YouTube thumbnail download function
  const handleYoutubeThumbnailDownload = async (thumbnailId: string) => {
    try {
      const response = await fetch(`/api/youtube-thumbnail/download/${thumbnailId}`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();

        // Fetch as blob to force background download without navigation
        const res = await fetch(data.downloadUrl, { mode: 'cors' });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const contentType = blob.type || 'image/png';
        const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' :
                   contentType.includes('webp') ? 'webp' : 'png';

        // Download the file
        const link = document.createElement('a');
        link.href = url;
        link.download = `thumbnail-${thumbnailId}.${ext}`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL
        URL.revokeObjectURL(url);

        await refetchCredits();
        // Update history to mark as downloaded
        setHistory(prevHistory =>
          prevHistory.map(item =>
            item.id === thumbnailId && isYoutubeThumbnail(item)
              ? { ...item, downloaded: true }
              : item
          )
        );
      } else {
        const error = await response.json();
        alert(error.message || 'Download failed');
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed, please retry');
    }
  };

  // YouTube thumbnail download handler with animations
  const handleYoutubeThumbnailClick = async (item: YoutubeThumbnailItem) => {
    const id = item.id;
    setYoutubeThumbnailStates(prev => ({ ...prev, [id]: 'packing' }));
    try {
      await handleYoutubeThumbnailDownload(item.id);
      setYoutubeThumbnailStates(prev => ({ ...prev, [id]: 'done' }));
    } finally {
      setTimeout(() => {
        setYoutubeThumbnailStates(prev => ({ ...prev, [id]: null }));
      }, 1200);
    }
  };

  // Standard ads cover download function (free) — show phrase only, no video download state
  const downloadStandardAdsCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || isYoutubeThumbnail(item) || !('coverImageUrl' in item) || !item.coverImageUrl) return;

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

  // Character ads cover download function (free) — similar to standard ads
  const downloadCharacterAdsCover = async (historyId: string) => {
    if (!user?.id) return;

    const item = history.find(h => h.id === historyId);
    if (!item || isYoutubeThumbnail(item) || !isCharacterAds(item) || !item.coverImageUrl) return;

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

  // Multi-variant ads download function
  const downloadMultiVariantAdsContent = async (instanceId: string, contentType: 'cover' | 'video', videoModel: 'veo3' | 'veo3_fast') => {
    if (!user?.id) return;

    const downloadCost = getCreditCost(videoModel);
    
    if (contentType === 'video' && (!userCredits || userCredits < downloadCost)) {
      alert(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
      return;
    }

    // Only track download state for paid video; cover should not affect video button state
    if (contentType === 'video') {
      setDownloadStates(prev => ({ ...prev, [instanceId]: 'processing' }));
    }

    try {
      const response = await fetch(`/api/multi-variant-ads/${instanceId}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download content');
      }

      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        // For cover: fetch as blob to avoid any navigation; for video keep direct download flow
        if (contentType === 'cover') {
          const res2 = await fetch(result.downloadUrl, { mode: 'cors' });
          const blob2 = await res2.blob();
          const url2 = URL.createObjectURL(blob2);
          const contentType2 = blob2.type || 'image/jpeg';
          const ext2 = contentType2.includes('png') ? 'png' : contentType2.includes('webp') ? 'webp' : 'jpg';
          const link2 = document.createElement('a');
          link2.href = url2;
          link2.download = `${contentType}-${instanceId}.${ext2}`;
          link2.style.display = 'none';
          document.body.appendChild(link2);
          link2.click();
          document.body.removeChild(link2);
          URL.revokeObjectURL(url2);
        } else {
          // Fetch video as blob as well to avoid any chance of navigation
          const res3 = await fetch(result.downloadUrl, { mode: 'cors' });
          const blob3 = await res3.blob();
          const url3 = URL.createObjectURL(blob3);
          const link3 = document.createElement('a');
          link3.href = url3;
          link3.download = `${contentType}-${instanceId}.mp4`;
          link3.style.display = 'none';
          document.body.appendChild(link3);
          link3.click();
          document.body.removeChild(link3);
          URL.revokeObjectURL(url3);
        }

        // Show success state only for paid video
        if (contentType === 'video') {
          setDownloadStates(prev => ({ ...prev, [instanceId]: 'success' }));
        }

        // Update local state if it was a video download (paid content)
        if (contentType === 'video' && result.creditsUsed > 0) {
          setHistory(prevHistory =>
            prevHistory.map(item => 
              item.id === instanceId && isMultiVariantAds(item)
                ? { ...item, downloaded: true }
                : item
            )
          );

          await refetchCredits();
        }

        // Reset to idle after 3 seconds (video only)
        if (contentType === 'video') {
          setTimeout(() => {
            setDownloadStates(prev => ({ ...prev, [instanceId]: 'idle' }));
          }, 3000);
        }
      }

      return result;
    } catch (error) {
      console.error('Download failed:', error);
      alert(error instanceof Error ? error.message : 'Download failed');
      if (contentType === 'video') {
        setDownloadStates(prev => ({ ...prev, [instanceId]: 'idle' }));
      }
      throw error;
    }
  };

  // Unified handler to show emotional phrase on Cover click then trigger download
  const handleCoverClick = async (item: HistoryItem) => {
    if (isYoutubeThumbnail(item)) return;

    const id = item.id;
    setCoverStates(prev => ({ ...prev, [id]: 'packing' }));
    try {
      if (isMultiVariantAds(item)) {
        await downloadMultiVariantAdsContent(item.id, 'cover', item.videoModel);
      } else if (isStandardAds(item)) {
        await downloadStandardAdsCover(item.id);
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
    if (isYoutubeThumbnail(item)) return;

    const id = item.id;
    setVideoStates(prev => ({ ...prev, [id]: 'packing' }));
    try {
      if (isMultiVariantAds(item)) {
        await downloadMultiVariantAdsContent(item.id, 'video', item.videoModel);
      } else if (isStandardAds(item) || isCharacterAds(item)) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-72 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                My Ads
              </h1>
            </div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600 text-sm">
                Manage your video advertisements and track performance
              </p>
              <button
                onClick={() => router.push('/dashboard/support')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <MessageSquare className="w-4 h-4" />
                Share Feedback
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Content Type Filter */}
                <div className="bg-gray-50 p-1 rounded-lg inline-flex">
                  {([
                    { value: 'all', label: 'All Content' },
                    { value: 'video-ads', label: 'Video Ads' },
                    { value: 'youtube-thumbnails', label: 'YouTube Thumbnails' }
                  ] as const).map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setContentFilter(type.value)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                        contentFilter === type.value
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status Filter */}
                <div className="bg-gray-50 p-1 rounded-lg inline-flex">
                  {(['all', 'completed', 'processing', 'failed'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                        filter === status
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Projects Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-200"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-6 bg-gray-200 rounded w-16"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-20">
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 pointer-events-auto',
                            getStatusBadgeClasses(item.status)
                          )}
                        >
                          {getStatusText(item.status)}
                          {item.status === 'failed' && (
                            <div className="relative group">
                              <HelpCircle className="w-4 h-4" aria-label="Failed generation details" />
                              <div className="absolute left-0 top-full mt-2 w-64 rounded-lg bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto z-50">
                                <div className="font-medium mb-2">Generation Failed</div>
                                <div className="space-y-1 mb-3">
                                  <p>Sorry, there was an issue during generation.</p>
                                  <p className="text-yellow-300">• We&apos;ll refund your credits</p>
                                  <p className="text-blue-300">• Please try with a different image</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push('/dashboard/support');
                                  }}
                                  className="w-full text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-center transition-colors"
                                >
                                  Contact Support →
                                </button>
                              </div>
                            </div>
                          )}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isYoutubeThumbnail(item)
                          ? 'bg-red-100 text-red-700 border border-red-200'
                          : isCharacterAds(item)
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : isMultiVariantAds(item)
                          ? 'bg-gradient-to-r from-orange-100 to-yellow-100 text-orange-700 border border-orange-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        {isYoutubeThumbnail(item)
                          ? 'YouTube Thumbnail'
                          : isCharacterAds(item)
                          ? 'Character Spokesperson'
                          : isMultiVariantAds(item)
                          ? 'Creative Mix'
                          : 'Product Focus'
                        }
                      </span>
                    </div>
                    {/* Video Preview on Hover */}
                    <div 
                      className="relative bg-white"
                      onMouseEnter={() => {
                        if (item.status === 'completed' && !isYoutubeThumbnail(item) && item.videoUrl) {
                          setHoveredVideo(item.id);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredVideo(null);
                      }}
                    >
                      <div className="aspect-[16/9] bg-white relative overflow-hidden">
                        {isYoutubeThumbnail(item) ? (
                          // YouTube Thumbnail display
                          item.thumbnail_url ? (
                            <RetryImage
                              src={item.thumbnail_url}
                              alt={item.title}
                              width={400}
                              height={300}
                              className="w-full h-full object-cover"
                              maxRetries={8}
                              retryDelay={1500}
                            />
                          ) : (
                            <RetryImage
                              src={item.identity_image_url}
                              alt={item.title}
                              width={400}
                              height={300}
                              className="w-full h-full object-cover"
                              maxRetries={8}
                              retryDelay={1500}
                            />
                          )
                        ) : (
                          // Regular video ad display
                          item.status === 'completed' && 'videoUrl' in item && item.videoUrl &&
                          (('photoOnly' in item && !item.photoOnly) || isCharacterAds(item)) &&
                          hoveredVideo === item.id ? (
                            <VideoPlayer
                              src={item.videoUrl}
                              className="w-full h-full object-cover"
                              autoPlay={true}
                              loop={true}
                              playsInline={true}
                              showControls={true}
                            />
                          ) : item.coverImageUrl ? (
                            <Image
                              src={item.coverImageUrl}
                              alt="Generated cover"
                              width={400}
                              height={300}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Image
                              src={item.originalImageUrl || '/placeholder-image.png'}
                              alt="Original product"
                              width={400}
                              height={300}
                              className="w-full h-full object-cover"
                            />
                          )
                        )}
                      </div>
                      
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      
                      {/* Enhanced metadata display */}
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center text-sm text-gray-500 gap-2">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">
                            {formatDate(isYoutubeThumbnail(item) ? item.created_at : item.createdAt)}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">
                            {formatTime(isYoutubeThumbnail(item) ? item.created_at : item.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Processing: no progress bar; keep layout consistent */}
                      {item.status === 'processing' && (
                        <div className="mt-2" />
                      )}

                      {/* Bottom action area - pinned to bottom for alignment */}
                      <div className="mt-auto">
                        <div className="border-t border-gray-200 bg-white -mx-4 -mb-4 px-4 py-3 min-h-[64px] flex items-center">
                          {item.status === 'failed' && (
                            <div className="flex gap-3 w-full">
                              {/* Cover Download Button (Left side) */}
                              {!isYoutubeThumbnail(item) && 'coverImageUrl' in item && item.coverImageUrl && (
                                <button
                                  onClick={() => isMultiVariantAds(item) ?
                                    downloadMultiVariantAdsContent(item.id, 'cover', item.videoModel) :
                                    downloadStandardAdsCover(item.id)
                                  }
                                  className="h-10 flex-1 flex items-center justify-between px-3 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black"
                                >
                                  <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-white" />
                                    <span>Cover</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-green-400">
                                    <span className="text-xs font-bold">FREE</span>
                                  </div>
                                </button>
                              )}
                              
                              {/* No charge info (Right side) */}
                              <div className={`${(!isYoutubeThumbnail(item) && 'coverImageUrl' in item && item.coverImageUrl) ? 'flex-1' : 'w-full'} flex items-center justify-between px-3 py-2.5 text-sm border border-gray-300 rounded-lg`}>
                                <div className="flex items-center gap-2.5">
                                  <RotateCcw className="w-4 h-4 text-gray-600" />
                                  <span className="font-medium text-gray-900">No charge</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-gray-700">
                                  <Coins className="w-4 h-4" />
                                  <span className="font-bold">0</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {item.status === 'completed' && (
                            <div className="flex gap-3 w-full">
                              {isYoutubeThumbnail(item) ? (
                                // YouTube Thumbnail Download Button with left-right layout
                                <button
                                  onClick={() => handleYoutubeThumbnailClick(item)}
                                  disabled={item.downloaded || youtubeThumbnailStates[item.id] === 'packing' || (!item.downloaded && (!userCredits || userCredits < item.credits_cost))}
                                  className={`w-full h-10 flex items-center justify-between px-3 text-sm border border-gray-300 rounded-lg transition-colors ${
                                    (!item.downloaded && (!userCredits || userCredits < item.credits_cost))
                                      ? 'text-red-600 hover:bg-red-50'
                                      : 'text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Download className="w-4 h-4 text-gray-600" />
                                    <span>Thumbnail</span>
                                  </div>
                                  <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                      key={
                                        !item.downloaded
                                          ? (youtubeThumbnailStates[item.id] || 'cost')
                                          : (youtubeThumbnailStates[item.id] || 'downloaded')
                                      }
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -6 }}
                                      transition={{ duration: 0.18 }}
                                      className={`flex items-center gap-1 ${
                                        (!item.downloaded && (!userCredits || userCredits < item.credits_cost))
                                          ? 'text-red-600'
                                          : youtubeThumbnailStates[item.id] === 'done'
                                          ? 'text-green-600'
                                          : 'text-gray-700'
                                      }`}
                                    >
                                      {(() => {
                                        const isInsufficient = (!item.downloaded && (!userCredits || userCredits < item.credits_cost));
                                        const isDownloading = youtubeThumbnailStates[item.id] === 'packing' || youtubeThumbnailStates[item.id] === 'done';

                                        if (isInsufficient) {
                                          return (
                                            <span className="text-xs font-bold">Insufficient</span>
                                          );
                                        }
                                        if (!item.downloaded) {
                                          if (isDownloading) {
                                            return (
                                              <span className="text-xs font-bold">{youtubeThumbnailStates[item.id] === 'packing' ? getPackingText('packing') : getPackingText('done')}</span>
                                            );
                                          }
                                          // Show credits cost with coins icon
                                          return (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold">
                                              <Coins className="w-3 h-3" />
                                              {item.credits_cost}
                                            </span>
                                          );
                                        }
                                        // Downloaded state
                                        if (isDownloading) {
                                          return (
                                            <span className="text-xs font-bold">{youtubeThumbnailStates[item.id] === 'packing' ? getPackingText('packing') : getPackingText('done')}</span>
                                          );
                                        }
                                        return (
                                          <span className="text-xs font-bold">Downloaded</span>
                                        );
                                      })()}
                                    </motion.div>
                                  </AnimatePresence>
                                </button>
                              ) : (
                                <>
                                  {/* Cover Download Button (Free) - Both V1 and V2 */}
                                  {!isYoutubeThumbnail(item) && 'coverImageUrl' in item && item.coverImageUrl && (
                                    <button
                                      onClick={() => handleCoverClick(item)}
                                      className="flex-1 px-3 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-white" />
                                        <span>Cover</span>
                                      </div>
                                      <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                          key={coverStates[item.id] || 'free'}
                                          initial={{ opacity: 0, y: 6 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -6 }}
                                          transition={{ duration: 0.18 }}
                                          className="flex items-center gap-1 text-green-400"
                                        >
                                          <span className="text-xs font-bold">
                                            {!coverStates[item.id]
                                              ? 'FREE'
                                              : coverStates[item.id] === 'packing'
                                              ? getPackingText('packing')
                                              : getPackingText('done')}
                                          </span>
                                        </motion.div>
                                      </AnimatePresence>
                                    </button>
                                  )}

                                  {/* Video Download Button - Emotional text only, smooth transitions */}
                                  {!isYoutubeThumbnail(item) && 'videoUrl' in item && item.videoUrl && (
                                    <button
                                      onClick={() => handleVideoClick(item)}
                                      disabled={downloadingVideo === item.id || videoStates[item.id] === 'packing' || (!item.downloaded && ('videoModel' in item) && (!userCredits || userCredits < getCreditCost(item.videoModel)))}
                                      className={`${(!isYoutubeThumbnail(item) && 'coverImageUrl' in item && item.coverImageUrl) ? 'flex-1' : 'w-full'} h-10 flex items-center justify-between px-3 text-sm border border-gray-300 rounded-lg transition-colors ${
                                        (!item.downloaded && ('videoModel' in item) && (!userCredits || userCredits < getCreditCost(item.videoModel)))
                                          ? 'text-red-600 hover:bg-red-50'
                                          : 'text-gray-700 hover:bg-gray-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Video className="w-4 h-4 text-gray-600" />
                                        <span>Video</span>
                                      </div>
                                      <AnimatePresence mode="wait" initial={false}>
                                        <motion.div
                                          key={
                                            !item.downloaded
                                              ? (videoStates[item.id] || 'cost')
                                              : (videoStates[item.id] || 'downloaded')
                                          }
                                          initial={{ opacity: 0, y: 6 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          exit={{ opacity: 0, y: -6 }}
                                          transition={{ duration: 0.18 }}
                                          className={`flex items-center gap-1 ${
                                            (!item.downloaded && (!userCredits || userCredits < getCreditCost(item.videoModel)))
                                              ? 'text-red-600'
                                              : videoStates[item.id] === 'done'
                                              ? 'text-green-600'
                                              : 'text-gray-700'
                                          }`}
                                        >
                                          {(() => {
                                            const hasVideoModel = 'videoModel' in item;
                                            const isInsufficient = (!item.downloaded && hasVideoModel && (!userCredits || userCredits < getCreditCost(item.videoModel)));
                                            const isDownloading = videoStates[item.id] === 'packing' || videoStates[item.id] === 'done';
                                            if (isInsufficient) {
                                              return (
                                                <span className="text-xs font-bold">Insufficient</span>
                                              );
                                            }
                                            if (!item.downloaded) {
                                              if (isDownloading) {
                                                return (
                                                  <span className="text-xs font-bold">{videoStates[item.id] === 'packing' ? getPackingText('packing') : getPackingText('done')}</span>
                                                );
                                              }
                                              // Show credits based on ad type
                                              return (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold">
                                                  <Coins className="w-3 h-3" />
                                                  {isCharacterAds(item) ? item.creditsUsed : getCreditCost(item.videoModel)}
                                                </span>
                                              );
                                            }
                                            // Downloaded state
                                            if (isDownloading) {
                                              return (
                                                <span className="text-xs font-bold">{videoStates[item.id] === 'packing' ? getPackingText('packing') : getPackingText('done')}</span>
                                              );
                                            }
                                            return (
                                              <span className="text-xs font-bold">Downloaded</span>
                                            );
                                          })()}
                                        </motion.div>
                                      </AnimatePresence>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {item.status === 'processing' && (
                            <div className="flex gap-3 w-full">
                              {/* Cover button - enabled if cover is ready, disabled if still generating */}
                              {!isYoutubeThumbnail(item) && 'coverImageUrl' in item && item.coverImageUrl ? (
                                // Cover is ready - allow download
                                <button
                                  onClick={() => handleCoverClick(item)}
                                  className="flex-1 px-3 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-white" />
                                    <span>Cover</span>
                                  </div>
                                  <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                      key={coverStates[item.id] || 'free'}
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -6 }}
                                      transition={{ duration: 0.18 }}
                                      className="flex items-center gap-1 text-green-400"
                                    >
                                      <span className="text-xs font-bold">
                                        {!coverStates[item.id]
                                          ? 'FREE'
                                          : coverStates[item.id] === 'packing'
                                          ? getPackingText('packing')
                                          : getPackingText('done')}
                                      </span>
                                    </motion.div>
                                  </AnimatePresence>
                                </button>
                              ) : (
                                // Cover still generating - show disabled state
                                <button
                                  disabled
                                  className="h-10 flex-1 flex items-center justify-between px-3 text-sm border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed"
                                >
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                    <span>Cover</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-700">
                                    <span className="text-xs font-bold">Generating…</span>
                                  </div>
                                </button>
                              )}

                              {/* Video generating button with spinner (hidden for photo-only) */}
                              {!isYoutubeThumbnail(item) &&
                               (('photoOnly' in item && !item.photoOnly) || isCharacterAds(item)) && (
                                <button
                                  disabled
                                  className="h-10 flex-1 flex items-center justify-between px-3 text-sm border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed"
                                >
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                    <span>Video</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-700">
                                    <span className="text-xs font-bold">{!isYoutubeThumbnail(item) ? (item.progress || 0) : 0}%</span>
                                  </div>
                                </button>
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
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                currentPage === page
                                  ? 'bg-gray-900 text-white'
                                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
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
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
}
