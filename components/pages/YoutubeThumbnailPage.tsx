'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import UserPhotoGallery from '@/components/UserPhotoGallery';
import { Zap, Loader2, Download, Youtube, Settings, Type, Hash, Play } from 'lucide-react';
import { THUMBNAIL_CREDIT_COST } from '@/lib/constants';
import RetryImage from '@/components/ui/RetryImage';

interface ThumbnailRecord {
  id: string;
  title: string;
  thumbnailUrl?: string;
  status: 'pending' | 'processing' | 'loading' | 'completed' | 'failed';
  downloaded: boolean;
  createdAt: string;
}

// Emotional generate button messages
const GENERATE_MESSAGES = [
  "Creating your masterpiece...",
  "Crafting something amazing...",
  "Working on magic...",
  "Bringing your vision to life...",
  "Processing with AI...",
  "Hang tight, great things take time...",
  "Your thumbnail is being crafted..."
];


export default function YoutubeThumbnailPage() {
  const { user, isLoaded } = useUser();
  const { credits, refetchCredits } = useCredits();
  const [title, setTitle] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string>('');
  const [imageCount, setImageCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [buttonMessage, setButtonMessage] = useState('Generate Thumbnail');
  const [generatedThumbnails, setGeneratedThumbnails] = useState<ThumbnailRecord[]>([]);

  const messageIndexRef = useRef(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCycleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // System prompt for YouTube thumbnail generation
  const systemPrompt = `A dynamic, flat-design YouTube thumbnail with a clear left-right composition. The left side is dominated by large, bold, horizontally arranged text, occupying approximately 70% of the thumbnail's total width. This text displays the video title: "${title}" in a readable horizontal layout. This text has its own solid color background panel.

The right side features a real person from the provided image. The person is cropped to show only the head and chest, with a distinct white outline or stroke. **Crucially, the person's facial expression and body language should directly reflect the emotion or subject conveyed by the video title, such as sadness, happiness, excitement, or surprise.**

The colors of the text's background panel, the overall thumbnail background, and the person's clothing must be distinctly different from each other, selected to create maximum visual contrast and separation. The overall thumbnail background is a vibrant gradient with a flat and minimalist aesthetic. Aspect ratio: 16:9.`;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (messageCycleIntervalRef.current) {
        clearInterval(messageCycleIntervalRef.current);
      }
    };
  }, []);

  // Button message cycling effect
  const startMessageCycling = useCallback(() => {
    messageIndexRef.current = 0;
    setButtonMessage(GENERATE_MESSAGES[0]);

    const interval = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % GENERATE_MESSAGES.length;
      setButtonMessage(GENERATE_MESSAGES[messageIndexRef.current]);
    }, 2500);

    return interval;
  }, []);

  // Clear all timers and reset state
  const clearTimersAndResetState = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    if (messageCycleIntervalRef.current) {
      clearInterval(messageCycleIntervalRef.current);
      messageCycleIntervalRef.current = null;
    }
  }, []);

  // Start polling task status
  const startPolling = useCallback((taskId: string) => {
    // Set up timeout (10 minutes - generous time for KIE generation)
    pollingTimeoutRef.current = setTimeout(() => {
      console.log('Polling timeout reached after 10 minutes');
      clearTimersAndResetState();
      setIsGenerating(false);
      setButtonMessage('Generate Thumbnail');
      // More friendly message - don't suggest it failed, just that it's taking time
      alert('Generation is taking longer than usual. You can continue using the app and check your history page later for results.');
    }, 600000); // 10 minutes

    const interval = setInterval(async () => {
      try {
        // Poll KIE API for progress
        const pollResponse = await fetch('/api/youtube-thumbnail/poll-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId })
        });

        if (pollResponse.ok) {
          const pollData = await pollResponse.json();
          console.log('Poll result:', pollData);


          if (pollData.status === 'completed') {
            console.log(`KIE polling found completed results`);

            // Stop polling and check database for results
            clearTimersAndResetState();
            setIsGenerating(false);
            setButtonMessage('Generate Thumbnail');

            // Check database for results
            setTimeout(async () => {
              try {
                const response = await fetch(`/api/youtube-thumbnail/status/${taskId}`);
                if (response.ok) {
                  const data = await response.json();
                  if (data.status === 'completed') {
                    // Update loading placeholders with actual results
                    setGeneratedThumbnails(prev => {
                      const results = data.results || [];
                      return prev.map((placeholder, index) => {
                        if (placeholder.status === 'loading' && results[index]) {
                          return {
                            ...results[index],
                            id: placeholder.id, // Keep original placeholder id
                            title: placeholder.title
                          };
                        }
                        return placeholder;
                      });
                    });
                    await refetchCredits();
                  }
                }
              } catch (error) {
                console.error('Error checking final status:', error);
              }
            }, 1000);

            return;
          } else if (pollData.status === 'failed') {
            // Generation failed
            setIsGenerating(false);
            clearTimersAndResetState();
            setButtonMessage('Generate Thumbnail');
            alert('Thumbnail generation failed. Please try again.');
            return;
          }
        }

        // Also check database status for any updates
        const response = await fetch(`/api/youtube-thumbnail/status/${taskId}`);
        if (response.ok) {
          const data = await response.json();

          if (data.status === 'completed') {
            // Generation completed via callback
            setIsGenerating(false);

            // Update loading placeholders with actual results
            setGeneratedThumbnails(prev => {
              const results = data.results || [];
              return prev.map((placeholder, index) => {
                if (placeholder.status === 'loading' && results[index]) {
                  return {
                    ...results[index],
                    id: placeholder.id, // Keep original placeholder id
                    title: placeholder.title
                  };
                }
                return placeholder;
              });
            });

            clearTimersAndResetState();
            setButtonMessage('Generate Thumbnail');
            await refetchCredits();
          } else if (data.status === 'failed') {
            // Generation failed
            setIsGenerating(false);
            clearTimersAndResetState();
            setButtonMessage('Generate Thumbnail');
            alert('Thumbnail generation failed. Please try again.');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't reset state on network errors, keep polling
      }
    }, 5000); // Poll every 5 seconds

    pollingIntervalRef.current = interval;
  }, [refetchCredits, clearTimersAndResetState]);



  const handleGenerate = async () => {
    if (!selectedPhotoUrl || !title.trim()) {
      alert('Please select a photo and enter a title');
      return;
    }

    const totalCreditsCost = THUMBNAIL_CREDIT_COST * imageCount;
    if (!credits || credits < totalCreditsCost) {
      alert(`Insufficient credits! Generating ${imageCount} thumbnail${imageCount > 1 ? 's' : ''} requires ${totalCreditsCost} credits`);
      return;
    }

    // Clear any existing timers
    clearTimersAndResetState();

    // Reset state and create loading placeholders
    setIsGenerating(true);

    // Create loading placeholders for immediate visual feedback
    const loadingThumbnails: ThumbnailRecord[] = Array.from({length: imageCount}, (_, index) => ({
      id: `loading-${Date.now()}-${index}`,
      title: title.trim(),
      status: 'loading' as const,
      downloaded: false,
      createdAt: new Date().toISOString()
    }));
    setGeneratedThumbnails(loadingThumbnails);

    // Start message cycling
    messageCycleIntervalRef.current = startMessageCycling();

    try {
      const response = await fetch('/api/youtube-thumbnail/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identityImageUrl: selectedPhotoUrl,
          title,
          prompt: systemPrompt,
          imageCount,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Start polling for results
        startPolling(data.taskId);

        // Clear the form
        setTitle('');
        setSelectedPhotoUrl('');

      } else {
        const error = await response.json();
        alert(error.message || 'Generation failed');

        // Reset state on error
        setIsGenerating(false);
        setButtonMessage('Generate Thumbnail');
        clearTimersAndResetState();
      }
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Generation failed, please try again');

      // Reset state on error
      setIsGenerating(false);
      setButtonMessage('Generate Thumbnail');
      clearTimersAndResetState();
    }
  };


  const totalCreditsCost = THUMBNAIL_CREDIT_COST * imageCount;
  const canAffordGeneration = credits != null && credits >= totalCreditsCost;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={credits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Youtube className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">YouTube Thumbnail Generator</h1>
            </div>
          </div>

          {/* Main Content - Left/Right Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* Left Side - Photo Gallery (40%) */}
            <div className="lg:col-span-2 order-2 lg:order-1">
              <UserPhotoGallery
                onPhotoSelect={setSelectedPhotoUrl}
                selectedPhotoUrl={selectedPhotoUrl}
              />
            </div>

            {/* Right Side - Configuration (60%) */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-fit">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
                  </div>
                </div>
                <div className="p-6 lg:p-8">

                  {/* Title Input */}
                  <div className="mb-8">
                    <label className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                      <Type className="w-5 h-5 text-gray-600" />
                      Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter title..."
                      className="w-full px-4 lg:px-6 py-3 lg:py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent text-lg lg:text-xl font-medium placeholder-gray-400"
                      maxLength={100}
                    />
                    {title.length >= 90 && (
                      <div className="mt-3 text-sm text-gray-500 text-right">
                        {title.length}/100
                      </div>
                    )}
                  </div>

                  {/* Image Count Selection */}
                  <div className="mb-8">
                    <label className="flex items-center gap-2 text-lg font-bold text-gray-900 mb-4">
                      <Hash className="w-5 h-5 text-gray-600" />
                      Number of Thumbnails
                    </label>
                    <div className="bg-gray-100 p-1 rounded-xl inline-flex relative">
                      {/* Sliding background indicator */}
                      <div
                        className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
                        style={{
                          left: `${4 + (imageCount - 1) * 33.333}%`,
                          width: '29.333%'
                        }}
                      />
                      {[1, 2, 3].map((count) => (
                        <button
                          key={count}
                          onClick={() => setImageCount(count)}
                          className={`
                            relative z-10 px-6 py-3 rounded-lg font-semibold transition-all duration-200 text-sm cursor-pointer
                            ${imageCount === count
                              ? 'text-gray-900'
                              : 'text-gray-600 hover:text-gray-900'
                            }
                          `}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="space-y-3">
                    <button
                      onClick={handleGenerate}
                      disabled={!canAffordGeneration || isGenerating || !selectedPhotoUrl || !title.trim()}
                      className={`
                        w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-lg
                        text-sm font-medium transition-all duration-200 ease-out
                        border border-transparent
                        ${isGenerating
                          ? 'bg-gray-700 text-white cursor-wait'
                          : !canAffordGeneration || !selectedPhotoUrl || !title.trim()
                          ? 'bg-gray-900 text-white opacity-40 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 cursor-pointer'
                        }
                        focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
                      `}
                    >
                      {/* Simple icon transition */}
                      <div className="flex items-center justify-center w-4 h-4">
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4" />
                        )}
                      </div>

                      {/* Clean text transition */}
                      <span className="transition-opacity duration-150">
                        {buttonMessage}
                      </span>
                    </button>

                  </div>


                </div>
              </div>
            </div>
          </div>

          {/* Generated Thumbnails Section */}
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Generated Thumbnails</h2>
            </div>

            {generatedThumbnails.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {generatedThumbnails.map((thumbnail) => (
                    <div key={thumbnail.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      {/* Thumbnail Image */}
                      <div className="relative aspect-video bg-gray-100">
                        {thumbnail.thumbnailUrl ? (
                          <RetryImage
                            src={thumbnail.thumbnailUrl}
                            alt={thumbnail.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            maxRetries={8}
                            retryDelay={1500}
                          />
                        ) : thumbnail.status === 'loading' ? (
                          // Enhanced loading state with skeleton effect
                          <div className="w-full h-full relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                                <span className="text-xs text-gray-500 font-medium">Generating...</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={() => window.location.href = '/dashboard/videos'}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-all duration-200 hover:border-gray-300 cursor-pointer"
                  >
                    <Download className="w-5 h-5" />
                    Satisfied? Click to View All Your Creations
                  </button>
                </div>
              </>
            ) : (
              /* Empty State - Minimal Notion Style */
              <div className="flex flex-col items-center justify-center py-16 px-8">
                {/* Simple Icon */}
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center mb-4">
                  <Play className="w-6 h-6 text-gray-400" />
                </div>

                {/* Minimal Text */}
                <p className="text-gray-500 text-sm font-medium">
                  Generated thumbnails will appear here
                </p>
              </div>
            )}
          </div>

          {/* Note: Thumbnail History moved to dashboard/videos */}
        </div>
      </div>
    </div>
  );
}