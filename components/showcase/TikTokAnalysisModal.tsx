'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import type { VideoAnalysisResult, CompetitorShot } from '@/hooks/useVideoAnalysis';

interface TikTokAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tiktokUrl: string;
  onComplete?: (result: VideoAnalysisResult) => void;
}

type ModalState = 'loading' | 'completed' | 'error';

export function TikTokAnalysisModal({
  isOpen,
  onClose,
  tiktokUrl,
  onComplete
}: TikTokAnalysisModalProps) {
  const { isSignedIn } = useUser();
  const [state, setState] = useState<ModalState>('loading');
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('loading');
      setResult(null);
      setError(null);
      // Start analysis immediately
      startAnalysis();
    }
  }, [isOpen]);

  const startAnalysis = useCallback(async () => {
    try {
      setError(null);

      console.log('[TikTokAnalysisModal] Starting analysis for:', tiktokUrl);

      // Call API to analyze TikTok video
      const response = await fetch('/api/competitor-ads/analyze-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktok_url: tiktokUrl,
          competitor_name: 'TikTok Video'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Analysis failed');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      console.log('[TikTokAnalysisModal] Analysis complete');

      // Save result
      const analysisResult: VideoAnalysisResult = {
        analysis: data.analysis,
        language: data.language,
        videoUrl: data.video_url, // TikTok CDN URL
      };

      setResult(analysisResult);
      setState('completed');

      // Notify parent component
      if (onComplete) {
        onComplete(analysisResult);
      }
    } catch (err) {
      console.error('[TikTokAnalysisModal] Error:', err);
      setState('error');

      // User-friendly error messages
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setError('This TikTok video could not be found. It may be private or deleted.');
        } else if (err.message.includes('429') || err.message.includes('rate limit')) {
          setError('Too many requests. Please try again in a few minutes.');
        } else if (err.message.includes('403') || err.message.includes('private')) {
          setError('This video is private and cannot be analyzed.');
        } else if (err.message.includes('timeout')) {
          setError('Analysis is taking longer than expected. Please try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  }, [tiktokUrl, onComplete]);

  const handleCloneVideo = () => {
    if (!result) return;

    // Save to sessionStorage for dashboard
    sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
      ...result,
      tiktokUrl
    }));

    // Redirect based on auth status
    if (isSignedIn) {
      window.location.href = '/dashboard/competitor-ugc-replication';
    } else {
      window.location.href = '/sign-up?redirect_url=/dashboard/competitor-ugc-replication';
    }
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#E5E5E5] w-[90vw] max-w-[1400px] h-[85vh] max-h-[900px] flex flex-col overflow-hidden animate-fade-in rounded-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#E5E5E5]">
          <h2
            className="text-xl font-semibold text-black"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
          >
            Analysis Complete
          </h2>
          <button
            onClick={handleClose}
            className="text-[#9B9A97] hover:text-black transition-colors duration-150"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Error State */}
          {state === 'error' && (
            <div className="h-full flex flex-col items-center justify-center p-8">
              <div className="w-16 h-16 rounded-full bg-[#F7F6F3] flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-[#37352F]" />
              </div>
              <h3 className="text-lg font-semibold text-black mb-2">Analysis Failed</h3>
              <p className="text-sm text-[#787774] text-center max-w-md mb-6">
                {error}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-black text-white text-sm font-semibold hover:bg-black/90 active:scale-[0.98] transition-all rounded-lg shadow-sm"
              >
                Close
              </button>
            </div>
          )}

          {/* Main Layout (Loading or Completed) */}
          {state !== 'error' && (
            <div className="h-full flex md-responsive">
              {/* Left: Video Preview (50%) */}
              <div className="w-1/2 border-r border-[#E5E5E5] flex items-center justify-center p-4 bg-[#F7F6F3] md-full-width">
                {state === 'loading' ? (
                  // Video Skeleton
                  <div className="w-full max-w-lg aspect-[9/16] bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '6px' }}>
                    <div className="h-full flex items-center justify-center">
                      <div className="text-[#9B9A97] text-sm">Loading video...</div>
                    </div>
                  </div>
                ) : result?.videoUrl ? (
                  <video
                    src={result.videoUrl}
                    controls
                    className="w-full max-w-lg shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                    style={{ borderRadius: '6px' }}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-[#9B9A97] text-sm">No video preview available</div>
                )}
              </div>

              {/* Right: Analysis Results (50%) */}
              <div className="w-1/2 overflow-y-auto p-8 md-full-width">
                {state === 'loading' ? (
                  // Analysis Skeleton
                  <div className="space-y-6">
                    {/* Badges Skeleton */}
                    <div className="flex gap-2">
                      <div className="w-16 h-6 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                      <div className="w-12 h-6 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                      <div className="w-20 h-6 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                    </div>

                    {/* Title Skeleton */}
                    <div className="w-32 h-5 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />

                    {/* Shots Skeleton */}
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="p-4 bg-[#F7F6F3] border border-[#E5E5E5] space-y-3"
                        style={{ borderRadius: '6px' }}
                      >
                        <div className="flex justify-between">
                          <div className="w-16 h-4 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                          <div className="w-24 h-4 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                        </div>
                        <div className="space-y-2">
                          <div className="w-full h-3 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                          <div className="w-5/6 h-3 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                          <div className="w-4/6 h-3 bg-[#E5E5E5] animate-pulse" style={{ borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : result ? (
                  // Real Analysis Data
                  <div className="space-y-6">
                    {/* Summary Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Language Badge */}
                      <div
                        className="px-3 py-1 bg-[#F7F6F3] border border-[#E5E5E5] text-xs font-medium text-[#37352F] rounded-md"
                      >
                        {result.language?.toUpperCase() || 'UNKNOWN'}
                      </div>

                      {/* Duration Badge */}
                      <div
                        className="px-3 py-1 bg-[#F7F6F3] text-xs font-medium text-[#787774] rounded-md"
                      >
                        {result.analysis.video_duration_seconds}s
                      </div>

                      {/* Shot Count Badge */}
                      <div
                        className="px-3 py-1 bg-[#37352F] text-xs font-medium text-white rounded-md"
                      >
                        {result.analysis.shots.length} SHOTS
                      </div>
                    </div>

                    {/* Shots Breakdown */}
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-[#37352F]">
                        Shot Breakdown
                      </h3>

                      {/* Display first 5 shots */}
                      {result.analysis.shots.slice(0, 5).map((shot: CompetitorShot) => (
                        <div
                          key={shot.shot_id}
                          className="p-4 bg-[#F7F6F3] border border-[#E5E5E5] space-y-2 rounded-lg"
                        >
                          {/* Shot Header */}
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-black">
                              Shot {shot.shot_id}
                            </span>
                            <span className="text-xs text-[#787774]">
                              {shot.start_time} - {shot.end_time}
                            </span>
                          </div>

                          {/* Shot Details */}
                          <div className="space-y-1.5 text-sm">
                            <div>
                              <span className="text-xs font-medium text-[#9B9A97] uppercase tracking-wide">
                                Action
                              </span>
                              <p className="text-[#37352F] mt-0.5">{shot.action}</p>
                            </div>

                            {shot.audio && (
                              <div>
                                <span className="text-xs font-medium text-[#9B9A97] uppercase tracking-wide">
                                  Audio
                                </span>
                                <p className="text-[#37352F] mt-0.5">{shot.audio}</p>
                              </div>
                            )}

                            <div>
                              <span className="text-xs font-medium text-[#9B9A97] uppercase tracking-wide">
                                Visual
                              </span>
                              <p className="text-[#37352F] mt-0.5">{shot.first_frame_description}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* More shots indicator */}
                      {result.analysis.shots.length > 5 && (
                        <div className="text-xs text-[#9B9A97] text-center pt-2">
                          + {result.analysis.shots.length - 5} more shots
                        </div>
                      )}
                    </div>

                    {/* CTA Button */}
                    <button
                      onClick={handleCloneVideo}
                      className="w-full py-3 bg-black text-white text-sm font-semibold hover:bg-black/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 rounded-lg shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Clone This Video Now
                    </button>

                    <p className="text-xs text-[#9B9A97] text-center mt-3">
                      {isSignedIn
                        ? 'Continue to your dashboard'
                        : 'Sign up to clone this video with your product'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Responsive Styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .md-responsive {
            flex-direction: column;
          }
          .md-full-width {
            width: 100% !important;
          }
          .border-r {
            border-right: none;
            border-bottom: 1px solid #E5E5E5;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 250ms ease-out;
        }
      `}</style>
    </div>
  );
}
