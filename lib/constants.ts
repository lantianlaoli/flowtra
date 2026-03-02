// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Simplified model selection: veo3 and veo3_fast only
// ALL models: PAID generation, FREE download

// Generation costs (ALL models charge at generation time)
export const GENERATION_COSTS = {
  'veo3': 150,           // Veo3.1: 150 credits per 8s segment
  'veo3_fast': 20,       // Veo3.1 fast: 20 credits per 8s segment
  'seedance_1_5_pro': 120, // Seedance 1.5 Pro: 120 credits per 8s segment (1080p with audio)
  'kling_3': 40 // Kling 3.0 Pro (1080P + audio): 40 credits per second
} as const;

// DEPRECATED: Legacy CREDIT_COSTS for backwards compatibility
export const CREDIT_COSTS = {
  'veo3_fast': 20,
  'veo3': 150
} as const;

export const HIGH_RES_DOWNLOAD_COSTS = {
  '1080p': 5,
  '4k': 40
} as const;

export type HighResResolution = '720p' | keyof typeof HIGH_RES_DOWNLOAD_COSTS;

// NOTE: Platform presets have been removed
// Platform selection is no longer a feature of the system

export const NON_AGENT_IMAGE_MODEL = 'nano-banana-2' as const;
export const NON_AGENT_IMAGE_RESOLUTION = '1K' as const;
export const NON_AGENT_IMAGE_OUTPUT_FORMAT = 'png' as const;

// Image models for cover generation
export const IMAGE_MODELS = {
  'nano_banana': 'google/nano-banana-edit',
  'nano_banana_2': 'nano-banana-2',
  'seedream': 'bytedance/seedream-v4-edit',
  'seedream_5_lite': 'seedream/5-lite-image-to-image',
  'nano_banana_pro': 'nano-banana-pro'
} as const

// Image size options for different models
export const IMAGE_SIZE_OPTIONS = {
  'nano_banana': [
    'auto',
    'square',
    // 'square_hd' removed for Banana to avoid duplicate 1:1 option
    'portrait_4_3',
    'portrait_3_2',
    'portrait_16_9',
    'portrait_5_4',
    'landscape_4_3',
    'landscape_3_2',
    'landscape_16_9',
    'landscape_5_4',
    'landscape_21_9'
  ],
  'seedream': [
    'auto',
    'square',
    'square_hd', 
    'portrait_4_3',
    'portrait_3_2',
    'portrait_16_9',
    'landscape_4_3',
    'landscape_3_2', 
    'landscape_16_9',
    'landscape_21_9'
  ],
  'nano_banana_pro': [
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
    '21:9'
  ]
} as const

// Video aspect ratio options for different models
export const VIDEO_ASPECT_RATIO_OPTIONS = {
  'veo3': ['16:9', '9:16'],
  'veo3_fast': ['16:9', '9:16'],
  'seedance_1_5_pro': ['16:9', '9:16'],
  'kling_3': ['16:9', '9:16']
} as const

// Credit costs for different image models (all free)
export const IMAGE_CREDIT_COSTS = {
  'nano_banana': 0,    // Nano Banana: Free, fast generation
  'nano_banana_2': 0,  // Nano Banana 2: Agent default image model
  'seedream': 0,       // Seedream 4.0: Free, high quality generation
  'nano_banana_pro': 24 // Replica mode: 24 credits per generation
} as const
// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'veo3_fast': '2-3 min',         // Veo3.1 fast: 2-3 minutes processing time
  'veo3': '5-8 min',              // Veo3.1: 5-8 minutes processing time
  'seedance_1_5_pro': '1-2 min',  // Seedance 1.5 Pro: 1-2 minutes processing time
  'kling_3': '2-4 min'            // Kling 3.0 Pro: 2-4 minutes processing time
} as const

// Processing times for different image models
export const IMAGE_PROCESSING_TIMES = {
  'nano_banana': '1-2 min',    // Nano Banana: 1-2 minutes processing time
  'nano_banana_2': '1-2 min',  // Nano Banana 2: Fast image generation
  'seedream': '2-4 min',       // Seedream 4.0: 2-4 minutes processing time
  'nano_banana_pro': '1-2 min'
} as const
// Replica photo generation credits (competitor photo mode)
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
      '≈ 96 Veo3.1 fast videos (8s)',
      'or ≈ 12 Veo3.1 videos (8s)',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 96,   // 1930 / 20 ≈ 96
      veo3: 12         // 1930 / 150 ≈ 12
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
      '≈ 196 Veo3.1 fast videos (8s)',
      'or ≈ 26 Veo3.1 videos (8s)',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 196,  // 3930 / 20 ≈ 196
      veo3: 26         // 3930 / 150 ≈ 26
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
      '≈ 330 Veo3.1 fast videos (8s)',
      'or ≈ 44 Veo3.1 videos (8s)',
      'AI-powered video generation',
      'Priority processing queue'
    ],
    videoEstimates: {
      veo3_fast: 330,  // 6600 / 20 = 330
      veo3: 44         // 6600 / 150 = 44
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
  _videoQuality?: 'standard' | 'high' // Ignored, kept for backwards compatibility
): number {
  const duration = Number(videoDuration);
  if (model === 'kling_3') {
    if (!Number.isFinite(duration) || duration <= 0) {
      return GENERATION_COSTS.kling_3 * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    return Math.ceil(duration) * GENERATION_COSTS.kling_3;
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return GENERATION_COSTS[model]; // One segment (8s)
  }

  const segments = Math.ceil(duration / 8); // All veo3 models use 8-second segments
  return GENERATION_COSTS[model] * segments;
}

export function getSegmentVideoGenerationCost(
  model: VideoModel,
  segmentDurationSeconds?: number
): number {
  if (model === 'kling_3') {
    const duration = Number(segmentDurationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
      return GENERATION_COSTS.kling_3 * DEFAULT_SEGMENT_DURATION_SECONDS;
    }
    return Math.ceil(duration) * GENERATION_COSTS.kling_3;
  }

  return GENERATION_COSTS[model];
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

// Auto mode intelligent image model selection (prioritize seedream for better aspect ratio support)
export function getAutoImageModeSelection(): 'nano_banana' | 'seedream' {
  // Return seedream as default since it supports more aspect ratios (16:9, 9:16)
  return 'seedream'
}

// Check if user has sufficient credits for an image model (always true since free)
 
export function canAffordImageModel(
  _userCredits: number,
  _model: 'auto' | 'nano_banana' | 'nano_banana_2' | 'seedream' | 'nano_banana_pro' | 'seedream_5_lite'
): boolean {
  // All image models are free, so always affordable
  return true
}

// Get the actual image model that will be used (resolves auto to specific model)
export function getActualImageModel(
  selectedModel: 'auto' | 'nano_banana' | 'nano_banana_2' | 'seedream' | 'nano_banana_pro' | 'seedream_5_lite'
): 'nano_banana' | 'nano_banana_2' | 'seedream' | 'nano_banana_pro' | 'seedream_5_lite' {
  if (selectedModel === 'auto') {
    return getAutoImageModeSelection()
  }
  return selectedModel
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

// Default initial credits for new users.
export const INITIAL_FREE_CREDITS = 100

// KIE API credit threshold for service availability (configurable via env)
export const KIE_CREDIT_THRESHOLD = (() => {
  const raw = process.env.KIE_CREDIT_THRESHOLD;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();


// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Complete workflow cost breakdown:
// - Image description: ~1-2 credits (OpenRouter API) - FREE for users
// - Prompt generation: ~1-2 credits (OpenRouter API) - FREE for users
// - Cover generation: 0 credits (Nano Banana 2) - FREE
// - Video generation: 20 credits (Veo3.1 fast, per 8s segment) or 150 credits (Veo3.1, per 8s segment)
// - Video download: FREE (no credits charged)
// Total for complete workflow: 20-1200 credits depending on model and duration
// New users receive a 100-credit welcome bonus.

// Get video aspect ratio options for a specific model
export function getVideoAspectRatioOptions(model: VideoModel): readonly string[] {
  return VIDEO_ASPECT_RATIO_OPTIONS[model]
}

// Video model capabilities based on quality and duration
export type VideoQuality = 'standard' | 'high';
export type VideoDuration = `${number}`;
export type VideoModel = 'veo3' | 'veo3_fast' | 'seedance_1_5_pro' | 'kling_3';

// Video model display names for UI
export const VIDEO_MODEL_DISPLAY_NAMES: Record<VideoModel, string> = {
  'veo3': 'Veo3.1',
  'veo3_fast': 'Veo3.1 fast',
  'seedance_1_5_pro': 'Seedance 1.5 Pro',
  'kling_3': 'Kling 3.0'
} as const;

export function getVideoModelDisplayName(model: VideoModel): string {
  return VIDEO_MODEL_DISPLAY_NAMES[model];
}

interface ModelCapabilities {
  model: VideoModel;
  supportedQualities: VideoQuality[];
  supportedDurations: VideoDuration[];
}

// Define which models support which quality/duration combinations
export const MODEL_CAPABILITIES: ModelCapabilities[] = [
  {
    model: 'veo3',
    supportedQualities: ['standard'],
    supportedDurations: ['8', '16', '24', '32', '40', '48', '56', '64']
  },
  {
    model: 'veo3_fast',
    supportedQualities: ['standard'],
    supportedDurations: ['8', '16', '24', '32', '40', '48', '56', '64']
  },
  {
    model: 'seedance_1_5_pro',
    supportedQualities: ['standard'],
    supportedDurations: ['8', '16', '24', '32', '40', '48', '56', '64']
  },
  {
    model: 'kling_3',
    supportedQualities: ['standard'],
    supportedDurations: Array.from({ length: 58 }, (_, index) => String(index + 3) as VideoDuration)
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

export function getSegmentDurationForModel(model?: VideoModel | null): number {
  if (model === 'kling_3') {
    return KLING_MAX_TASK_DURATION_SECONDS;
  }
  // All non-Kling models use 8-second segments
  return DEFAULT_SEGMENT_DURATION_SECONDS;
}

export function getSegmentCountFromDuration(videoDuration?: string | null, model?: VideoModel): number {
  if (model === 'kling_3') {
    const klingDuration = Number(videoDuration);
    if (!Number.isFinite(klingDuration) || klingDuration <= KLING_MAX_TASK_DURATION_SECONDS) {
      return 1;
    }
    return Math.max(1, Math.ceil(klingDuration / KLING_MAX_TASK_DURATION_SECONDS));
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
  if (model === 'kling_3') {
    const normalized = Math.round(targetSeconds);
    const bounded = Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.min(KLING_MAX_PROJECT_DURATION_SECONDS, normalized));
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
  quality: VideoQuality,
  duration: VideoDuration
): number {
  if (model === 'kling_3') {
    return Number(duration) * GENERATION_COSTS.kling_3;
  }
  // Segment-priced models: cost per segment * number of segments
  const segments = getSegmentCountFromDuration(duration, model);
  return GENERATION_COSTS[model] * segments;
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
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'nl' | 'sv' | 'no' | 'da'
  | 'fi' | 'pl' | 'ru' | 'el' | 'tr' | 'cs' | 'ro' | 'zh' | 'ur' | 'pa' | 'id';

// Language code to display name mapping
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'no': 'Norwegian',
  'da': 'Danish',
  'fi': 'Finnish',
  'pl': 'Polish',
  'ru': 'Russian',
  'el': 'Greek',
  'tr': 'Turkish',
  'cs': 'Czech',
  'ro': 'Romanian',
  'zh': 'Chinese',
  'ur': 'Urdu',
  'pa': 'Punjabi',
  'id': 'Indonesian'
} as const;

// Language code to native name mapping
export const LANGUAGE_NATIVE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'it': 'Italiano',
  'pt': 'Português',
  'nl': 'Nederlands',
  'sv': 'Svenska',
  'no': 'Norsk',
  'da': 'Dansk',
  'fi': 'Suomi',
  'pl': 'Polski',
  'ru': 'Русский',
  'el': 'Ελληνικά',
  'tr': 'Türkçe',
  'cs': 'Čeština',
  'ro': 'Română',
  'zh': '中文',
  'ur': 'اردو',
  'pa': 'ਪੰਜਾਬੀ',
  'id': 'Bahasa Indonesia'
} as const;

// Language code to natural language name for AI prompts
export const LANGUAGE_PROMPT_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'es': 'Spanish (Español)',
  'fr': 'French (Français)',
  'de': 'German (Deutsch)',
  'it': 'Italian (Italiano)',
  'pt': 'Portuguese (Português)',
  'nl': 'Dutch (Nederlands)',
  'sv': 'Swedish (Svenska)',
  'no': 'Norwegian (Norsk)',
  'da': 'Danish (Dansk)',
  'fi': 'Finnish (Suomi)',
  'pl': 'Polish (Polski)',
  'ru': 'Russian (Русский)',
  'el': 'Greek (Ελληνικά)',
  'tr': 'Turkish (Türkçe)',
  'cs': 'Czech (Čeština)',
  'ro': 'Romanian (Română)',
  'zh': 'Chinese (中文)',
  'ur': 'Urdu (اردو)',
  'pa': 'Punjabi (ਪੰਜਾਬੀ)',
  'id': 'Indonesian (Bahasa Indonesia)'
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
    'es': 'Spanish accent',
    'fr': 'French accent',
    'de': 'German accent',
    'it': 'Italian accent',
    'pt': 'Portuguese accent',
    'nl': 'Dutch accent',
    'sv': 'Swedish accent',
    'no': 'Norwegian accent',
    'da': 'Danish accent',
    'fi': 'Finnish accent',
    'pl': 'Polish accent',
    'ru': 'Russian accent',
    'el': 'Greek accent',
    'tr': 'Turkish accent',
    'cs': 'Czech accent',
    'ro': 'Romanian accent',
    'zh': 'Chinese accent',
    'ur': 'Urdu accent',
    'pa': 'Punjabi accent',
    'id': 'Indonesian accent'
  };

  return voiceStyleMap[code] || 'English accent'; // fallback to English
}

// ===== VIDEO ANALYSIS SIZE LIMITS =====
// Limits for competitor video analysis to ensure API compatibility

/**
 * Maximum video file size for competitor ad analysis (bytes)
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
