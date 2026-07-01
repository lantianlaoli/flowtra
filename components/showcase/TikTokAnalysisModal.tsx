'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { X, CheckCircle, AlertCircle, Loader2, Sparkles, Film, Volume2, Maximize, Download } from 'lucide-react';
import type { VideoAnalysisResult, ReferenceVideoShot } from '@/hooks/useVideoAnalysis';

interface TikTokAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  tiktokUrl: string;
  onComplete?: (result: VideoAnalysisResult) => void;
}

type AnalysisState = 'idle' | 'fetching_video' | 'analyzing' | 'completed' | 'error';
type ShareImageState = 'idle' | 'generating' | 'ready' | 'error';
type CloneReadyState = 'idle' | 'saving' | 'ready' | 'error';

const LOADING_TIPS = [
  "Deconstructing narrative structure...",
  "Identifying camera movements...",
  "Analyzing lighting and color palettes...",
  "Extracting key dialogue and audio cues...",
  "Mapping shot transitions...",
];
const SHARE_IMAGE_POLL_INTERVAL_MS = 3000;
const SHARE_IMAGE_MAX_WAIT_MS = 90000;

export function TikTokAnalysisModal({
  isOpen,
  onClose,
  tiktokUrl,
  onComplete
}: TikTokAnalysisModalProps) {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [status, setStatus] = useState<AnalysisState>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareImageStatus, setShareImageStatus] = useState<ShareImageState>('idle');
  const [shareImageTaskId, setShareImageTaskId] = useState<string | null>(null);
  const [shareImageError, setShareImageError] = useState<string | null>(null);
  const [cloneReadyStatus, setCloneReadyStatus] = useState<CloneReadyState>('idle');
  const [cloneReadyError, setCloneReadyError] = useState<string | null>(null);
  const [persistedCreatorSourceVideoId, setPersistedCreatorSourceVideoId] = useState<string | null>(null);
  
  // Refs for cleanup
  const tipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareImagePollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareImageResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareImageStartedAtRef = useRef<number | null>(null);
  const persistCreatorSourceVideoPromiseRef = useRef<Promise<string> | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  // Reset and start when opened
  useEffect(() => {
    if (isOpen) {
      setStatus('fetching_video');
      setVideoUrl(null);
      setResult(null);
      setError(null);
      setShareImageStatus('idle');
      setShareImageTaskId(null);
      setShareImageError(null);
      setCloneReadyStatus('idle');
      setCloneReadyError(null);
      setPersistedCreatorSourceVideoId(null);
      persistCreatorSourceVideoPromiseRef.current = null;
      setTipIndex(0);
      startAnalysis();
    } else {
      cleanupTimers();
      setStatus('idle');
    }
    return () => cleanupTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const cleanupTimers = () => {
    if (tipIntervalRef.current) clearInterval(tipIntervalRef.current);
    if (shareImagePollTimeoutRef.current) clearTimeout(shareImagePollTimeoutRef.current);
    if (shareImageResetTimeoutRef.current) clearTimeout(shareImageResetTimeoutRef.current);
  };

  const getShareImageFilename = useCallback(() => {
    const baseName = result?.analysis.name
      ?.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return baseName ? `analysis-share-${baseName}.png` : 'analysis-share.png';
  }, [result?.analysis.name]);

  const downloadShareImage = useCallback(async (imageUrl: string) => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download the generated share image');
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = getShareImageFilename();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, [getShareImageFilename]);

  const resetShareImageState = useCallback(() => {
    if (shareImagePollTimeoutRef.current) {
      clearTimeout(shareImagePollTimeoutRef.current);
      shareImagePollTimeoutRef.current = null;
    }
    if (shareImageResetTimeoutRef.current) {
      clearTimeout(shareImageResetTimeoutRef.current);
      shareImageResetTimeoutRef.current = null;
    }

    shareImageStartedAtRef.current = null;
    setShareImageTaskId(null);
    setShareImageStatus('idle');
    setShareImageError(null);
  }, []);

  const handleGenerateShareImage = useCallback(async () => {
    if (!result || !isSignedIn || shareImageStatus === 'generating') {
      return;
    }

    try {
      setShareImageError(null);
      setShareImageStatus('generating');

      const response = await fetch('/api/reference-videos/share-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: result.analysis,
          videoUrl: result.videoUrl,
          tiktokUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.taskId) {
        throw new Error(data.error || 'Failed to start share image generation');
      }

      shareImageStartedAtRef.current = Date.now();
      setShareImageTaskId(data.taskId);
    } catch (shareError) {
      console.error('[TikTokAnalysisModal] Share image request failed:', shareError);
      setShareImageStatus('error');
      setShareImageError(
        shareError instanceof Error
          ? shareError.message
          : 'Failed to generate your share image. Please try again.'
      );
    }
  }, [isSignedIn, result, shareImageStatus, tiktokUrl]);

  const persistCreatorSourceVideo = useCallback(async (analysisResult: VideoAnalysisResult): Promise<string> => {
    if (persistedCreatorSourceVideoId) {
      return persistedCreatorSourceVideoId;
    }

    if (persistCreatorSourceVideoPromiseRef.current) {
      return persistCreatorSourceVideoPromiseRef.current;
    }

    setCloneReadyStatus('saving');
    setCloneReadyError(null);

    const promise = (async () => {
      const response = await fetch('/api/creator-videos/import-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: tiktokUrl,
          analysisResult: analysisResult.analysis,
          language: analysisResult.language,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.video?.id) {
        throw new Error(data.error || data.details || 'Failed to save analyzed video for cloning');
      }

      const creatorSourceVideoId = data.video.id as string;
      setPersistedCreatorSourceVideoId(creatorSourceVideoId);
      setCloneReadyStatus('ready');
      return creatorSourceVideoId;
    })();

    persistCreatorSourceVideoPromiseRef.current = promise;

    try {
      return await promise;
    } catch (persistError) {
      setCloneReadyStatus('error');
      setCloneReadyError(
        persistError instanceof Error
          ? persistError.message
          : 'Failed to save analyzed video for cloning.'
      );
      throw persistError;
    } finally {
      persistCreatorSourceVideoPromiseRef.current = null;
    }
  }, [persistedCreatorSourceVideoId, tiktokUrl]);

  useEffect(() => {
    if (!isOpen || !isSignedIn || !shareImageTaskId || shareImageStatus !== 'generating') {
      return;
    }

    let cancelled = false;

    const pollShareImage = async () => {
      if (shareImageStartedAtRef.current && Date.now() - shareImageStartedAtRef.current > SHARE_IMAGE_MAX_WAIT_MS) {
        if (!cancelled) {
          setShareImageStatus('error');
          setShareImageError('Share image generation timed out. Please try again.');
          setShareImageTaskId(null);
        }
        return;
      }

      try {
        const response = await fetch(`/api/reference-videos/share-image?taskId=${encodeURIComponent(shareImageTaskId)}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to check share image status');
        }

        if (cancelled) {
          return;
        }

        if (data.status === 'success') {
          if (!data.imageUrl) {
            throw new Error('The share image finished without a downloadable file.');
          }

          await downloadShareImage(data.imageUrl);
          if (!cancelled) {
            setShareImageStatus('ready');
            setShareImageTaskId(null);
            setShareImageError(null);
            shareImageResetTimeoutRef.current = setTimeout(() => {
              if (!cancelled) {
                resetShareImageState();
              }
            }, 3000);
          }
          return;
        }

        if (data.status === 'fail' || data.status === 'unknown') {
          throw new Error(data.error || 'Share image generation failed');
        }

        shareImagePollTimeoutRef.current = setTimeout(pollShareImage, SHARE_IMAGE_POLL_INTERVAL_MS);
      } catch (pollError) {
        console.error('[TikTokAnalysisModal] Share image polling failed:', pollError);
        if (!cancelled) {
          setShareImageStatus('error');
          setShareImageTaskId(null);
          setShareImageError(
            pollError instanceof Error
              ? pollError.message
              : 'Failed to generate your share image. Please try again.'
          );
        }
      }
    };

    pollShareImage();

    return () => {
      cancelled = true;
      if (shareImagePollTimeoutRef.current) {
        clearTimeout(shareImagePollTimeoutRef.current);
        shareImagePollTimeoutRef.current = null;
      }
    };
  }, [downloadShareImage, isOpen, isSignedIn, resetShareImageState, shareImageStatus, shareImageTaskId]);

  const startAnalysis = useCallback(async () => {
    try {
      console.log('[TikTokAnalysisModal] Starting analysis for:', tiktokUrl);
      
      // Phase 1: Fetch Video URL
      setStatus('fetching_video');

      const videoRes = await fetch('/api/tiktok/fetch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiktok_url: tiktokUrl }),
      });

      if (!videoRes.ok) {
        const errorData = await videoRes.json();
        throw new Error(errorData.error || 'Failed to fetch video');
      }

      const videoData = await videoRes.json();
      if (!videoData.success || !videoData.video_url) {
        throw new Error('Failed to retrieve video URL');
      }

      const fetchedVideoUrl = videoData.video_url;
      setVideoUrl(fetchedVideoUrl);

      // Phase 2: Analyze Video (Show Split View immediately)
      setStatus('analyzing');
      
      // Start tip rotation
      cleanupTimers();
      tipIntervalRef.current = setInterval(() => {
        setTipIndex(prev => (prev + 1) % LOADING_TIPS.length);
      }, 3000);

      // Call Analysis API with the fetched URL
      const analyzeRes = await fetch('/api/reference-videos/analyze-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: fetchedVideoUrl,
          is_external_url: true, // Use external URL mode
          reference_name: 'TikTok Video'
        }),
      });

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        throw new Error(errorData.error || errorData.details || 'Analysis failed');
      }

      const analyzeData = await analyzeRes.json();

      if (!analyzeData.success) {
        throw new Error(analyzeData.error || 'Analysis failed');
      }

      // Complete
      cleanupTimers();
      
      const analysisResult: VideoAnalysisResult = {
        analysis: analyzeData.analysis,
        language: analyzeData.language,
        videoUrl: fetchedVideoUrl,
      };

      setResult(analysisResult);
      setStatus('completed');

      if (isSignedIn) {
        void persistCreatorSourceVideo(analysisResult).catch((persistError) => {
          console.error('[TikTokAnalysisModal] Failed to persist creator source video:', persistError);
        });
      }

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
  }, [isSignedIn, onComplete, persistCreatorSourceVideo, tiktokUrl]);

  const handleCloneVideo = async () => {
    if (!result) return;

    if (!isSignedIn) {
      window.location.href = '/sign-up?redirect_url=/dashboard/video-clone';
      return;
    }

    try {
      const creatorSourceVideoId = await persistCreatorSourceVideo(result);
      sessionStorage.setItem('preselect_reference_video', JSON.stringify({
        creatorSourceVideoId,
        videoId: creatorSourceVideoId,
      }));
      onClose?.();
      router.push('/dashboard/video-clone');
    } catch (cloneError) {
      console.error('[TikTokAnalysisModal] Clone setup failed:', cloneError);
      setCloneReadyStatus('error');
      setCloneReadyError(
        cloneError instanceof Error
          ? cloneError.message
          : 'Failed to prepare the analyzed video for cloning.'
      );
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
               status === 'fetching_video' ? 'Connecting to TikTok...' :
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
          
          {/* Phase 1: Fetching Video (Centered Spinner) */}
          {status === 'fetching_video' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white z-20">
              <div className="w-full max-w-md space-y-8 text-center">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 border-4 border-[#F0F0F0] rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-[#787774] text-sm">Fetching video metadata...</p>
              </div>
            </div>
          )}

          {/* Phase 2 & 3: Analyzing / Completed (Split View) */}
          {(status === 'analyzing' || status === 'completed') && (
            <div className="h-full flex flex-col md:flex-row bg-[#FAFAF8]">

              {/* Left: Video + Primary Summary */}
              <div className="w-full md:w-[42%] border-r border-[#E7E7E4] bg-[#F3F3F0] p-5 md:p-6 flex flex-col">
                <div className="min-h-0 flex-1 flex items-center justify-center">
                  <div className="relative h-full w-full max-h-full max-w-full rounded-[30px] bg-black overflow-hidden shadow-[0_22px_60px_rgba(0,0,0,0.18)] ring-1 ring-black/10">
                    <div className="mx-auto h-full w-full max-w-[min(100%,26rem)]">
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          controls
                          autoPlay
                          loop
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                          <Loader2 className="w-8 h-8 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-[#DFDFDA] pt-4">
                  {status === 'analyzing' ? (
                    <div className="space-y-3">
                      <div className="h-7 w-3/4 rounded-lg bg-[#E8E8E3] animate-pulse" />
                      <div className="flex gap-3">
                        <div className="h-3 w-20 rounded-full bg-[#E8E8E3] animate-pulse" />
                        <div className="h-3 w-16 rounded-full bg-[#E8E8E3] animate-pulse" />
                        <div className="h-3 w-12 rounded-full bg-[#E8E8E3] animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <h3 className="text-[34px] font-semibold leading-[0.95] tracking-[-0.06em] text-[#171717]">
                        {result?.analysis.name || 'Untitled Analysis'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#6B6B65]">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{result?.analysis.shots.length} shots</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <Film className="w-3.5 h-3.5" />
                          {result?.analysis.video_duration_seconds}s
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <Maximize className="w-3.5 h-3.5" />
                          9:16
                        </div>
                        <div className="inline-flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5" />
                          {result?.language?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Shot Breakdown + CTA */}
              <div className="flex-1 min-h-0 flex flex-col bg-white">
                <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-[#EFEFEA]">
                  {status === 'analyzing' ? (
                    <div className="flex items-center gap-2 text-sm text-[#6F6F69]">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      <span>{LOADING_TIPS[tipIndex]}</span>
                    </div>
                  ) : (
                    <h4 className="text-xs font-semibold uppercase tracking-[0.24em] text-[#979791]">
                      Shot Breakdown
                    </h4>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 md:px-8 py-6">
                  <div className="mx-auto max-w-2xl space-y-3">
                      {status === 'analyzing' ? (
                        // Skeletons
                        [1, 2, 3, 4].map((i) => (
                          <div key={i} className="rounded-[24px] border border-[#ECECE8] bg-[#FBFBFA] p-5 space-y-3">
                            <div className="flex gap-4">
                              <div className="w-8 h-8 bg-[#ECECE8] rounded-full animate-pulse" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-3/4 bg-[#ECECE8] rounded animate-pulse" />
                                <div className="h-3 w-full bg-[#ECECE8] rounded animate-pulse" />
                                <div className="h-3 w-5/6 bg-[#ECECE8] rounded animate-pulse" />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        // Real Shots
                        result?.analysis.shots.map((shot: ReferenceVideoShot) => (
                          <div 
                            key={shot.shot_id} 
                            className="group rounded-[24px] border border-[#E8E8E3] bg-[#FBFBFA] p-5 transition-all duration-200 hover:border-[#CFCFC9] hover:bg-white hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)]"
                          >
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0 w-9 flex justify-center pt-0.5">
                                <span className="inline-flex w-7 h-7 rounded-full bg-white text-[#5E5E57] text-xs font-bold items-center justify-center border border-[#DEDED8]">
                                  {shot.shot_id}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-[15px] font-semibold leading-[1.45] tracking-[-0.01em] text-[#171717]">
                                    {shot.action}
                                  </p>
                                  <span className="shrink-0 rounded-full border border-[#E1E1DC] bg-white px-2.5 py-1 text-[10px] font-mono text-[#7C7C75]">
                                    {shot.start_time}
                                  </span>
                                </div>
                                <p className="text-[13px] leading-7 text-[#62625C]">
                                  {shot.first_frame_description}
                                </p>
                                {shot.audio && (
                                  <div className="flex items-start gap-2 rounded-2xl border border-[#ECECE7] bg-white px-3 py-2.5">
                                    <Volume2 className="mt-0.5 h-3.5 w-3.5 text-[#8A8A84]" />
                                    <p className="text-xs italic leading-6 text-[#7A7A73]">
                                      &quot;{shot.audio}&quot;
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                  </div>
                </div>

                {/* Action */}
                <div className="mt-auto border-t border-[#ECECE7] bg-white px-6 md:px-8 py-5">
                  <div className="mx-auto max-w-2xl space-y-3">
                    {status === 'analyzing' ? (
                      <button disabled className="w-full rounded-2xl bg-[#F0F0EC] py-3.5 text-sm font-semibold text-[#9B9A97] cursor-not-allowed">
                        Finalizing Analysis...
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {cloneReadyError && isSignedIn && (
                          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{cloneReadyError}</span>
                          </div>
                        )}
                        {shareImageError && isSignedIn && (
                          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span>{shareImageError}</span>
                          </div>
                        )}

                        {isSignedIn ? (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={handleGenerateShareImage}
                              disabled={shareImageStatus === 'generating' || shareImageStatus === 'ready'}
                              className={`min-h-12 rounded-2xl px-4 py-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 transition-all flex items-center justify-center gap-2 ${
                                shareImageStatus === 'ready'
                                  ? 'border border-green-200 bg-green-50 text-green-700'
                                  : 'border border-[#D9D9D3] bg-[#F6F6F2] text-[#20201D] hover:bg-[#EFEFEA]'
                              }`}
                            >
                              {shareImageStatus === 'generating' ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generating...
                                </>
                              ) : shareImageStatus === 'ready' ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  Downloaded
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  Generate Share Image
                                </>
                              )}
                            </button>
                            <button
                              onClick={handleCloneVideo}
                              disabled={cloneReadyStatus === 'saving'}
                              className="min-h-12 rounded-2xl bg-black px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#222222] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.18)] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {cloneReadyStatus === 'saving' ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Preparing Clone...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Clone This Structure
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleCloneVideo}
                            className="w-full rounded-2xl bg-black py-3.5 text-sm font-semibold text-white hover:bg-[#222222] active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(0,0,0,0.18)] flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Clone This Structure
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-center text-xs text-[#8B8B84]">
                      {isSignedIn
                        ? shareImageStatus === 'ready'
                          ? 'Share image downloaded and editor is ready'
                          : 'Download a social share card or continue to editor'
                        : 'Sign up required to save'}
                    </p>
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
        </div>
      </div>
    </div>
  );
}
