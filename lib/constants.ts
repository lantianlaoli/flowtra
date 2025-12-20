// ===== VERSION 2.0: UNIFIED GENERATION-TIME BILLING =====
// Simplified model selection: veo3 and veo3_fast only
// ALL models: PAID generation, FREE download

// Generation costs (ALL models charge at generation time)
export const GENERATION_COSTS = {
  'veo3': 150,        // Veo3.1: 150 credits per 8s segment
  'veo3_fast': 20     // Veo3.1 fast: 20 credits per 8s segment
} as const;

// DEPRECATED: Legacy CREDIT_COSTS for backwards compatibility
export const CREDIT_COSTS = {
  'veo3_fast': 20,
  'veo3': 150
} as const;

// ===== PLATFORM PRESETS =====
// Platform-specific recommended configurations
export const PLATFORM_PRESETS = {
  tiktok: {
    format: '9:16' as const,
    duration: '8' as const,
    description: 'Optimized for TikTok short-form vertical videos'
  },
  facebook: {
    format: '16:9' as const,
    duration: '16' as const,
    description: 'Optimized for Facebook horizontal videos'
  },
  instagram: {
    format: '9:16' as const,
    duration: '8' as const,
    description: 'Optimized for Instagram Reels and Stories'
  },
  youtube: {
    format: '16:9' as const,
    duration: '16' as const,
    description: 'Optimized for YouTube Shorts'
  }
} as const;

export type Platform = keyof typeof PLATFORM_PRESETS;

// Image models for cover generation
export const IMAGE_MODELS = {
  'nano_banana': 'google/nano-banana-edit',
  'seedream': 'bytedance/seedream-v4-edit',
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
  'veo3_fast': ['16:9', '9:16']
} as const

// Credit costs for different image models (all free)
export const IMAGE_CREDIT_COSTS = {
  'nano_banana': 0,    // Nano Banana: Free, fast generation
  'seedream': 0,       // Seedream 4.0: Free, high quality generation
  'nano_banana_pro': 24 // Replica mode: 24 credits per generation
} as const

// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'veo3_fast': '2-3 min',    // Veo3.1 fast: 2-3 minutes processing time
  'veo3': '5-8 min'          // Veo3.1: 5-8 minutes processing time
} as const

// Processing times for different image models
export const IMAGE_PROCESSING_TIMES = {
  'nano_banana': '1-2 min',    // Nano Banana: 1-2 minutes processing time
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
  model: 'veo3' | 'veo3_fast',
  videoDuration?: string,
  _videoQuality?: 'standard' | 'high' // Ignored, kept for backwards compatibility
): number {
  const duration = Number(videoDuration);
  if (!Number.isFinite(duration) || duration <= 0) {
    return GENERATION_COSTS[model]; // One segment (8s)
  }

  const segments = Math.ceil(duration / 8); // All veo3 models use 8-second segments
  return GENERATION_COSTS[model] * segments;
}

// Get download cost (ALL downloads are FREE in Version 2.0)
export function getDownloadCost(
  model: 'veo3' | 'veo3_fast',
  videoDuration?: string | null,
  segmentCount?: number | null
): number {
  // Version 2.0: ALL downloads are FREE
  return 0;
}

// Get replica photo credit cost for a specific resolution (defaults to 2K pricing)
export function getReplicaPhotoCredits(resolution?: ReplicaPhotoResolution): number {
  const resolved = resolution ? REPLICA_PHOTO_CREDITS[resolution] : undefined;
  return typeof resolved === 'number' ? resolved : REPLICA_PHOTO_CREDITS['2K'];
}

// Get processing time for video model
export function getProcessingTime(model: keyof typeof MODEL_PROCESSING_TIMES): string {
  return MODEL_PROCESSING_TIMES[model]
}

// Get processing time for image model
export function getImageProcessingTime(model: keyof typeof IMAGE_PROCESSING_TIMES): string {
  return IMAGE_PROCESSING_TIMES[model]
}

// Get credit cost for image model
export function getImageCreditCost(model: keyof typeof IMAGE_CREDIT_COSTS): number {
  return IMAGE_CREDIT_COSTS[model]
}

// Check if user has sufficient credits for a model
// Version 2.0: ALL models require credits at generation time
export function canAffordModel(userCredits: number, model: 'veo3' | 'veo3_fast'): boolean {
  return userCredits >= GENERATION_COSTS[model];
}

// Auto mode intelligent image model selection (prioritize seedream for better aspect ratio support)
export function getAutoImageModeSelection(): 'nano_banana' | 'seedream' {
  // Return seedream as default since it supports more aspect ratios (16:9, 9:16)
  return 'seedream'
}

// Check if user has sufficient credits for an image model (always true since free)
 
export function canAffordImageModel(_userCredits: number, _model: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro'): boolean {
  // All image models are free, so always affordable
  return true
}

// Get the actual image model that will be used (resolves auto to specific model)
export function getActualImageModel(selectedModel: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro'): 'nano_banana' | 'seedream' | 'nano_banana_pro' {
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

// Default initial credits for new users (enough for 1 complete workflow)
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
// - Cover generation: 0 credits (Seedream/Nano Banana) - FREE
// - Video generation: 20 credits (Veo3.1 fast, per 8s segment) or 150 credits (Veo3.1, per 8s segment)
// - Video download: FREE (no credits charged)
// Total for complete workflow: 20-1200 credits depending on model and duration
// With 100 free credits, users can generate 5 Veo3.1 fast videos (8s each) or 30+ shorter clips

// Get image size options for a specific model
export function getImageSizeOptions(model: 'nano_banana' | 'seedream'): readonly string[] {
  return IMAGE_SIZE_OPTIONS[model]
}

// Get video aspect ratio options for a specific model
export function getVideoAspectRatioOptions(model: 'veo3' | 'veo3_fast'): readonly string[] {
  return VIDEO_ASPECT_RATIO_OPTIONS[model]
}

// Get auto image size based on video aspect ratio for seedream
export function getAutoImageSize(videoAspectRatio: '16:9' | '9:16', imageModel: 'nano_banana' | 'seedream'): string {
  if (imageModel === 'nano_banana') {
    // For Banana, choose a sensible default matching video aspect ratio
    return videoAspectRatio === '9:16' ? 'portrait_16_9' : 'landscape_16_9'
  }

  // For seedream, map video aspect ratio to image size
  if (videoAspectRatio === '16:9') {
    return 'landscape_16_9'
  } else if (videoAspectRatio === '9:16') {
    return 'portrait_16_9'
  }

  return 'auto' // fallback
}

// Video model capabilities based on quality and duration
export type VideoQuality = 'standard' | 'high';
export type VideoDuration = '8' | '16' | '24' | '32' | '40' | '48' | '56' | '64';
export type VideoModel = 'veo3' | 'veo3_fast';

// Video model display names for UI
export const VIDEO_MODEL_DISPLAY_NAMES: Record<VideoModel, string> = {
  'veo3': 'Veo3.1',
  'veo3_fast': 'Veo3.1 fast'
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

export function getSegmentDurationForModel(model?: VideoModel | null): number {
  // All veo3 models use 8-second segments
  return DEFAULT_SEGMENT_DURATION_SECONDS;
}

export function getSegmentCountFromDuration(videoDuration?: string | null, model?: VideoModel): number {
  const duration = Number(videoDuration);
  const segmentLength = 8; // All veo3 models use 8-second segments
  const maxSegments = 8; // Maximum 8 segments (64 seconds)

  if (!Number.isFinite(duration) || duration <= segmentLength) {
    return 1;
  }

  const segments = Math.min(maxSegments, Math.ceil(duration / segmentLength));
  return Math.max(1, segments);
}

export function snapDurationToModel(model: VideoModel, targetSeconds: number): VideoDuration {
  const supportedDurations = [8, 16, 24, 32, 40, 48, 56, 64]; // All veo3 models support these durations

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
  // Both veo3 and veo3_fast use same calculation: cost per segment * number of segments
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
  | 'fi' | 'pl' | 'ru' | 'el' | 'tr' | 'cs' | 'ro' | 'zh' | 'ur' | 'pa';

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
  'pa': 'Punjabi'
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
  'pa': 'ਪੰਜਾਬੀ'
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
  'pa': 'Punjabi (ਪੰਜਾਬੀ)'
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
    'pa': 'Punjabi accent'
  };

  return voiceStyleMap[code] || 'English accent'; // fallback to English
}
