// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Active dashboard model selection: Seedance 2 Fast, Seedance 2, Kling 3.0
// ALL models: PAID generation, FREE download

// Generation costs (ALL models charge at generation time)
export const GENERATION_COSTS = {
  'seedance_2_fast': 33, // Seedance 2 Fast: 33 credits per second
  'seedance_2': 41, // Seedance 2: 41 credits per second
  'kling_3': 27, // Kling 3.0 Pro (1080p + audio): 27 credits per second
  'wan_27': 24 // Wan 2.7 (1080p): 24 credits per second
} as const;

export const SEEDANCE_2_QUALITY_COSTS = {
  '720p': 41,
  '1080p': 102
} as const;

export const KLING_QUALITY_COSTS = {
  '720p': 20,
  '1080p': 27
} as const;

export const MOTION_CLONE_QUALITY_COSTS = {
  '720p': 20,
  '1080p': 27
} as const;

// DEPRECATED: Legacy CREDIT_COSTS for backwards compatibility
export const CREDIT_COSTS = {
  'seedance_2_fast': 33,
  'seedance_2': 41
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
  'seedance_2_fast': ['16:9', '9:16'],
  'seedance_2': ['16:9', '9:16'],
  'kling_3': ['16:9', '9:16'],
  'wan_27': ['16:9', '9:16']
} as const
// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'seedance_2_fast': '1-2 min',
  'seedance_2': '2-4 min',
  'kling_3': '2-4 min',            // Kling 3.0 Pro: 2-4 minutes processing time
  'wan_27': '2-4 min'              // Wan 2.7: 2-4 minutes processing time
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
    name: 'Basic',
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
    name: 'Pro',
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
export function getPackageByName(packageName: 'lite' | 'basic' | 'pro') {
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
  videoQuality?: PersistedVideoQuality
): number {
  const normalizedCloneQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  const duration = Number(videoDuration);
  if (model === 'kling_3') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return KLING_QUALITY_COSTS[normalizedCloneQuality === '1080p' ? '1080p' : '720p'] * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    const perSecondCost = normalizedCloneQuality === '1080p'
      ? KLING_QUALITY_COSTS['1080p']
      : KLING_QUALITY_COSTS['720p'];
    return Math.ceil(duration) * perSecondCost;
  }

  if (model === 'seedance_2') {
    const perSecondCost = normalizedCloneQuality === '1080p'
      ? SEEDANCE_2_QUALITY_COSTS['1080p']
      : SEEDANCE_2_QUALITY_COSTS['720p'];
    if (!Number.isFinite(duration) || duration <= 0) {
      return perSecondCost * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    return Math.ceil(duration) * perSecondCost;
  }

  if (model === 'seedance_2_fast') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return GENERATION_COSTS[model] * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    return Math.ceil(duration) * GENERATION_COSTS[model];
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return GENERATION_COSTS[model] * DEFAULT_SEGMENT_DURATION_SECONDS;
  }

  return Math.ceil(duration) * GENERATION_COSTS[model];
}

export function getSegmentVideoGenerationCost(
  model: VideoModel,
  segmentDurationSeconds?: number,
  videoQuality?: PersistedVideoQuality
): number {
  const normalizedCloneQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  if (model === 'kling_3') {
    const duration = Number(segmentDurationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return KLING_QUALITY_COSTS[normalizedCloneQuality === '1080p' ? '1080p' : '720p'] * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    const perSecondCost = normalizedCloneQuality === '1080p'
      ? KLING_QUALITY_COSTS['1080p']
      : KLING_QUALITY_COSTS['720p'];
    return Math.ceil(duration) * perSecondCost;
  }

  if (model === 'seedance_2_fast' || model === 'seedance_2' || model === 'wan_27') {
    return getCloneSegmentVideoGenerationCost(model, segmentDurationSeconds, normalizedCloneQuality);
  }

  return GENERATION_COSTS[model] * DEFAULT_SEGMENT_DURATION_SECONDS;
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
  // Get environment-specific product IDs
  const liteDevId = process.env.LITE_PACK_CREEM_DEV_ID
  const liteProdId = process.env.LITE_PACK_CREEM_PROD_ID
  const basicDevId = process.env.BASIC_PACK_CREEM_DEV_ID
  const basicProdId = process.env.BASIC_PACK_CREEM_PROD_ID
  const proDevId = process.env.PRO_PACK_CREEM_DEV_ID
  const proProdId = process.env.PRO_PACK_CREEM_PROD_ID

  if (productId === liteDevId || productId === liteProdId) {
    return {
      credits: PACKAGES.lite.credits,
      packageName: 'lite'
    }
  }

  if (productId === basicDevId || productId === basicProdId) {
    return {
      credits: PACKAGES.basic.credits,
      packageName: 'basic'
    }
  }
  
  if (productId === proDevId || productId === proProdId) {
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
export type VideoModel = 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';

// Video model display names for UI
export const VIDEO_MODEL_DISPLAY_NAMES: Record<VideoModel, string> = {
  'seedance_2_fast': 'Seedance 2 Fast',
  'seedance_2': 'Seedance 2',
  'kling_3': 'Kling 3.0',
  'wan_27': 'Wan 2.7'
} as const;

export function getVideoModelDisplayName(model: VideoModel): string {
  return VIDEO_MODEL_DISPLAY_NAMES[model];
}

export const LANDING_PRICING_VIDEO_MODELS: readonly VideoModel[] = [
  'seedance_2_fast',
  'seedance_2',
  'kling_3',
  'wan_27'
] as const;

export function getApproxVideoMinutesFromCredits(
  credits: number,
  model: VideoModel,
  klingQuality: keyof typeof KLING_QUALITY_COSTS = '1080p'
): number {
  if (!Number.isFinite(credits) || credits <= 0) {
    return 0;
  }

  if (model === 'kling_3') {
    return credits / KLING_QUALITY_COSTS[klingQuality] / 60;
  }

  return credits / GENERATION_COSTS[model] / 60;
}

export function formatApproxVideoMinutesFromCredits(
  credits: number,
  model: VideoModel,
  klingQuality: keyof typeof KLING_QUALITY_COSTS = '1080p'
): string {
  return `≈ ${getApproxVideoMinutesFromCredits(credits, model, klingQuality).toFixed(1)} min`;
}

export type PackageModelDurationRow = {
  model: VideoModel;
  label: string;
  durationLabel: string;
  durationLabels?: string[];
};

export function getPackageModelDurationRows(
  packageName: keyof typeof PACKAGES,
  models: readonly VideoModel[] = LANDING_PRICING_VIDEO_MODELS
): PackageModelDurationRow[] {
  const credits = PACKAGES[packageName].credits;

  return models.map((model) => {
    if (model === 'kling_3') {
      const durationLabels = [
        `720p ${formatApproxVideoMinutesFromCredits(credits, model, '720p')}`,
        `1080p ${formatApproxVideoMinutesFromCredits(credits, model, '1080p')}`,
      ];

      return {
        model,
        label: getVideoModelDisplayName(model),
        durationLabel: durationLabels.join(' / '),
        durationLabels,
      };
    }

    return {
      model,
      label: getVideoModelDisplayName(model),
      durationLabel: formatApproxVideoMinutesFromCredits(credits, model),
    };
  });
}

export function getDefaultCloneVideoQuality(model: VideoModel): CloneVideoQuality {
  if (model === 'wan_27') {
    return '1080p';
  }
  if (model === 'seedance_2') {
    return '1080p';
  }
  if (model === 'kling_3' || model === 'seedance_2_fast') {
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

  if (model === 'wan_27') {
    return normalized === '1080p' ? '1080p' : '1080p';
  }

  if (model === 'kling_3') {
    return normalized === '1080p' ? '1080p' : '720p';
  }

  if (model === 'seedance_2') {
    return normalized === '720p' ? '720p' : '1080p';
  }

  if (model === 'seedance_2_fast') {
    return '720p';
  }

  return getDefaultCloneVideoQuality(model);
}

export function mapCloneQualityToKlingMode(quality?: PersistedVideoQuality | null): 'std' | 'pro' {
  const normalized = normalizeCloneVideoQualityForModel('kling_3', quality);
  return normalized === '1080p' ? 'pro' : 'std';
}

export function mapCloneQualityToSeedanceResolution(
  quality?: PersistedVideoQuality | null
): '720p' | '1080p' {
  const normalized = quality === 'standard'
    ? '720p'
    : quality === 'high'
      ? '1080p'
      : quality;
  return normalized === '1080p' ? '1080p' : '720p';
}

export function getCloneSegmentVideoGenerationCost(
  model: VideoModel,
  segmentDurationSeconds?: number,
  videoQuality?: PersistedVideoQuality | null
): number {
  const normalizedQuality = normalizeCloneVideoQualityForModel(model, videoQuality);

  if (model === 'kling_3') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : DEFAULT_SEGMENT_DURATION_SECONDS;
    const perSecondCost = normalizedQuality === '1080p'
      ? KLING_QUALITY_COSTS['1080p']
      : KLING_QUALITY_COSTS['720p'];
    return effectiveDuration * perSecondCost;
  }

  if (model === 'seedance_2') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : DEFAULT_SEGMENT_DURATION_SECONDS;
    const perSecondCost = normalizedQuality === '1080p'
      ? SEEDANCE_2_QUALITY_COSTS['1080p']
      : SEEDANCE_2_QUALITY_COSTS['720p'];
    return effectiveDuration * perSecondCost;
  }

  if (model === 'seedance_2_fast' || model === 'wan_27') {
    const duration = Number(segmentDurationSeconds);
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? Math.ceil(duration)
      : DEFAULT_SEGMENT_DURATION_SECONDS;
    return effectiveDuration * GENERATION_COSTS[model];
  }

  return GENERATION_COSTS[model] * DEFAULT_SEGMENT_DURATION_SECONDS;
}

export type MotionCloneQuality = keyof typeof MOTION_CLONE_QUALITY_COSTS;

export function normalizeMotionCloneQuality(
  quality?: string | null
): MotionCloneQuality {
  return quality === '1080p' ? '1080p' : '720p';
}

export function getMotionCloneGenerationCost(
  durationSeconds?: number | null,
  quality?: string | null
): number {
  const normalizedQuality = normalizeMotionCloneQuality(quality);
  const duration = Number(durationSeconds);
  const effectiveDuration = Number.isFinite(duration) && duration > 0
    ? Math.ceil(duration)
    : 0;

  return effectiveDuration * MOTION_CLONE_QUALITY_COSTS[normalizedQuality];
}

interface ModelCapabilities {
  model: VideoModel;
  supportedQualities: VideoQuality[];
  supportedDurations: VideoDuration[];
}

// Define which models support which quality/duration combinations
export const MODEL_CAPABILITIES: ModelCapabilities[] = [
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
  {
    model: 'kling_3',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 58 }, (_, index) => String(index + 3) as VideoDuration)
  },
  {
    model: 'wan_27',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 14 }, (_, index) => String(index + 2) as VideoDuration)
  }
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
    // Fallback to default if model not found
    return ['8'] as VideoDuration[];
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

export const DEFAULT_SEGMENT_DURATION_SECONDS = 8;
export const KLING_MAX_TASK_DURATION_SECONDS = 15;
export const KLING_MIN_TASK_DURATION_SECONDS = 3;
export const KLING_MAX_PROJECT_DURATION_SECONDS = 60;
export const SEEDANCE_MIN_TASK_DURATION_SECONDS = 4;
export const SEEDANCE_MAX_TASK_DURATION_SECONDS = 15;
export const SEEDANCE_MAX_PROJECT_DURATION_SECONDS = 60;

export function getSegmentDurationForModel(model?: VideoModel | null): number {
  if (model === 'kling_3' || model === 'seedance_2_fast' || model === 'seedance_2') {
    return KLING_MAX_TASK_DURATION_SECONDS;
  }
  if (model === 'wan_27') {
    return 15; // Wan 2.7 max task duration is 15s
  }
  return DEFAULT_SEGMENT_DURATION_SECONDS;
}

export function getSegmentCountFromDuration(videoDuration?: string | null, model?: VideoModel): number {
  if (model === 'kling_3' || model === 'seedance_2_fast' || model === 'seedance_2') {
    const klingDuration = Number(videoDuration);
    if (!Number.isFinite(klingDuration) || klingDuration <= KLING_MAX_TASK_DURATION_SECONDS) {
      return 1;
    }
    return Math.max(1, Math.ceil(klingDuration / KLING_MAX_TASK_DURATION_SECONDS));
  }

  if (model === 'wan_27') {
    const wanDuration = Number(videoDuration);
    const wanMaxDuration = 15;
    if (!Number.isFinite(wanDuration) || wanDuration <= wanMaxDuration) {
      return 1;
    }
    return Math.max(1, Math.ceil(wanDuration / wanMaxDuration));
  }

  const duration = Number(videoDuration);
  const segmentLength = getSegmentDurationForModel(model ?? null);
  const maxSegments = 8; // Maximum 8 segments (64 seconds)

  if (!Number.isFinite(duration) || duration <= segmentLength) {
    return 1;
  }

  const segments = Math.min(maxSegments, Math.ceil(duration / segmentLength));
  return Math.max(1, segments);
}

export function snapDurationToModel(model: VideoModel, targetSeconds: number): VideoDuration {
  if (model === 'kling_3' || model === 'seedance_2_fast' || model === 'seedance_2') {
    const normalized = Math.round(targetSeconds);
    const minDuration = model === 'kling_3' ? KLING_MIN_TASK_DURATION_SECONDS : SEEDANCE_MIN_TASK_DURATION_SECONDS;
    const bounded = Math.max(minDuration, Math.min(KLING_MAX_PROJECT_DURATION_SECONDS, normalized));
    return String(bounded) as VideoDuration;
  }

  if (model === 'wan_27') {
    const normalized = Math.round(targetSeconds);
    const bounded = Math.max(2, Math.min(15, normalized));
    return String(bounded) as VideoDuration;
  }

  const supportedDurations = [8, 16, 24, 32, 40, 48, 56, 64]; // Segment-priced models support 8s steps

  if (targetSeconds <= 8) return '8';
  if (targetSeconds >= 64) return '64';

  // Find closest supported duration
  const closest = supportedDurations.reduce((prev, curr) =>
    Math.abs(curr - targetSeconds) < Math.abs(prev - targetSeconds) ? curr : prev
  );

  return String(closest) as VideoDuration;
}

// Calculate cost for a model based on quality and duration
export function getModelCostByConfig(
  model: VideoModel,
  quality: PersistedVideoQuality,
  duration: VideoDuration
): number {
  return getGenerationCost(model, duration, quality);
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
