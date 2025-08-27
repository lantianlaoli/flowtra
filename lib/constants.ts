// Credit costs for different video models based on price.md
export const CREDIT_COSTS = {
  'veo3_fast': 30,    // Veo3 Fast: 30 credits per video
  'veo3': 150,        // Veo3 High Quality: 150 credits per video
} as const

// Package definitions based on price.md
export const PACKAGES = {
  starter: {
    name: 'Starter',
    price: 29,
    priceSymbol: '$',
    credits: 2000,
    description: 'Trial Pack',
    features: [
      '2,000 credits',
      '≈ 65 Veo3 Fast videos',
      'or ≈ 13 Veo3 high-quality videos',
      'AI-powered video generation'
    ],
    videoEstimates: {
      veo3_fast: 65,   // 2000 / 30 ≈ 65
      veo3: 13         // 2000 / 150 ≈ 13
    }
  },
  pro: {
    name: 'Pro', 
    price: 99,
    priceSymbol: '$',
    credits: 7500,
    description: 'Recommended Plan',
    features: [
      '7,500 credits',
      '≈ 250 Veo3 Fast videos',
      'or ≈ 50 Veo3 high-quality videos',
      'AI-powered video generation',
      'Priority processing queue'
    ],
    videoEstimates: {
      veo3_fast: 250,  // 7500 / 30 = 250
      veo3: 50         // 7500 / 150 = 50
    }
  }
} as const

// Get package details by name
export function getPackageByName(packageName: 'starter' | 'pro') {
  return PACKAGES[packageName]
}

// Get credit cost for video model
export function getCreditCost(model: keyof typeof CREDIT_COSTS): number {
  return CREDIT_COSTS[model]
}

// Map product_id to credits and package info
export function getCreditsFromProductId(productId: string): { credits: number; packageName: string } | null {
  // Get environment-specific product IDs
  const starterDevId = process.env.STARTER_PACK_CREEM_DEV_ID
  const starterProdId = process.env.STARTER_PACK_CREEM_PROD_ID
  const proDevId = process.env.PRO_PACK_CREEM_DEV_ID
  const proProdId = process.env.PRO_PACK_CREEM_PROD_ID

  if (productId === starterDevId || productId === starterProdId) {
    return {
      credits: PACKAGES.starter.credits,
      packageName: 'starter'
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

// KIE API credit threshold for service availability
export const KIE_CREDIT_THRESHOLD = 600

// Complete workflow cost breakdown:
// - Image description: 1-2 credits (OpenRouter API)
// - Prompt generation: 1-2 credits (OpenRouter API) 
// - Cover generation: ~10-15 credits (Kie.ai GPT4O-Image)
// - Video generation: 30 credits (Veo3 Fast) or 150 credits (Veo3)
// Total for complete workflow with Veo3 Fast: ~45-50 credits
// With 100 free credits, users can complete 2 full workflows