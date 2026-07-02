// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Active dashboard model selection: Seedance 2 Mini, Seedance 2 Fast, Seedance 2
// ALL models: PAID generation, FREE download

// Generation costs (ALL models charge at generation time)
export const GENERATION_COSTS = {
  'seedance_2_mini': 20.5, // Seedance 2 Mini: 20.5 credits per second at 720p
  'seedance_2_fast': 33, // Seedance 2 Fast: 33 credits per second
  'seedance_2': 41, // Seedance 2: 41 credits per second
} as const;

export type VideoModel = keyof typeof GENERATION_COSTS;

export const SEEDANCE_VIDEO_MODELS = [
  'seedance_2_mini',
  'seedance_2_fast',
  'seedance_2',
] as const satisfies readonly VideoModel[];

export const SEEDANCE_2_QUALITY_COSTS = {
  '480p': 19,
  '720p': 41,
  '1080p': 102
} as const;

export const SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS = {
  '480p': 11.5,
  '720p': 25,
  '1080p': 62,
} as const;

export const SEEDANCE_2_FAST_QUALITY_COSTS = {
  '480p': 15.5,
  '720p': 33,
} as const;

export const SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS = {
  '480p': 9,
  '720p': 20,
} as const;

export const SEEDANCE_2_MINI_QUALITY_COSTS = {
  '480p': 9.5,
  '720p': 20.5,
} as const;

export const SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS = {
  '480p': 6,
  '720p': 12.5,
} as const;

export const MOTION_CLONE_QUALITY_COSTS = {
  '480p': SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS['480p'],
  '720p': SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS['720p'],
} as const;

// DEPRECATED: Legacy CREDIT_COSTS for backwards compatibility
export const CREDIT_COSTS = {
  'seedance_2_mini': 20.5,
  'seedance_2_fast': 33,
  'seedance_2': 41,
} as const;

export const HIGH_RES_DOWNLOAD_COSTS = {
  '1080p': 5,
  '4k': 40
} as const;

export type HighResResolution = '720p' | keyof typeof HIGH_RES_DOWNLOAD_COSTS;

// NOTE: Platform presets have been removed
// Platform selection is no longer a feature of the system

export const GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL = 'gpt-image-2-text-to-image' as const;
export const GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL = 'gpt-image-2-image-to-image' as const;
export const NON_AGENT_IMAGE_MODEL = GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL;

// Video aspect ratio options for different models
export const VIDEO_ASPECT_RATIO_OPTIONS = {
  'seedance_2_mini': ['16:9', '9:16'],
  'seedance_2_fast': ['16:9', '9:16'],
  'seedance_2': ['16:9', '9:16'],
} as const
// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'seedance_2_mini': '1-2 min',
  'seedance_2_fast': '1-2 min',
  'seedance_2': '2-4 min',
} as const
// Replica photo generation credits (reference photo mode)
export const REPLICA_PHOTO_CREDITS = {
  '1K': 6,
  '2K': 6,
  '4K': 12
} as const;
export type ReplicaPhotoResolution = keyof typeof REPLICA_PHOTO_CREDITS;

// Package definitions based on updated pricing
export const PACKAGES = {
  lite: {
    name: 'Lite',
    price: 19,
    priceSymbol: '$',
    credits: 1250,
    description: 'Starter Creator Pack',
    features: [
      '1,250 credits',
      '≈ 38s of Seedance 2 Fast video',
      'or ≈ 30s of Seedance 2 video',
      'AI-powered video generation'
    ],
    videoEstimates: {
      seedance_2_fast: 38,
      seedance_2: 30
    }
  },
  plus: {
    name: 'Plus',
    price: 29,
    priceSymbol: '$',
    credits: 1930,
    description: 'Entry Creator Pack',
    features: [
      '1,930 credits',
      '≈ 58s of Seedance 2 Fast video',
      'or ≈ 47s of Seedance 2 video',
      'AI-powered video generation'
    ],
    videoEstimates: {
      seedance_2_fast: 58,
      seedance_2: 47
    }
  },
  basic: {
    name: 'Pro',
    price: 59,
    priceSymbol: '$',
    credits: 3930,
    description: 'Content Creator\'s Choice',
    features: [
      '3,930 credits',
      '≈ 119s of Seedance 2 Fast video',
      'or ≈ 95s of Seedance 2 video',
      'AI-powered video generation'
    ],
    videoEstimates: {
      seedance_2_fast: 119,
      seedance_2: 95
    }
  },
  pro: {
    name: 'Ultra',
    price: 99,
    priceSymbol: '$',
    credits: 6600,
    description: 'Pro Video Production',
    features: [
      '6,600 credits',
      '≈ 200s of Seedance 2 Fast video',
      'or ≈ 160s of Seedance 2 video',
      'AI-powered video generation',
      'Priority processing queue'
    ],
    videoEstimates: {
      seedance_2_fast: 200,
      seedance_2: 160
    }
  }
} as const

// Get package details by name
export function getPackageByName(packageName: 'lite' | 'plus' | 'basic' | 'pro') {
  return PACKAGES[packageName]
}

// Get credit cost for video model
export function getCreditCost(model: keyof typeof CREDIT_COSTS): number {
  return CREDIT_COSTS[model]
}

// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING HELPERS =====

// Get generation cost (ALL models charge at generation)
export function getGenerationCost(
  model: VideoModel,
  videoDuration?: string,
  videoQuality?: PersistedVideoQuality,
  options?: { hasVideoInput?: boolean }
): number {
  const normalizedCloneQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  const duration = Number(videoDuration);
  if (model === 'seedance_2') {
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedCloneQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    return Math.ceil(Math.ceil(duration) * perSecondCost);
  }

  if (model === 'seedance_2_fast') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_FAST_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedCloneQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    return Math.ceil(Math.ceil(duration) * perSecondCost);
  }

  if (model === 'seedance_2_mini') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return 0;
    }
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_MINI_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedCloneQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    return Math.ceil(Math.ceil(duration) * perSecondCost);
  }

  return Math.ceil(duration) * GENERATION_COSTS[model];
}

export function getSegmentVideoGenerationCost(
  model: VideoModel,
  segmentDurationSeconds?: number,
  videoQuality?: PersistedVideoQuality,
  options?: { hasVideoInput?: boolean }
): number {
  const normalizedCloneQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  if (model === 'seedance_2_fast' || model === 'seedance_2' || model === 'seedance_2_mini') {
    return getCloneSegmentVideoGenerationCost(model, segmentDurationSeconds, normalizedCloneQuality, options);
  }

  return 0;
}

// Get download cost (ALL downloads are FREE in Version 2.0)
export function getDownloadCost(
  model: VideoModel,
  videoDuration?: string | null,
  segmentCount?: number | null
): number {
  // Version 2.0: ALL downloads are FREE
  return 0;
}

// Get replica photo credit cost for a specific resolution (defaults to 2K pricing)
export function getReplicaPhotoCredits(resolution?: ReplicaPhotoResolution): number {
  const resolved = resolution ? REPLICA_PHOTO_CREDITS[resolution] : undefined;
  return typeof resolved === 'number' ? resolved : REPLICA_PHOTO_CREDITS['1K'];
}

// Get processing time for video model
export function getProcessingTime(model: keyof typeof MODEL_PROCESSING_TIMES): string {
  return MODEL_PROCESSING_TIMES[model]
}

// Check if user has sufficient credits for a model
// Version 2.0: ALL models require credits at generation time
export function canAffordModel(userCredits: number, model: VideoModel): boolean {
  return userCredits >= GENERATION_COSTS[model];
}

// Map product_id to credits and package info
export function getCreditsFromProductId(productId: string): { credits: number; packageName: string } | null {
  const liteId = process.env.LITE_PACK_CREEM_ID
  const plusId = process.env.PLUS_PACK_CREEM_ID
  const proId = process.env.PRO_PACK_CREEM_ID
  const ultraId = process.env.ULTRA_PACK_CREEM_ID

  if (productId === liteId) {
    return {
      credits: PACKAGES.lite.credits,
      packageName: 'lite'
    }
  }

  if (productId === plusId) {
    return {
      credits: PACKAGES.plus.credits,
      packageName: 'plus'
    }
  }

  if (productId === proId) {
    return {
      credits: PACKAGES.basic.credits,
      packageName: 'basic'
    }
  }

  if (productId === ultraId) {
    return {
      credits: PACKAGES.pro.credits,
      packageName: 'pro'
    }
  }

  return null
}


// KIE API credit threshold for service availability (configurable via env)
export const KIE_CREDIT_THRESHOLD = (() => {
  const raw = process.env.KIE_CREDIT_THRESHOLD;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();


// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Complete workflow cost breakdown:
// - Image description: ~1-2 credits (AI Gateway model call) - FREE for users
// - Prompt generation: ~1-2 credits (AI Gateway model call) - FREE for users
// - Cover generation: 0 credits (GPT Image 2) - FREE
// - Video generation: model-specific per-second pricing
// - Video download: FREE (no credits charged)
// Total for complete workflow varies by model and duration

// Get video aspect ratio options for a specific model
export function getVideoAspectRatioOptions(model: VideoModel): readonly string[] {
  return VIDEO_ASPECT_RATIO_OPTIONS[model]
}

// Video model capabilities based on quality and duration
export type VideoQuality = 'standard' | 'high';
export type CloneVideoQuality = '480p' | '720p' | '1080p' | '4k';
export type PersistedVideoQuality = VideoQuality | CloneVideoQuality;
export type VideoDuration = `${number}`;
// Video model display names for UI
export const VIDEO_MODEL_DISPLAY_NAMES: Record<VideoModel, string> = {
  'seedance_2_mini': 'Seedance 2 Mini',
  'seedance_2_fast': 'Seedance 2 Fast',
  'seedance_2': 'Seedance 2',
} as const;

export function getVideoModelDisplayName(model: VideoModel): string {
  return VIDEO_MODEL_DISPLAY_NAMES[model];
}

export const LANDING_PRICING_VIDEO_MODELS: readonly VideoModel[] = [
  'seedance_2_mini',
  'seedance_2_fast',
  'seedance_2',
] as const;

export function getApproxVideoMinutesFromCredits(
  credits: number,
  model: VideoModel,
): number {
  if (!Number.isFinite(credits) || credits <= 0) {
    return 0;
  }

  return credits / GENERATION_COSTS[model] / 60;
}

export function formatApproxVideoMinutesFromCredits(
  credits: number,
  model: VideoModel,
): string {
  return `≈ ${getApproxVideoMinutesFromCredits(credits, model).toFixed(1)} min`;
}

export type PackageModelDurationRow = {
  model: VideoModel;
  label: string;
  durationLabel: string;
  durationLabels?: string[];
};

// Single canonical model benchmark for plan-card copy: Seedance 2 Mini at 480p,
// no reference video input. Returns the count of full 15-second clips a plan's
// credits can cover, given the constant per-second cost (9.5 credits/sec at
// 480p). Any fractional remainder is dropped — only whole videos are counted.
// e.g. Lite 1930 / 9.5 / 15 = 13.54 → 13.
export function getPackageSeedance2Mini15sVideoCount(packageName: keyof typeof PACKAGES): number {
  const credits = PACKAGES[packageName].credits;
  const perSecondCost = SEEDANCE_2_MINI_QUALITY_COSTS['480p'];
  return Math.floor(credits / perSecondCost / 15);
}

export function getPackageModelDurationRows(
  packageName: keyof typeof PACKAGES,
  models: readonly VideoModel[] = LANDING_PRICING_VIDEO_MODELS
): PackageModelDurationRow[] {
  const credits = PACKAGES[packageName].credits;

  return models.map((model) => ({
      model,
      label: getVideoModelDisplayName(model),
      durationLabel: formatApproxVideoMinutesFromCredits(credits, model),
  }));
}

export function getDefaultCloneVideoQuality(model: VideoModel): CloneVideoQuality {
  if (model === 'seedance_2') {
    return '720p';
  }
  if (model === 'seedance_2_fast' || model === 'seedance_2_mini') {
    return '720p';
  }
  return '720p';
}

export function normalizeCloneVideoQualityForModel(
  model: VideoModel,
  quality?: PersistedVideoQuality | null
): CloneVideoQuality {
  const normalized = quality === 'standard'
    ? '720p'
    : quality === 'high'
      ? '1080p'
      : quality;

  if (model === 'seedance_2') {
    return normalized === '480p' || normalized === '720p' || normalized === '1080p'
      ? normalized
      : '720p';
  }

  if (model === 'seedance_2_fast') {
    return normalized === '480p' || normalized === '720p'
      ? normalized
      : '720p';
  }

  if (model === 'seedance_2_mini') {
    return normalized === '480p' || normalized === '720p'
      ? normalized
      : '720p';
  }

  return getDefaultCloneVideoQuality(model);
}

export function mapCloneQualityToSeedanceResolution(
  quality?: PersistedVideoQuality | null
): '480p' | '720p' | '1080p' {
  const normalized = quality === 'standard'
    ? '720p'
    : quality === 'high'
      ? '1080p'
      : quality;
  return normalized === '480p' || normalized === '1080p' ? normalized : '720p';
}

export function getCloneSegmentVideoGenerationCost(
  model: VideoModel,
  segmentDurationSeconds?: number,
  videoQuality?: PersistedVideoQuality | null,
  options?: { hasVideoInput?: boolean }
): number {
  const normalizedQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  if (model === 'seedance_2') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : 0;
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    return Math.ceil(effectiveDuration * perSecondCost);
  }

  if (model === 'seedance_2_fast') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : 0;
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_FAST_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    return Math.ceil(effectiveDuration * perSecondCost);
  }

  if (model === 'seedance_2_mini') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : 0;
    const priceTable = options?.hasVideoInput
      ? SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_MINI_QUALITY_COSTS;
    const perSecondCost = priceTable[normalizedQuality as keyof typeof priceTable]
      ?? priceTable['720p'];
    return Math.ceil(effectiveDuration * perSecondCost);
  }

  return 0;
}

export type MotionCloneQuality = keyof typeof MOTION_CLONE_QUALITY_COSTS;

export function normalizeMotionCloneQuality(
  quality?: string | null
): MotionCloneQuality {
  return quality === '480p' ? '480p' : '720p';
}

export function getMotionCloneGenerationCost(
  durationSeconds?: number | null,
  quality?: string | null,
  model: VideoModel = 'seedance_2_mini'
): number {
  const normalizedQuality = normalizeMotionCloneQuality(quality);
  const duration = Number(durationSeconds);
  const effectiveDuration = Number.isFinite(duration) && duration > 0
    ? Math.ceil(duration)
    : 0;

  const table = model === 'seedance_2'
    ? SEEDANCE_2_WITH_VIDEO_INPUT_QUALITY_COSTS
    : model === 'seedance_2_fast'
      ? SEEDANCE_2_FAST_WITH_VIDEO_INPUT_QUALITY_COSTS
      : SEEDANCE_2_MINI_WITH_VIDEO_INPUT_QUALITY_COSTS;
  return Math.ceil(effectiveDuration * (table[normalizedQuality] ?? table['720p']));
}

interface ModelCapabilities {
  model: VideoModel;
  supportedQualities: VideoQuality[];
  supportedDurations: VideoDuration[];
}

// Define which models support which quality/duration combinations
export const MODEL_CAPABILITIES: ModelCapabilities[] = [
  {
    model: 'seedance_2_mini',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 12 }, (_, index) => String(index + 4) as VideoDuration)
  },
  {
    model: 'seedance_2_fast',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 12 }, (_, index) => String(index + 4) as VideoDuration)
  },
  {
    model: 'seedance_2',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 12 }, (_, index) => String(index + 4) as VideoDuration)
  },
];

// Get available video models based on selected quality and duration
export function getAvailableModels(
  quality: VideoQuality,
  duration: VideoDuration
): VideoModel[] {
  return MODEL_CAPABILITIES
    .filter(cap =>
      cap.supportedQualities.includes(quality) &&
      cap.supportedDurations.includes(duration)
    )
    .map(cap => cap.model);
}

// Check if a model supports the given quality and duration
export function modelSupports(
  model: VideoModel,
  quality: VideoQuality,
  duration: VideoDuration
): boolean {
  const capability = MODEL_CAPABILITIES.find(cap => cap.model === model);
  if (!capability) return false;

  return (
    capability.supportedQualities.includes(quality) &&
    capability.supportedDurations.includes(duration)
  );
}

// Get supported durations for a specific model (optionally filtered by quality)
export function getModelSupportedDurations(model: VideoModel, quality?: VideoQuality): VideoDuration[] {
  const capability = MODEL_CAPABILITIES.find(cap => cap.model === model);

  if (!capability) {
    return [];
  }

  // If quality is provided, check if the model supports that quality
  if (quality && !capability.supportedQualities.includes(quality)) {
    return [];
  }

  // Return all supported durations for this model (sorted)
  return [...capability.supportedDurations].sort((a, b) => Number(a) - Number(b));
}

// Get available durations for a given quality
export function getAvailableDurations(quality: VideoQuality, models: VideoModel[] = MODEL_CAPABILITIES.map(cap => cap.model)): VideoDuration[] {
  const durations = new Set<VideoDuration>();

  MODEL_CAPABILITIES.forEach(cap => {
    if (!models.includes(cap.model)) {
      return;
    }
    if (cap.supportedQualities.includes(quality)) {
      cap.supportedDurations.forEach(d => durations.add(d));
    }
  });

  return Array.from(durations).sort((a, b) => Number(a) - Number(b));
}

// Get available qualities for a given duration
export function getAvailableQualities(duration: VideoDuration): VideoQuality[] {
  const qualities = new Set<VideoQuality>();

  MODEL_CAPABILITIES.forEach(cap => {
    if (cap.supportedDurations.includes(duration)) {
      cap.supportedQualities.forEach(q => qualities.add(q));
    }
  });

  return Array.from(qualities);
}

export const SEEDANCE_MIN_TASK_DURATION_SECONDS = 4;
export const SEEDANCE_MAX_TASK_DURATION_SECONDS = 15;
export const SEEDANCE_MAX_PROJECT_DURATION_SECONDS = 60;

export function getSegmentDurationForModel(model?: VideoModel | null): number {
  if (model === 'seedance_2_fast' || model === 'seedance_2' || model === 'seedance_2_mini') {
    return SEEDANCE_MAX_TASK_DURATION_SECONDS;
  }
  return 0;
}

export function getSegmentCountFromDuration(videoDuration?: string | null, model?: VideoModel): number {
  if (model === 'seedance_2_fast' || model === 'seedance_2' || model === 'seedance_2_mini') {
    const seedanceDuration = Number(videoDuration);
    if (!Number.isFinite(seedanceDuration) || seedanceDuration <= 0) {
      return 0;
    }
    if (seedanceDuration <= SEEDANCE_MAX_TASK_DURATION_SECONDS) {
      return 1;
    }
    return Math.max(1, Math.ceil(seedanceDuration / SEEDANCE_MAX_TASK_DURATION_SECONDS));
  }

  return 0;
}

export function snapDurationToModel(model: VideoModel, targetSeconds: number): VideoDuration {
  if (model === 'seedance_2_fast' || model === 'seedance_2' || model === 'seedance_2_mini') {
    const normalized = Math.round(targetSeconds);
    const bounded = Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(SEEDANCE_MAX_PROJECT_DURATION_SECONDS, normalized));
    return String(bounded) as VideoDuration;
  }

  return String(Math.max(1, Math.round(targetSeconds))) as VideoDuration;
}

// Calculate cost for a model based on quality and duration
export function getModelCostByConfig(
  model: VideoModel,
  quality: PersistedVideoQuality,
  duration: VideoDuration,
  options?: { hasVideoInput?: boolean }
): number {
  return getGenerationCost(model, duration, quality, options);
}

// Get best model recommendation based on credits, quality, and duration
export function getRecommendedModel(
  userCredits: number,
  quality: VideoQuality,
  duration: VideoDuration
): VideoModel | null {
  const availableModels = getAvailableModels(quality, duration);

  // Sort by cost (cheapest first)
  const affordableModels = availableModels
    .map(model => ({
      model,
      cost: getModelCostByConfig(model, quality, duration)
    }))
    .filter(m => userCredits >= m.cost)
    .sort((a, b) => a.cost - b.cost);

  return affordableModels[0]?.model || null;
}

// ===== LANGUAGE SUPPORT =====

export type LanguageCode =
  | 'en' | 'zh' | 'zh_yue' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'pt';

export const SUPPORTED_LANGUAGE_CODES: LanguageCode[] = [
  'en', 'zh', 'zh_yue', 'ja', 'ko', 'es', 'fr', 'de', 'pt'
];

// Language code to display name mapping
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': 'Chinese (Mandarin)',
  'zh_yue': 'Chinese (Cantonese)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'pt': 'Portuguese'
} as const;

// Language code to native name mapping
export const LANGUAGE_NATIVE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': '中文（普通话）',
  'zh_yue': '中文粤语',
  'ja': '日本語',
  'ko': '한국어',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'pt': 'Português'
} as const;

// Language code to natural language name for AI prompts
export const LANGUAGE_PROMPT_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': 'Chinese (Mandarin)',
  'zh_yue': 'Chinese (Cantonese)',
  'ja': 'Japanese (日本語)',
  'ko': 'Korean (한국어)',
  'es': 'Spanish (Español)',
  'fr': 'French (Français)',
  'de': 'German (Deutsch)',
  'pt': 'Portuguese (Português)'
} as const;

// Get language display name
export function getLanguageName(code: LanguageCode): string {
  return LANGUAGE_NAMES[code];
}

// Get language native name
export function getLanguageNativeName(code: LanguageCode): string {
  return LANGUAGE_NATIVE_NAMES[code];
}

// Get language name for AI prompts
export function getLanguagePromptName(code: LanguageCode): string {
  const name = LANGUAGE_PROMPT_NAMES[code];

  // Defensive check: log if undefined
  if (!name) {
    console.error(`❌ getLanguagePromptName: No mapping found for language code "${code}"`);
    console.error(`Type of code: ${typeof code}, Value: ${JSON.stringify(code)}`);
    console.error(`Available codes: ${Object.keys(LANGUAGE_PROMPT_NAMES).join(', ')}`);

    // Fallback to English to prevent undefined
    return 'English';
  }

  return name;
}

// Get language-specific voice style for video generation
// Maps language codes to appropriate accent descriptions for AI voice generation
export function getLanguageVoiceStyle(code: LanguageCode): string {
  const voiceStyleMap: Record<LanguageCode, string> = {
    'en': 'English accent',
    'zh': 'Mandarin Chinese accent',
    'zh_yue': 'Cantonese Chinese accent',
    'ja': 'Japanese accent',
    'ko': 'Korean accent',
    'es': 'Spanish accent',
    'fr': 'French accent',
    'de': 'German accent',
    'pt': 'Portuguese accent'
  };

  return voiceStyleMap[code] || 'English accent'; // fallback to English
}

// ===== VIDEO ANALYSIS SIZE LIMITS =====
// Limits for reference video analysis to ensure API compatibility

/**
 * Maximum video file size for reference video analysis (bytes)
 *
 * Rationale:
 * - Keep uploads within provider expectations for video_url analysis
 * - 20 MB is the maximum supported upload size
 */
export const MAX_COMPETITOR_VIDEO_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Maximum Base64-encoded video size for API requests (bytes)
 * Allows headroom for Base64 expansion on 20 MB uploads
 */
export const MAX_BASE64_VIDEO_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
