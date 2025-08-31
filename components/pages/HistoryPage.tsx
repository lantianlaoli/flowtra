'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Download, ChevronLeft, ChevronRight, Clock, Zap, Coins, Sparkles, FileVideo, CheckCircle, AlertCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { getDownloadCost, getGenerationCost } from '@/lib/constants';
import VideoPlayer from '@/components/ui/VideoPlayer';

interface HistoryItem {
  id: string;
  originalImageUrl: string;
  coverImageUrl?: string;
  videoUrl?: string;
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
}

const ITEMS_PER_PAGE = 6; // 2 rows × 3 columns = 6 items per page

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const { credits: userCredits, refetchCredits } = useCredits();
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');

  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    setSelectedModel(model);
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;
      
      try {
        const response = await fetch('/api/history');
        const result = await response.json();
        
        if (result.success) {
          setHistory(result.history);
        } else {
          console.error('Failed to fetch history:', result.error);
          setHistory([]);
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      }
    };

    fetchHistory();
  }, [user?.id]);

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const filteredHistory = history.filter(item => 
    filter === 'all' || item.status === filter
  );

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentHistory = filteredHistory.slice(startIndex, endIndex);
  




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

  const getModelDisplayName = (model: string) => {
    switch (model) {
      case 'veo3':
        return 'VEO 3';
      case 'veo3_fast':
        return 'VEO 3 Fast';
      default:
        return model.toUpperCase();
    }
  };

  const getStepMessage = (step?: string) => {
    const stepMessages = {
      'describing': 'Analyzing product...',
      'generating_prompts': 'Creating concepts...',
      'generating_cover': 'Designing cover...',
      'generating_video': 'Generating video...'
    };
    return stepMessages[step as keyof typeof stepMessages] || 'Processing...';
  };

  const downloadVideo = async (historyId: string, videoModel: 'veo3' | 'veo3_fast') => {
    if (!user?.id || !userCredits) return;

    const downloadCost = getDownloadCost(videoModel);
    if (userCredits < downloadCost) {
      alert(`Insufficient credits. Need ${downloadCost}, have ${userCredits}`);
      return;
    }

    setDownloadingVideo(historyId);

    try {
      const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          historyId,
          userId: user.id,
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
          
          setHistory(prevHistory =>
            prevHistory.map(item =>
              item.id === historyId
                ? {
                    ...item,
                    downloaded: true,
                    downloadCreditsUsed: downloadCost,
                  }
                : item
            )
          );

          await refetchCredits();
        } else {
          const result = await response.json();
          alert(result.message || 'Failed to download video');
        }
      } else {
        const result = await response.json();
        alert(result.message || 'Failed to authorize download');
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('An error occurred while downloading the video');
    } finally {
      setDownloadingVideo(null);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={userCredits}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <FileVideo className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                History
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-2xl">
              View and manage your AI-generated advertisement projects
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                {filter === 'all' ? 'All Projects' : 
                 filter === 'completed' ? 'Completed Projects' :
                 filter === 'processing' ? 'Processing Projects' :
                 'Failed Projects'}
                <span className="ml-2 text-sm text-gray-500 font-normal">
                  ({filteredHistory.length})
                </span>
              </h2>
              

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

          {/* Projects Grid */}
          {filteredHistory.length === 0 ? (
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
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-all duration-200 hover:shadow-md flex flex-col">
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
                      <div className="aspect-[16/9] bg-white relative overflow-hidden">
                        {item.status === 'completed' && item.videoUrl && hoveredVideo === item.id ? (
                          <VideoPlayer
                            src={item.videoUrl}
                            className="w-full h-full object-cover"
                            autoPlay={true}
                            loop={true}
                            playsInline={true}
                            showControls={false}
                          />
                        ) : (
                          <Image
                            src={item.originalImageUrl}
                            alt="Original product"
                            width={400}
                            height={300}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      
                      {/* Status badge */}
                      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full border border-gray-200 bg-white/90 backdrop-blur text-xs font-medium inline-flex items-center gap-1.5">
                        {item.status === 'completed' ? (
                          <CheckCircle className="w-3 h-3 text-gray-700" />
                        ) : item.status === 'processing' ? (
                          <PlayCircle className="w-3 h-3 text-gray-600" />
                        ) : item.status === 'failed' ? (
                          <AlertCircle className="w-3 h-3 text-gray-800" />
                        ) : (
                          <PauseCircle className="w-3 h-3 text-gray-500" />
                        )}
                        <span>{getStatusText(item.status)}</span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-medium text-gray-900 text-base mb-3 line-clamp-1">
                        {item.productDescription || 'Untitled Project'}
                      </h3>
                      
                      {/* Enhanced metadata display */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{formatDate(item.createdAt)}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-400">{formatTime(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Zap className="w-4 h-4" />
                          <span className="font-medium">{getModelDisplayName(item.videoModel)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Sparkles className="w-4 h-4" />
                          <span className="font-medium">{item.generationCreditsUsed || getGenerationCost(item.videoModel)}</span>
                        </div>
                      </div>

                                             {/* Progress bar for processing items */}
                       {item.status === 'processing' && (
                         <div className="mt-2">
                           <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                             <span>{getStepMessage(item.currentStep)}</span>
                             <span>{item.progress || 0}%</span>
                           </div>
                           <div className="w-full bg-gray-200 rounded-full h-1.5">
                             <div 
                               className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                               style={{ width: `${item.progress || 0}%` }}
                             ></div>
                           </div>
                         </div>
                       )}



                                           {/* Bottom action area - fixed height for consistency */}
                     <div className="mt-2">
                       {/* Bottom action area - unified layout for all states */}
                       <div className="border-t border-gray-200 bg-white -mx-4 -mb-4 px-4 py-3">
                         {item.status === 'failed' && (
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2.5">
                               <CheckCircle className="w-4 h-4 text-gray-700" />
                               <span className="text-sm font-medium text-gray-900">Credits Refunded</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Coins className="w-4 h-4 text-gray-600" />
                               <span className="text-sm font-bold text-gray-900">{getGenerationCost(item.videoModel)}</span>
                             </div>
                           </div>
                         )}

                         {item.status === 'completed' && item.videoUrl && !item.downloaded && (
                           <button
                             onClick={() => downloadVideo(item.id, item.videoModel)}
                             disabled={downloadingVideo === item.id || !userCredits || userCredits < getDownloadCost(item.videoModel)}
                             className="w-full text-left"
                           >
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2.5">
                                 <Download className="w-4 h-4 text-gray-600 group-disabled:text-gray-400" />
                                 <span className="text-sm font-medium text-gray-900 group-disabled:text-gray-500">Download Video</span>
                               </div>
                               <div className="flex items-center gap-1.5">
                                 <Coins className="w-4 h-4 text-gray-600 group-disabled:text-gray-400" />
                                 <span className="text-sm font-bold text-gray-900 group-disabled:text-gray-500">{getDownloadCost(item.videoModel)}</span>
                               </div>
                             </div>
                           </button>
                         )}

                         {item.status === 'completed' && item.videoUrl && item.downloaded && (
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2.5">
                               <CheckCircle className="w-4 h-4 text-gray-700" />
                               <span className="text-sm font-medium text-gray-900">Downloaded</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Coins className="w-4 h-4 text-gray-600" />
                               <span className="text-sm font-bold text-gray-900">
                                 {item.downloadCreditsUsed || 0}
                               </span>
                             </div>
                           </div>
                         )}

                         {item.status === 'completed' && item.videoUrl && downloadingVideo === item.id && (
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2.5">
                               <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                               <span className="text-sm font-medium text-gray-700">Downloading...</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Coins className="w-4 h-4 text-gray-400" />
                               <span className="text-sm font-bold text-gray-400">-</span>
                             </div>
                           </div>
                         )}

                         {item.status === 'processing' && (
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2.5">
                               <PlayCircle className="w-4 h-4 text-gray-600 animate-pulse" />
                               <span className="text-sm font-medium text-gray-500">Processing...</span>
                             </div>
                             <div className="flex items-center gap-1.5">
                               <Coins className="w-4 h-4 text-gray-400" />
                               <span className="text-sm font-bold text-gray-400">-</span>
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                    </div>
                  </div>
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