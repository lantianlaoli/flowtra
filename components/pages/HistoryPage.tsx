'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { ChevronLeft, ChevronRight, Clock, Coins, FileVideo, RotateCcw, Loader2, Play, Image as ImageIcon, Video as VideoIcon, Layers, HelpCircle, Download, Check } from 'lucide-react';
import { getCreditCost } from '@/lib/constants';
import { cn } from '@/lib/utils';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
  videoModel: 'veo3' | 'veo3_fast' | 'sora2';
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


interface CharacterAdsItem {
  id: string;
  originalImageUrl?: string;
  coverImageUrl?: string;
  videoUrl?: string;
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
}

type HistoryItem = StandardAdsItem | MultiVariantAdsItem | CharacterAdsItem;

const ITEMS_PER_PAGE = 6; // 2 rows × 3 columns = 6 items per page

// Helper functions

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
  // Content filter simplified: only video ads types remain
  const [contentFilter, setContentFilter] = useState<'all' | 'standard' | 'multi-variant' | 'character'>('all');
  const { credits: userCredits, refetchCredits } = useCredits();
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [, setDownloadStates] = useState<Record<string, 'idle' | 'processing' | 'success'>>({});
  // Deprecated YouTube thumbnail helpers (kept to satisfy type system after feature removal)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const youtubeThumbnailStates: Record<string, 'packing' | 'done' | null> = {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleYoutubeThumbnailClick = (_item: unknown) => {};
  // Cover UI transient state: 'packing' -> 'done' -> cleared
  const [coverStates, setCoverStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // Video UI transient state: 'packing' -> 'done' -> cleared
  const [videoStates, setVideoStates] = useState<Record<string, 'packing' | 'done' | null>>({});
  // Removed YouTube thumbnail transient state


  // Memoized filtered history for better performance
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Status filter
      const statusMatch = filter === 'all' || item.status === filter;
      // Content filter by ad type
      const contentMatch =
        contentFilter === 'all' ||
        (contentFilter === 'standard' && isStandardAds(item)) ||
        (contentFilter === 'multi-variant' && isMultiVariantAds(item)) ||
        (contentFilter === 'character' && isCharacterAds(item));
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
        return 'bg-gray-900 text-white border border-gray-900';
      case 'processing':
        return 'bg-gray-100 text-gray-800 border border-gray-300';
      case 'failed':
        return 'bg-white text-gray-900 border border-gray-900';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  const getStepLabel = (step?: string) => {
    if (!step) return 'Processing';
    const map: Record<string, string> = {
      analyzing_image: 'Analyzing Image',
      generating_cover: 'Generating Cover',
      generating_video: 'Generating Video',
      merging_video: 'Merging Video',
      uploading_assets: 'Uploading Assets',
    };
    return map[step] || 'Processing';
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
const downloadVideo = async (historyId: string, videoModel: 'veo3' | 'veo3_fast' | 'sora2') => {
    if (!user?.id || !userCredits) return;

    const item = history.find(h => h.id === historyId);
    const isFirstDownload = !item?.downloaded;

    if (!item) return;

    // Calculate download cost based on video duration for Character Ads
    let downloadCost = getCreditCost(videoModel);
    if (isCharacterAds(item) && item.videoDurationSeconds) {
      // For Character Ads: cost = (duration / unitSeconds) * base_cost_per_unit
      const unitSeconds = videoModel === 'sora2' ? 10 : 8;
      const baseCostPerUnit = getCreditCost(videoModel);
      downloadCost = Math.round((item.videoDurationSeconds / unitSeconds) * baseCostPerUnit);
    }

    if (isFirstDownload && userCredits < downloadCost) {
      alert(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
      return;
    }

    // Start download animation
    setDownloadStates(prev => ({ ...prev, [historyId]: 'processing' }));

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
              item.id === historyId
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
    }
  };

  // Generate a short emotional phrase for the Cover button
  const getPackingText = (stage: 'packing' | 'done') =>
    stage === 'packing' ? 'Packing…' : 'Ready!';

  // Removed YouTube thumbnail download handlers

  // Standard ads cover download function (free) — show phrase only, no video download state
  const downloadStandardAdsCover = async (historyId: string) => {
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

  // Character ads cover download function (free) — similar to standard ads
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
    // only for ads content

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
    // only for ads content

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
      
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
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
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Content Type Filter (Discover-like) */}
                <div className="bg-white border border-gray-200 p-1 rounded-lg inline-flex shadow-sm">
                  {([
                    { value: 'all', label: 'All', icon: ImageIcon },
                    { value: 'standard', label: 'Standard', icon: ImageIcon },
                    { value: 'multi-variant', label: 'Multi-Variant', icon: Layers },
                    { value: 'character', label: 'Character', icon: VideoIcon },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setContentFilter(opt.value)}
                      className={`h-8 px-2.5 flex items-center gap-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        contentFilter === opt.value ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{opt.label}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-gray-200"></div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                            <div className="group">
                              <HelpCircle className="w-4 h-4" aria-label="Failed generation details" />
                              <div className="absolute left-0 right-auto top-full mt-2 w-[calc(100%-0.75rem)] max-w-[16rem] sm:max-w-[18rem] rounded-lg bg-gray-900 text-white text-xs leading-relaxed p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-auto z-50 whitespace-normal break-words">
                                <div className="font-medium mb-2">Generation Failed</div>
                                <div className="space-y-2 mb-3">
                                  <p>
                                    This video couldn&apos;t be generated because your image may violate
                                    Google&apos;s content policy. Please try again with a different product
                                    photo.
                                  </p>
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300`}>
                        {isCharacterAds(item)
                          ? 'Character'
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
                        if (item.status === 'completed' && item.videoUrl) {
                          setHoveredVideo(item.id);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredVideo(null);
                      }}
                    >
                      <div className="aspect-[3/4] bg-white relative overflow-hidden">
                        {
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
                        }
                        {/* Character Ads processing overlay: soft veil + circular progress */}
                        {item.status === 'processing' && isCharacterAds(item) && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
                            {(() => {
                              const pct = Math.round(Math.max(0, Math.min(100, item.progress ?? 0)));
                              return (
                                <div className="relative w-20 h-20">
                                  <div
                                    className="absolute inset-0 rounded-full"
                                    style={{ background: `conic-gradient(#111 ${pct}%, #e5e7eb 0)` }}
                                  />
                                  <div className="absolute inset-1 rounded-full bg-white/70 backdrop-blur-sm" />
                                  <div className="absolute inset-0 flex items-center justify-center">
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
                    <div className="p-4 flex-1 flex flex-col">
                      
                      {/* Enhanced metadata display */}
                      <div className="space-y-2 mb-2">
                        <div className="flex items-center text-sm text-gray-500 gap-2">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">
                            {formatDate(item.createdAt)}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">
                            {formatTime(item.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Processing: show progress like other ad types (non-character only) */}
                      {item.status === 'processing' && !isCharacterAds(item) && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span className="font-medium">{getStepLabel(item.currentStep)}</span>
                            <span className="tabular-nums">{Math.round(Math.max(0, Math.min(100, item.progress ?? 0)))}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gray-900 transition-all"
                              style={{ width: `${Math.round(Math.max(0, Math.min(100, item.progress ?? 0)))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Bottom action area - pinned to bottom for alignment */}
                      <div className="mt-auto">
                        <div className="border-t border-gray-200 bg-white -mx-4 -mb-4 px-4 py-3 flex items-center">
                          {item.status === 'processing' && (
                            <div className="flex flex-col gap-2 w-full">
                              {/* Cover button: enabled if cover is ready during processing */}
                              <button
                                onClick={() => { if ('coverImageUrl' in item && item.coverImageUrl) handleCoverClick(item); }}
                                disabled={!('coverImageUrl' in item && item.coverImageUrl)}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg border transition-colors',
                                  'coverImageUrl' in item && item.coverImageUrl
                                    ? 'bg-black text-white hover:bg-gray-800 border-black'
                                    : 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <ImageIcon className={cn('w-4 h-4', ('coverImageUrl' in item && item.coverImageUrl) ? 'text-white' : 'text-gray-500')} />
                                  <span>{('coverImageUrl' in item && item.coverImageUrl) ? (coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover') : 'Cover'}</span>
                                </div>
                                <div className={cn('flex items-center gap-1', ('coverImageUrl' in item && item.coverImageUrl) ? 'text-green-400' : 'text-gray-500')}>
                                  <span className="text-xs font-bold">FREE</span>
                                </div>
                              </button>

                              {/* Video button: always disabled while processing */}
                              <button
                                disabled
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-gray-100 text-gray-500 rounded-lg border border-gray-200 cursor-not-allowed"
                              >
                                <div className="flex items-center gap-2">
                                  <Download className="w-4 h-4" />
                                  <span>Video</span>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-xs font-medium">Generating</span>
                                </div>
                              </button>
                            </div>
                          )}
                          {item.status === 'failed' && (
                            <div className="flex flex-col gap-2 w-full">
                              {/* Cover Download Button */}
                              {'coverImageUrl' in item && item.coverImageUrl && (
                                <button
                                  onClick={() => handleCoverClick(item)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black"
                                >
                                  <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-white" />
                                    <span>{coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-green-400">
                                    <span className="text-xs font-bold">FREE</span>
                                  </div>
                                </button>
                              )}

                              {/* No charge info */}
                              <div className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-gray-300 rounded-lg">
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
                            <div className="flex flex-col gap-2 w-full">
                              {/* Cover Download Button (always free) */}
                              {'coverImageUrl' in item && item.coverImageUrl && (
                                <button
                                  onClick={() => handleCoverClick(item)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors border border-black"
                                >
                                  <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-white" />
                                    <span>{coverStates[item.id] ? getPackingText(coverStates[item.id]!) : 'Cover'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-green-400">
                                    <span className="text-xs font-bold">FREE</span>
                                  </div>
                                </button>
                              )}

                              {/* Video Download Button (paid on first download) */}
                              {'videoUrl' in item && item.videoUrl && (
                                <button
                                  onClick={() => handleVideoClick(item)}
                                  disabled={videoStates[item.id] === 'packing'}
                                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm bg-white text-gray-900 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Download className="w-4 h-4" />
                                    <span>{videoStates[item.id] ? getPackingText(videoStates[item.id]!) : 'Video'}</span>
                                  </div>
                                  {videoStates[item.id] === 'packing' ? (
                                    <div className="flex items-center gap-1.5 text-gray-600">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                  ) : item.downloaded ? (
                                    <div className="flex items-center gap-1.5 text-green-600">
                                      <Check className="w-4 h-4" />
                                      <span className="text-xs font-semibold">Downloaded</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-gray-800">
                                      {(() => {
                                        // Compute dynamic cost for Character Ads based on duration; others use model cost
                                        let cost = 0;
                                        if (isCharacterAds(item) && item.videoDurationSeconds) {
                                          const unitSeconds = item.videoModel === 'sora2' ? 10 : 8;
                                          const base = getCreditCost(item.videoModel);
                                          cost = Math.round((item.videoDurationSeconds / unitSeconds) * base);
                                        } else {
                                          cost = getCreditCost(item.videoModel);
                                        }
                                        return (
                                          <>
                                            <Coins className="w-4 h-4" />
                                            <span className="font-bold">{cost}</span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
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
