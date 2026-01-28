'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Play, Wand2, Clock, Languages, Film, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import VideoPlayer from '@/components/ui/VideoPlayer';
import CompetitorShotsEditor from '@/components/CompetitorShotsEditor';
import { parseShotsFromAnalysis } from '@/lib/competitor-shot-form';

interface VideoAsset {
  id: string;
  video_url?: string | null;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  source_id?: string | null;
  source_name?: string | null;
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
}

interface VideoAssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoAsset | null;
}

export default function VideoAssetDetailsModal({ isOpen, onClose, video }: VideoAssetDetailsModalProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isCreatingClone, setIsCreatingClone] = useState(false);

  const shots = useMemo(() => {
    const raw = video?.analysis_result && typeof video.analysis_result === 'object'
      ? (video.analysis_result as any).shots
      : null;
    return Array.isArray(raw) ? raw : [];
  }, [video?.analysis_result]);

  const parsedShots = useMemo(() => parseShotsFromAnalysis(shots), [shots]);

  const analysisName = useMemo(() => {
    if (!video?.analysis_result || typeof video.analysis_result !== 'object') return null;
    const name = (video.analysis_result as any).name;
    return typeof name === 'string' ? name : null;
  }, [video?.analysis_result]);

  const analysisDuration = useMemo(() => {
    if (!video?.analysis_result || typeof video.analysis_result !== 'object') return null;
    const duration = (video.analysis_result as any).video_duration_seconds;
    return typeof duration === 'number' ? duration : null;
  }, [video?.analysis_result]);

  const detectedLanguage = useMemo(() => {
    if (video?.analysis_result && typeof video.analysis_result === 'object') {
      const detected = (video.analysis_result as any).detected_language;
      if (typeof detected === 'string') return detected;
    }
    return video?.analysis_language || null;
  }, [video?.analysis_result, video?.analysis_language]);

  const hasAnalysis = Boolean(video?.analysis_result);

  const displayName = useMemo(() => {
    if (!video) return 'TikTok Video';
    return video.source_name || 'TikTok Video';
  }, [video]);

  const handleUseForClone = async () => {
    if (!video?.analysis_result || !video) {
      showError('Video analysis is still running. Please try again shortly.');
      return;
    }

    setIsCreatingClone(true);
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
          analysis: video.analysis_result,
          language: video.analysis_language || 'en',
          videoUrl: video.video_cdn_url || null,
          tiktokUrl: video.video_url || null
        }));
      }

      showSuccess('Analysis ready. Continue to clone setup.');
      onClose();
      router.push('/dashboard/competitor-ugc-replication');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start clone flow';
      showError(message);
    } finally {
      setIsCreatingClone(false);
    }
  };

  const handleUseInMotionSwap = () => {
    router.push(`/dashboard/motion-swap?videoId=${video?.id}`);
  };

  return (
    <AnimatePresence>
      {isOpen && video && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-5xl mx-auto overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Video Details</h3>
                <p className="text-sm text-gray-500">{displayName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] gap-6 p-6">
              <div className="bg-black/95 rounded-xl overflow-hidden">
                {video.video_cdn_url ? (
                  <VideoPlayer
                    src={video.video_cdn_url}
                    className="w-full h-full"
                    showControls
                  />
                ) : (
                  <div className="flex items-center justify-center aspect-[9/16] text-gray-400">
                    Video unavailable
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Overview</p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        Duration
                      </span>
                      <span>{video.duration_seconds ? `${video.duration_seconds}s` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-gray-400" />
                        Language
                      </span>
                      <span>{detectedLanguage || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-400" />
                        Shots
                      </span>
                      <span>{parsedShots.length || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-400" />
                        Name
                      </span>
                      <span className="truncate max-w-[160px]">{analysisName || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Structure Analysis</p>
                  {hasAnalysis ? (
                    <div className="space-y-3">
                      <div className="max-h-[420px] overflow-y-auto">
                        <CompetitorShotsEditor
                          shots={parsedShots}
                          onShotsChange={() => {}}
                          showSummary={false}
                          readOnly
                          hideHeader
                          expandedMaxHeightClass="max-h-[280px] overflow-y-auto"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 space-y-3">
                      {video?.analysis_status === 'failed' ? (
                        <>
                          <p className="text-red-600">Analysis failed. Please retry by re-importing the video.</p>
                          {video.analysis_error && (
                            <p className="text-xs text-red-500">{video.analysis_error}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Analysis is running automatically in the background.</span>
                          </div>
                          <p className="text-xs text-gray-500">This may take a few minutes. Refresh the page to see the results.</p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-2 pt-2">
                  <button
                    onClick={handleUseForClone}
                    disabled={!hasAnalysis || isCreatingClone}
                    className="w-full px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreatingClone ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Use for Clone
                  </button>
                  <button
                    onClick={handleUseInMotionSwap}
                    disabled={!video.source_id}
                    className="w-full px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    Use in Motion Swap
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
