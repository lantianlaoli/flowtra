'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { X, Image as ImageIcon, Video as VideoIcon, Loader2, ChevronDown, Plus, Trash2, Link2, User, Clapperboard, Palette, Volume2, Waves, MessageSquare, Camera, Move, Sun, Sparkles } from 'lucide-react';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { LanguageCode } from '@/components/ui/LanguageSelector';
import type { UserAvatar } from '@/lib/supabase';
import type { SystemAvatar } from '@/lib/default-avatars';
import { MODEL_PROCESSING_TIMES, type VideoModel } from '@/lib/constants';
import { getSegmentPromptVideoGenerationCost } from '@/lib/competitor-ugc-segment-billing';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import { estimateKlingPromptUsage, KLING_PROMPT_MAX_CHARS } from '@/lib/kling-prompt-budget';
import SegmentTimelineRuler from '@/components/competitor-ugc-replication/SegmentTimelineRuler';
import { MENTION_TOKEN_REGEX, parseMentionToken } from '@/lib/prompt-mention-tokens';

export type SegmentShotPayload = {
  id: number;
  time_range: string;
  audio: string;
  sfx: string;
  ambient: string;
  style: string;
  action: string;
  subject: string;
  dialogue: string;
  language: LanguageCode;
  composition: string;
  context_environment: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
};

function getEstimatedTime(videoModel?: string): string {
  if (!videoModel) return '';
  const model = videoModel as VideoModel;
  const timeRange = MODEL_PROCESSING_TIMES[model];
  return timeRange ? ` (~${timeRange})` : '';
}

const LANGUAGE_OPTIONS: Array<{ value: LanguageCode; label: string; native: string }> = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'zh', label: 'Chinese', native: '中文' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'fr', label: 'French', native: 'Français' },
  { value: 'de', label: 'German', native: 'Deutsch' },
  { value: 'it', label: 'Italian', native: 'Italiano' },
  { value: 'id', label: 'Indonesian', native: 'Bahasa Indonesia' },
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
const PRODUCT_FETCH_MAX_ATTEMPTS = 3;
type AvatarOption = UserAvatar | SystemAvatar;

const normalizeShotLanguage = (value?: string): LanguageCode => {
  if (!value) return DEFAULT_LANGUAGE;
  const match = LANGUAGE_OPTIONS.find(option => option.value === value);
  return match ? match.value : DEFAULT_LANGUAGE;
};

const createEmptyShotPayload = (id: number, language: LanguageCode): SegmentShotPayload => ({
  id,
  time_range: '00:00 - 00:02',
  audio: '',
  sfx: '',
  ambient: '',
  style: '',
  action: '',
  subject: '',
  dialogue: '',
  language,
  composition: '',
  context_environment: '',
  ambiance_colour_lighting: '',
  camera_motion_positioning: ''
});

const parseLegacyAudioField = (value?: string) => {
  const source = (value || '').trim();
  if (!source) {
    return { sfx: '', ambient: '' };
  }

  const sfxMatch = source.match(/SFX:\s*([^|]+)/i);
  const ambientMatch = source.match(/Ambient:\s*([^|]+)/i);
  if (sfxMatch || ambientMatch) {
    return {
      sfx: (sfxMatch?.[1] || '').trim(),
      ambient: (ambientMatch?.[1] || '').trim(),
    };
  }

  return { sfx: '', ambient: source };
};

const buildLegacyAudioField = (shot: Pick<SegmentShotPayload, 'sfx' | 'ambient'>) => {
  const parts = [
    shot.sfx.trim() ? `SFX: ${shot.sfx.trim()}` : '',
    shot.ambient.trim() ? `Ambient: ${shot.ambient.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
};

const buildShotPayloadForPersistence = (shot: SegmentShotPayload, index: number) => ({
  id: index + 1,
  time_range: shot.time_range.trim(),
  audio: buildLegacyAudioField(shot).trim(),
  sfx: shot.sfx.trim(),
  ambient: shot.ambient.trim(),
  style: shot.style.trim(),
  action: shot.action.trim(),
  subject: shot.subject.trim(),
  dialogue: shot.dialogue.trim(),
  language: shot.language,
  composition: shot.composition.trim(),
  context_environment: shot.context_environment.trim(),
  ambiance_colour_lighting: shot.ambiance_colour_lighting.trim(),
  camera_motion_positioning: shot.camera_motion_positioning.trim()
});

const convertShotsForEditor = (shots: SegmentPrompt['shots'], fallbackLanguage: LanguageCode): SegmentShotPayload[] => {
  if (Array.isArray(shots) && shots.length > 0) {
    return shots.map((shot, index) => {
      const parsedAudio = parseLegacyAudioField(shot.audio || '');
      const sfx = (shot.sfx || '').trim() || parsedAudio.sfx;
      const ambient = (shot.ambient || '').trim() || parsedAudio.ambient;
      return ({
      id: shot.id || index + 1,
      time_range: shot.time_range || '00:00 - 00:02',
      audio: buildLegacyAudioField({ sfx, ambient }),
      sfx,
      ambient,
      style: shot.style || '',
      action: shot.action || '',
      subject: shot.subject || '',
      dialogue: shot.dialogue || '',
      language: normalizeShotLanguage(shot.language),
      composition: shot.composition || '',
      context_environment: shot.context_environment || '',
      ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
      camera_motion_positioning: shot.camera_motion_positioning || ''
    });
    });
  }
  return [createEmptyShotPayload(1, fallbackLanguage)];
};

type ProductOption = {
  id: string;
  product_name: string;
  user_product_photos?: Array<{ photo_url: string; is_primary?: boolean }>;
};

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
  selectedLanguage?: LanguageCode;
  onRegenerate?: (options: {
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  isSubmitting?: { photo: boolean; video: boolean };
};

export type SegmentPromptPayload = {
  first_frame_description: string;
  shots: SegmentShotPayload[];
  is_continuation_from_prev: boolean;
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
  selectedLanguage,
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

  const activeLanguage = selectedLanguage || normalizeShotLanguage(normalizedPrompt.language || DEFAULT_LANGUAGE);
  const initialPhotoPrompt = normalizedPrompt.first_frame_description || '';
  const initialShots = useMemo(
    () => convertShotsForEditor(normalizedPrompt.shots, activeLanguage).map((shot) => ({ ...shot, language: activeLanguage })),
    [activeLanguage, normalizedPrompt]
  );

  const [photoPrompt, setPhotoPrompt] = useState(initialPhotoPrompt);
  const [shots, setShots] = useState<SegmentShotPayload[]>(initialShots);
  const [shotExpansion, setShotExpansion] = useState<Record<number, boolean>>({});
  const [isContinuation, setIsContinuation] = useState(Boolean(normalizedPrompt.is_continuation_from_prev));
  const [photoPreviewPending, setPhotoPreviewPending] = useState(false);
  const [videoPreviewPending, setVideoPreviewPending] = useState(false);
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const productCacheRef = useRef<Record<string, { items: ProductOption[]; error?: string }>>({});
  const [characterOptions, setCharacterOptions] = useState<AvatarOption[]>([]);
  const firstFrameUrl = segment?.firstFrameUrl || null;
  const videoUrl = segment?.videoUrl || null;
  const lastFirstFrameUrlRef = useRef<string | null>(firstFrameUrl);
  const lastVideoUrlRef = useRef<string | null>(videoUrl);
  const segmentVideoCost = useMemo(() => {
    const resolvedModel = videoModel as VideoModel | undefined;
    if (!resolvedModel) {
      return 0;
    }

    return getSegmentPromptVideoGenerationCost(resolvedModel, shots);
  }, [shots, videoModel]);
  const promptSeedSignature = useMemo(() => JSON.stringify({
    photo: initialPhotoPrompt?.trim() || '',
    shots: initialShots
  }), [initialPhotoPrompt, initialShots]);
  const promptSeedRef = useRef(promptSeedSignature);

  useEffect(() => {
    if (promptSeedRef.current === promptSeedSignature) {
      return;
    }
    promptSeedRef.current = promptSeedSignature;
    setPhotoPrompt(initialPhotoPrompt);
    setShots(initialShots);
    const continuationDefault = Boolean(normalizedPrompt.is_continuation_from_prev);
    setIsContinuation(continuationDefault);
    setShotExpansion({});
  }, [initialPhotoPrompt, initialShots, promptSeedSignature, normalizedPrompt.is_continuation_from_prev]);

  useEffect(() => {
    setShotExpansion(prev => {
      const next: Record<number, boolean> = {};
      shots.forEach(shot => {
        const existing = Object.prototype.hasOwnProperty.call(prev, shot.id) ? prev[shot.id] : undefined;
        next[shot.id] = typeof existing === 'boolean' ? existing : false;
      });
      return next;
    });
  }, [shots]);

  useEffect(() => {
    setShots((prev) => prev.map((shot) => (
      shot.language === activeLanguage ? shot : { ...shot, language: activeLanguage }
    )));
  }, [activeLanguage]);

  useEffect(() => {
    if (!open) {
      setProductOptions([]);
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const cacheKey = 'all';
    const cached = productCacheRef.current[cacheKey];
    if (cached) {
      setProductOptions(cached.items);
      return () => {
        if (retryTimeout) clearTimeout(retryTimeout);
        if (activeController) activeController.abort();
      };
    }

    const fetchProducts = async (attempt = 1) => {
      if (cancelled) return;
      if (attempt === 1) {
      }

      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch('/api/user-products', { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Failed to load products');
        }
        const data = await response.json();
        if (cancelled) return;

        const items: ProductOption[] = Array.isArray(data?.products) ? data.products : [];
        productCacheRef.current[cacheKey] = { items };
        setProductOptions(items);
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        console.error(`Failed to fetch products (attempt ${attempt}):`, error);
        if (attempt < PRODUCT_FETCH_MAX_ATTEMPTS) {
          const delay = attempt * 1000;
          retryTimeout = setTimeout(() => {
            fetchProducts(attempt + 1);
          }, delay);
        } else {
          const message = 'Unable to load products. Please refresh and try again.';
          productCacheRef.current[cacheKey] = { items: [], error: message };
          setProductOptions([]);
        }
      }
    };

    fetchProducts();

    return () => {
      cancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (activeController) {
        activeController.abort();
      }
    };
  }, [open]);

  // Fetch characters (avatars) when modal opens
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const fetchCharacters = async () => {
      try {
        const response = await fetch('/api/user-avatars');
        if (!response.ok) {
          throw new Error('Failed to load characters');
        }
        const data = await response.json();
        if (cancelled) return;

        const characters: AvatarOption[] = Array.isArray(data?.avatars) ? data.avatars : [];
        setCharacterOptions(characters);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch characters:', error);
        setCharacterOptions([]);
      }
    };

    fetchCharacters();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleAddShot = () => {
    setShots(prev => {
      if (prev.length >= 5) return prev;
      const nextId = prev.length + 1;
      setShotExpansion(expansion => ({
        ...expansion,
        [nextId]: true
      }));
      const fallbackLanguage = prev[0]?.language || DEFAULT_LANGUAGE;
      return [...prev, createEmptyShotPayload(nextId, fallbackLanguage)];
    });
  };

  const handleRemoveShot = (shotId: number) => {
    setShots(prev => {
      if (prev.length <= 1) return prev;
      return prev
        .filter(shot => shot.id !== shotId)
        .map((shot, index) => ({ ...shot, id: index + 1 }));
    });
  };

  const handleShotChange = <K extends keyof SegmentShotPayload>(shotId: number, key: K, value: SegmentShotPayload[K]) => {
    setShots(prev => prev.map(shot => (shot.id === shotId ? { ...shot, [key]: value } : shot)));
  };

  const toggleShotExpansion = (shotId: number) => {
    setShotExpansion(prev => ({
      ...prev,
      [shotId]: !prev[shotId]
    }));
  };

  const regenEnabled = Boolean(onRegenerate);
  const photoPromptTooLong = photoPrompt.length > PHOTO_CHAR_LIMIT;
  const hasPhotoUpdates = true;
  const hasVideoUpdates = true;
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
  const getMentionedIds = (prompt: string) => {
    const productIds = new Set<string>();
    const characterIds = new Set<string>();
    let match: RegExpExecArray | null;
    MENTION_TOKEN_REGEX.lastIndex = 0;
    while ((match = MENTION_TOKEN_REGEX.exec(prompt)) !== null) {
      const parsed = parseMentionToken(match[0]);
      const type = parsed?.type;
      const name = parsed?.label?.trim();
      if (!type || !name) continue;
      if (type === 'product') {
        const product = productOptions.find(item => item.product_name === name);
        if (product) productIds.add(product.id);
      } else if (type === 'character') {
        const character = characterOptions.find(item => item.avatar_name === name);
        if (character) characterIds.add(character.id);
      }
    }
    return { productIds: Array.from(productIds), characterIds: Array.from(characterIds) };
  };
  const getProductPhotoUrl = (product?: ProductOption | null) => {
    if (!product?.user_product_photos?.length) return null;
    const primary = product.user_product_photos.find(photo => photo.is_primary);
    return primary?.photo_url || product.user_product_photos[0]?.photo_url || null;
  };
  const getProductPhotoCount = (product?: ProductOption | null) =>
    Array.isArray(product?.user_product_photos)
      ? product.user_product_photos.filter(photo => Boolean(photo?.photo_url)).length
      : 0;
  const getCharacterPhotoCount = (character?: AvatarOption | null) => {
    if (!character) return 0;
    const referenceCount = Array.isArray(character.reference_photos)
      ? character.reference_photos.filter(photo => Boolean(photo?.photo_url)).length
      : 0;
    return (character.photo_url ? 1 : 0) + referenceCount;
  };
  const enforceKlingElementPhotoCount = videoModel === 'kling_3';
  const klingShotEstimates = useMemo(() => {
    if (videoModel !== 'kling_3') return [];
    return shots.map((shot, index) => estimateKlingPromptUsage({
      shot
    }));
  }, [shots, videoModel]);

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
    const normalizedShots = shots.map((shot, idx) => buildShotPayloadForPersistence(shot, idx));
    const payload: SegmentPromptPayload = {
      first_frame_description: photoPrompt,
      shots: normalizedShots,
      is_continuation_from_prev: isContinuation
    };
    const { productIds, characterIds } = getMentionedIds(photoPrompt);
    if (type === 'photo') {
      setPhotoPreviewPending(true);
    } else {
      setVideoPreviewPending(true);
    }
    const maybePromise = onRegenerate({
      type,
      prompt: payload,
      productIds: type === 'photo' && productIds.length ? productIds : undefined,
      characterIds: type === 'photo' && characterIds.length ? characterIds : undefined
    });
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
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-7xl p-6 lg:p-8 space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
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
                    <span className="mt-2">Rendering first frame… (~1-2 min)</span>
                  </div>
                ) : segment?.firstFrameUrl ? (
                  <NextImage
                    src={segment.firstFrameUrl}
                    alt="Segment still"
                    className="w-full h-full object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
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
                    <span className="mt-2">Rendering clip{getEstimatedTime(videoModel)}…</span>
                  </div>
                ) : segment?.videoUrl ? (
                  <video
                    src={segment.videoUrl}
                    controls
                    controlsList="nodownload"
                    playsInline
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
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gray-900" />
                  <p className="text-sm font-semibold text-gray-900">Image Prompt</p>
                </div>
                <span className="text-xs text-gray-500">Type @ to insert a character or product</span>
              </div>
              <PromptMentionTextarea
                value={photoPrompt}
                onChange={setPhotoPrompt}
                rows={6}
                hasError={photoPromptTooLong}
                placeholder="Describe the exact frame you want..."
                characterMentions={characterOptions.map(character => ({
                  id: character.id,
                  label: character.avatar_name,
                  imageUrl: character.photo_url,
                  photoCount: getCharacterPhotoCount(character)
                }))}
                productMentions={productOptions.map(product => ({
                  id: product.id,
                  label: product.product_name,
                  imageUrl: getProductPhotoUrl(product),
                  photoCount: getProductPhotoCount(product)
                }))}
                enforcePhotoCount={enforceKlingElementPhotoCount}
                minRequiredPhotos={2}
                insufficientPhotosLabel="Need 2 photos"
              />
              {photoPromptTooLong && (
                <p className="text-xs text-red-600">Image prompt exceeds {PHOTO_CHAR_LIMIT} characters.</p>
              )}
              {segmentIndex >= 1 && (
                <button
                  type="button"
                  aria-pressed={isContinuation}
                  onClick={() => setIsContinuation(prev => !prev)}
                  className={clsx(
                    'w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 transition',
                    isContinuation
                      ? 'border-gray-900 bg-gray-50 text-gray-900'
                      : 'border-gray-200 text-gray-600 hover:border-gray-900 hover:text-gray-900'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center rounded-full border w-9 h-9 flex-shrink-0',
                      isContinuation ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300'
                    )}
                  >
                    <Link2 className="w-4 h-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">Link to previous frame</span>
                    <span className="block text-xs text-gray-500">
                      Use the prior segment&apos;s first frame as a reference to keep characters consistent.
                    </span>
                  </span>
                  <span
                    className={clsx(
                      'w-3 h-3 rounded-full border',
                      isContinuation ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                    )}
                  />
                </button>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-gray-900" />
                  <p className="text-sm font-semibold text-gray-900">Shots</p>
                </div>
                <div className="flex items-center gap-2">
                  {shots.length >= 5 && (
                    <span className="text-[11px] text-gray-500">Max 5 shots</span>
                  )}
                  <button
                    type="button"
                    onClick={handleAddShot}
                    disabled={shots.length >= 5}
                    className={clsx(
                      'inline-flex items-center justify-center rounded-full border text-xs font-semibold transition w-9 h-9',
                      shots.length >= 5
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                    )}
                    title="Add shot"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="sr-only">Add shot</span>
                  </button>
                </div>
              </div>
              <SegmentTimelineRuler
                shots={shots}
                onChange={(nextRanges) => {
                  setShots((prev) => prev.map((shot) => {
                    const nextRange = nextRanges.find((item) => item.id === shot.id);
                    return nextRange ? { ...shot, time_range: nextRange.time_range } : shot;
                  }));
                }}
              />
              <div className="space-y-3">
                {shots.map((shot, index) => {
                  const klingEstimate = klingShotEstimates[index];
                  const likelyOverKlingLimit = Boolean(klingEstimate && klingEstimate.originalLength > KLING_PROMPT_MAX_CHARS);
                  const expanded = shotExpansion[shot.id] ?? false;
                  const summaryText = shot.subject?.trim() || shot.action?.trim() || shot.dialogue?.trim() || 'Add more shot detail.';
                  const toggleCard = () => toggleShotExpansion(shot.id);
                  return (
                    <div key={shot.id} className="rounded-2xl border border-gray-200 p-3 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className="flex-1 cursor-pointer select-none"
                          role="button"
                          tabIndex={0}
                          onClick={toggleCard}
                          onKeyDown={event => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleCard();
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">Shot {shot.id}</div>
                            <span className="text-[11px] font-medium text-gray-500">{shot.time_range || '00:00 - 00:02'}</span>
                          </div>
                          {klingEstimate && (
                            <p className={clsx(
                              'mt-1 text-[11px]',
                              likelyOverKlingLimit ? 'text-amber-600' : 'text-gray-500'
                            )}>
                              Estimated prompt: {klingEstimate.originalLength}/{KLING_PROMPT_MAX_CHARS} characters
                            </p>
                          )}
                          {!expanded && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{summaryText}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-shot-control="true"
                            onClick={() => handleRemoveShot(shot.id)}
                            disabled={shots.length <= 1}
                            className={clsx(
                              'inline-flex items-center justify-center rounded-full border w-8 h-8',
                              shots.length <= 1
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-red-200 text-red-500 hover:bg-red-50'
                            )}
                            title="Remove shot"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="sr-only">Remove shot</span>
                          </button>
                          <button
                            type="button"
                            data-shot-control="true"
                            onClick={() => toggleShotExpansion(shot.id)}
                            className="inline-flex items-center justify-center rounded-full border border-gray-200 p-1 text-gray-600 hover:bg-gray-50"
                          >
                            <ChevronDown className={clsx('w-4 h-4 transition-transform', expanded ? 'rotate-180' : '')} />
                            <span className="sr-only">Toggle shot</span>
                          </button>
                        </div>
                      </div>
                      <div
                        className={clsx(
                          'overflow-hidden transition-all duration-300 ease-in-out space-y-3', // Added space-y-3 for consistent spacing
                          expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                        )}
                      >
                          {likelyOverKlingLimit && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                              This shot is likely over Kling&apos;s 500-character limit and will be shortened during generation.
                            </div>
                          )}
                          <div className="space-y-4 pt-1">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Core Prompt Elements</span>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <User className="w-3.5 h-3.5" />
                                    <span>Subject</span>
                                  </div>
                                  <PromptMentionTextarea
                                    value={shot.subject}
                                    onChange={(value) => handleShotChange(shot.id, 'subject', value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-gray-200 focus:ring-0 focus:ring-offset-0 min-h-[72px]"
                                    characterMentions={characterOptions.map(character => ({
                                      id: character.id,
                                      label: character.avatar_name,
                                      imageUrl: character.photo_url,
                                      photoCount: getCharacterPhotoCount(character)
                                    }))}
                                    productMentions={productOptions.map(product => ({
                                      id: product.id,
                                      label: product.product_name,
                                      imageUrl: getProductPhotoUrl(product),
                                      photoCount: getProductPhotoCount(product)
                                    }))}
                                    enforcePhotoCount={enforceKlingElementPhotoCount}
                                    minRequiredPhotos={2}
                                    insufficientPhotosLabel="Need 2 photos"
                                  />
                                </div>

                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <Clapperboard className="w-3.5 h-3.5" />
                                    <span>Action</span>
                                  </div>
                                  <PromptMentionTextarea
                                    value={shot.action}
                                    onChange={(value) => handleShotChange(shot.id, 'action', value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-gray-200 focus:ring-0 focus:ring-offset-0 min-h-[72px]"
                                    characterMentions={characterOptions.map(character => ({
                                      id: character.id,
                                      label: character.avatar_name,
                                      imageUrl: character.photo_url,
                                      photoCount: getCharacterPhotoCount(character)
                                    }))}
                                    productMentions={productOptions.map(product => ({
                                      id: product.id,
                                      label: product.product_name,
                                      imageUrl: getProductPhotoUrl(product),
                                      photoCount: getProductPhotoCount(product)
                                    }))}
                                    enforcePhotoCount={enforceKlingElementPhotoCount}
                                    minRequiredPhotos={2}
                                    insufficientPhotosLabel="Need 2 photos"
                                  />
                                </div>

                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <Palette className="w-3.5 h-3.5" />
                                    <span>Style</span>
                                  </div>
                                  <textarea
                                    value={shot.style}
                                    rows={1}
                                    onFocus={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.height = '';
                                    }}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                      handleShotChange(shot.id, 'style', target.value);
                                    }}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Cinematography</span>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <Move className="w-3.5 h-3.5" />
                                    <span>Camera Motion & Positioning</span>
                                  </div>
                                  <textarea
                                    value={shot.camera_motion_positioning}
                                    rows={1}
                                    onFocus={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.height = '';
                                    }}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                      handleShotChange(shot.id, 'camera_motion_positioning', target.value);
                                    }}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                  />
                                </div>

                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>Composition</span>
                                  </div>
                                  <textarea
                                    value={shot.composition}
                                    rows={1}
                                    onFocus={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.height = '';
                                    }}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                      handleShotChange(shot.id, 'composition', target.value);
                                    }}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                  />
                                </div>

                                <div className="group">
                                  <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                    <Sun className="w-3.5 h-3.5" />
                                    <span>Ambiance & Lighting</span>
                                  </div>
                                  <textarea
                                    value={shot.ambiance_colour_lighting}
                                    rows={1}
                                    onFocus={(e) => {
                                      e.target.style.height = 'auto';
                                      e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                    }}
                                    onBlur={(e) => {
                                      e.target.style.height = '';
                                    }}
                                    onInput={(e) => {
                                      const target = e.target as HTMLTextAreaElement;
                                      target.style.height = 'auto';
                                      target.style.height = `${target.scrollHeight}px`;
                                      handleShotChange(shot.id, 'ambiance_colour_lighting', target.value);
                                    }}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                <Volume2 className="w-3.5 h-3.5" />
                                <span>Audio</span>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                              <div className="group">
                                <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>Dialogue</span>
                                </div>
                                <textarea
                                  value={shot.dialogue}
                                  rows={1}
                                  onFocus={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.height = '';
                                  }}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                    handleShotChange(shot.id, 'dialogue', target.value);
                                  }}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                />
                              </div>

                              <div className="group">
                                <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>SFX</span>
                                </div>
                                <textarea
                                  value={shot.sfx}
                                  rows={1}
                                  onFocus={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.height = '';
                                  }}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                    const nextValue = target.value;
                                    setShots(prev => prev.map(item => (
                                      item.id === shot.id
                                        ? { ...item, sfx: nextValue, audio: buildLegacyAudioField({ sfx: nextValue, ambient: item.ambient }) }
                                        : item
                                    )));
                                  }}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                />
                              </div>

                              <div className="group">
                                <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                  <Waves className="w-3.5 h-3.5" />
                                  <span>Ambient Noise</span>
                                </div>
                                <textarea
                                  value={shot.ambient}
                                  rows={1}
                                  onFocus={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.height = '';
                                  }}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${target.scrollHeight}px`;
                                    const nextValue = target.value;
                                    setShots(prev => prev.map(item => (
                                      item.id === shot.id
                                        ? { ...item, ambient: nextValue, audio: buildLegacyAudioField({ sfx: item.sfx, ambient: nextValue }) }
                                        : item
                                    )));
                                  }}
                                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-0 focus:ring-offset-0 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                                />
                              </div>
                              </div>
                            </div>

                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gray-900 px-5 text-base font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!regenEnabled || !hasPhotoUpdates || submittingPhoto || photoPromptTooLong}
                  onClick={() => handleRegenerate('photo')}
                >
                  {submittingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  Generate Image
                  <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    FREE
                  </span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!regenEnabled || !hasVideoUpdates || submittingVideo}
                  onClick={() => handleRegenerate('video')}
                >
                  {submittingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
                  Generate Video
                  <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                    {segmentVideoCost} credits
                  </span>
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
    case 'awaiting_prev_first_frame':
      return 'Waiting for previous frame';
    case 'generating_first_frame':
      return 'Generating first frame';
    case 'retrying_first_frame':
      return 'Retrying first frame';
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
