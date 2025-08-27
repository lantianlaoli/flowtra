'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Calendar, Eye, Download } from 'lucide-react';

interface HistoryItem {
  id: string;
  originalImageUrl: string;
  coverImageUrl?: string;
  videoUrl?: string;
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
  const { credits: userCredits } = useCredits();

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

          {/* How to Download Guide */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3">
            <h2 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Download className="w-5 h-5 text-gray-700" />
              How to Download Videos
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[11px] font-medium">
                    1
                  </div>
                  <p className="text-gray-700 text-base leading-snug">Click the &ldquo;Preview&rdquo; button on any completed project</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[11px] font-medium">
                    2
                  </div>
                  <p className="text-gray-700 text-base leading-snug">In the video player, click the three dots menu (⋮) in the bottom right corner</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-[11px] font-medium">
                    3
                  </div>
                  <p className="text-gray-700 text-base leading-snug">Select &ldquo;Download&rdquo; to save the video to your device</p>
                </div>
              </div>
              <div>
                <Image 
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/other/download_guide.png" 
                  alt="Video download guide showing the three dots menu"
                  width={600}
                  height={240}
                  className="w-full h-60 object-contain rounded-xl"
                />
              </div>
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
                  {/* Image as main content */}
                  <div className="relative bg-white">
                    <div className="aspect-[4/3] bg-white">
                      <Image
                        src={item.originalImageUrl}
                        alt="Original product"
                        width={400}
                        height={300}
                        className="w-full h-full object-cover"
                      />
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
                      <span>-{item.creditsUsed}</span>
                      <span>•</span>
                      <span className="uppercase">{item.videoModel}</span>
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
                      <div className="mt-4 -mx-4 -mb-4 border-t border-gray-200">
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full px-4 py-2.5 text-center bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                          <span className="inline-flex items-center justify-center gap-2">
                            <Eye className="w-4 h-4" />
                            Preview
                          </span>
                        </a>
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