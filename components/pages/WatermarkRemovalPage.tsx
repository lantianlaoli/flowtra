'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import { Sparkles, Loader2, Info, Video, Coins } from 'lucide-react';
import { WATERMARK_REMOVAL_COST } from '@/lib/constants';

export default function WatermarkRemovalPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, refetchCredits } = useCredits();
  const { showSuccess } = useToast();
  const [videoUrl, setVideoUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
        // Show success toast and redirect to My Ads
        showSuccess(
          'Added to removal queue! Check My Ads for the watermark-free video.',
          5000,
          { label: 'View Progress →', href: '/dashboard/videos' }
        );

        // Clear form and refresh credits
        setVideoUrl('');
        await refetchCredits();
      } else {
        setErrorMsg(data.details || data.error || 'Failed to start watermark removal');
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
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
        <div className="p-8 max-w-7xl mx-auto">
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
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Remove Watermark</span>
                    <span className="ml-2 px-2.5 py-1 bg-gray-800 text-white text-sm font-medium rounded flex items-center gap-1.5">
                      <Coins className="w-4 h-4" />
                      <span>{WATERMARK_REMOVAL_COST}</span>
                    </span>
                  </>
                )}
              </button>

              {(userCredits || 0) < WATERMARK_REMOVAL_COST && (
                <p className="mt-3 text-sm text-red-600 text-center">
                  Insufficient credits. Need {WATERMARK_REMOVAL_COST} credits, have {userCredits} credits
                </p>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
