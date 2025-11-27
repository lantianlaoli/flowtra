'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { X, Image as ImageIcon, Video as VideoIcon, Loader2 } from 'lucide-react';
import type { SegmentPrompt } from '@/lib/standard-ads-workflow';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { LanguageCode } from '@/components/ui/LanguageSelector';

type EditableVideoPrompt = {
  action: string;
  subject: string;
  style: string;
  dialogue: string;
  audio: string;
  composition: string;
  context_environment: string;
  camera_motion_positioning: string;
  ambiance_colour_lighting: string;
  language: LanguageCode;
};

const VIDEO_TEXT_FIELDS: Array<{ key: Exclude<keyof EditableVideoPrompt, 'language'>; label: string; placeholder: string; required?: boolean }> = [
  { key: 'action', label: 'Action', placeholder: 'Describe what happens in this shot', required: true },
  { key: 'subject', label: 'Subject', placeholder: 'Who/what is featured?', required: true },
  { key: 'style', label: 'Style', placeholder: 'Cinematic, vlog, documentary, etc.' },
  { key: 'dialogue', label: 'Dialogue / VO', placeholder: 'Exact line or narration tone' },
  { key: 'audio', label: 'Audio / Music', placeholder: 'Music vibe or sound design' },
  { key: 'composition', label: 'Composition', placeholder: 'Camera framing guidance' },
  { key: 'context_environment', label: 'Environment', placeholder: 'Location, props, background' },
  { key: 'camera_motion_positioning', label: 'Camera Motion', placeholder: 'Dolly, handheld, static…' },
  { key: 'ambiance_colour_lighting', label: 'Lighting', placeholder: 'Mood, colors, lighting cues' }
];

const LANGUAGE_OPTIONS: Array<{ value: LanguageCode; label: string; native: string }> = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'zh', label: 'Chinese', native: '中文' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'fr', label: 'French', native: 'Français' },
  { value: 'de', label: 'German', native: 'Deutsch' },
  { value: 'it', label: 'Italian', native: 'Italiano' },
  { value: 'pt', label: 'Portuguese', native: 'Português' },
  { value: 'nl', label: 'Dutch', native: 'Nederlands' },
  { value: 'sv', label: 'Swedish', native: 'Svenska' },
  { value: 'no', label: 'Norwegian', native: 'Norsk' },
  { value: 'da', label: 'Danish', native: 'Dansk' },
  { value: 'fi', label: 'Finnish', native: 'Suomi' },
  { value: 'pl', label: 'Polish', native: 'Polski' },
  { value: 'ru', label: 'Russian', native: 'Русский' },
  { value: 'el', label: 'Greek', native: 'Ελληνικά' },
  { value: 'tr', label: 'Turkish', native: 'Türkçe' },
  { value: 'cs', label: 'Czech', native: 'Čeština' },
  { value: 'ro', label: 'Romanian', native: 'Română' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
  { value: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' }
];

const DEFAULT_LANGUAGE: LanguageCode = 'en';

type SegmentInspectorProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  segmentIndex: number;
  segment?: SegmentCardSummary | null;
  segmentPlanEntry?: SegmentPrompt;
  videoModel?: string;
  videoDuration?: string | null;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  onRegenerate?: (options: {
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
  }) => Promise<void> | void;
  isSubmitting?: { photo: boolean; video: boolean };
};

export type SegmentPromptPayload = {
  first_frame_description: string;
  video: EditableVideoPrompt;
};

export default function SegmentInspector({
  open,
  onClose,
  projectId,
  segmentIndex,
  segment,
  segmentPlanEntry,
  videoModel,
  videoDuration,
  videoAspectRatio,
  onRegenerate,
  isSubmitting,
}: SegmentInspectorProps) {
  const PHOTO_CHAR_LIMIT = 5000;
  const normalizedPrompt = useMemo(() => {
    const current = (segment?.prompt || {}) as Partial<SegmentPrompt>;
    return {
      ...segmentPlanEntry,
      ...current
    };
  }, [segment?.prompt, segmentPlanEntry]);

  const initialPhotoPrompt = normalizedPrompt.first_frame_description || '';
  const initialVideoPrompt = useMemo(
    () => createEditableVideoPrompt(normalizedPrompt),
    [normalizedPrompt]
  );

  const [photoPrompt, setPhotoPrompt] = useState(initialPhotoPrompt);
  const [videoPrompt, setVideoPrompt] = useState<EditableVideoPrompt>(initialVideoPrompt);
  const [photoFocused, setPhotoFocused] = useState(false);
  const [videoFocusedField, setVideoFocusedField] = useState<keyof EditableVideoPrompt | null>(null);
  const [photoPreviewPending, setPhotoPreviewPending] = useState(false);
  const [videoPreviewPending, setVideoPreviewPending] = useState(false);
  const firstFrameUrl = segment?.firstFrameUrl || null;
  const videoUrl = segment?.videoUrl || null;
  const lastFirstFrameUrlRef = useRef<string | null>(firstFrameUrl);
  const lastVideoUrlRef = useRef<string | null>(videoUrl);
  const promptSeedSignature = useMemo(() => JSON.stringify({
    photo: initialPhotoPrompt?.trim() || '',
    video: initialVideoPrompt
  }), [initialPhotoPrompt, initialVideoPrompt]);
  const promptSeedRef = useRef(promptSeedSignature);

  useEffect(() => {
    if (promptSeedRef.current === promptSeedSignature) {
      return;
    }
    promptSeedRef.current = promptSeedSignature;
    setPhotoPrompt(initialPhotoPrompt);
    setVideoPrompt(initialVideoPrompt);
  }, [initialPhotoPrompt, initialVideoPrompt, promptSeedSignature]);

  const photoChanged = photoPrompt.trim() !== initialPhotoPrompt.trim();
  const videoChanged = !areVideoPromptsEqual(videoPrompt, initialVideoPrompt);
  const regenEnabled = Boolean(onRegenerate);
  const photoPromptTooLong = photoPrompt.length > PHOTO_CHAR_LIMIT;
  const missingLanguage = !videoPrompt.language?.trim();
  const requiredVideoFieldsMissing =
    VIDEO_TEXT_FIELDS.some(field => field.required && !videoPrompt[field.key].trim()) || missingLanguage;
  const previewAspectClass = getAspectRatioClass(videoAspectRatio);
  const isPortraitPreview = videoAspectRatio === '9:16';
  const previewLayoutClass = isPortraitPreview
    ? 'flex flex-col gap-4 lg:flex-row lg:items-start'
    : 'space-y-4';
  const previewCardClass = isPortraitPreview ? 'w-full lg:flex-none lg:w-[360px]' : '';
  const previewMediaClass = (isDashed?: boolean) =>
    clsx(
      'relative rounded-2xl border bg-gray-50 overflow-hidden flex items-center justify-center',
      previewAspectClass,
      isDashed ? 'border-dashed border-gray-200' : 'border border-gray-100',
      isPortraitPreview ? 'w-full max-w-[320px] mx-auto lg:mx-0' : ''
    );
  const normalizedStatus = (segment?.status || '').toLowerCase();
  const isGeneratingFirstFrame = normalizedStatus === 'generating_first_frame';
  const isGeneratingVideo = normalizedStatus === 'generating_video';
  const showPhotoSkeleton = photoPreviewPending || isGeneratingFirstFrame;
  const showVideoSkeleton = videoPreviewPending || isGeneratingVideo;
  const submittingPhoto = isSubmitting?.photo ?? false;
  const submittingVideo = isSubmitting?.video ?? false;

  useEffect(() => {
    if (firstFrameUrl && firstFrameUrl !== lastFirstFrameUrlRef.current) {
      lastFirstFrameUrlRef.current = firstFrameUrl;
      setPhotoPreviewPending(false);
    } else if (!firstFrameUrl) {
      lastFirstFrameUrlRef.current = null;
    }
  }, [firstFrameUrl]);

  useEffect(() => {
    if (videoUrl && videoUrl !== lastVideoUrlRef.current) {
      lastVideoUrlRef.current = videoUrl;
      setVideoPreviewPending(false);
    } else if (!videoUrl) {
      lastVideoUrlRef.current = null;
    }
  }, [videoUrl]);

  if (!open) return null;

  const handleRegenerate = (type: 'photo' | 'video') => {
    if (!onRegenerate) return;
    const payload: SegmentPromptPayload = {
      first_frame_description: photoPrompt,
      video: videoPrompt
    };
    if (type === 'photo') {
      setPhotoPreviewPending(true);
    } else {
      setVideoPreviewPending(true);
    }
    const maybePromise = onRegenerate({ type, prompt: payload });
    if (
      type === 'photo' &&
      maybePromise &&
      typeof (maybePromise as Promise<unknown>).catch === 'function'
    ) {
      (maybePromise as Promise<unknown>).catch(() => setPhotoPreviewPending(false));
    } else if (
      type === 'video' &&
      maybePromise &&
      typeof (maybePromise as Promise<unknown>).catch === 'function'
    ) {
      (maybePromise as Promise<unknown>).catch(() => setVideoPreviewPending(false));
    }
  };

  const handleClose = () => {
    if ((photoChanged || videoChanged) && !window.confirm('Discard unsaved edits?')) {
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-7xl p-6 lg:p-8 space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Project {projectId} · Segment {segmentIndex + 1}
            </p>
            <h2 className="text-2xl font-semibold text-gray-900">
              {getSegmentTitle(normalizedPrompt, segmentIndex)}
            </h2>
            <p className="text-sm text-gray-500">
              {segment?.status ? `Current status: ${formatSegmentStatus(segment.status)}` : 'Status pending'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {videoModel && (
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                Model: {videoModel.toUpperCase()}
              </span>
            )}
            {videoDuration && (
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-700">
                Duration: {videoDuration}s
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-1.5" />
              Close
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_minmax(0,1.25fr)]">
          <section className={previewLayoutClass}>
            <div className={clsx('rounded-3xl border border-gray-200 p-4', previewCardClass)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  First frame
                </div>
              </div>
              <div className={previewMediaClass()}>
                {showPhotoSkeleton ? (
                  <div className="w-full h-full animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    <span className="mt-2">Rendering first frame…</span>
                  </div>
                ) : segment?.firstFrameUrl ? (
                  <img
                    src={segment.firstFrameUrl}
                    alt="Segment still"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    First frame not generated yet.
                  </div>
                )}
              </div>
            </div>

            <div className={clsx('rounded-3xl border border-gray-200 p-4', previewCardClass)}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <VideoIcon className="w-4 h-4 text-gray-500" />
                  Video clip
                </div>
              </div>
              <div className={previewMediaClass(true)}>
                {showVideoSkeleton ? (
                  <div className="w-full h-full animate-pulse bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 flex flex-col items-center justify-center text-gray-500 text-sm">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
                    <span className="mt-2">Rendering clip…</span>
                  </div>
                ) : segment?.videoUrl ? (
                  <video
                    src={segment.videoUrl}
                    controls
                    className="w-full h-full object-contain bg-black rounded-2xl"
                  />
                ) : (
                  <div className="text-center text-sm text-gray-500">
                    Video not generated yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-3xl border border-gray-200 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Photo prompt</p>
                <p className="text-xs text-gray-500">Used for first-frame regeneration.</p>
              </div>
              <textarea
                value={photoPrompt}
                onChange={e => setPhotoPrompt(e.target.value)}
                onFocus={() => setPhotoFocused(true)}
                onBlur={() => setPhotoFocused(false)}
                rows={6}
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${photoPromptTooLong ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-gray-900 focus:border-gray-900'}`}
                placeholder="Describe the exact frame you want..."
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className={photoPromptTooLong ? 'text-red-600' : undefined}>
                  {photoPrompt.length}/{PHOTO_CHAR_LIMIT} characters
                </span>
                {photoFocused && photoChanged && !photoPromptTooLong && <span className="text-indigo-600">Unsaved edits</span>}
              </div>
              {photoPromptTooLong && (
                <p className="text-xs text-red-600">Photo prompt exceeds {PHOTO_CHAR_LIMIT} characters.</p>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Video prompt</p>
                <p className="text-xs text-gray-500">Controls the segment narration + visuals.</p>
              </div>
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {VIDEO_TEXT_FIELDS.map(field => (
                  <label key={field.key} className="block">
                    <span className="text-xs font-semibold text-gray-700">{field.label}</span>
                    <textarea
                      rows={field.key === 'dialogue' ? 2 : 1}
                      value={videoPrompt[field.key]}
                      onChange={e =>
                        setVideoPrompt(prev => ({
                          ...prev,
                          [field.key]: e.target.value
                        }))
                      }
                      onFocus={() => setVideoFocusedField(field.key)}
                      onBlur={() => setVideoFocusedField(current => (current === field.key ? null : current))}
                      placeholder={field.placeholder}
                      className={`mt-1 w-full rounded-2xl border px-3 py-2 text-sm text-gray-900 focus:outline-none transition-colors ${field.required && !videoPrompt[field.key].trim() ? 'border-red-500 focus:border-red-500' : 'border-gray-200 focus:border-gray-900'}`}
                    />
                    {videoFocusedField === field.key && videoPrompt[field.key].trim() !==
                      initialVideoPrompt[field.key].trim() && (
                      <span className="text-[11px] text-indigo-600">Edited</span>
                    )}
                    {field.required && !videoPrompt[field.key].trim() && (
                      <span className="text-[11px] text-red-600">This field is required.</span>
                    )}
                  </label>
                ))}
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Language</span>
                  <select
                    value={videoPrompt.language}
                    onChange={e =>
                      setVideoPrompt(prev => ({
                        ...prev,
                        language: normalizeLanguageCode(e.target.value)
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 border-gray-200 focus:ring-gray-900 focus:border-gray-900 bg-white"
                  >
                    {LANGUAGE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label} · {option.native}
                      </option>
                    ))}
                  </select>
                  {videoPrompt.language !== initialVideoPrompt.language && (
                    <span className="text-[11px] text-indigo-600">Edited</span>
                  )}
                </label>
              </div>
            </div>

              <div className="rounded-3xl border border-gray-200 p-4 space-y-3">
                <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!regenEnabled || !photoChanged || submittingPhoto || photoPromptTooLong}
                  onClick={() => handleRegenerate('photo')}
                >
                  {submittingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Regenerate First Frame
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 py-2.5 text-sm font-semibold text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!regenEnabled || !videoChanged || submittingVideo || requiredVideoFieldsMissing}
                  onClick={() => handleRegenerate('video')}
                >
                  {submittingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Regenerate Video
                </button>
                {!regenEnabled && (
                  <p className="text-xs text-gray-500 text-center">
                    Backend endpoint not wired yet. Edits will stay local until regeneration is enabled.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function createEditableVideoPrompt(prompt?: Partial<SegmentPrompt>): EditableVideoPrompt {
  return {
    action: prompt?.action || '',
    subject: prompt?.subject || '',
    style: prompt?.style || '',
    dialogue: prompt?.dialogue || '',
    audio: prompt?.audio || '',
    composition: prompt?.composition || '',
    context_environment: prompt?.context_environment || '',
    camera_motion_positioning: prompt?.camera_motion_positioning || '',
    ambiance_colour_lighting: prompt?.ambiance_colour_lighting || '',
    language: normalizeLanguageCode(prompt?.language)
  };
}

function areVideoPromptsEqual(a: EditableVideoPrompt, b: EditableVideoPrompt) {
  return Object.keys(a).every(key => a[key as keyof EditableVideoPrompt].trim() === b[key as keyof EditableVideoPrompt].trim());
}

function normalizeLanguageCode(value?: string): LanguageCode {
  if (!value) return DEFAULT_LANGUAGE;
  const lower = value.toLowerCase() as LanguageCode;
  return (LANGUAGE_OPTIONS.find(option => option.value === lower)?.value) || DEFAULT_LANGUAGE;
}

function getAspectRatioClass(ratio?: string | null) {
  switch (ratio) {
    case '9:16':
      return 'aspect-[9/16]';
    case '1:1':
      return 'aspect-square';
    case '16:9':
    default:
      return 'aspect-[16/9]';
  }
}

function getSegmentTitle(prompt: Partial<SegmentPrompt>, index: number) {
  const promptWithMeta = prompt as Partial<SegmentPrompt> & {
    segment_title?: string;
    segment_goal?: string;
  };
  if (promptWithMeta.segment_title) return promptWithMeta.segment_title;
  if (promptWithMeta.segment_goal) return promptWithMeta.segment_goal;
  return `Segment ${index + 1}`;
}

function formatSegmentStatus(status: string) {
  switch ((status || '').toLowerCase()) {
    case 'pending_first_frame':
      return 'Waiting for first frame';
    case 'generating_first_frame':
      return 'Generating first frame';
    case 'first_frame_ready':
      return 'First frame ready';
    case 'generating_video':
      return 'Generating video';
    case 'video_ready':
      return 'Video ready';
    case 'failed':
      return 'Needs attention';
    default:
      return status || 'Unknown';
  }
}
