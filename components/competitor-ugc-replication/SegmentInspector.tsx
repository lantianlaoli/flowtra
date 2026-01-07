'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { X, Image as ImageIcon, Video as VideoIcon, Loader2, Check, ChevronDown, Plus, Trash2, Link2, UserCircle, Clock, User, Clapperboard, Palette, Music, MessageSquare, Globe, Camera, Move, MapPin, Sun, Sparkles, ShoppingBag } from 'lucide-react';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { LanguageCode } from '@/components/ui/LanguageSelector';
import type { UserAvatar } from '@/lib/supabase';
import { MODEL_PROCESSING_TIMES, type VideoModel } from '@/lib/constants';

export type SegmentShotPayload = {
  id: number;
  time_range: string;
  audio: string;
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
const MAX_REFERENCE_PRODUCTS = 10;
const MAX_TOTAL_REFERENCES = 10;
const PRODUCT_FETCH_MAX_ATTEMPTS = 3;

const normalizeShotLanguage = (value?: string): LanguageCode => {
  if (!value) return DEFAULT_LANGUAGE;
  const match = LANGUAGE_OPTIONS.find(option => option.value === value);
  return match ? match.value : DEFAULT_LANGUAGE;
};

const createEmptyShotPayload = (id: number, language: LanguageCode): SegmentShotPayload => ({
  id,
  time_range: '00:00 - 00:02',
  audio: '',
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

const convertShotsForEditor = (shots: SegmentPrompt['shots'], fallbackLanguage: LanguageCode): SegmentShotPayload[] => {
  if (Array.isArray(shots) && shots.length > 0) {
    return shots.map((shot, index) => ({
      id: shot.id || index + 1,
      time_range: shot.time_range || '00:00 - 00:02',
      audio: shot.audio || '',
      style: shot.style || '',
      action: shot.action || '',
      subject: shot.subject || '',
      dialogue: shot.dialogue || '',
      language: normalizeShotLanguage(shot.language),
      composition: shot.composition || '',
      context_environment: shot.context_environment || '',
      ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
      camera_motion_positioning: shot.camera_motion_positioning || ''
    }));
  }
  return [createEmptyShotPayload(1, fallbackLanguage)];
};

type BrandProduct = {
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
  brandId?: string | null;
  brandName?: string | null;
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
  brandId,
  brandName,
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
  const initialShots = useMemo(
    () => convertShotsForEditor(normalizedPrompt.shots, normalizeShotLanguage(normalizedPrompt.language || DEFAULT_LANGUAGE)),
    [normalizedPrompt]
  );

  const [photoPrompt, setPhotoPrompt] = useState(initialPhotoPrompt);
  const [shots, setShots] = useState<SegmentShotPayload[]>(initialShots);
  const [shotExpansion, setShotExpansion] = useState<Record<number, boolean>>({});
  const [openLanguageDropdownId, setOpenLanguageDropdownId] = useState<number | null>(null); // New state for custom dropdown
  const [isContinuation, setIsContinuation] = useState(Boolean(normalizedPrompt.is_continuation_from_prev));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openLanguageDropdownId === null) return;
      const target = event.target as HTMLElement;
      if (!target.closest('[data-language-dropdown]')) {
        setOpenLanguageDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openLanguageDropdownId]);
  const [photoPreviewPending, setPhotoPreviewPending] = useState(false);
  const [videoPreviewPending, setVideoPreviewPending] = useState(false);
  const [productOptions, setProductOptions] = useState<BrandProduct[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const productCacheRef = useRef<Record<string, { items: BrandProduct[]; error?: string }>>({});
  const [characterOptions, setCharacterOptions] = useState<UserAvatar[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);
  const firstFrameUrl = segment?.firstFrameUrl || null;
  const videoUrl = segment?.videoUrl || null;
  const lastFirstFrameUrlRef = useRef<string | null>(firstFrameUrl);
  const lastVideoUrlRef = useRef<string | null>(videoUrl);
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
    if (!open) {
      setSelectedProductIds([]);
    }
  }, [open]);

  useEffect(() => {
    setSelectedProductIds([]);
  }, [brandId]);

  useEffect(() => {
    if (!open || !brandId) {
      setProductOptions([]);
      setProductError(brandId ? null : 'Link this project to a brand to unlock product references.');
      setProductLoading(false);
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const cached = productCacheRef.current[brandId];
    if (cached) {
      setProductOptions(cached.items);
      setProductError(cached.error ?? null);
      setProductLoading(false);
      setSelectedProductIds(prev => prev.filter(id => cached.items.some(item => item.id === id)));
      return () => {
        if (retryTimeout) clearTimeout(retryTimeout);
        if (activeController) activeController.abort();
      };
    }

    const fetchProducts = async (attempt = 1) => {
      if (cancelled) return;
      if (attempt === 1) {
        setProductLoading(true);
        setProductError(null);
      }

      const controller = new AbortController();
      activeController = controller;

      try {
        const response = await fetch(`/api/brands/${brandId}/products`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Failed to load products');
        }
        const data = await response.json();
        if (cancelled) return;

        const items: BrandProduct[] = Array.isArray(data?.products) ? data.products : [];
        productCacheRef.current[brandId] = { items };
        setProductOptions(items);
        setSelectedProductIds(prev => prev.filter(id => items.some(item => item.id === id)));
        setProductLoading(false);
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        console.error(`Failed to fetch brand products (attempt ${attempt}):`, error);
        if (attempt < PRODUCT_FETCH_MAX_ATTEMPTS) {
          const delay = attempt * 1000;
          retryTimeout = setTimeout(() => {
            fetchProducts(attempt + 1);
          }, delay);
        } else {
          const message = 'Unable to load products for this brand. Please refresh and try again.';
          productCacheRef.current[brandId] = { items: [], error: message };
          setProductOptions([]);
          setProductError(message);
          setProductLoading(false);
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
  }, [open, brandId]);

  // Fetch characters (avatars) when modal opens
  useEffect(() => {
    if (!open) {
      setSelectedCharacterIds([]);
      return;
    }

    let cancelled = false;

    const fetchCharacters = async () => {
      setCharacterLoading(true);
      setCharacterError(null);

      try {
        const response = await fetch('/api/user-avatars');
        if (!response.ok) {
          throw new Error('Failed to load characters');
        }
        const data = await response.json();
        if (cancelled) return;

        const characters: UserAvatar[] = Array.isArray(data?.avatars) ? data.avatars : [];
        setCharacterOptions(characters);
        setCharacterLoading(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch characters:', error);
        setCharacterError('Unable to load characters. Please refresh and try again.');
        setCharacterOptions([]);
        setCharacterLoading(false);
      }
    };

    fetchCharacters();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleAddShot = () => {
    setShots(prev => {
      if (prev.length >= 4) return prev;
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
  const selectedProductCount = selectedProductIds.length;
  const productSelectionLimitReached = selectedProductCount >= MAX_REFERENCE_PRODUCTS;

  const getProductPhotoUrl = (product?: BrandProduct | null) => {
    if (!product?.user_product_photos?.length) return null;
    const primary = product.user_product_photos.find(photo => photo.is_primary);
    return primary?.photo_url || product.user_product_photos[0]?.photo_url || null;
  };

  const handleProductToggle = (product: BrandProduct) => {
    const hasPhoto = Boolean(getProductPhotoUrl(product));
    if (!hasPhoto) {
      return;
    }
    setSelectedProductIds(prev => {
      if (prev.includes(product.id)) {
        return prev.filter(id => id !== product.id);
      }
      // Check combined limit with characters
      // Soft limit: allow selection but show warning in UI
      return [...prev, product.id];
    });
  };

  const handleCharacterToggle = (character: UserAvatar) => {
    setSelectedCharacterIds(prev => {
      if (prev.includes(character.id)) {
        return prev.filter(id => id !== character.id);
      }
      // Soft limit: allow selection but show warning in UI
      return [...prev, character.id];
    });
  };

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
    const normalizedShots = shots.map((shot, idx) => ({
      id: idx + 1,
      time_range: shot.time_range.trim(),
      audio: shot.audio.trim(),
      style: shot.style.trim(),
      action: shot.action.trim(),
      subject: shot.subject.trim(),
      dialogue: shot.dialogue.trim(),
      language: shot.language,
      composition: shot.composition.trim(),
      context_environment: shot.context_environment.trim(),
      ambiance_colour_lighting: shot.ambiance_colour_lighting.trim(),
      camera_motion_positioning: shot.camera_motion_positioning.trim()
    }));
    const payload: SegmentPromptPayload = {
      first_frame_description: photoPrompt,
      shots: normalizedShots,
      is_continuation_from_prev: isContinuation
    };
    const referenceProductIds = type === 'photo' && selectedProductIds.length ? selectedProductIds : undefined;
    const referenceCharacterIds = type === 'photo' && selectedCharacterIds.length > 0 ? selectedCharacterIds : undefined;
    if (type === 'photo') {
      setPhotoPreviewPending(true);
    } else {
      setVideoPreviewPending(true);
    }
    const maybePromise = onRegenerate({
      type,
      prompt: payload,
      productIds: referenceProductIds,
      characterIds: referenceCharacterIds
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
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-gray-900" />
                <p className="text-sm font-semibold text-gray-900">Photo prompt</p>
              </div>
              <textarea
                value={photoPrompt}
                onChange={e => setPhotoPrompt(e.target.value)}
                rows={6}
                className={`w-full rounded-2xl border px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 ${photoPromptTooLong ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-gray-900 focus:border-gray-900'}`}
                placeholder="Describe the exact frame you want..."
              />
              {photoPromptTooLong && (
                <p className="text-xs text-red-600">Photo prompt exceeds {PHOTO_CHAR_LIMIT} characters.</p>
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
              <div className="pt-3 border-t border-dashed border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-gray-900" />
                    <p className="text-sm font-semibold text-gray-900">Product references</p>
                  </div>
                  {(selectedProductIds.length + selectedCharacterIds.length) > MAX_TOTAL_REFERENCES && (
                    <span className="text-xs text-amber-600 font-medium">
                      {selectedProductIds.length + selectedCharacterIds.length}/{MAX_TOTAL_REFERENCES} total references
                    </span>
                  )}
                </div>
                {!brandId ? (
                  <p className="text-xs text-gray-500">
                    Link this project to a brand to enable product references.
                  </p>
                ) : productLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading products…
                  </div>
                ) : productError ? (
                  <p className="text-xs text-red-600">{productError}</p>
                ) : productOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No products with photos found for this brand yet.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {productOptions.map(product => {
                      const photoUrl = getProductPhotoUrl(product);
                      const isSelected = selectedProductIds.includes(product.id);
                      const disabled = (!photoUrl && !isSelected);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleProductToggle(product)}
                          disabled={disabled}
                          className={clsx(
                            'relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
                            isSelected ? 'border-gray-900 shadow-sm' : 'border-gray-200 hover:border-gray-300',
                            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer bg-white'
                          )}
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 relative">
                            {photoUrl ? (
                              <NextImage src={photoUrl} alt={product.product_name} className="object-cover" fill sizes="48px" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{product.product_name}</p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-gray-900 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedProductCount > 0 && (
                  <p className="text-[11px] text-gray-500">
                    First-frame regeneration will reuse the selected product photos.
                  </p>
                )}
                {(selectedProductIds.length + selectedCharacterIds.length) > MAX_TOTAL_REFERENCES && (
                  <p className="text-[11px] text-amber-600">
                    You’ve exceeded the {MAX_TOTAL_REFERENCES}-product recommended limit.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-dashed border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-900" />
                    <p className="text-sm font-semibold text-gray-900">Character reference</p>
                  </div>
                </div>

                {characterLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading characters…
                  </div>
                ) : characterError ? (
                  <p className="text-xs text-red-600">{characterError}</p>
                ) : characterOptions.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No avatars found. Add avatars in Assets to use this feature.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {characterOptions.map(character => {
                      const isSelected = selectedCharacterIds.includes(character.id);
                      // Soft limit
                      const disabled = false;

                      return (
                        <button
                          key={character.id}
                          type="button"
                          onClick={() => handleCharacterToggle(character)}
                          disabled={disabled}
                          className={clsx(
                            'relative flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition',
                            isSelected ? 'border-gray-900 shadow-sm' : 'border-gray-200 hover:border-gray-300',
                            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer bg-white'
                          )}
                        >
                          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0 relative">
                            <NextImage
                              src={character.photo_url}
                              alt={character.avatar_name}
                              className="object-cover"
                              fill
                              sizes="48px"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {character.avatar_name}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-gray-900 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {(selectedProductIds.length + selectedCharacterIds.length) > MAX_TOTAL_REFERENCES && selectedCharacterIds.length > 0 && (
                  <p className="text-[11px] text-amber-600">
                    First-frame regeneration will use {selectedCharacterIds.length} character{selectedCharacterIds.length > 1 ? 's' : ''} as visual reference.
                  </p>
                )}

                {(selectedProductIds.length + selectedCharacterIds.length) > MAX_TOTAL_REFERENCES && (
                  <p className="text-[11px] text-amber-600">
                    You&apos;ve exceeded the {MAX_TOTAL_REFERENCES}-image limit for references (products + characters).
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clapperboard className="w-4 h-4 text-gray-900" />
                  <p className="text-sm font-semibold text-gray-900">Shots</p>
                </div>
                <div className="flex items-center gap-2">
                  {shots.length >= 4 && (
                    <span className="text-[11px] text-gray-500">Max 4 shots</span>
                  )}
                  <button
                    type="button"
                    onClick={handleAddShot}
                    disabled={shots.length >= 4}
                    className={clsx(
                      'inline-flex items-center justify-center rounded-full border text-xs font-semibold transition w-9 h-9',
                      shots.length >= 4
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
              <div className="space-y-3">
                {shots.map(shot => {
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
                          <div className="space-y-4 pt-1">
                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Time range (relative)</span>
                              </div>
                              <input
                                type="text"
                                value={shot.time_range}
                                onChange={e => handleShotChange(shot.id, 'time_range', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5"
                                placeholder="00:00 - 00:02"
                              />
                            </div>
                            
                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <User className="w-3.5 h-3.5" />
                                <span>Subject</span>
                              </div>
                              <textarea
                                value={shot.subject}
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
                                  handleShotChange(shot.id, 'subject', target.value);
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Clapperboard className="w-3.5 h-3.5" />
                                <span>Action</span>
                              </div>
                              <textarea
                                value={shot.action}
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
                                  handleShotChange(shot.id, 'action', target.value);
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
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
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Music className="w-3.5 h-3.5" />
                                <span>Audio / Music</span>
                              </div>
                              <textarea
                                value={shot.audio}
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
                                  handleShotChange(shot.id, 'audio', target.value);
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <MessageSquare className="w-3.5 h-3.5" />
                                <span>Dialogue / VO</span>
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
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Globe className="w-3.5 h-3.5" />
                                <span>Language</span>
                              </div>
                              <div className="relative" data-language-dropdown>
                                <button
                                  type="button"
                                  onClick={() => setOpenLanguageDropdownId(openLanguageDropdownId === shot.id ? null : shot.id)}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pr-8 text-left text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5"
                                >
                                  {LANGUAGE_OPTIONS.find(opt => opt.value === shot.language)?.native || 'Select language'}
                                </button>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                {openLanguageDropdownId === shot.id && (
                                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-100 bg-white shadow-lg max-h-60 overflow-y-auto py-1 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                                    {LANGUAGE_OPTIONS.map(option => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                          handleShotChange(shot.id, 'language', option.value);
                                          setOpenLanguageDropdownId(null);
                                        }}
                                        className={clsx(
                                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors",
                                          shot.language === option.value ? "bg-gray-50 font-medium text-gray-900" : "text-gray-700"
                                        )}
                                      >
                                        <span>{option.native}</span>
                                        {shot.language === option.value && <Check className="w-3.5 h-3.5" />}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Composition / Camera</span>
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
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Move className="w-3.5 h-3.5" />
                                <span>Camera Motion</span>
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
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <MapPin className="w-3.5 h-3.5" />
                                <span>Environment</span>
                              </div>
                              <textarea
                                value={shot.context_environment}
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
                                  handleShotChange(shot.id, 'context_environment', target.value);
                                }}
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>

                            <div className="group">
                              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-gray-700">
                                <Sun className="w-3.5 h-3.5" />
                                <span>Ambiance / Lighting</span>
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
                                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out"
                              />
                            </div>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 text-white py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!regenEnabled || !hasPhotoUpdates || submittingPhoto || photoPromptTooLong}
                  onClick={() => handleRegenerate('photo')}
                >
                  {submittingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Regenerate First Frame
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 py-2.5 text-sm font-semibold text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!regenEnabled || !hasVideoUpdates || submittingVideo}
                  onClick={() => handleRegenerate('video')}
                >
                  {submittingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {videoUrl ? 'Regenerate Video' : 'Confirm & Generate Video'}
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
