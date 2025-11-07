// Blog category definitions for filtering

export interface CategoryDefinition {
  id: string
  label: string
  keywords: string[] // Keywords to match against article keywords
}

// Platform categories
export const PLATFORM_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'etsy',
    label: 'Etsy',
    keywords: ['etsy', 'etsy-shop', 'etsy store']
  },
  {
    id: 'shopify',
    label: 'Shopify',
    keywords: ['shopify', 'shopify-store', 'shopify store']
  },
  {
    id: 'gumroad',
    label: 'Gumroad',
    keywords: ['gumroad']
  },
  {
    id: 'stan',
    label: 'Stan',
    keywords: ['stan', 'stan-store', 'stan store']
  },
  {
    id: 'social-platforms',
    label: 'Social Platforms',
    keywords: ['tiktok', 'instagram', 'facebook', 'social-media', 'social media', 'reels', 'shorts', 'tik-tok', 'tik tok', 'ig', 'insta']
  },
  {
    id: 'local-stores',
    label: 'Local Stores',
    keywords: ['local-stores', 'local stores', 'retail', 'brick-and-mortar', 'physical-store', 'local business', 'local-business']
  }
]

// Audience categories
export const AUDIENCE_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'small-business',
    label: 'Small Business',
    keywords: ['small-business', 'small business', 'smb', 'local-business', 'local business']
  },
  {
    id: 'ecommerce-sellers',
    label: 'E-commerce Sellers',
    keywords: ['ecommerce-sellers', 'e-commerce sellers', 'online-sellers', 'online sellers', 'sellers']
  },
  {
    id: 'digital-creators',
    label: 'Digital Creators',
    keywords: ['digital-creators', 'digital creators', 'creators', 'content-creators', 'content creators']
  },
  {
    id: 'dropshippers',
    label: 'Dropshippers',
    keywords: ['dropshipping', 'dropshippers', 'drop-shipping', 'drop shipping']
  },
  {
    id: 'local-stores',
    label: 'Local Stores',
    keywords: ['local-stores', 'local stores', 'retail', 'brick-and-mortar', 'physical-store']
  }
]

// Helper function to check if article keywords match a category
export function matchesCategory(articleKeywords: string[], category: CategoryDefinition): boolean {
  if (!articleKeywords || articleKeywords.length === 0) return false

  const normalizedArticleKeywords = articleKeywords.map(k => k.toLowerCase().trim())

  return category.keywords.some(categoryKeyword =>
    normalizedArticleKeywords.some(articleKeyword =>
      articleKeyword.includes(categoryKeyword.toLowerCase()) ||
      categoryKeyword.toLowerCase().includes(articleKeyword)
    )
  )
}

// Get all matching categories for an article
export function getMatchingCategories(articleKeywords: string[]): {
  platforms: string[]
  audiences: string[]
} {
  const platforms = PLATFORM_CATEGORIES
    .filter(cat => matchesCategory(articleKeywords, cat))
    .map(cat => cat.id)

  const audiences = AUDIENCE_CATEGORIES
    .filter(cat => matchesCategory(articleKeywords, cat))
    .map(cat => cat.id)

  return { platforms, audiences }
}

// Get keywords to search for given selected category IDs
export function getCategoryKeywords(categoryIds: string[], categories: CategoryDefinition[]): string[] {
  const selectedCategories = categories.filter(cat => categoryIds.includes(cat.id))
  return selectedCategories.flatMap(cat => cat.keywords)
}

// Notion color theme
export const notionColors = {
  text: {
    primary: '#37352f',      // Main text
    secondary: '#787774',    // Muted text
    tertiary: '#9b9a97'      // Placeholder
  },
  background: {
    primary: '#ffffff',      // Main background
    secondary: '#fafafa',    // Hover
    tertiary: '#f7f6f3'      // Sidebar
  },
  border: '#e5e7eb',         // All borders
  accent: '#2383e2'          // Single blue for links/active
}
