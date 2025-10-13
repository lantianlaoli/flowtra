'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Sparkles, Download, Loader2, CheckCircle, XCircle, Info, Video } from 'lucide-react';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { WATERMARK_REMOVAL_COST } from '@/lib/constants';

interface Project {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl: string;
  resultVideoUrl?: string;
  errorMessage?: string;
  createdAt: string;
}

export default function WatermarkRemovalPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, refetchCredits } = useCredits();
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  // 添加悬停状态管理
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  // Poll for status updates
  useEffect(() => {
    if (!currentProject || currentProject.status !== 'processing') return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/watermark-removal/${currentProject.id}/status`);
        const data = await response.json();

        if (data.success && data.project) {
          setCurrentProject(data.project);

          if (data.project.status === 'completed') {
            await refetchCredits();
          }
        }
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentProject, refetchCredits]);

  const handleSubmit = async () => {
    if (!user?.id || !videoUrl.trim()) return;

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/watermark-removal/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          videoUrl: videoUrl.trim(),
        }),
      });

      const data = await response.json();

      if (data.success && data.projectId) {
        // Start polling for status
        const statusResponse = await fetch(`/api/watermark-removal/${data.projectId}/status`);
        const statusData = await statusResponse.json();

        if (statusData.success) {
          setCurrentProject(statusData.project);
          setVideoUrl('');
          await refetchCredits();
        }
      } else {
        setErrorMsg(data.details || data.error || 'Failed to start watermark removal');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!currentProject || !user?.id) return;

    try {
      const response = await fetch('/api/watermark-removal/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          userId: user.id,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `flowtra-watermark-removed-${currentProject.id}.mp4`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        const data = await response.json();
        alert(data.error || 'Download failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download video');
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">Sora2 Watermark Removal</h1>
            </div>
            <p className="text-gray-600">Remove watermarks from Sora2 videos • {WATERMARK_REMOVAL_COST} credits per video</p>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Paste your Sora ChatGPT video link (sora.chatgpt.com)</li>
                <li>Processing takes 2-5 minutes</li>
                <li>Automatic refund on failure</li>
              </ul>
            </div>
          </div>

          {/* Input Section */}
          {!currentProject && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sora Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://sora.chatgpt.com/p/..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 mb-4"
                disabled={isSubmitting}
              />

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !videoUrl.trim() || (userCredits || 0) < WATERMARK_REMOVAL_COST}
                className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Remove Watermark ({WATERMARK_REMOVAL_COST} Credits)</span>
                  </>
                )}
              </button>

              {(userCredits || 0) < WATERMARK_REMOVAL_COST && (
                <p className="mt-3 text-sm text-red-600 text-center">
                  Insufficient credits. Need {WATERMARK_REMOVAL_COST} credits, have {userCredits} credits
                </p>
              )}
            </div>
          )}

          {/* Result Section */}
          {currentProject && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {currentProject.status === 'processing' && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-gray-900 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Removing watermark...</h3>
                  <p className="text-gray-600">This usually takes 2-5 minutes, please wait</p>
                </div>
              )}

              {currentProject.status === 'completed' && currentProject.resultVideoUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Watermark removed successfully!</h3>
                  </div>

                  <div 
                    className="aspect-video bg-gray-900 rounded-lg overflow-hidden mb-4 relative cursor-pointer"
                    onMouseEnter={() => setHoveredVideo(currentProject.id)}
                    onMouseLeave={() => setHoveredVideo(null)}
                  >
                    {hoveredVideo === currentProject.id ? (
                      <>
                        <VideoPlayer
                          src={currentProject.resultVideoUrl}
                          className="w-full h-full"
                          autoPlay={true}
                          loop={true}
                          playsInline={true}
                          showControls={false}
                        />
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                          预览结果
                        </div>
                      </>
                    ) : (
                      <>
                        <VideoPlayer
                          src={currentProject.videoUrl}
                          className="w-full h-full"
                          autoPlay={false}
                          loop={false}
                          playsInline={true}
                          showControls={false}
                        />
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                          悬停预览结果
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download Video</span>
                    </button>

                    <button
                      onClick={() => setCurrentProject(null)}
                      className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {currentProject.status === 'failed' && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Processing failed</h3>
                  </div>

                  <p className="text-gray-600 mb-4">
                    {currentProject.errorMessage || 'Watermark removal failed, please try again'}
                  </p>

                  <p className="text-sm text-green-600 mb-4">
                    Credits automatically refunded
                  </p>

                  <button
                    onClick={() => setCurrentProject(null)}
                    className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
