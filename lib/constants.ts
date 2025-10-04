// Credit costs for different video models based on price.md
export const CREDIT_COSTS = {
  'veo3_fast': 30,    // Veo3 Fast: 30 credits per video
  'veo3': 150,        // Veo3 High Quality: 150 credits per video
  'sora2': 30,        // Sora2: align with Veo3 Fast (30 credits per video)
  'download': 18,     // Download cost (60% of veo3_fast)
} as const

// Image models for cover generation
export const IMAGE_MODELS = {
  'nano_banana': 'google/nano-banana-edit',
  'seedream': 'bytedance/seedream-v4-edit'
} as const

// Image size options for different models
export const IMAGE_SIZE_OPTIONS = {
  'nano_banana': ['auto'], // Banana only supports auto (no size parameter)
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
  'sora2': ['16:9', '9:16'] // Sora2 supports both portrait and landscape
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
} as const

// Processing times for different image models
export const IMAGE_PROCESSING_TIMES = {
  'nano_banana': '1-2 min',    // Nano Banana: 1-2 minutes processing time
  'seedream': '2-4 min',       // Seedream 4.0: 2-4 minutes processing time
} as const

// Package definitions based on price.md
export const PACKAGES = {
  lite: {
    name: 'Lite',
    price: 9,
    priceSymbol: '$',
    credits: 500,
    description: 'Entry Pack',
    features: [
      '500 credits',
      '≈ 16 Veo3 Fast videos',
      'or ≈ 3 Veo3 high-quality videos',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 16,  // 500 / 30 ≈ 16
      veo3: 3         // 500 / 150 ≈ 3
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
      '≈ 66 Veo3 Fast videos',
      'or ≈ 13 Veo3 high-quality videos',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 66,   // 2000 / 30 ≈ 66
      veo3: 13         // 2000 / 150 ≈ 13
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
      '≈ 116 Veo3 Fast videos',
      'or ≈ 23 Veo3 high-quality videos',
      'AI-powered video generation',
      'Priority processing queue'
    ],
    videoEstimates: {
      veo3_fast: 116,  // 3500 / 30 ≈ 116
      veo3: 23         // 3500 / 150 ≈ 23
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

// Get generation cost (40% of total)
export function getGenerationCost(model: keyof typeof CREDIT_COSTS): number {
  return Math.round(CREDIT_COSTS[model] * 0.4)
}

// Get download cost (60% of total)
export function getDownloadCost(model: keyof typeof CREDIT_COSTS): number {
  return Math.round(CREDIT_COSTS[model] * 0.6)
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

// Auto mode intelligent model selection based on user credits (prioritize fastest)
export function getAutoModeSelection(userCredits: number): 'veo3' | 'veo3_fast' | 'sora2' | null {
  // Prioritize fastest model first
  if (userCredits >= CREDIT_COSTS.veo3_fast) {
    return 'veo3_fast'
  } else if (userCredits >= CREDIT_COSTS.veo3) {
    return 'veo3'
  } else if (userCredits >= CREDIT_COSTS.sora2) {
    return 'sora2'
  } else {
    return null // Insufficient credits for any model
  }
}

// Check if user has sufficient credits for a model
export function canAffordModel(userCredits: number, model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2'): boolean {
  if (model === 'auto') {
    return userCredits >= CREDIT_COSTS.veo3_fast // Auto requires at least the cheapest model
  }
  return userCredits >= CREDIT_COSTS[model]
}

// Get the actual model that will be used (resolves auto to specific model)
export function getActualModel(selectedModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2', userCredits: number): 'veo3' | 'veo3_fast' | 'sora2' | null {
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

// Thumbnail generation credit cost
export const THUMBNAIL_CREDIT_COST = 5

// Default initial credits for new users (enough for 1 complete workflow)
export const INITIAL_FREE_CREDITS = 100

// KIE API credit threshold for service availability (configurable via env)
export const KIE_CREDIT_THRESHOLD = (() => {
  const raw = process.env.KIE_CREDIT_THRESHOLD;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
})();


// Complete workflow cost breakdown:
// - Image description: 1-2 credits (OpenRouter API)
// - Prompt generation: 1-2 credits (OpenRouter API) 
// - Cover generation: ~10-15 credits (Kie.ai GPT4O-Image)
// - Video generation: 30 credits (Veo3 Fast) or 150 credits (Veo3) or 200 credits (Sora2)
// Total for complete workflow with Veo3 Fast: ~45-50 credits
// With 100 free credits, users can complete 2 full workflows

// Get image size options for a specific model
export function getImageSizeOptions(model: 'nano_banana' | 'seedream'): readonly string[] {
  return IMAGE_SIZE_OPTIONS[model]
}

// Get video aspect ratio options for a specific model
export function getVideoAspectRatioOptions(model: 'veo3' | 'veo3_fast' | 'sora2'): readonly string[] {
  return VIDEO_ASPECT_RATIO_OPTIONS[model]
}

// Get auto image size based on video aspect ratio for seedream
export function getAutoImageSize(videoAspectRatio: '16:9' | '9:16', imageModel: 'nano_banana' | 'seedream'): string {
  if (imageModel === 'nano_banana') {
    return 'auto' // Banana only supports auto
  }
  
  // For seedream, map video aspect ratio to image size
  if (videoAspectRatio === '16:9') {
    return 'landscape_16_9'
  } else if (videoAspectRatio === '9:16') {
    return 'portrait_16_9'
  }
  
  return 'auto' // fallback
}
