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
    description: 'Professional AI-powered advertising platform that transforms product images into high-converting video ads for small businesses.',
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
    name: 'Flowtra AI Video Ad Generator',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    description: 'Professional AI-powered video ad generator that creates high-converting advertisements from product images. Features Competitor UGC Replication and Character Ads workflows.',
    offers: {
      '@type': 'AggregateOffer',
      '@id': 'https://www.flowtra.store/#offers',
      priceCurrency: 'USD',
      lowPrice: '9',
      highPrice: '49',
      offerCount: '3',
      offers: [
        {
          '@type': 'Offer',
          name: 'Lite Package',
          price: '9',
          priceCurrency: 'USD',
          description: '500 credits. Approximately 25 Veo3 Fast videos. Includes Competitor UGC Replication and Character Ads. Mixed billing model with free image generation.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Lite',
            description: '500 AI video generation credits'
          }
        },
        {
          '@type': 'Offer',
          name: 'Basic Package',
          price: '29',
          priceCurrency: 'USD',
          description: '2,000 credits. Approximately 100 Veo3 Fast videos. Free unlimited downloads and image generation. Includes all features: Competitor UGC Replication and Character Ads.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Basic',
            description: '2,000 AI video generation credits'
          }
        },
        {
          '@type': 'Offer',
          name: 'Pro Package',
          price: '49',
          priceCurrency: 'USD',
          description: '3,500 credits. Approximately 175 Veo3 Fast videos. Priority processing, mixed billing model, free image generation. Includes Competitor UGC Replication and Character Ads.',
          availability: 'https://schema.org/InStock',
          url: 'https://www.flowtra.store/#pricing',
          priceValidUntil: '2025-12-31',
          itemOffered: {
            '@type': 'Service',
            name: 'Flowtra Pro',
            description: '3,500 AI video generation credits with priority processing'
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
      'Competitor UGC Replication: Single product image to video conversion',
      'Character Ads: Character-based advertisement generation',
      'Kling 2.6: Audio-enabled landscape videos up to 80 seconds',
      'AI-powered image description and prompt generation',
      'Multiple AI models: Veo3, Veo3 Fast, Sora2, Sora2 Pro, Kling 2.6',
      'Cover image generation: nano_banana, seedream models',
      'Mixed billing model: Free generation or paid generation options',
      'Always free image generation',
      'Credit-based flexible pricing',
      'No subscriptions, one-time purchase'
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
