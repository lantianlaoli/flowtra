'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import { Image, Play, Download, Calendar, Zap, Filter } from 'lucide-react';

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

// Mock data - replace with actual API call
const mockHistory: HistoryItem[] = [
  {
    id: '1',
    originalImageUrl: 'https://via.placeholder.com/300x200',
    coverImageUrl: 'https://via.placeholder.com/300x200',
    videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    productDescription: 'Premium wireless headphones with noise cancellation',
    videoModel: 'veo3',
    creditsUsed: 150,
    status: 'completed',
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    originalImageUrl: 'https://via.placeholder.com/300x200',
    coverImageUrl: 'https://via.placeholder.com/300x200',
    productDescription: 'Ergonomic office chair with lumbar support',
    videoModel: 'veo3_fast',
    creditsUsed: 30,
    status: 'processing',
    createdAt: '2024-01-14T14:20:00Z'
  },
  {
    id: '3',
    originalImageUrl: 'https://via.placeholder.com/300x200',
    productDescription: 'Smart fitness tracker with heart rate monitor',
    videoModel: 'veo3',
    creditsUsed: 150,
    status: 'failed',
    createdAt: '2024-01-13T09:15:00Z'
  }
];

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [userCredits, setUserCredits] = useState<number>();

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  useEffect(() => {
    // TODO: Implement API call to fetch user history
    setHistory(mockHistory);
    setUserCredits(2000); // Mock data
  }, []);

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
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar credits={userCredits} />
      
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              History
            </h1>
            <p className="text-gray-600">
              View and manage all your generated advertisements
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Image className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Ads</p>
                  <p className="text-2xl font-bold text-gray-900">{history.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{completedAds}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Credits Used</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCreditsUsed}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <Filter className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filter by Status</h2>
            </div>
            <div className="flex gap-2">
              {(['all', 'completed', 'processing', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === status
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* History List */}
          <div className="space-y-4">
            {filteredHistory.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No advertisements found</h3>
                <p className="text-gray-600 mb-4">
                  {filter === 'all' 
                    ? "You haven't created any advertisements yet." 
                    : `No ${filter} advertisements found.`}
                </p>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Create Your First Ad
                </button>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Original Image */}
                    <div className="lg:w-48 flex-shrink-0">
                      <img
                        src={item.originalImageUrl}
                        alt="Original product"
                        className="w-full h-32 lg:h-24 object-cover rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">Original</p>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {item.productDescription || 'Product Advertisement'}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(item.createdAt)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Zap className="w-4 h-4" />
                              {item.creditsUsed} credits
                            </div>
                            <span className="text-gray-400">•</span>
                            <span className="capitalize">{item.videoModel}</span>
                          </div>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>

                      {/* Generated Content */}
                      <div className="flex gap-4">
                        {item.coverImageUrl && (
                          <div className="text-center">
                            <img
                              src={item.coverImageUrl}
                              alt="Generated cover"
                              className="w-24 h-16 object-cover rounded border"
                            />
                            <p className="text-xs text-gray-500 mt-1">Cover</p>
                            <a
                              href={item.coverImageUrl}
                              download
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          </div>
                        )}

                        {item.videoUrl && (
                          <div className="text-center">
                            <video
                              src={item.videoUrl}
                              className="w-24 h-16 object-cover rounded border"
                              muted
                            />
                            <p className="text-xs text-gray-500 mt-1">Video</p>
                            <a
                              href={item.videoUrl}
                              download
                              className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 mt-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          </div>
                        )}

                        {item.status === 'processing' && (
                          <div className="text-center">
                            <div className="w-24 h-16 bg-gray-100 rounded border flex items-center justify-center">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600"></div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Processing...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}