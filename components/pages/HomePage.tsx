'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { BarChart3, Zap, TrendingUp, Clock, Hand, Award, Brain, Target, Calendar, Volume2, Music, Film, MapPin } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import VideoPlayer from '@/components/ui/VideoPlayer';

interface RecentVideo {
  id: string;
  thumbnail?: string;
  videoUrl?: string;
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  generationTime?: number; // in minutes
  modelUsed?: string;
  creditsConsumed?: number;
  creativePrompt?: {
    music?: string;
    action?: string;
    ending?: string;
    setting?: string;
  };
}

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const { credits } = useCredits();
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [stats, setStats] = useState({
    totalVideos: 0,
    thisMonth: 0,
    creditsUsed: 0,
    successRate: 98
  });

  // Fetch recent videos and stats
  useEffect(() => {
    if (user) {
      fetchRecentVideos();
      fetchStats();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecentVideos = async () => {
    try {
      const response = await fetch('/api/recent-videos');
      if (response.ok) {
        const data = await response.json();
        setRecentVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Failed to fetch recent videos:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/user-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const getUserName = () => {
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.split('@')[0];
    }
    return 'Guest';
  };



  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'today';
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    const months = Math.floor(diffInDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={credits} 
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Hand className="w-7 h-7 text-gray-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Hello, {getUserName()}
              </h1>
            </div>
          </div>

          {/* Stats Cards - Compact Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-2xl font-bold text-gray-900">{stats.totalVideos}</span>
                  <span className="text-sm font-medium text-gray-600 truncate">Total Videos Created</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-2xl font-bold text-gray-900">{stats.thisMonth}</span>
                  <span className="text-sm font-medium text-gray-600 truncate">Ads This Month</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-2xl font-bold text-gray-900">{stats.creditsUsed}</span>
                  <span className="text-sm font-medium text-gray-600 truncate">Credits Used</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-2xl font-bold text-gray-900">{stats.successRate}%</span>
                  <span className="text-sm font-medium text-gray-600 truncate">Success Rate</span>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Masterpiece Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-gray-700" />
                  <h2 className="text-xl font-semibold text-gray-900">Latest Masterpiece</h2>
                </div>
                {recentVideos.length > 0 && recentVideos[0].status === 'completed' && (
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    {recentVideos[0].generationTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{recentVideos[0].generationTime}min</span>
                      </div>
                    )}
                    {recentVideos[0].modelUsed && (
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        <span>{recentVideos[0].modelUsed.replace(' Fast', '').replace(' High Quality', ' HQ')}</span>
                      </div>
                    )}
                    {recentVideos[0].creditsConsumed && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-4 h-4" />
                        <span>{recentVideos[0].creditsConsumed}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatRelativeTime(recentVideos[0].createdAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-6">
              {recentVideos.length > 0 && recentVideos[0].status === 'completed' ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  {/* Left Side - Large Video Preview */}
                  <div className="lg:col-span-3">
                    <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 relative group">
                      <VideoPlayer 
                        src={recentVideos[0].videoUrl!} 
                        className="w-full h-full object-cover"
                        showControls={true}
                        autoPlay={true}
                        loop={true}
                      />
                      <div className="absolute top-4 right-4 bg-black/50 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Volume2 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>

                  {/* Right Side - Creative Elements Panel */}
                  <div className="lg:col-span-2 flex flex-col h-full">
                    <div className="bg-gray-50 rounded-lg p-4 flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wide mb-4">Creative Elements</h3>
                      
                      {recentVideos[0].creativePrompt ? (
                        <div className="space-y-4 h-full">
                          {/* Music */}
                          {recentVideos[0].creativePrompt.music && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start gap-3">
                                <Music className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-gray-900 text-sm mb-1">Music</h4>
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {recentVideos[0].creativePrompt.music}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Action */}
                          {recentVideos[0].creativePrompt.action && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start gap-3">
                                <Film className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-gray-900 text-sm mb-1">Action</h4>
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {recentVideos[0].creativePrompt.action}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Ending */}
                          {recentVideos[0].creativePrompt.ending && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start gap-3">
                                <Target className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-gray-900 text-sm mb-1">Ending</h4>
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {recentVideos[0].creativePrompt.ending}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Setting */}
                          {recentVideos[0].creativePrompt.setting && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-gray-900 text-sm mb-1">Setting</h4>
                                  <p className="text-sm text-gray-700 line-clamp-2">
                                    {recentVideos[0].creativePrompt.setting}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-gray-500">
                          <div className="text-center">
                            <Brain className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Creative elements will appear here</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Award className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Ready to Create Your First Masterpiece?
                  </h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    Let AI help you craft your first professional advertisement video that converts viewers into customers.
                  </p>
                  <Link
                    href="/dashboard/generate"
                    className="inline-flex items-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-colors font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  >
                    <Zap className="w-5 h-5" />
                    Start Creating
                  </Link>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
