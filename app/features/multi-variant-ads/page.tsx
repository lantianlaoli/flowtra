import { type Metadata } from 'next';
import MultiVariantAdsShowcasePage from '@/components/pages/MultiVariantAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Multi-Variant Ads - Generate Multiple Ad Versions | Flowtra',
  description: 'Generate multiple ad variants from one image. Free image generation with diverse styles and backgrounds. Perfect for A/B testing and social media marketing campaigns.',
  keywords: 'multiple ad variants, A/B testing ads, batch ad generation, social media ads, product variations, free image generation',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/multi-variant-ads',
  },
  openGraph: {
    title: 'Multi-Variant Ads - Generate Multiple Ad Versions | Flowtra',
    description: 'Generate multiple ad variants from one image with AI. Free image generation with diverse styles and backgrounds.',
    url: 'https://www.flowtra.store/features/multi-variant-ads',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Multi-Variant Ads - Generate Multiple Ad Versions',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Multi-Variant Ads - Generate Multiple Ad Versions | Flowtra',
    description: 'Generate multiple ad variants from one image with AI. Perfect for A/B testing.',
    images: ['/twitter-image.jpg'],
    creator: '@flowtra',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Multi-Variant Ads - AI Ad Variant Generator',
            description: 'Generate multiple ad variants from one image. Free image generation with diverse styles and backgrounds. Perfect for A/B testing and social media marketing campaigns.',
            url: 'https://www.flowtra.store/features/multi-variant-ads',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              description: 'Free image generation, optional video conversion available',
            },
            featureList: [
              'Multi-language support (50+ languages)',
              'Multiple style variations',
              'Batch generation',
              'AI background replacement',
              'Free unlimited image generation',
              'Optional video conversion',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <MultiVariantAdsShowcasePage />
    </>
  );
}
