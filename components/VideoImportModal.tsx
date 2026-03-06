'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Link, Upload, Users, Loader2, ArrowLeft, Info, Sparkles, Shuffle, RotateCcw } from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import VideoPlayer from '@/components/ui/VideoPlayer';
import CompetitorShotsEditor from '@/components/CompetitorShotsEditor';
import { parseShotsFromAnalysis } from '@/lib/competitor-shot-form';
import { getSupabase } from '@/lib/supabase';

interface PreviewVideo {
  platform_video_id: string;
  video_url: string;
  play_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
}

interface ImportedVideo {
  id: string;
  source_id?: string | null;
  source_name?: string | null;
  video_url?: string | null;
  video_cdn_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
  analysis_status?: string | null;
  analysis_result?: Record<string, unknown> | null;
  analysis_error?: string | null;
  analysis_language?: string | null;
}

interface VideoImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (videos: ImportedVideo[], options?: { message?: string; skipRefresh?: boolean }) => void;
  onError?: (error: string) => void;
}

type ImportStep = 'choose' | 'link' | 'upload' | 'creator' | 'creator-preview' | 'processing' | 'processing-batch';
type ProcessingOrigin = 'upload' | 'link' | 'creator' | null;

const readApiErrorMessage = async (response: Response, fallback: string) => {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
    return fallback;
  } catch {
    return text.slice(0, 180);
  }
};

export default function VideoImportModal({
  isOpen,
  onClose,
  onImported,
  onError
}: VideoImportModalProps) {
  const [step, setStep] = useState<ImportStep>('choose');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkUrl, setLinkUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [creatorHandle, setCreatorHandle] = useState('');
  const [previewVideos, setPreviewVideos] = useState<PreviewVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [processingVideo, setProcessingVideo] = useState<ImportedVideo | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [processingCount, setProcessingCount] = useState(0);
  const [processingOrigin, setProcessingOrigin] = useState<ProcessingOrigin>(null);
  const [isFirstFrameUploading, setIsFirstFrameUploading] = useState(false);
  const [firstFrameUploadError, setFirstFrameUploadError] = useState<string | null>(null);
  const [analysisLoadingMessageIndex, setAnalysisLoadingMessageIndex] = useState(0);
  const [videoName, setVideoName] = useState('');
  const [isSavingVideoName, setIsSavingVideoName] = useState(false);
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const isProcessingStep = step === 'processing' || step === 'processing-batch';

  useEffect(() => {
    if (!isOpen) return;
    setStep('choose');
    setError(null);
    setIsSubmitting(false);
    setLinkUrl('');
    setUploadFile(null);
    setCreatorHandle('');
    setPreviewVideos([]);
    setSelectedVideoIds(new Set());
    setProcessingVideo(null);
    setProcessingMessage('');
    setProcessingCount(0);
    setProcessingOrigin(null);
    setIsFirstFrameUploading(false);
    setFirstFrameUploadError(null);
    setAnalysisLoadingMessageIndex(0);
    setVideoName('');
    setIsSavingVideoName(false);
    setIsRetryingAnalysis(false);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const selectedVideos = useMemo(() => {
    return previewVideos.filter(video => selectedVideoIds.has(video.platform_video_id));
  }, [previewVideos, selectedVideoIds]);

  const processingShots = useMemo(() => {
    const raw = processingVideo?.analysis_result && typeof processingVideo.analysis_result === 'object'
      ? (processingVideo.analysis_result as any).shots
      : null;
    return parseShotsFromAnalysis(Array.isArray(raw) ? raw : []);
  }, [processingVideo?.analysis_result]);

  const analysisLoadingMessages = useMemo(
    () => [
      'Analyzing your video structure...',
      'Detecting scene boundaries and pacing...',
      'Extracting subject, action, and camera motion...',
      'Mapping composition, lighting, and audio cues...',
      'Preparing a clean shot-by-shot timeline...'
    ],
    []
  );

  useEffect(() => {
    const isAnalysisPending = step === 'processing' &&
      processingVideo?.analysis_status !== 'failed' &&
      !processingVideo?.analysis_result;

    if (!isAnalysisPending) {
      setAnalysisLoadingMessageIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisLoadingMessageIndex(prev => (prev + 1) % analysisLoadingMessages.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [analysisLoadingMessages.length, processingVideo?.analysis_result, processingVideo?.analysis_status, step]);

  useEffect(() => {
    const videoId = processingVideo?.id;
    const shouldTrack = step === 'processing' &&
      Boolean(videoId) &&
      !processingVideo?.analysis_result &&
      processingVideo?.analysis_status !== 'failed';

    if (!shouldTrack || !videoId) return;

    let stopped = false;
    let inFlight = false;

    const applyVideoUpdate = (next: ImportedVideo) => {
      setProcessingVideo(next);
      if (next.analysis_status === 'failed') {
        setProcessingMessage('Video added. Analysis failed.');
      } else if (next.analysis_status === 'completed' || next.analysis_result) {
        setProcessingMessage('Video added. Analysis completed.');
      }
    };

    const syncVideo = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/creator-videos/${videoId}`, { method: 'GET' });
        if (!response.ok) return;
        const data = await response.json() as { video?: ImportedVideo };
        if (!data.video || stopped) return;
        applyVideoUpdate(data.video);
      } catch {
        // Best-effort fallback sync.
      } finally {
        inFlight = false;
      }
    };

    const supabase = getSupabase();
    const channel = supabase
      .channel(`creator-video-import-${videoId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'creator_source_videos',
        filter: `id=eq.${videoId}`
      }, payload => {
        if (stopped) return;
        const next = payload.new as ImportedVideo;
        applyVideoUpdate(next);
      })
      .subscribe();

    void syncVideo();
    const interval = window.setInterval(() => { void syncVideo(); }, 8000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [processingVideo?.analysis_result, processingVideo?.analysis_status, processingVideo?.id, step]);

  const canUseForClone = Boolean(processingVideo?.analysis_result);
  const requiresFirstFrameForMotionSwap = processingOrigin === 'upload';
  const hasFirstFrameImage = Boolean(processingVideo?.cover_url);
  const canUseForMotionSwap = Boolean(
    processingVideo?.source_id &&
    processingVideo?.id &&
    (!requiresFirstFrameForMotionSwap || hasFirstFrameImage)
  );

  const analysisName = useMemo(() => {
    if (!processingVideo?.analysis_result || typeof processingVideo.analysis_result !== 'object') {
      return '';
    }

    const name = (processingVideo.analysis_result as { name?: unknown }).name;
    return typeof name === 'string' ? name.trim() : '';
  }, [processingVideo?.analysis_result]);

  useEffect(() => {
    const nextName = processingVideo?.description?.trim()
      || analysisName
      || processingVideo?.source_name?.trim()
      || '';
    setVideoName(nextName);
  }, [analysisName, processingVideo?.description, processingVideo?.id, processingVideo?.source_name]);

  const handleBackToChoose = () => {
    setStep('choose');
    setError(null);
  };

  const scheduleAutoClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 700);
  };

  const handleImportLink = async () => {
    if (!linkUrl.trim()) {
      setError('TikTok link is required.');
      return;
    }

    setStep('processing');
    setIsSubmitting(true);
    setError(null);
    setFirstFrameUploadError(null);
    setProcessingOrigin('link');
    setProcessingMessage('Importing video and running analysis...');
    setProcessingVideo(null);

    try {
      const response = await fetch('/api/creator-videos/import-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import video.');
      }

      const imported = data.videos || (data.video ? [data.video] : []);
      const nextVideo = imported[0] || null;
      setProcessingVideo(nextVideo);
      if (nextVideo?.analysis_status === 'failed') {
        setProcessingMessage('Video added. Analysis failed.');
      } else if (nextVideo?.analysis_status === 'completed') {
        setProcessingMessage('Video added. Analysis completed.');
      } else {
        setProcessingMessage('Video added. Analysis is running.');
      }

      onImported(imported, {
        message: nextVideo?.analysis_status === 'failed'
          ? 'Video imported. Analysis failed. Refresh to see the latest updates.'
          : nextVideo?.analysis_status === 'completed'
            ? 'Video imported. Analysis completed. Refresh to see the latest updates.'
            : 'Video imported. Analysis is running. Refresh to see the latest updates.',
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to import video.';
      setError(message);
      onError?.(message);
      setStep('link');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpload = async (fileOverride?: File | null) => {
    const fileToUpload = fileOverride ?? uploadFile;
    if (!fileToUpload) {
      setError('Please select a video file to upload.');
      return;
    }
    if (!fileToUpload.type.startsWith('video/')) {
      setError('Only video files are supported.');
      return;
    }

    setStep('processing');
    setIsSubmitting(true);
    setError(null);
    setFirstFrameUploadError(null);
    setProcessingOrigin('upload');
    setProcessingMessage('Uploading video and running analysis...');
    setProcessingVideo(null);

    try {
      const signedResponse = await fetch('/api/creator-videos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileToUpload.name,
          fileType: fileToUpload.type
        })
      });
      if (!signedResponse.ok) {
        throw new Error(await readApiErrorMessage(signedResponse, 'Failed to initialize upload.'));
      }

      const signedData = await signedResponse.json() as {
        bucket: string;
        creatorVideoId: string;
        path: string;
        token: string;
      };

      if (!signedData.bucket || !signedData.creatorVideoId || !signedData.path || !signedData.token) {
        throw new Error('Failed to initialize upload.');
      }

      const supabase = getSupabase();
      const { error: uploadError } = await supabase.storage
        .from(signedData.bucket)
        .uploadToSignedUrl(signedData.path, signedData.token, fileToUpload, {
          contentType: fileToUpload.type || 'video/mp4',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const response = await fetch('/api/creator-videos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorVideoId: signedData.creatorVideoId,
          storageBucket: signedData.bucket,
          storagePath: signedData.path,
          fileName: fileToUpload.name,
          fileType: fileToUpload.type
        })
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to process uploaded video.'));
      }

      const data = await response.json();

      const imported = data.videos || (data.video ? [data.video] : []);
      const nextVideo = imported[0] || null;
      setProcessingVideo(nextVideo);
      if (nextVideo?.analysis_status === 'failed') {
        setProcessingMessage('Video added. Analysis failed.');
      } else if (nextVideo?.analysis_status === 'completed') {
        setProcessingMessage('Video added. Analysis completed.');
      } else {
        setProcessingMessage('Video added. Analysis is running.');
      }

      onImported(imported, {
        message: nextVideo?.analysis_status === 'failed'
          ? 'Video uploaded. Analysis failed. Refresh to see the latest updates.'
          : nextVideo?.analysis_status === 'completed'
            ? 'Video uploaded. Analysis completed. Refresh to see the latest updates.'
            : 'Video uploaded. Analysis is running. Refresh to see the latest updates.',
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to upload video.';
      setError(message);
      onError?.(message);
      setStep('upload');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewCreator = async () => {
    if (!creatorHandle.trim()) {
      setError('TikTok username is required.');
      return;
    }

    setIsPreviewLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/creator-videos/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: creatorHandle.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch creator videos.');
      }

      setPreviewVideos(data.videos || []);
      setSelectedVideoIds(new Set());
      setStep('creator-preview');
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : 'Failed to fetch creator videos.';
      setError(message);
      onError?.(message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleImportCreatorVideos = async () => {
    if (selectedVideos.length === 0) {
      setError('Select at least one video to import.');
      return;
    }

    setStep('processing-batch');
    setIsSubmitting(true);
    setError(null);
    setFirstFrameUploadError(null);
    setProcessingOrigin('creator');
    setProcessingMessage('Processing selected videos. This may take a few minutes.');
    setProcessingCount(selectedVideos.length);

    try {
      const response = await fetch('/api/creator-videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: creatorHandle.trim(),
          videos: selectedVideos
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import creator videos.');
      }

      onImported([], {
        message: `Processing ${selectedVideos.length} videos in the background. Refresh in a few minutes to see them.`
      });
      scheduleAutoClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to import creator videos.';
      setError(message);
      onError?.(message);
      setStep('creator-preview');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelected = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleUseForClone = () => {
    if (!processingVideo?.analysis_result) {
      setError('Analysis is still running. Please wait a moment.');
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
        analysis: processingVideo.analysis_result,
        language: processingVideo.analysis_language || 'en',
        videoUrl: processingVideo.video_cdn_url || null,
        tiktokUrl: processingVideo.video_url || null
      }));
    }

    onClose();
    router.push('/dashboard/competitor-ugc-replication');
  };

  const handleUseInMotionSwap = () => {
    onClose();
    router.push(`/dashboard/motion-swap?videoId=${processingVideo?.id}`);
  };

  const handleSaveVideoName = async () => {
    if (!processingVideo?.id) {
      return;
    }

    const trimmedName = videoName.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (trimmedName === (processingVideo.description || '').trim()) {
      return;
    }

    setIsSavingVideoName(true);
    setError(null);

    try {
      const response = await fetch(`/api/creator-videos/${processingVideo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmedName })
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to update video name.'));
      }

      const data = await response.json() as { video?: ImportedVideo };
      if (!data.video) {
        throw new Error('Failed to update video name.');
      }

      setProcessingVideo(prev => prev ? { ...prev, description: data.video?.description || trimmedName } : prev);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update video name.';
      setError(message);
      onError?.(message);
    } finally {
      setIsSavingVideoName(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!processingVideo?.id) {
      return;
    }

    setIsRetryingAnalysis(true);
    setError(null);

    try {
      const response = await fetch(`/api/creator-videos/${processingVideo.id}/retry-analysis`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, 'Failed to retry analysis.'));
      }

      const data = await response.json() as { video?: ImportedVideo };
      const nextVideo = data.video || null;
      if (!nextVideo) {
        throw new Error('Failed to retry analysis.');
      }

      setProcessingVideo(prev => prev ? {
        ...prev,
        ...nextVideo,
        analysis_result: null,
        analysis_error: null,
        analysis_status: 'analyzing'
      } : nextVideo);
      setProcessingMessage('Video added. Analysis is running.');
    } catch (retryError) {
      const message = retryError instanceof Error ? retryError.message : 'Failed to retry analysis.';
      setError(message);
      onError?.(message);
    } finally {
      setIsRetryingAnalysis(false);
    }
  };

  const handleUploadFirstFrame = async (file: File | null) => {
    if (!file || !processingVideo?.id) {
      return;
    }

    setIsFirstFrameUploading(true);
    setFirstFrameUploadError(null);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file for the first frame.');
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/creator-videos/${processingVideo.id}/first-frame`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload first frame image.');
      }

      const updatedVideo = data.video as ImportedVideo;
      setProcessingVideo(prev => prev ? { ...prev, cover_url: updatedVideo.cover_url || null } : prev);
      onImported([updatedVideo], {
        message: 'First frame uploaded. Motion Swap is now available.'
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : 'Failed to upload first frame image.';
      setFirstFrameUploadError(message);
      onError?.(message);
    } finally {
      setIsFirstFrameUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="assets-modal assets-video-import fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="assets-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`assets-modal-panel assets-video-import-panel relative mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ${isProcessingStep ? 'max-w-[1560px] h-[88vh] max-h-[878px]' : 'max-w-[1180px] max-h-[90vh]'}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="assets-modal-icon w-9 h-9 bg-black rounded-lg flex items-center justify-center">
                  <SiTiktok className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Import Videos</h3>
                  <p className="assets-modal-subtitle text-sm text-gray-600">TikTok only. Videos are stored in your library.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {step === 'choose' && (
              <div className="assets-modal-body p-6 space-y-6">
                <div className="assets-video-import-options grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setStep('link')}
                    className="assets-video-import-option group border border-gray-200 rounded-xl p-5 text-left hover:border-black hover:shadow-sm transition-colors"
                  >
                    <div className="assets-video-import-option-icon w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors">
                      <Link className="w-4 h-4" />
                    </div>
                    <h4 className="assets-video-import-option-title text-sm font-semibold text-gray-900 mb-1">Paste Link</h4>
                    <p className="assets-video-import-option-copy text-xs text-gray-500">Copy a TikTok video URL and import it instantly.</p>
                  </button>
                  <button
                    onClick={() => setStep('upload')}
                    className="assets-video-import-option group border border-gray-200 rounded-xl p-5 text-left hover:border-black hover:shadow-sm transition-colors"
                  >
                    <div className="assets-video-import-option-icon w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors">
                      <Upload className="w-4 h-4" />
                    </div>
                    <h4 className="assets-video-import-option-title text-sm font-semibold text-gray-900 mb-1">Upload File</h4>
                    <p className="assets-video-import-option-copy text-xs text-gray-500">Upload a downloaded TikTok MP4 from your device.</p>
                  </button>
                  <button
                    onClick={() => setStep('creator')}
                    className="assets-video-import-option group border border-gray-200 rounded-xl p-5 text-left hover:border-black hover:shadow-sm transition-colors"
                  >
                    <div className="assets-video-import-option-icon w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="assets-video-import-option-title text-sm font-semibold text-gray-900 mb-1">Creator Name</h4>
                    <p className="assets-video-import-option-copy text-xs text-gray-500">Fetch the latest videos and import selected ones.</p>
                  </button>
                </div>
              </div>
            )}

            {(step === 'link' || step === 'upload') && (
              <div className="assets-modal-body p-6 space-y-6">
                <button
                  onClick={handleBackToChoose}
                  className="assets-video-import-back inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to options
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-6">
                  <div className="assets-video-import-help rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div className="assets-video-import-help-title flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Info className="w-4 h-4" />
                      {step === 'link' ? 'How to get the TikTok link' : 'How to prepare the file'}
                    </div>
                    <ol className="assets-video-import-help-list space-y-2 text-sm text-gray-600">
                      {step === 'link' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">1.</span>
                            Open the TikTok video you want to import.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">2.</span>
                            Tap the Share button on the right panel.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">3.</span>
                            Choose Copy Link and paste it here.
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">1.</span>
                            Download the TikTok video to your device.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">2.</span>
                            Save the file as MP4 or MOV.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">3.</span>
                            Upload the file here to import.
                          </li>
                        </>
                      )}
                    </ol>
                  </div>

                  <div className="assets-video-import-form space-y-4">
                    {step === 'link' ? (
                      <>
                        <label className="assets-modal-label block text-sm font-medium text-gray-700">TikTok Video Link</label>
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={linkUrl}
                              onChange={(event) => setLinkUrl(event.target.value)}
                              placeholder="https://www.tiktok.com/@creator/video/123"
                              className="assets-modal-input w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                            />
                          </div>
                          <button
                            onClick={handleImportLink}
                            disabled={isSubmitting}
                            className="assets-modal-primary w-full px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isSubmitting ? 'Importing...' : 'Import & Analyze'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="assets-modal-label block text-sm font-medium text-gray-700">Upload Video File</label>
                        <div className="flex flex-col gap-3">
                          <label className="assets-modal-upload w-full aspect-square flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-2xl px-6 text-sm text-gray-500 cursor-pointer hover:border-gray-400 transition-colors">
                            <Upload className="w-5 h-5" />
                            <span className="text-sm">{uploadFile ? uploadFile.name : 'Choose a video file'}</span>
                            <span className="assets-modal-helper text-xs text-gray-400">MP4 or MOV</span>
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                setUploadFile(file);
                                if (file) {
                                  void handleUpload(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'creator' && (
              <div className="assets-modal-body p-6 space-y-6">
                <button
                  onClick={handleBackToChoose}
                  className="assets-video-import-back inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to options
                </button>

                <div className="assets-video-import-form space-y-4">
                  <label className="assets-modal-label block text-sm font-medium text-gray-700">TikTok Username</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">@</span>
                      <input
                        type="text"
                        value={creatorHandle}
                        onChange={(event) => setCreatorHandle(event.target.value)}
                        placeholder="creator"
                        className="assets-modal-input w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      />
                    </div>
                    <button
                      onClick={handlePreviewCreator}
                      disabled={isPreviewLoading}
                      className="assets-modal-secondary px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      {isPreviewLoading ? 'Loading...' : 'Fetch Videos'}
                    </button>
                  </div>
                  <p className="assets-modal-helper text-xs text-gray-500">We will show the latest 10 videos for selection.</p>
                </div>
              </div>
            )}

            {step === 'creator-preview' && (
              <div className="assets-modal-body p-6 space-y-6">
                <button
                  onClick={() => setStep('creator')}
                  className="assets-video-import-back inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to search
                </button>

                <div className="flex items-center justify-between">
                  <p className="assets-video-import-meta text-sm text-gray-600">
                    Select videos to import ({selectedVideos.length} selected)
                  </p>
                  <button
                    onClick={handleImportCreatorVideos}
                    disabled={isSubmitting || selectedVideos.length === 0}
                    className="assets-modal-primary px-4 py-2 text-sm font-medium bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
                  >
                    {isSubmitting ? 'Importing...' : 'Import Selected'}
                  </button>
                </div>

                <div className="max-h-[62vh] overflow-y-auto pr-1">
                  <div className="assets-video-import-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {previewVideos.map(video => (
                      <button
                        key={video.platform_video_id}
                        onClick={() => toggleSelected(video.platform_video_id)}
                        className={`assets-video-import-tile group text-left border rounded-lg overflow-hidden transition-colors ${selectedVideoIds.has(video.platform_video_id) ? 'border-black ring-1 ring-black' : 'border-gray-200 hover:border-gray-400'}`}
                      >
                        <div className="assets-video-import-thumb relative aspect-[9/16] bg-gray-100">
                          {video.cover_url ? (
                            <img
                              src={video.cover_url}
                              alt={video.description || 'TikTok preview'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-300">
                              <Users className="w-5 h-5" />
                            </div>
                          )}
                          {selectedVideoIds.has(video.platform_video_id) && (
                            <div className="assets-video-import-thumb-overlay absolute inset-0 bg-black/30" />
                          )}
                        </div>
                        <div className="assets-video-import-tile-body p-2">
                          <p className="assets-video-import-tile-copy text-xs text-gray-600 line-clamp-2 min-h-[2rem]">
                            {video.description || 'TikTok video'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 'processing' && (
              <div className={`assets-modal-body grid min-h-0 flex-1 grid-cols-1 items-stretch gap-5 overflow-hidden px-5 py-5 ${requiresFirstFrameForMotionSwap ? 'lg:grid-cols-[840px_minmax(520px,1fr)]' : 'lg:grid-cols-[340px_minmax(720px,1fr)]'}`}>
                <div className={`grid min-h-0 h-full min-w-0 items-stretch justify-items-center gap-4 overflow-hidden ${requiresFirstFrameForMotionSwap ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {requiresFirstFrameForMotionSwap && (
                    <label className="assets-video-import-preview flex h-full aspect-[9/16] w-auto max-w-full min-w-0 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white transition-colors hover:border-gray-500 cursor-pointer">
                      <div className="flex h-full w-full items-center justify-center overflow-hidden px-5 text-center">
                        {processingVideo?.cover_url ? (
                          <img
                            src={processingVideo.cover_url}
                            alt="Uploaded first frame"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3">
                            <Upload className="w-5 h-5 text-gray-500" />
                            {isFirstFrameUploading ? (
                              <p className="text-sm text-gray-600">Uploading first frame...</p>
                            ) : (
                              <>
                                <p className="text-sm font-medium text-gray-800">First Frame</p>
                                <p className="text-xs text-gray-500">Optional, required for Motion Swap</p>
                              </>
                            )}
                          </div>
                        )}
                        <span className="sr-only">Upload first frame</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isFirstFrameUploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            void handleUploadFirstFrame(file);
                            event.currentTarget.value = '';
                          }}
                        />
                      </div>
                    </label>
                  )}
                  <div className="flex min-h-0 h-full items-stretch justify-start overflow-hidden">
                    <div className="assets-video-import-preview h-full aspect-[9/16] w-auto max-w-full overflow-hidden rounded-xl border-2 border-gray-300 bg-black/95">
                      {processingVideo?.video_cdn_url ? (
                        <VideoPlayer
                          src={processingVideo.video_cdn_url}
                          className="w-full h-full object-cover"
                          showControls
                        />
                      ) : (
                        <div className="assets-video-import-preview-empty flex h-full w-full flex-col items-center justify-center text-gray-300 text-sm gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Preparing video preview...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="assets-video-import-panel flex min-h-0 h-full flex-col gap-4 overflow-hidden">
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <label htmlFor="import-video-name" className="assets-video-import-label text-xs uppercase tracking-wide text-gray-500">
                        Name
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="import-video-name"
                          type="text"
                          value={videoName}
                          onChange={(event) => setVideoName(event.target.value)}
                          onBlur={() => {
                            if (!isSavingVideoName && videoName.trim() && videoName.trim() !== (processingVideo?.description || '').trim()) {
                              void handleSaveVideoName();
                            }
                          }}
                          maxLength={120}
                          placeholder="Name this video"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:border-black focus:outline-none focus:ring-2 focus:ring-black/5"
                          disabled={!processingVideo?.id || isSavingVideoName}
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveVideoName()}
                          disabled={!processingVideo?.id || !videoName.trim() || isSavingVideoName || videoName.trim() === (processingVideo?.description || '').trim()}
                          className="min-h-[40px] rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isSavingVideoName ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <p className="assets-video-import-label text-xs uppercase tracking-wide text-gray-500">Overview</p>
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>Language</span>
                      <span>{processingVideo?.analysis_language || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-700">
                      <span>Duration</span>
                      <span>{processingVideo?.duration_seconds ? `${processingVideo.duration_seconds}s` : '—'}</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 min-h-0">
                    <p className="assets-video-import-label text-xs uppercase tracking-wide text-gray-500">Structure Analysis</p>
                    {processingVideo?.analysis_status === 'failed' ? (
                      <div className="assets-video-import-alert rounded-lg border border-dashed border-red-200 bg-red-50 p-4 text-sm text-red-600 space-y-3">
                        <p>Analysis failed. Retry the analysis to continue.</p>
                        {processingVideo.analysis_error && (
                          <p className="text-xs text-red-500">{processingVideo.analysis_error}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleRetryAnalysis()}
                          disabled={isRetryingAnalysis}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isRetryingAnalysis ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          {isRetryingAnalysis ? 'Retrying...' : 'Retry Analysis'}
                        </button>
                      </div>
                    ) : processingVideo?.analysis_result ? (
                      <>
                        <div className="flex items-center justify-between text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">Shot List</span>
                          <span className="assets-video-import-meta text-xs text-gray-500">{processingShots.length} shots</span>
                        </div>
                        <div className="assets-video-import-shots flex-1 min-h-0 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4">
                          <CompetitorShotsEditor
                            shots={processingShots}
                            onShotsChange={() => {}}
                            showSummary={false}
                            readOnly
                            hideHeader
                            expandedMaxHeightClass="max-h-[260px] overflow-y-auto"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="assets-video-import-alert rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500 min-h-[80px] flex items-center">
                        <div className="flex items-center gap-2 text-gray-600 w-full min-w-0">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={analysisLoadingMessages[analysisLoadingMessageIndex]}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.22 }}
                              className="truncate"
                            >
                              {analysisLoadingMessages[analysisLoadingMessageIndex]}
                            </motion.span>
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="assets-video-import-actions mt-auto flex flex-col gap-2">
                    <button
                      onClick={handleUseForClone}
                      disabled={!canUseForClone}
                      className="w-full h-11 px-4 text-sm font-semibold text-white rounded-xl border border-black bg-gradient-to-b from-[#141414] to-black shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.30)] active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_20px_rgba(0,0,0,0.24)] flex items-center justify-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-md border border-white/20 bg-white/10 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </span>
                      Go to Clone Video
                    </button>
                    <button
                      onClick={handleUseInMotionSwap}
                      disabled={!canUseForMotionSwap || isFirstFrameUploading}
                      className="w-full h-11 px-4 text-sm font-semibold text-white rounded-xl border border-black bg-gradient-to-b from-[#101010] to-black shadow-[0_8px_20px_rgba(0,0,0,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.30)] active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_20px_rgba(0,0,0,0.24)] flex items-center justify-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-md border border-white/20 bg-white/10 flex items-center justify-center">
                        <Shuffle className="w-3.5 h-3.5" />
                      </span>
                      Go to Motion Swap
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'processing-batch' && (
              <div className="assets-modal-body p-10 flex flex-col items-center justify-center text-center gap-4">
                <div className="assets-video-import-loader w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
                <h4 className="assets-video-import-title text-lg font-semibold text-gray-900">Processing {processingCount} videos</h4>
                <p className="assets-video-import-meta text-sm text-gray-500 max-w-md">
                  {processingMessage || 'This may take a few minutes. You can close this window and refresh to see new videos.'}
                </p>
              </div>
            )}

            {error && (
              <div className="assets-modal-body px-6 pb-6">
                <div className="assets-modal-error bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
