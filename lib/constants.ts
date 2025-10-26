// ===== VERSION 3.0: MIXED BILLING MODEL =====
// Basic models: FREE generation, PAID download
// Premium models: PAID generation, FREE download

// Model classification
export const FREE_GENERATION_MODELS = ['veo3_fast', 'sora2'] as const;
export const PAID_GENERATION_MODELS = ['veo3', 'sora2_pro'] as const;

// Generation costs (only for PAID generation models)
export const GENERATION_COSTS = {
  'veo3': 150,        // Veo3 High Quality: 150 credits at generation
  // Sora2 Pro: See SORA2_PRO_CREDIT_COSTS (36-160 credits)
} as const;

// Download costs (only for FREE generation models)
export const DOWNLOAD_COSTS = {
  'veo3_fast': 20,    // Veo3 Fast: 20 credits at download
  'sora2': 6,         // Sora2: 6 credits at download
} as const;

// DEPRECATED: Legacy CREDIT_COSTS for backwards compatibility
export const CREDIT_COSTS = {
  'veo3_fast': 20,
  'veo3': 150,
  'sora2': 6,
} as const;

// Sora2 Pro credit costs based on duration and quality
export const SORA2_PRO_CREDIT_COSTS = {
  'standard_10s': 36,   // Sora2 Pro Standard 10s: 36 credits
  'standard_15s': 54,   // Sora2 Pro Standard 15s: 54 credits
  'hd_10s': 80,         // Sora2 Pro HD 10s: 80 credits
  'hd_15s': 160,        // Sora2 Pro HD 15s: 160 credits
} as const

// Watermark removal cost
export const WATERMARK_REMOVAL_COST = 3  // Sora2 watermark removal: 3 credits

// Image models for cover generation
export const IMAGE_MODELS = {
  'nano_banana': 'google/nano-banana-edit',
  'seedream': 'bytedance/seedream-v4-edit'
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
  ]
} as const

// Video aspect ratio options for different models
export const VIDEO_ASPECT_RATIO_OPTIONS = {
  'veo3': ['16:9', '9:16'],
  'veo3_fast': ['16:9', '9:16'],
  'sora2': ['16:9', '9:16'],  // Sora2 supports both portrait and landscape
  'sora2_pro': ['16:9', '9:16']  // Sora2 Pro supports both portrait and landscape
} as const

// Credit costs for different image models (all free)
export const IMAGE_CREDIT_COSTS = {
  'nano_banana': 0,    // Nano Banana: Free, fast generation
  'seedream': 0,       // Seedream 4.0: Free, high quality generation
} as const

// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'veo3_fast': '2-3 min',    // Veo3 Fast: 2-3 minutes processing time
  'veo3': '5-8 min',         // Veo3 High Quality: 5-8 minutes processing time
  'sora2': '8-12 min',       // Sora2: 8-12 minutes processing time (premium quality)
  'sora2_pro': '8-15 min',   // Sora2 Pro: 8-15 minutes processing time (varies by duration)
} as const

// Processing times for different image models
export const IMAGE_PROCESSING_TIMES = {
  'nano_banana': '1-2 min',    // Nano Banana: 1-2 minutes processing time
  'seedream': '2-4 min',       // Seedream 4.0: 2-4 minutes processing time
} as const

// Package definitions based on updated pricing
export const PACKAGES = {
  lite: {
    name: 'Lite',
    price: 9,
    priceSymbol: '$',
    credits: 500,
    description: 'Entry Pack',
    features: [
      '500 credits',
      '≈ 25 Veo3 Fast videos',
      'or ≈ 83 Sora2 videos',
      'or ≈ 3 Veo3 high-quality videos',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 25,  // 500 / 20 = 25
      veo3: 3,        // 500 / 150 ≈ 3
      sora2: 83       // 500 / 6 ≈ 83
    }
  },
  basic: {
    name: 'Basic',
    price: 29,
    priceSymbol: '$',
    credits: 2000,
    description: 'Recommended Plan',
    features: [
      '2,000 credits',
      '≈ 100 Veo3 Fast videos',
      'or ≈ 333 Sora2 videos',
      'or ≈ 13 Veo3 high-quality videos',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 100,  // 2000 / 20 = 100
      veo3: 13,        // 2000 / 150 ≈ 13
      sora2: 333       // 2000 / 6 ≈ 333
    }
  },
  pro: {
    name: 'Pro',
    price: 49,
    priceSymbol: '$',
    credits: 3500,
    description: 'Advanced Pack',
    features: [
      '3,500 credits',
      '≈ 175 Veo3 Fast videos',
      'or ≈ 583 Sora2 videos',
      'or ≈ 23 Veo3 high-quality videos',
      'AI-powered video generation',
      'Priority processing queue'
    ],
    videoEstimates: {
      veo3_fast: 175,  // 3500 / 20 = 175
      veo3: 23,        // 3500 / 150 ≈ 23
      sora2: 583       // 3500 / 6 ≈ 583
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

// Get credit cost for Sora2 Pro based on duration and quality
export function getSora2ProCreditCost(duration: '10' | '15', quality: 'standard' | 'high'): number {
  // Map 'high' to 'hd' to match SORA2_PRO_CREDIT_COSTS keys
  const qualityKey = quality === 'high' ? 'hd' : 'standard';
  const key = `${qualityKey}_${duration}s` as keyof typeof SORA2_PRO_CREDIT_COSTS;
  return SORA2_PRO_CREDIT_COSTS[key];
}

// ===== VERSION 3.0: MIXED BILLING HELPERS =====

// Check if model uses free generation (paid download)
export function isFreeGenerationModel(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'): boolean {
  return FREE_GENERATION_MODELS.includes(model as typeof FREE_GENERATION_MODELS[number]);
}

// Check if model uses paid generation (free download)
export function isPaidGenerationModel(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'): boolean {
  return PAID_GENERATION_MODELS.includes(model as typeof PAID_GENERATION_MODELS[number]);
}

// Get generation cost (0 for free generation models)
// IMPORTANT: videoDuration and videoQuality are generic parameters applicable to all models
// They are currently only used by Sora2 Pro, but kept generic for future model support
export function getGenerationCost(
  model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro',
  videoDuration?: string, // Generic: e.g., '8', '10', '15' (seconds)
  videoQuality?: 'standard' | 'high' // Generic: applicable to all models
): number {
  if (isFreeGenerationModel(model)) {
    return 0; // Free generation models
  }

  if (model === 'sora2_pro') {
    // For Sora2 Pro, use duration and quality to calculate cost
    const duration = (videoDuration === '15' ? '15' : '10') as '10' | '15';
    return getSora2ProCreditCost(duration, videoQuality || 'standard');
  }

  if (model === 'veo3') {
    return GENERATION_COSTS.veo3;
  }

  return 0;
}

// Get download cost (0 for paid generation models)
export function getDownloadCost(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'): number {
  if (isPaidGenerationModel(model)) {
    return 0; // Paid generation models have free downloads
  }

  if (model === 'veo3_fast') {
    return DOWNLOAD_COSTS.veo3_fast;
  }

  if (model === 'sora2') {
    return DOWNLOAD_COSTS.sora2;
  }

  return 0;
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

// Auto mode intelligent model selection based on user credits (prioritize cheapest first)
export function getAutoModeSelection(userCredits: number): 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | null {
  // Prioritize cheapest model first: Sora2 (6) < Veo3 Fast (20) < Veo3 (150)
  if (userCredits >= CREDIT_COSTS.sora2) {
    return 'sora2'  // Cheapest option (6 credits)
  } else if (userCredits >= CREDIT_COSTS.veo3_fast) {
    return 'veo3_fast'  // Second cheapest (20 credits)
  } else if (userCredits >= CREDIT_COSTS.veo3) {
    return 'veo3'  // Most expensive basic model (150 credits)
  } else {
    return null  // Insufficient credits for any model
  }
}

// Check if user has sufficient credits for a model
export function canAffordModel(userCredits: number, model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'): boolean {
  if (model === 'auto') {
    return userCredits >= CREDIT_COSTS.sora2  // Auto requires at least the cheapest model (Sora2: 6 credits)
  }
  if (model === 'sora2_pro') {
    return userCredits >= SORA2_PRO_CREDIT_COSTS.standard_10s  // Minimum Sora2 Pro cost (36 credits)
  }
  return userCredits >= CREDIT_COSTS[model]
}

// Get the actual model that will be used (resolves auto to specific model)
export function getActualModel(selectedModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro', userCredits: number): 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | null {
  if (selectedModel === 'auto') {
    return getAutoModeSelection(userCredits)
  }
  return canAffordModel(userCredits, selectedModel) ? selectedModel : null
}

// Auto mode intelligent image model selection (prioritize seedream for better aspect ratio support)
export function getAutoImageModeSelection(): 'nano_banana' | 'seedream' {
  // Return seedream as default since it supports more aspect ratios (16:9, 9:16)
  return 'seedream'
}

// Check if user has sufficient credits for an image model (always true since free)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canAffordImageModel(_userCredits: number, _model: 'auto' | 'nano_banana' | 'seedream'): boolean {
  // All image models are free, so always affordable
  return true
}

// Get the actual image model that will be used (resolves auto to specific model)
export function getActualImageModel(selectedModel: 'auto' | 'nano_banana' | 'seedream'): 'nano_banana' | 'seedream' {
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


// Complete workflow cost breakdown (generation-time billing):
// - Image description: ~1-2 credits (OpenRouter API) - FREE for users
// - Prompt generation: ~1-2 credits (OpenRouter API) - FREE for users
// - Cover generation: 0 credits (Seedream/Nano Banana) - FREE
// - Video generation: 6 credits (Sora2) or 20 credits (Veo3 Fast) or 150 credits (Veo3)
//                     or 36-160 credits (Sora2 Pro, based on duration and quality)
// - Video download: FREE (no credits charged)
// Total for complete workflow with Sora2: 6 credits
// Total for complete workflow with Veo3 Fast: 20 credits
// With 100 free credits, users can generate 16 Sora2 videos or 5 Veo3 Fast videos

// Get image size options for a specific model
export function getImageSizeOptions(model: 'nano_banana' | 'seedream'): readonly string[] {
  return IMAGE_SIZE_OPTIONS[model]
}

// Get video aspect ratio options for a specific model
export function getVideoAspectRatioOptions(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'): readonly string[] {
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
export type VideoDuration = '8' | '10' | '15';
export type VideoModel = 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';

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
    supportedDurations: ['8']
  },
  {
    model: 'veo3_fast',
    supportedQualities: ['standard'],
    supportedDurations: ['8']
  },
  {
    model: 'sora2',
    supportedQualities: ['standard'],
    supportedDurations: ['10']
  },
  {
    model: 'sora2_pro',
    supportedQualities: ['standard', 'high'],
    supportedDurations: ['10', '15']
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

// Get available durations for a given quality
export function getAvailableDurations(quality: VideoQuality): VideoDuration[] {
  const durations = new Set<VideoDuration>();

  MODEL_CAPABILITIES.forEach(cap => {
    if (cap.supportedQualities.includes(quality)) {
      cap.supportedDurations.forEach(d => durations.add(d));
    }
  });

  return Array.from(durations).sort();
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

// Calculate cost for a model based on quality and duration
export function getModelCostByConfig(
  model: VideoModel,
  quality: VideoQuality,
  duration: VideoDuration
): number {
  if (model === 'sora2_pro') {
    // Sora2 Pro uses lookup table
    return getSora2ProCreditCost(duration === '15' ? '15' : '10', quality === 'high' ? 'high' : 'standard');
  }

  // For other models, use base cost (they only support 8s/10s standard)
  if (model === 'veo3') return CREDIT_COSTS.veo3;
  if (model === 'veo3_fast') return CREDIT_COSTS.veo3_fast;
  if (model === 'sora2') return CREDIT_COSTS.sora2;

  return 0;
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

// ===== VIDEO CONFIGURATION PRESETS =====

export interface VideoConfigurationPreset {
  id: string;
  model: VideoModel;
  quality: VideoQuality;
  duration: VideoDuration;
  label: string;
  description: string;
}

// Get default video configuration based on user's stored preference or system default
export function getDefaultVideoConfiguration(): { model: VideoModel; quality: VideoQuality; duration: VideoDuration } {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('flowtra_video_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the stored config
        if (
          parsed &&
          typeof parsed.model === 'string' &&
          typeof parsed.quality === 'string' &&
          typeof parsed.duration === 'string'
        ) {
          return {
            model: parsed.model as VideoModel,
            quality: parsed.quality as VideoQuality,
            duration: parsed.duration as VideoDuration
          };
        }
      }
    }
  } catch {}

  // Default configuration
  return {
    model: 'veo3_fast',
    quality: 'standard',
    duration: '8'
  };
}

// ===== LANGUAGE SUPPORT =====

export type LanguageCode = 'en' | 'zh' | 'es' | 'fr' | 'de' | 'ur' | 'pa';

// Language code to display name mapping
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': 'Chinese',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'ur': 'Urdu',
  'pa': 'Punjabi'
} as const;

// Language code to native name mapping
export const LANGUAGE_NATIVE_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': '中文',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'ur': 'اردو',
  'pa': 'ਪੰਜਾਬੀ'
} as const;

// Language code to natural language name for AI prompts
export const LANGUAGE_PROMPT_NAMES: Record<LanguageCode, string> = {
  'en': 'English',
  'zh': 'Chinese (中文)',
  'es': 'Spanish (Español)',
  'fr': 'French (Français)',
  'de': 'German (Deutsch)',
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
  return LANGUAGE_PROMPT_NAMES[code];
}
