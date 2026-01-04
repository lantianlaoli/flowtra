'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, CheckCircle, AlertCircle, Loader2, Sparkles, Film, Volume2, Maximize } from 'lucide-react';
import type { VideoAnalysisResult, CompetitorShot } from '@/hooks/useVideoAnalysis';

interface TikTokAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tiktokUrl: string;
  onComplete?: (result: VideoAnalysisResult) => void;
}

type AnalysisState = 'idle' | 'fetching' | 'analyzing' | 'completed' | 'error';

const LOADING_TIPS = [
  "Deconstructing narrative structure...",
  "Identifying camera movements...",
  "Analyzing lighting and color palettes...",
  "Extracting key dialogue and audio cues...",
  "Mapping shot transitions...",
];

export function TikTokAnalysisModal({
  isOpen,
  onClose,
  tiktokUrl,
  onComplete
}: TikTokAnalysisModalProps) {
  const { isSignedIn } = useUser();
  const [status, setStatus] = useState<AnalysisState>('idle');
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for cleanup
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tipIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset and start when opened
  useEffect(() => {
    if (isOpen) {
      setStatus('fetching');
      setProgress(0);
      setTipIndex(0);
      setResult(null);
      setError(null);
      startAnalysis();
    } else {
      // Cleanup on close
      cleanupTimers();
      setStatus('idle');
    }
    return () => cleanupTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cleanupTimers = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
  };

  const startAnalysis = useCallback(async () => {
    try {
      console.log('[TikTokAnalysisModal] Starting analysis for:', tiktokUrl);
      
      // Phase 1: Fetching
      setStatus('fetching');
      setProgress(10);

      // Call API
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

      // Phase 2: Analyzing (Simulated progress while parsing)
      setStatus('analyzing');
      setProgress(30);
      
      // Start progress simulation
      cleanupTimers();
      progressIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90;
          return prev + (Math.random() * 5); // Random increment
        });
      }, 800);

      // Start tip rotation
      tipIntervalRef.current = setInterval(() => {
        setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
      }, 2500);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      // Complete
      setProgress(100);
      cleanupTimers();
      
      const analysisResult: VideoAnalysisResult = {
        analysis: data.analysis,
        language: data.language,
        videoUrl: data.video_url,
      };

      setResult(analysisResult);
      setStatus('completed');

      if (onComplete) {
        onComplete(analysisResult);
      }

    } catch (err) {
      console.error('[TikTokAnalysisModal] Error:', err);
      cleanupTimers();
      setStatus('error');
      
      if (err instanceof Error) {
        if (err.message.includes('404')) setError('Video not found. It may be private or deleted.');
        else if (err.message.includes('429')) setError('Too many requests. Please try again later.');
        else if (err.message.includes('timeout')) setError('Analysis timed out. Please try a shorter video.');
        else setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    }
  }, [tiktokUrl, onComplete]);

  const handleCloneVideo = () => {
    if (!result) return;
    
    sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
      ...result,
      tiktokUrl
    }));

    if (isSignedIn) {
      window.location.href = '/dashboard/competitor-ugc-replication';
    } else {
      window.location.href = '/sign-up?redirect_url=/dashboard/competitor-ugc-replication';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative bg-white w-full max-w-5xl h-[85vh] max-h-[800px] rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden border border-[#E9E9E9] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0] bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${
              status === 'completed' ? 'bg-green-500' : 
              status === 'error' ? 'bg-red-500' : 
              'bg-blue-500 animate-pulse'
            }`} />
            <h2 className="text-base font-semibold text-[#37352F]">
              {status === 'completed' ? 'Analysis Complete' : 
               status === 'error' ? 'Analysis Failed' : 
               'Analyzing Video...'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#F7F6F3] rounded-md text-[#9B9A97] hover:text-[#37352F] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-white relative">
          
          {/* Loading State */}
          {(status === 'fetching' || status === 'analyzing') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white z-20">
              <div className="w-full max-w-md space-y-8 text-center">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 border-4 border-[#F0F0F0] rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                  <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-black animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-[#37352F]">
                    {status === 'fetching' ? 'Connecting to TikTok...' : 'Analyzing Creative Structure...'}
                  </h3>
                  <p className="text-[#787774] text-sm h-6 transition-all duration-300">
                    {status === 'analyzing' ? LOADING_TIPS[tipIndex] : 'Fetching video metadata...'}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="h-1.5 w-full bg-[#F0F0F0] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-black transition-all duration-500 ease-out rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#9B9A97] font-medium">
                    <span>{Math.round(progress)}%</span>
                    <span>Estimated time: 15s</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-20">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-[#37352F] mb-2">Analysis Failed</h3>
              <p className="text-[#787774] max-w-sm text-center mb-8">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 border border-[#E0E0E0] rounded-lg text-sm font-medium text-[#37352F] hover:bg-[#F7F6F3] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={startAnalysis}
                  className="px-6 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-[#2F2F2F] transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Completed State */}
          {status === 'completed' && result && (
            <div className="h-full flex flex-col md:flex-row">
              {/* Left: Video Preview */}
              <div className="w-full md:w-[45%] bg-[#F7F6F3] border-r border-[#E9E9E9] p-6 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-[320px] aspect-[9/16] bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5">
                  {result.videoUrl ? (
                    <video
                      src={result.videoUrl}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50">
                      No Preview
                    </div>
                  )}
                </div>
                <div className="mt-6 flex gap-4 text-xs font-medium text-[#787774]">
                  <div className="flex items-center gap-1.5">
                    <Film className="w-4 h-4" />
                    {result.analysis.video_duration_seconds}s
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Maximize className="w-4 h-4" />
                    9:16
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4" />
                    {result.language?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Right: Analysis Data */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-2xl mx-auto space-y-8">
                  
                  {/* Header Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 bg-[#F0F0F0] text-[#37352F] text-xs font-semibold rounded-md border border-[#E0E0E0]">
                        AI ANALYSIS
                      </span>
                      <span className="text-xs text-[#9B9A97]">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-[#37352F] mb-2">
                      {result.analysis.name || 'Untitled Analysis'}
                    </h3>
                    <p className="text-[#787774] text-sm">
                      Successfully identified {result.analysis.shots.length} distinct shots and narrative beats.
                    </p>
                  </div>

                  {/* Shot List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-[#9B9A97] uppercase tracking-wider">
                      Shot Breakdown
                    </h4>
                    <div className="space-y-3">
                      {result.analysis.shots.map((shot: CompetitorShot) => (
                        <div 
                          key={shot.shot_id} 
                          className="group p-4 rounded-xl border border-[#E9E9E9] bg-white hover:border-[#D0D0D0] hover:shadow-sm transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 pt-1">
                              <span className="inline-block w-6 h-6 rounded-full bg-[#F7F6F3] text-[#787774] text-xs font-bold flex items-center justify-center border border-[#E9E9E9]">
                                {shot.shot_id}
                              </span>
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex justify-between items-start">
                                <p className="text-sm font-medium text-[#37352F] leading-snug">
                                  {shot.action}
                                </p>
                                <span className="text-[10px] font-mono text-[#9B9A97] bg-[#F9F9F9] px-1.5 py-0.5 rounded border border-[#EFEFEF]">
                                  {shot.start_time}
                                </span>
                              </div>
                              <p className="text-xs text-[#787774] leading-relaxed">
                                {shot.first_frame_description}
                              </p>
                              {shot.audio && (
                                <div className="flex items-start gap-2 pt-1">
                                  <Volume2 className="w-3 h-3 text-[#9B9A97] mt-0.5" />
                                  <p className="text-xs text-[#9B9A97] italic">
                                    &quot;{shot.audio}&quot;
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-4 sticky bottom-0 bg-white pb-2 border-t border-transparent">
                    <button
                      onClick={handleCloneVideo}
                      className="w-full py-3.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-[#2F2F2F] active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Clone This Structure
                    </button>
                    <p className="text-center text-xs text-[#9B9A97] mt-3">
                      {isSignedIn ? 'Continues to editor' : 'Sign up required to save'}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}