'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Calendar, Download } from 'lucide-react';
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


export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const { credits: userCredits, refetchCredits } = useCredits();
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

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
    
    // Credits are now managed by CreditsContext
  }, [user?.id]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'processing':
        return 'bg-yellow-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

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
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

    // Direct download without confirmation

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
        // Check if response is a video file (binary) or JSON
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('video/mp4')) {
          // This is the video file, trigger download
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `flowtra-video-${historyId}.mp4`;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the blob URL
          window.URL.revokeObjectURL(url);
          
          // Update the history item
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

          // Refresh credits
          await refetchCredits();
          
          // Video downloaded successfully - no need for intrusive alert
          // The UI already updates to show "Already Downloaded" state
        } else {
          // This is a JSON response, handle error
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

  

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-white min-h-screen">
        <div className="p-12 max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                History
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-2xl">
              View and manage your AI-generated advertisement projects
            </p>
          </div>

          {/* Video Preview Guide */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
            <h2 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-gray-700" />
              How It Works
            </h2>
            <div className="space-y-2">
              <p className="text-gray-700 text-sm">
                <span className="font-medium">Preview:</span> Hover over any completed video to see it play with audio
              </p>
              <p className="text-gray-700 text-sm">
                <span className="font-medium">Download:</span> Click the download button to save the video (additional credits required)
              </p>
            </div>
          </div>

          

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">All Projects</h2>
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
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
              <p className="text-gray-500 mb-6">Start creating your first AI-powered advertisement</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredHistory.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors flex flex-col">
                  {/* Video Preview on Hover */}
                  <div 
                    className="relative bg-white"
                    onMouseEnter={() => item.status === 'completed' && item.videoUrl && setHoveredVideo(item.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    <div className="aspect-[16/9] bg-white relative overflow-hidden">
                      {item.status === 'completed' && item.videoUrl && hoveredVideo === item.id ? (
                        <VideoPlayer
                          src={item.videoUrl}
                          className="w-full h-full object-cover"
                          autoPlay={true}
                          loop={true}
                          playsInline={true}
                          showControls={true}
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
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full border border-gray-200 bg-white/90 backdrop-blur text-xs text-gray-700 inline-flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}></span>
                      <span>{getStatusText(item.status)}</span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                      {item.productDescription || 'Untitled Project'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatDate(item.createdAt)}</span>
                      <span>•</span>
                      <span className="uppercase">{item.videoModel}</span>
                      <span>•</span>
                      <span>{getGenerationCost(item.videoModel)}+{getDownloadCost(item.videoModel)} credits</span>
                    </div>

                    {/* Progress bar for processing items */}
                    {item.status === 'processing' && (
                      <div className="mt-3">
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

                    {item.status === 'completed' && item.videoUrl && (
                      <div className="mt-4 -mx-4 -mb-4">
                        {/* Download Button - Notion-style Design */}
                        {item.downloaded ? (
                          <a
                            href={item.videoUrl}
                            download={`flowtra-video-${item.id}.mp4`}
                            className="group block w-full px-4 py-3 border-t border-gray-200 bg-white hover:bg-gray-50 transition-colors duration-150"
                          >
                            <div className="flex items-center gap-3">
                              <Download className="w-4 h-4 text-gray-600" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">Already Downloaded</div>
                              </div>
                              <div className="text-xs text-gray-500">Click to download again</div>
                            </div>
                          </a>
                        ) : (
                          <button
                            onClick={() => downloadVideo(item.id, item.videoModel)}
                            disabled={downloadingVideo === item.id || !userCredits || userCredits < getDownloadCost(item.videoModel)}
                            className="group w-full px-4 py-3 border-t border-gray-200 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors duration-150"
                          >
                            <div className="flex items-center gap-3">
                              {downloadingVideo === item.id ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-700">Downloading...</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4 text-gray-600 group-disabled:text-gray-400" />
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900 group-disabled:text-gray-500">Download Video</div>
                                  </div>
                                  <div className="text-xs text-gray-500 group-disabled:text-gray-400">MP4 file</div>
                                </>
                              )}
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}