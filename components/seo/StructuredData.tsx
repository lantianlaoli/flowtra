/**
 * StructuredData Component
 *
 * Provides comprehensive JSON-LD structured data for AI search engines and SEO.
 * Includes Organization, WebSite, Product, and AggregateOffer schemas.
 */
export default function StructuredData() {
  // Organization Schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://www.flowtra.store/#organization',
    name: 'Flowtra',
    url: 'https://www.flowtra.store',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.flowtra.store/logo.png',
      width: 250,
      height: 60
    },
    description: 'AI-powered video cloning platform that replicates competitors\' best-performing UGC videos for small businesses. Transform any TikTok ad, Instagram Reel, or YouTube Short into your own branded content.',
    sameAs: [
      'https://twitter.com/flowtra',
      'https://www.linkedin.com/company/flowtra'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      email: 'support@flowtra.store',
      availableLanguage: ['en', 'zh']
    }
  };

  // WebSite Schema
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://www.flowtra.store/#website',
    url: 'https://www.flowtra.store',
    name: 'Flowtra - AI Video Ads for Small Business',
    description: 'Create professional video advertisements with AI. Transform product images into engaging video ads for Amazon, Walmart, and local stores.',
    publisher: {
      '@id': 'https://www.flowtra.store/#organization'
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.flowtra.store/search?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  };

  // Product/Service Schema
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://www.flowtra.store/#product',
    name: 'Flowtra - Turn Viral Videos Into Your Own | AI Video Cloning',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    description: 'Turn your competitors\' viral UGC videos into your own with AI. Clone TikTok ads, Instagram Reels, and YouTube Shorts with your products. Features dual-mode workflow: competitor video cloning and avatar-based video generation. Built for Shopify sellers, dropshippers, and small businesses.',
    offers: {
      '@type': 'AggregateOffer',
      '@id': 'https://www.flowtra.store/#offers',
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
          description: '1,930 credits. Approximately 96 Veo3 Fast videos or 321 Sora2 videos. Includes Competitor UGC Replication and Avatar Ads. Generation-time billing.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
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
          description: '3,930 credits. Approximately 196 Veo3 Fast videos or 655 Sora2 videos. Image generation included. Includes all features: Competitor UGC Replication and Avatar Ads.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
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
          description: '6,600 credits. Approximately 330 Veo3 Fast videos or 1100 Sora2 videos. Priority processing, generation-time billing. Includes Competitor UGC Replication and Avatar Ads.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
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
      'Competitor Video Cloning: Replicate TikTok, Instagram, and YouTube UGC ads',
      'AI-Powered Creative Structure Analysis: Extract and clone proven video formats',
      'Automatic Product Replacement: Replace competitor products with yours',
      'Avatar Ads: Character-based advertisement generation',
      'Dual-Mode Workflow: Competitor cloning + original video generation',
      'Multi-Platform Support: TikTok, Instagram Reels, YouTube Shorts',
      'Multiple AI Models: Veo3, Veo3 Fast, Sora2, Sora2 Pro',
      'Multi-Language Support: English, Chinese, Spanish, and 10+ languages',
      'Generation-Time Billing: Pay only for generated videos',
      'No Editing Skills Required: AI handles creative structure replication'
    ],
    screenshot: 'https://www.flowtra.store/screenshots/dashboard.png',
    url: 'https://www.flowtra.store',
    author: {
      '@id': 'https://www.flowtra.store/#organization'
    },
    provider: {
      '@id': 'https://www.flowtra.store/#organization'
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
        item: 'https://www.flowtra.store'
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
