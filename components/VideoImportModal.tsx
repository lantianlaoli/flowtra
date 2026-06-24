'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Link, Upload, Loader2, ArrowLeft, ArrowRight, Info, AlertCircle, RotateCcw, Languages, Film, Clock, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReferenceVideoShotsEditor from '@/components/ReferenceVideoShotsEditor';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { parseShotsFromAnalysis } from '@/lib/reference-video-shot-form';
import { getAnalysisShotCount, normalizeAnalysisToV2 } from '@/lib/video-analysis-schema';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';

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
  onVideoUpdated?: (video: ImportedVideo) => void;
  onError?: (error: string) => void;
  onContinueInAgentFeatures?: () => void;
}

type ImportStep = 'choose' | 'link' | 'upload' | 'creator' | 'creator-preview' | 'processing' | 'processing-batch';
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

const DEFAULT_IMPORT_NAMES = new Set([
  'uploaded',
  'upload',
  'untitled',
  'tiktok video',
]);

const isDefaultImportName = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && DEFAULT_IMPORT_NAMES.has(normalized));
};

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const deriveAnalysisDisplayName = (analysisResult: Record<string, unknown> | null | undefined): string => {
  if (!analysisResult || typeof analysisResult !== 'object') {
    return '';
  }

  const explicitName = typeof analysisResult.name === 'string' ? analysisResult.name.trim() : '';
  if (explicitName) {
    return isDefaultImportName(explicitName) ? '' : toTitleCase(explicitName);
  }

  const shots = Array.isArray(analysisResult.shots) ? analysisResult.shots : [];
  const firstShot = shots[0];
  if (!firstShot || typeof firstShot !== 'object') {
    return '';
  }

  const shotRecord = firstShot as Record<string, unknown>;
  const visual = shotRecord.visual && typeof shotRecord.visual === 'object'
    ? shotRecord.visual as Record<string, unknown>
    : null;
  const openingFrame = shotRecord.opening_frame && typeof shotRecord.opening_frame === 'object'
    ? shotRecord.opening_frame as Record<string, unknown>
    : null;

  const subject = typeof visual?.subject === 'string' ? visual.subject.trim() : '';
  if (subject) {
    return subject.length > 60 ? `${subject.slice(0, 57).trim()}...` : subject;
  }

  const description = typeof openingFrame?.description === 'string' ? openingFrame.description.trim() : '';
  if (description) {
    return description.length > 60 ? `${description.slice(0, 57).trim()}...` : description;
  }

  return '';
};

function GlassLoadingBar({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-full border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,245,0.82))] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm ${className}`}>
      <motion.div
        className="absolute inset-y-[-35%] -left-[42%] w-[42%] rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.98),rgba(255,255,255,0))] blur-md"
        animate={{ x: ['0%', '360%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,255,255,0.08))]" />
    </div>
  );
}

function GlassLoadingField({
  className = '',
  lines = 1,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={`rounded-2xl border border-[#D8D8D8] bg-white/72 p-3 shadow-[0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm ${className}`}>
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, index) => (
          <GlassLoadingBar
            key={index}
            className={index === lines - 1 ? 'h-3.5 w-3/5' : 'h-3.5 w-full'}
          />
        ))}
      </div>
    </div>
  );
}

function GlassWavePanel({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-dashed border-[#D7D7D7] bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(250,250,250,0.74))] backdrop-blur-sm ${className}`}>
      <motion.div
        className="absolute inset-y-[-18%] -left-[35%] w-[46%] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.96),rgba(255,255,255,0))] blur-xl"
        animate={{ x: ['0%', '320%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-y-[-12%] -left-[55%] w-[58%] bg-[linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.55),rgba(255,255,255,0))] blur-2xl"
        animate={{ x: ['0%', '290%'] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'linear', delay: 0.2 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.55),transparent_58%)]" />
      {children}
    </div>
  );
}

export default function VideoImportModal({
  isOpen,
  onClose,
  onImported,
  onVideoUpdated,
  onError,
  onContinueInAgentFeatures
}: VideoImportModalProps) {
  const supabase = useSupabaseBrowserClient();
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
  const [videoName, setVideoName] = useState('');
  const [isSavingVideoName, setIsSavingVideoName] = useState(false);
  const [isRetryingAnalysis, setIsRetryingAnalysis] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const videoNameAutoSaveTimerRef = useRef<number | null>(null);
  const previousProcessingVideoIdRef = useRef<string | null>(null);
  const previousVideoDescriptionRef = useRef('');
  const isProcessingStep = step === 'processing' || step === 'processing-batch';
  const canContinueInAgentFeatures = Boolean(
    onContinueInAgentFeatures &&
    processingVideo?.analysis_result &&
    processingVideo.analysis_status !== 'failed'
  );

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
    setVideoName('');
    setIsSavingVideoName(false);
    setIsRetryingAnalysis(false);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (videoNameAutoSaveTimerRef.current) {
        window.clearTimeout(videoNameAutoSaveTimerRef.current);
      }
    };
  }, []);

  const selectedVideos = useMemo(() => {
    return previewVideos.filter(video => selectedVideoIds.has(video.platform_video_id));
  }, [previewVideos, selectedVideoIds]);

  const processingShots = useMemo(() => {
    return parseShotsFromAnalysis(processingVideo?.analysis_result || null);
  }, [processingVideo?.analysis_result]);
  const isAnalysisPending = step === 'processing' &&
    processingVideo?.analysis_status !== 'failed' &&
    !processingVideo?.analysis_result;

  useEffect(() => {
    if (!isAnalysisPending) {
      return;
    }
  }, [isAnalysisPending]);

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
      if (next.id) {
        onVideoUpdated?.(next);
      }
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
  }, [onVideoUpdated, processingVideo?.analysis_result, processingVideo?.analysis_status, processingVideo?.id, step, supabase]);

  const previewWidth = 324;
  const previewHeight = 576;
  const previewCardClassName = 'flex-none overflow-hidden rounded-xl';
  const processingDisplayDurationSeconds = useMemo(() => {
    const normalizedAnalysis = normalizeAnalysisToV2(processingVideo?.analysis_result || null);
    const analysisDuration = normalizedAnalysis?.video_duration_seconds;
    const summedShotDuration = processingShots.reduce(
      (sum, shot) => sum + (Number(shot.duration_seconds) || 0),
      0,
    );

    if (typeof analysisDuration === 'number' && analysisDuration > 0) {
      return analysisDuration;
    }

    if (summedShotDuration > 0) {
      return summedShotDuration;
    }

    return processingVideo?.duration_seconds || null;
  }, [processingShots, processingVideo?.analysis_result, processingVideo?.duration_seconds]);
  const processingShotCount = useMemo(() => {
    return getAnalysisShotCount(processingVideo?.analysis_result || null) || 0;
  }, [processingVideo?.analysis_result]);
  const canSaveVideoName = Boolean(
    processingVideo?.id &&
    videoName.trim() &&
    videoName.trim() !== (processingVideo?.description || '').trim() &&
    !isSavingVideoName
  );

  const analysisName = useMemo(() => {
    return deriveAnalysisDisplayName(processingVideo?.analysis_result);
  }, [processingVideo?.analysis_result]);

  const hasGeneratedAnalysisName = Boolean(analysisName);
  const hasMeaningfulVideoDescription = Boolean(
    processingVideo?.description?.trim() &&
    !isDefaultImportName(processingVideo.description)
  );

  const handleSaveVideoName = useCallback(async (nameOverride?: string) => {
    if (!processingVideo?.id) {
      return;
    }

    const trimmedName = (nameOverride ?? videoName).trim();
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

      previousVideoDescriptionRef.current = (data.video.description || trimmedName).trim();
      setProcessingVideo(prev => prev ? { ...prev, description: data.video?.description || trimmedName } : prev);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update video name.';
      setError(message);
      onError?.(message);
    } finally {
      setIsSavingVideoName(false);
    }
  }, [onError, processingVideo, videoName]);

  useEffect(() => {
    const nextName = hasMeaningfulVideoDescription
      ? processingVideo?.description?.trim() || ''
      : analysisName;
    const nextVideoId = processingVideo?.id || null;
    const currentDescription = (processingVideo?.description || '').trim();

    if (nextVideoId !== previousProcessingVideoIdRef.current) {
      previousProcessingVideoIdRef.current = nextVideoId;
      previousVideoDescriptionRef.current = currentDescription;
      setVideoName(nextName);
      return;
    }

    if (videoName.trim() === previousVideoDescriptionRef.current) {
      previousVideoDescriptionRef.current = currentDescription;
      setVideoName(nextName);
      return;
    }

    previousVideoDescriptionRef.current = currentDescription;
  }, [analysisName, hasMeaningfulVideoDescription, processingVideo?.description, processingVideo?.id, videoName]);

  useEffect(() => {
    if (!processingVideo?.id) return;

    const trimmedName = videoName.trim();
    const currentDescription = (processingVideo.description || '').trim();

    if (!trimmedName || trimmedName === currentDescription) {
      if (videoNameAutoSaveTimerRef.current) {
        window.clearTimeout(videoNameAutoSaveTimerRef.current);
        videoNameAutoSaveTimerRef.current = null;
      }
      return;
    }

    if (videoNameAutoSaveTimerRef.current) {
      window.clearTimeout(videoNameAutoSaveTimerRef.current);
    }

    videoNameAutoSaveTimerRef.current = window.setTimeout(() => {
      void handleSaveVideoName(trimmedName);
    }, 700);

    return () => {
      if (videoNameAutoSaveTimerRef.current) {
        window.clearTimeout(videoNameAutoSaveTimerRef.current);
        videoNameAutoSaveTimerRef.current = null;
      }
    };
  }, [handleSaveVideoName, processingVideo?.description, processingVideo?.id, videoName]);

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
            className={`assets-modal-panel assets-video-import-panel relative mx-auto flex w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl ${isProcessingStep ? 'max-h-[86vh] max-w-5xl' : 'max-h-[90vh] max-w-[calc(100vw-2rem)] xl:max-w-[1180px]'}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="assets-modal-icon flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-sm">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Import Videos</h3>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Import from a link or local file. Videos are saved to your library.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="assets-modal-close w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {step === 'choose' && (
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStep('link')}
                    className="assets-video-import-option group flex aspect-[4/3] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-black hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white">
                      <Link className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="assets-video-import-option-title text-xl font-semibold tracking-tight text-gray-900">Paste Link</h4>
                        <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                          Social URL
                        </span>
                      </div>
                      <p className="assets-video-import-option-copy max-w-[26ch] text-sm leading-6 text-gray-600">
                        Paste a TikTok, Instagram, YouTube, or Facebook video link and import it directly.
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('upload')}
                    className="assets-video-import-option group flex aspect-[4/3] flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-black hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-900 transition-colors group-hover:border-black group-hover:bg-black group-hover:text-white">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="assets-video-import-option-title text-xl font-semibold tracking-tight text-gray-900">Upload File</h4>
                        <span className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">
                          MP4 / MOV
                        </span>
                      </div>
                      <p className="assets-video-import-option-copy max-w-[26ch] text-sm leading-6 text-gray-600">
                        Upload a local video file and run the same import and analysis flow in one step.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {(step === 'link' || step === 'upload') && (
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                <button
                  type="button"
                  onClick={handleBackToChoose}
                  className="assets-video-import-back inline-flex items-center gap-2 rounded-full text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK</span>
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-6">
                  <div className="assets-video-import-help rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div className="assets-video-import-help-title flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <Info className="w-4 h-4" />
                      {step === 'link' ? 'How to get the video link' : 'How to prepare the file'}
                    </div>
                    <ol className="assets-video-import-help-list space-y-2 text-sm text-gray-600">
                      {step === 'link' ? (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">1.</span>
                            Open the video on TikTok, Instagram, YouTube, or Facebook.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">2.</span>
                            Tap the Share button and choose Copy Link.
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">3.</span>
                            Paste the link here and click Import & Analyze.
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2">
                            <span className="assets-video-import-help-index font-semibold text-gray-900">1.</span>
                            Download the video to your device.
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
                        <label className="assets-modal-label block text-sm font-medium text-gray-700">Video Link</label>
                        <div className="flex flex-col gap-3">
                          <div className="relative">
                            <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={linkUrl}
                              onChange={(event) => setLinkUrl(event.target.value)}
                              placeholder="https://www.tiktok.com/... or instagram.com/... or youtube.com/..."
                              className="assets-modal-input w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                            />
                          </div>
                          <button
                            type="button"
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
                          <label className="assets-modal-upload flex min-h-[320px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 px-6 text-sm text-gray-500 transition-colors hover:border-gray-400 sm:min-h-[360px] lg:min-h-[420px] cursor-pointer">
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
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                <button
                  type="button"
                  onClick={handleBackToChoose}
                  className="assets-video-import-back inline-flex items-center gap-2 rounded-full text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK</span>
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
                      type="button"
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
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-6 space-y-6">
                <button
                  type="button"
                  onClick={() => setStep('creator')}
                  className="assets-video-import-back inline-flex items-center gap-2 rounded-full text-sm text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK</span>
                </button>

                <div className="flex items-center justify-between">
                  <p className="assets-video-import-meta text-sm text-gray-600">
                    Select videos to import ({selectedVideos.length} selected)
                  </p>
                  <button
                    type="button"
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
                        type="button"
                        key={video.platform_video_id}
                        onClick={() => toggleSelected(video.platform_video_id)}
                        className={`assets-video-import-tile group text-left border rounded-lg overflow-hidden transition-colors ${selectedVideoIds.has(video.platform_video_id) ? 'border-black ring-1 ring-black' : 'border-gray-200 hover:border-gray-400'}`}
                      >
                        <div className="assets-video-import-thumb relative aspect-[9/16] bg-gray-100">
                          {video.cover_url ? (
                            <Image
                              src={video.cover_url}
                              alt={video.description || 'TikTok preview'}
                              fill
                              sizes="(min-width: 1024px) 20vw, (min-width: 768px) 33vw, 50vw"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-300">
                              <Upload className="w-5 h-5" />
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
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-6">
                <div className="grid min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-[max-content_minmax(0,1fr)] lg:items-end">
                  <div className="min-h-0 min-w-0 overflow-hidden flex items-end justify-center">
                    <div className="min-h-0 flex items-stretch justify-center">
                      <div
                        className={`bg-black/95 ${previewCardClassName}`}
                        style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                      >
                        {processingVideo?.video_cdn_url ? (
                          <VideoPlayer
                            src={processingVideo.video_cdn_url}
                            className="h-full w-full object-contain"
                            showControls
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_48%)] px-8 text-center text-gray-300">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                              <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-base font-medium text-white/90">Preparing video preview</p>
                              <p className="text-sm leading-6 text-gray-400">The uploaded video will appear here as soon as it finishes processing.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className="min-h-0 flex flex-col gap-4 self-end"
                    style={{ height: `${previewHeight}px` }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          Video Name
                        </p>
                        <span className="text-xs text-gray-400">
                          {videoName.trim().length}/120
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="import-video-name"
                          type="text"
                          value={videoName}
                          onChange={(event) => setVideoName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && canSaveVideoName) {
                              event.preventDefault();
                              void handleSaveVideoName();
                            }
                          }}
                          onBlur={() => {
                            if (canSaveVideoName) {
                              void handleSaveVideoName();
                            }
                          }}
                          maxLength={120}
                          placeholder="AI is generating a title..."
                          className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-black"
                          disabled={!processingVideo?.id}
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveVideoName()}
                          disabled={!canSaveVideoName}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-black bg-black px-3 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {isSavingVideoName ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Overview
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                          <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                          {isAnalysisPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-label="Loading duration" />
                          ) : (
                            <span className="font-medium text-gray-800">
                              {processingDisplayDurationSeconds ? `${processingDisplayDurationSeconds}s` : '—'}
                            </span>
                          )}
                        </div>
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                          <Languages className="h-4 w-4 shrink-0 text-gray-400" />
                          {isAnalysisPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-label="Loading language" />
                          ) : (
                            <span className="font-medium text-gray-800">{processingVideo?.analysis_language || '—'}</span>
                          )}
                        </div>
                        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                          <Film className="h-4 w-4 shrink-0 text-gray-400" />
                          {isAnalysisPending ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" aria-label="Loading shot count" />
                          ) : (
                            <span className="font-medium text-gray-800">{processingShotCount || '—'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Structure Analysis
                      </p>
                      {processingVideo?.analysis_status === 'failed' ? (
                        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 px-6 py-8 text-center">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-sm">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <h4 className="mt-4 text-base font-semibold text-gray-900">System issue</h4>
                          <p className="mt-2 max-w-[260px] text-sm leading-6 text-gray-500">
                            Analysis could not finish. Please retry.
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleRetryAnalysis()}
                            disabled={isRetryingAnalysis}
                            className="mt-5 inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-black bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRetryingAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            {isRetryingAnalysis ? 'Retrying...' : 'Retry'}
                          </button>
                        </div>
                      ) : processingVideo?.analysis_result ? (
                        <div className="min-h-0 flex-1">
                          <div className="h-full overflow-y-auto pr-1">
                            <ReferenceVideoShotsEditor
                              shots={processingShots}
                              onShotsChange={() => {}}
                              showSummary={false}
                              readOnly
                              hideHeader
                              expandedMaxHeightClass="max-h-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="min-h-0 flex-1 rounded-lg border border-dashed border-gray-200 p-4">
                          <GlassWavePanel className="h-full rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,#FCFCFC,#F4F4F4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                            <div className="flex h-full flex-col justify-center gap-3 px-4 py-4">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="rounded-xl border border-white/80 bg-white/90 px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full border border-gray-200 bg-gray-100" />
                                    <GlassLoadingBar className="h-3.5 w-24" />
                                  </div>
                                  <GlassLoadingBar className="mt-3 h-3.5 w-full" />
                                  <GlassLoadingBar className="mt-2 h-3.5 w-4/5" />
                                </div>
                              ))}
                            </div>
                          </GlassWavePanel>
                        </div>
                      )}
                    </div>

                    {canContinueInAgentFeatures ? (
                      <div className="mt-auto pt-2">
                        <button
                          type="button"
                          onClick={onContinueInAgentFeatures}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-black bg-black px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-900"
                        >
                          Continue in Agent
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}

                  </div>
                </div>
              </div>
            )}

            {step === 'processing-batch' && (
              <div className="assets-modal-body min-h-0 flex-1 overflow-y-auto p-10 flex flex-col items-center justify-center text-center gap-4">
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
