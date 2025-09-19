// Credit costs for different video models based on price.md
export const CREDIT_COSTS = {
  'veo3_fast': 30,    // Veo3 Fast: 30 credits per video
  'veo3': 150,        // Veo3 High Quality: 150 credits per video
} as const

// Processing times for different video models
export const MODEL_PROCESSING_TIMES = {
  'veo3_fast': '2-3 min',    // Veo3 Fast: 2-3 minutes processing time
  'veo3': '5-8 min',         // Veo3 High Quality: 5-8 minutes processing time
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

// Auto mode intelligent model selection based on user credits
export function getAutoModeSelection(userCredits: number): 'veo3' | 'veo3_fast' | null {
  // Try from most expensive to cheapest
  if (userCredits >= CREDIT_COSTS.veo3) {
    return 'veo3'
  } else if (userCredits >= CREDIT_COSTS.veo3_fast) {
    return 'veo3_fast'
  } else {
    return null // Insufficient credits for any model
  }
}

// Check if user has sufficient credits for a model
export function canAffordModel(userCredits: number, model: 'auto' | 'veo3' | 'veo3_fast'): boolean {
  if (model === 'auto') {
    return userCredits >= CREDIT_COSTS.veo3_fast // Auto requires at least the cheapest model
  }
  return userCredits >= CREDIT_COSTS[model]
}

// Get the actual model that will be used (resolves auto to specific model)
export function getActualModel(selectedModel: 'auto' | 'veo3' | 'veo3_fast', userCredits: number): 'veo3' | 'veo3_fast' | null {
  if (selectedModel === 'auto') {
    return getAutoModeSelection(userCredits)
  }
  return canAffordModel(userCredits, selectedModel) ? selectedModel : null
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
})();


// Complete workflow cost breakdown:
// - Image description: 1-2 credits (OpenRouter API)
// - Prompt generation: 1-2 credits (OpenRouter API) 
// - Cover generation: ~10-15 credits (Kie.ai GPT4O-Image)
// - Video generation: 30 credits (Veo3 Fast) or 150 credits (Veo3)
// Total for complete workflow with Veo3 Fast: ~45-50 credits
// With 100 free credits, users can complete 2 full workflows
