/**
 * StructuredData Component
 *
 * Provides comprehensive JSON-LD structured data for AI search engines and SEO.
 * Includes Organization, WebSite, Product, and AggregateOffer schemas.
 */
import { SITE_URL } from '@/lib/seo';

export default function StructuredData() {
  // Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Flowtra',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/logo.svg`,
      width: 250,
      height: 60
    },
    description: 'AI-powered video cloning platform that replicates viral UGC videos for small businesses. Transform any TikTok ad, Instagram Reel, or YouTube Short into product-and-avatar customized content.',
    sameAs: [
      'https://twitter.com/flowtra',
      'https://www.linkedin.com/company/flowtra'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'support@flowtra.ai',
      availableLanguage: ['en', 'zh']
    }
  };

  // WebSite Schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Flowtra - AI Video Ads for Small Business',
    description: 'Create professional video advertisements with AI. Transform product images into engaging video ads for Amazon, Walmart, and local stores.',
    publisher: {
      '@id': `${SITE_URL}/#organization`
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };

  // Product/Service Schema
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#product`,
    name: 'Flowtra - Turn Viral Videos Into Your Own | AI Video Cloning',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    description: 'Turn viral UGC videos into your own with AI. Clone TikTok ads, Instagram Reels, and YouTube Shorts with your products. Features dual-mode workflow: viral video cloning and avatar-based video generation. Built for Shopify sellers, dropshippers, and small businesses.',
    offers: {
      '@type': 'AggregateOffer',
      '@id': `${SITE_URL}/#offers`,
      priceCurrency: 'USD',
      lowPrice: '29',
      highPrice: '99',
      offerCount: '3',
      offers: [
        {
          '@type': 'Offer',
          name: 'Lite Package',
          price: '29',
          priceCurrency: 'USD',
          description: '1,930 credits. Approximately 58 Seedance 2 Fast videos (or 47 Seedance 2 videos) per 1-second generation units. Includes Video Clone, Avatar Ads, Motion Clone, plus free unlimited AI Agent access.',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Lite',
            description: '1,930 AI video generation credits'
          }
        },
        {
          '@type': 'Offer',
          name: 'Basic Package',
          price: '59',
          priceCurrency: 'USD',
          description: '3,930 credits. Approximately 119 Seedance 2 Fast videos (or 95 Seedance 2 videos) per 1-second generation units. Image generation included. Includes Video Clone, Avatar Ads, Motion Clone, plus free unlimited AI Agent access.',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Basic',
            description: '3,930 AI video generation credits'
          }
        },
        {
          '@type': 'Offer',
          name: 'Pro Package',
          price: '99',
          priceCurrency: 'USD',
          description: '6,600 credits. Approximately 200 Seedance 2 Fast videos (or 160 Seedance 2 videos) per 1-second generation units. Priority processing. Includes Video Clone, Avatar Ads, Motion Clone, plus free unlimited AI Agent access.',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Pro',
            description: '6,600 AI video generation credits with priority processing'
          }
        }
      ]
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '342',
      reviewCount: '187',
      bestRating: '5',
      worstRating: '1'
    },
    featureList: [
      'Viral Video Cloning: Clone TikTok, Instagram, and YouTube UGC ads',
      'AI-Powered Creative Structure Analysis: Extract and clone proven video formats',
      'Automatic Product Replacement: Replace products in viral videos with yours',
      'AI Agent: Free unlimited prompt-guided creative planning across all plans',
      'Avatar Ads: Character-based advertisement generation',
      'Dual-Mode Workflow: Viral cloning + original video generation',
      'Multi-Platform Support: TikTok, Instagram Reels, YouTube Shorts',
      'Multiple AI Models: Seedance 2 Fast, Seedance 2, Seedance 2 Mini, Kling 3.0',
      'Multi-Language Support: English, Chinese, Spanish, and 10+ languages',
      'Generation-Time Billing: Pay only for generated videos',
      'No Editing Skills Required: AI handles creative structure replication'
    ],
    screenshot: `${SITE_URL}/screenshots/dashboard.png`,
    url: SITE_URL,
    author: {
      '@id': `${SITE_URL}/#organization`
    },
    provider: {
      '@id': `${SITE_URL}/#organization`
    }
  };

  // BreadcrumbList Schema for homepage
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL
      }
    ]
  };

  // Combine all schemas
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationSchema,
      websiteSchema,
      productSchema,
      breadcrumbSchema
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
      }}
    />
  );
}
