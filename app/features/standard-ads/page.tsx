import { type Metadata } from 'next';
import StandardAdsShowcasePage from '@/components/pages/StandardAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Standard Ads - AI Video Generator | Flowtra',
  description: 'Transform product images into engaging video ads with AI. Support 50+ languages including Urdu, Arabic, Hindi. Custom WhatsApp display for direct customer contact. Free image generation.',
  keywords: 'AI video ads, product video generator, e-commerce video ads, multilingual ads, WhatsApp business ads, Urdu ads, Arabic ads',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/standard-ads',
  },
  openGraph: {
    title: 'Standard Ads - AI Video Generator | Flowtra',
    description: 'Transform product images into engaging video ads with AI. Support 50+ languages including Urdu, Arabic, Hindi.',
    url: 'https://www.flowtra.store/features/standard-ads',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Standard Ads - AI Video Generator',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Standard Ads - AI Video Generator | Flowtra',
    description: 'Transform product images into engaging video ads with AI. Support 50+ languages.',
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
            name: 'Standard Ads - AI Video Generator',
            description: 'Transform product images into engaging video ads with AI. Support 50+ languages including Urdu, Arabic, Hindi. Custom WhatsApp display for direct customer contact.',
            url: 'https://www.flowtra.store/features/standard-ads',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'USD',
              lowPrice: '0.11',
              highPrice: '2.88',
              offerCount: '4',
            },
            featureList: [
              'Multi-language support (50+ languages)',
              'Custom WhatsApp display',
              'AI-powered descriptions',
              'Multiple AI models (Veo3, Veo3 Fast, Sora2, Sora2 Pro)',
              'Free image generation',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <StandardAdsShowcasePage />
    </>
  );
}
