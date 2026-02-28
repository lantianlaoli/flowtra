'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import {
  Loader2,
  Check,
  ChevronDown,
  Plus,
  Trash2,
  Link2,
  Clock,
  User,
  Clapperboard,
  Palette,
  Music,
  MessageSquare,
  Globe,
  Camera,
  Move,
  MapPin,
  Sun,
  Sparkles,
  Image as ImageIcon,
  Video as VideoIcon
} from 'lucide-react';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import type { LanguageCode } from '@/components/ui/LanguageSelector';
import type { UserAvatar } from '@/lib/supabase';
import { getFlagEmoji } from '@/lib/language-utils';
import { useToast } from '@/contexts/ToastContext';
import { estimateKlingPromptUsage, KLING_PROMPT_MAX_CHARS } from '@/lib/kling-prompt-budget';

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

export type SegmentPromptPayload = {
  first_frame_description: string;
  shots: SegmentShotPayload[];
  is_continuation_from_prev: boolean;
};

type BrandProduct = {
  id: string;
  product_name: string;
  user_product_photos?: Array<{ photo_url: string; is_primary?: boolean }>;
};

interface SegmentFormColumnProps {
  projectId: string;
  segmentIndex: number;
  segment?: SegmentCardSummary | null;
  segmentPlanEntry?: SegmentPrompt;
  videoModel?: string;
  videoDuration?: string | null;
  onRegenerate?: (options: {
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  isSubmitting?: { photo: boolean; video: boolean };
  readOnly?: boolean;
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
const PHOTO_CHAR_LIMIT = 5000;

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

export default function SegmentFormColumn({
  projectId,
  segmentIndex,
  segment,
  segmentPlanEntry,
  videoModel,
  videoDuration,
  onRegenerate,
  isSubmitting,
  readOnly = false
}: SegmentFormColumnProps) {
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
  const [openLanguageDropdownId, setOpenLanguageDropdownId] = useState<number | null>(null);
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

  const [productOptions, setProductOptions] = useState<BrandProduct[]>([]);
  const productCacheRef = useRef<Record<string, { items: BrandProduct[]; error?: string }>>({});

  const [characterOptions, setCharacterOptions] = useState<UserAvatar[]>([]);

  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { showError } = useToast();

  const firstFrameUrl = segment?.firstFrameUrl || null;
  const videoUrl = segment?.videoUrl || null;

  // Track segment index to detect when user switches to a different segment
  const previousSegmentIndexRef = useRef(segmentIndex);
  const isSegmentSwitch = previousSegmentIndexRef.current !== segmentIndex;

  const promptSeedSignature = useMemo(() => JSON.stringify({
    photo: initialPhotoPrompt?.trim() || '',
    shots: initialShots
  }), [initialPhotoPrompt, initialShots]);
  const promptSeedRef = useRef(promptSeedSignature);

  const normalizeShotsForCompare = (items: SegmentShotPayload[]) =>
    items.map((shot, idx) => ({
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

  const hasLocalEdits = (nextInitialPhoto: string, nextInitialShots: SegmentShotPayload[], nextContinuation: boolean) => {
    if (photoPrompt.trim() !== nextInitialPhoto.trim()) return true;
    if (isContinuation !== nextContinuation) return true;
    if (shots.length !== nextInitialShots.length) return true;
    const currentNormalized = normalizeShotsForCompare(shots);
    const nextNormalized = normalizeShotsForCompare(nextInitialShots);
    return currentNormalized.some((shot, idx) => {
      const initial = nextNormalized[idx];
      if (!initial) return true;
      return (
        shot.time_range !== initial.time_range ||
        shot.audio !== initial.audio ||
        shot.style !== initial.style ||
        shot.action !== initial.action ||
        shot.subject !== initial.subject ||
        shot.dialogue !== initial.dialogue ||
        shot.language !== initial.language ||
        shot.composition !== initial.composition ||
        shot.context_environment !== initial.context_environment ||
        shot.ambiance_colour_lighting !== initial.ambiance_colour_lighting ||
        shot.camera_motion_positioning !== initial.camera_motion_positioning
      );
    });
  };

  useEffect(() => {
    if (promptSeedRef.current === promptSeedSignature && !isSegmentSwitch) {
      return;
    }
    if (!isSegmentSwitch && hasLocalEdits(initialPhotoPrompt, initialShots, Boolean(normalizedPrompt.is_continuation_from_prev))) {
      return;
    }
    promptSeedRef.current = promptSeedSignature;
    previousSegmentIndexRef.current = segmentIndex;
    setPhotoPrompt(initialPhotoPrompt);
    setShots(initialShots);
    const continuationDefault = Boolean(normalizedPrompt.is_continuation_from_prev);
    setIsContinuation(continuationDefault);

    // Only reset shot expansion when switching segments, not on auto-save updates
    if (isSegmentSwitch) {
      setShotExpansion({});
    }
  }, [initialPhotoPrompt, initialShots, promptSeedSignature, normalizedPrompt.is_continuation_from_prev, segmentIndex, isSegmentSwitch]);

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

        const items: BrandProduct[] = Array.isArray(data?.products) ? data.products : [];
        productCacheRef.current[cacheKey] = { items };
        setProductOptions(items);
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCharacters = async () => {
      try {
        const response = await fetch('/api/user-avatars');
        if (!response.ok) {
          throw new Error('Failed to load characters');
        }
        const data = await response.json();
        if (cancelled) return;

        const characters: UserAvatar[] = Array.isArray(data?.avatars) ? data.avatars : [];
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
  }, []);

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
  const submittingPhoto = isSubmitting?.photo ?? false;
  const submittingVideo = isSubmitting?.video ?? false;

  const getMentionedIds = (prompt: string) => {
    const productIds = new Set<string>();
    const characterIds = new Set<string>();
    const regex = /@(?<type>character|product)\((?<name>[^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(prompt)) !== null) {
      const type = match.groups?.type;
      const name = match.groups?.name?.trim();
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

  const getProductPhotoUrl = (product?: BrandProduct | null) => {
    if (!product?.user_product_photos?.length) return null;
    const primary = product.user_product_photos.find(photo => photo.is_primary);
    return primary?.photo_url || product.user_product_photos[0]?.photo_url || null;
  };
  const getProductPhotoCount = (product?: BrandProduct | null) =>
    Array.isArray(product?.user_product_photos)
      ? product.user_product_photos.filter(photo => Boolean(photo?.photo_url)).length
      : 0;
  const getCharacterPhotoCount = (character?: UserAvatar | null) => {
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

  // Auto-save logic
  const saveChanges = async () => {
    try {
      const snapshotPhoto = photoPrompt.trim();
      const snapshotContinuation = isContinuation;
      const normalizedShots = normalizeShotsForCompare(shots);
      const snapshotShotsSignature = JSON.stringify(normalizedShots);

      const payload = {
        prompt: {
          first_frame_description: photoPrompt,
          shots: normalizedShots,
          is_continuation_from_prev: isContinuation
        },
        regenerate: 'none'
      };

      const response = await fetch(`/api/competitor-ugc-replication/${projectId}/segments/${segmentIndex}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      // Update seed ref to prevent reverting changes on Realtime update
      // Use normalizedShots to match the format that will come back from the database
      const currentNormalized = normalizeShotsForCompare(shots);
      const matchesSnapshot =
        snapshotPhoto === photoPrompt.trim() &&
        snapshotContinuation === isContinuation &&
        JSON.stringify(currentNormalized) === snapshotShotsSignature;

      if (matchesSnapshot) {
        promptSeedRef.current = JSON.stringify({
          photo: snapshotPhoto,
          shots: normalizedShots
        });
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      showError('Failed to save changes. Please check your connection.');
    }
  };

  // Debounced auto-save when prompt or shots change
  useEffect(() => {
    // Skip auto-save in read-only mode
    if (readOnly) {
      return;
    }

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Check if there are actual changes
    const hasChanges =
      photoPrompt.trim() !== initialPhotoPrompt.trim() ||
      isContinuation !== Boolean(normalizedPrompt.is_continuation_from_prev) ||
      shots.length !== initialShots.length ||
      shots.some((shot, idx) => {
        const initial = initialShots[idx];
        if (!initial) return true;
        return (
          shot.time_range !== initial.time_range ||
          shot.audio !== initial.audio ||
          shot.style !== initial.style ||
          shot.action !== initial.action ||
          shot.subject !== initial.subject ||
          shot.dialogue !== initial.dialogue ||
          shot.language !== initial.language ||
          shot.composition !== initial.composition ||
          shot.context_environment !== initial.context_environment ||
          shot.ambiance_colour_lighting !== initial.ambiance_colour_lighting ||
          shot.camera_motion_positioning !== initial.camera_motion_positioning
        );
      });

    if (!hasChanges) {
      return;
    }

    // Debounce: Save after 1.5 seconds of inactivity
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, 1500);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoPrompt, shots, isContinuation]);

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
    const { productIds, characterIds } = getMentionedIds(photoPrompt);
    onRegenerate({
      type,
      prompt: payload,
      productIds: type === 'photo' && productIds.length ? productIds : undefined,
      characterIds: type === 'photo' && characterIds.length ? characterIds : undefined
    });
  };

  return (
    <div className="clone-editor-form flex h-full flex-col bg-white">
      {/* Header */}
      <div className="clone-editor-form-header flex-shrink-0 border-b border-[#E5E5E5] bg-gray-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="clone-editor-form-icon w-4 h-4 text-black" />
            <h2 className="clone-editor-form-title text-sm font-semibold text-black">
              Visual Prompt
            </h2>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="clone-editor-form-body flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* Photo Prompt Section */}
          <div className="clone-editor-card rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-black" />
                <p className="clone-editor-label text-sm font-semibold text-black">Photo Prompt</p>
              </div>
              <span className="clone-editor-helper text-xs text-[#666666]">Type @ to insert a character or product</span>
            </div>
            <PromptMentionTextarea
              value={photoPrompt}
              onChange={setPhotoPrompt}
              rows={6}
              disabled={readOnly}
              readOnly={readOnly}
              hasError={photoPromptTooLong}
              className={clsx(
                'clone-editor-textarea rounded-lg',
                photoPromptTooLong ? 'border-red-500' : 'border-[#E5E5E5]',
                readOnly ? 'bg-gray-50' : ''
              )}
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
              <p className="text-xs text-red-600">Photo prompt exceeds {PHOTO_CHAR_LIMIT} characters.</p>
            )}
            {segmentIndex >= 1 && (
              <button
                type="button"
                aria-pressed={isContinuation}
                onClick={() => !readOnly && setIsContinuation(prev => !prev)}
                disabled={readOnly}
                className={clsx(
                  'clone-editor-continuation w-full text-left rounded-lg border px-4 py-3 flex items-center gap-3 transition',
                  isContinuation
                    ? 'border-black bg-gray-50 text-black'
                    : 'border-[#E5E5E5] text-[#666666] hover:border-black hover:text-black',
                  readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
              >
                <span
                  className={clsx(
                    'clone-editor-continuation-icon inline-flex items-center justify-center rounded-full border w-9 h-9 flex-shrink-0',
                    isContinuation ? 'border-black bg-black text-white' : 'border-gray-300'
                  )}
                >
                  <Link2 className="w-4 h-4" />
                </span>
                <span className="flex-1">
                  <span className="clone-editor-label block text-sm font-semibold">Link to previous frame</span>
                  <span className="clone-editor-helper block text-xs text-[#666666]">
                    Use the prior segment&apos;s first frame as a reference to keep characters consistent.
                  </span>
                </span>
                <span
                  className={clsx(
                    'w-3 h-3 rounded-full border',
                    isContinuation ? 'bg-black border-black' : 'border-gray-300'
                  )}
                />
              </button>
            )}

          </div>

          {/* Shots Editor */}
          <div className="clone-editor-card rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-black" />
                <p className="clone-editor-label text-sm font-semibold text-black">Shots</p>
              </div>
              {!readOnly && (
              <div className="flex items-center gap-2">
                {shots.length >= 4 && (
                  <span className="clone-editor-helper text-[11px] text-[#666666]">Max 4 shots</span>
                )}
                <button
                  type="button"
                  onClick={handleAddShot}
                  disabled={shots.length >= 4}
                  className={clsx(
                    'clone-editor-secondary inline-flex items-center justify-center rounded-full border text-xs font-semibold transition w-9 h-9',
                    shots.length >= 4
                      ? 'border-[#E5E5E5] text-gray-400 cursor-not-allowed'
                      : 'border-black text-black hover:bg-black hover:text-white'
                  )}
                  title="Add shot"
                >
                  <Plus className="w-4 h-4" />
                  <span className="sr-only">Add shot</span>
                </button>
              </div>
              )}
            </div>
            {videoModel === 'kling_3' && (
              <p className="text-xs text-[#666666]">
                Kling 3.0 allows up to 500 characters per shot prompt. Long dialogue or detailed shot fields will be compressed automatically.
              </p>
            )}
            <div className="space-y-3">
              {shots.map((shot, index) => {
                const klingEstimate = klingShotEstimates[index];
                const likelyOverKlingLimit = Boolean(klingEstimate && klingEstimate.originalLength > KLING_PROMPT_MAX_CHARS);
                const expanded = shotExpansion[shot.id] ?? false;
                const summaryText = shot.subject?.trim() || shot.action?.trim() || shot.dialogue?.trim() || 'Add more shot detail.';
                const toggleCard = () => toggleShotExpansion(shot.id);
                return (
                  <div key={shot.id} className="clone-editor-shot-card rounded-lg border border-[#E5E5E5] p-3 space-y-3 bg-white">
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
                          <div className="clone-editor-label text-sm font-semibold text-black">Shot {shot.id}</div>
                          <span className="clone-editor-helper text-[11px] font-medium text-[#666666]">{shot.time_range || '00:00 - 00:02'}</span>
                        </div>
                        {klingEstimate && (
                          <p className={clsx(
                            'mt-1 text-[11px]',
                            likelyOverKlingLimit ? 'text-amber-600' : 'text-[#666666]'
                          )}>
                            Estimated prompt: {klingEstimate.originalLength}/{KLING_PROMPT_MAX_CHARS} characters
                          </p>
                        )}
                        {!expanded && (
                          <p className="clone-editor-helper mt-1 text-xs text-[#666666] line-clamp-2">{summaryText}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!readOnly && (
                        <button
                          type="button"
                          data-shot-control="true"
                          onClick={() => handleRemoveShot(shot.id)}
                          disabled={shots.length <= 1}
                          className={clsx(
                            'clone-editor-danger inline-flex items-center justify-center rounded-full border w-8 h-8',
                            shots.length <= 1
                              ? 'border-[#E5E5E5] text-gray-300 cursor-not-allowed'
                              : 'border-red-200 text-red-500 hover:bg-red-50'
                          )}
                          title="Remove shot"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Remove shot</span>
                        </button>
                        )}
                        <button
                          type="button"
                          data-shot-control="true"
                          onClick={() => toggleShotExpansion(shot.id)}
                          className="clone-editor-secondary inline-flex items-center justify-center rounded-full border border-[#E5E5E5] p-1 text-[#666666] hover:bg-gray-50"
                        >
                          <ChevronDown className={clsx('w-4 h-4 transition-transform', expanded ? 'rotate-180' : '')} />
                          <span className="sr-only">Toggle shot</span>
                        </button>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        'overflow-hidden transition-all duration-300 ease-in-out space-y-3',
                        expanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
                      )}
                    >
                      {likelyOverKlingLimit && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          This shot is likely over Kling&apos;s 500-character limit and will be shortened during generation.
                        </div>
                      )}
                      <div className="space-y-4 pt-1">
                        {/* Time Range */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Time range (relative)</span>
                          </div>
                          <input
                            type="text"
                            value={shot.time_range}
                            onChange={e => handleShotChange(shot.id, 'time_range', e.target.value)}
                            disabled={readOnly}
                            readOnly={readOnly}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                            placeholder="00:00 - 00:02"
                          />
                        </div>

                        {/* Subject */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <User className="w-3.5 h-3.5" />
                            <span>Subject</span>
                          </div>
                          <PromptMentionTextarea
                            value={shot.subject}
                            onChange={(value) => handleShotChange(shot.id, 'subject', value)}
                            rows={2}
                            disabled={readOnly}
                            readOnly={readOnly}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] focus:ring-1 focus:ring-offset-1 focus:ring-black/5 min-h-[72px] ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
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

                        {/* Action */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Clapperboard className="w-3.5 h-3.5" />
                            <span>Action</span>
                          </div>
                          <PromptMentionTextarea
                            value={shot.action}
                            onChange={(value) => handleShotChange(shot.id, 'action', value)}
                            rows={2}
                            disabled={readOnly}
                            readOnly={readOnly}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] focus:ring-1 focus:ring-offset-1 focus:ring-black/5 min-h-[72px] ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
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

                        {/* Style */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Palette className="w-3.5 h-3.5" />
                            <span>Style</span>
                          </div>
                          <textarea
                            value={shot.style}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'style', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Audio */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Music className="w-3.5 h-3.5" />
                            <span>Audio / Music</span>
                          </div>
                          <textarea
                            value={shot.audio}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'audio', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Dialogue */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Dialogue / VO</span>
                          </div>
                          <textarea
                            value={shot.dialogue}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'dialogue', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Language */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Globe className="w-3.5 h-3.5" />
                            <span>Language</span>
                          </div>
                          <div className="relative" data-language-dropdown>
                            <button
                              type="button"
                              onClick={() => !readOnly && setOpenLanguageDropdownId(openLanguageDropdownId === shot.id ? null : shot.id)}
                              disabled={readOnly}
                              className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 pr-8 text-left text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 ${
                                readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="text-base"
                                  style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' }}
                                >
                                  {getFlagEmoji(shot.language)}
                                </span>
                                <span>
                                  {LANGUAGE_OPTIONS.find(opt => opt.value === shot.language)?.native || 'Select language'}
                                </span>
                              </span>
                            </button>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            {openLanguageDropdownId === shot.id && (
                              <div className="clone-editor-dropdown absolute z-50 mt-1 w-full rounded-lg border border-gray-100 bg-white shadow-lg max-h-60 overflow-y-auto py-1 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-200">
                                {LANGUAGE_OPTIONS.map(option => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      handleShotChange(shot.id, 'language', option.value);
                                      setOpenLanguageDropdownId(null);
                                    }}
                                    className={clsx(
                                      "clone-editor-dropdown-option w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors",
                                      shot.language === option.value ? "bg-gray-50 font-medium text-black" : "text-[#666666]"
                                    )}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span
                                        className="text-base"
                                        style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' }}
                                      >
                                        {getFlagEmoji(option.value)}
                                      </span>
                                      <span>{option.native}</span>
                                    </span>
                                    {shot.language === option.value && <Check className="w-3.5 h-3.5" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Composition */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Camera className="w-3.5 h-3.5" />
                            <span>Composition / Camera</span>
                          </div>
                          <textarea
                            value={shot.composition}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'composition', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Camera Motion */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Move className="w-3.5 h-3.5" />
                            <span>Camera Motion</span>
                          </div>
                          <textarea
                            value={shot.camera_motion_positioning}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'camera_motion_positioning', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Environment */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Environment</span>
                          </div>
                          <textarea
                            value={shot.context_environment}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'context_environment', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>

                        {/* Ambiance / Lighting */}
                        <div className="group">
                          <div className="clone-editor-helper flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#666666]">
                            <Sun className="w-3.5 h-3.5" />
                            <span>Ambiance / Lighting</span>
                          </div>
                          <textarea
                            value={shot.ambiance_colour_lighting}
                            rows={1}
                            disabled={readOnly}
                            readOnly={readOnly}
                            onFocus={(e) => {
                              if (readOnly) return;
                              e.target.style.height = 'auto';
                              e.target.style.height = `${Math.max(80, e.target.scrollHeight)}px`;
                            }}
                            onBlur={(e) => {
                              if (readOnly) return;
                              e.target.style.height = '';
                            }}
                            onInput={(e) => {
                              if (readOnly) return;
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = `${target.scrollHeight}px`;
                              handleShotChange(shot.id, 'ambiance_colour_lighting', target.value);
                            }}
                            className={`clone-editor-input w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-offset-1 focus:ring-black/5 resize-none overflow-hidden focus:overflow-auto min-h-[40px] transition-all duration-200 ease-in-out ${
                              readOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regenerate Buttons - Hidden in read-only mode */}
          {!readOnly && (
          <div className="clone-editor-card rounded-lg border border-[#E5E5E5] bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="clone-editor-primary inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-black px-5 text-base font-semibold text-white cursor-pointer hover:bg-gray-900 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-black"
                disabled={!regenEnabled || submittingPhoto || photoPromptTooLong}
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
                className="clone-editor-secondary inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 text-base font-semibold text-black cursor-pointer hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                disabled={!regenEnabled || submittingVideo}
                onClick={() => handleRegenerate('video')}
              >
                {submittingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <VideoIcon className="w-4 h-4" />}
                Generate Video
                <span className="ml-1 inline-flex items-center rounded-lg border border-emerald-900 bg-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  FREE
                </span>
              </button>
              {!regenEnabled && (
                <p className="clone-editor-helper text-xs text-[#666666] text-center">
                  Backend endpoint not wired yet. Edits will stay local until regeneration is enabled.
                </p>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
