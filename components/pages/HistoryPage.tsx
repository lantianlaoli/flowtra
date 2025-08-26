'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Image, Play, Calendar, Zap, Filter, ArrowRight, Eye } from 'lucide-react';

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
}

// Empty mock data - will be replaced with actual API call
const mockHistory: HistoryItem[] = [];

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

  const totalCreditsUsed = history.reduce((sum, item) => sum + item.creditsUsed, 0);
  const completedAds = history.filter(item => item.status === 'completed').length;

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
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-4">How to Download Videos</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                    1
                  </div>
                  <p className="text-gray-700">Click the &ldquo;Preview&rdquo; button on any completed project</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                    2
                  </div>
                  <p className="text-gray-700">In the video player, click the three dots menu (⋮) in the bottom right corner</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-medium mt-0.5">
                    3
                  </div>
                  <p className="text-gray-700">Select &ldquo;Download&rdquo; to save the video to your device</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <img 
                  src="/download_guide.png" 
                  alt="Video download guide showing the three dots menu"
                  className="w-full rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Projects</p>
                  <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{completedAds}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Credits Spent</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCreditsUsed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="flex items-center gap-6 mb-6">
              <h2 className="text-lg font-medium text-gray-900">All Projects</h2>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">Filter:</span>
              </div>
            </div>
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
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors">
                  {/* Card Header - Transformation Flow */}
                  <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      {/* Original Image */}
                      <div className="flex-1 text-center">
                        <div className="w-12 h-12 mx-auto rounded-lg overflow-hidden border border-gray-200 bg-white mb-2 relative">
                          <img 
                            src={item.originalImageUrl} 
                            alt="Original product"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 right-1 w-4 h-4 bg-gray-800 rounded-full flex items-center justify-center">
                            <Image className="w-2 h-2 text-white" />
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">Original</p>
                      </div>

                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />

                      {/* Video */}
                      <div className="flex-1 text-center">
                        <div className="w-12 h-12 mx-auto rounded-lg border border-gray-200 bg-black mb-2 flex items-center justify-center relative">
                          <Play className="w-4 h-4 text-white" />
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                        </div>
                        <p className="text-xs text-gray-600">Video</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-2">
                        {item.productDescription || 'Untitled Project'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatDate(item.createdAt)}</span>
                        <span>•</span>
                        <span>{item.creditsUsed} credits</span>
                        <span>•</span>
                        <span className="uppercase">{item.videoModel}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}></div>
                        <span className="text-xs text-gray-600">{getStatusText(item.status)}</span>
                      </div>

                      {item.status === 'completed' && item.videoUrl && (
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          Preview
                        </a>
                      )}
                    </div>
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