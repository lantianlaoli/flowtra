import { type Metadata } from 'next';
import AvatarAdsShowcasePage from '@/components/pages/AvatarAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Avatar Ads - AI Character-Driven Video Ads | Flowtra',
  description: 'Create character-driven video advertisements with AI. Custom characters, dialogue, and realistic performances powered by Google Veo3. Perfect for brand storytelling and product demos.',
  keywords: 'AI avatar ads, character animation, video spokesperson, brand ambassador, AI video characters, Google Veo3',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/avatar-ads',
  },
  openGraph: {
    title: 'Avatar Ads - AI Character-Driven Video Ads | Flowtra',
    description: 'Create character-driven video advertisements with realistic AI characters powered by Google Veo3. Custom dialogue and natural performances.',
    url: 'https://www.flowtra.store/features/avatar-ads',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Avatar Ads - AI Character-Driven Video Ads',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Avatar Ads - AI Character-Driven Video Ads | Flowtra',
    description: 'Create realistic AI character-driven video ads with Google Veo3. Custom dialogue and professional quality.',
    images: ['/twitter-image.png'],
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
            name: 'Avatar Ads - AI Character Video Generator',
            description: 'Create character-driven video advertisements with AI. Custom characters, dialogue, and realistic performances powered by Google Veo3. Perfect for brand storytelling and product demos.',
            url: 'https://www.flowtra.store/features/avatar-ads',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '2.70',
              priceCurrency: 'USD',
              description: '150 credits per 8-second video, powered by Google Veo3',
            },
            featureList: [
              'Custom character settings',
              'Custom dialogue content',
              'Realistic performance with natural movements',
              'Professional quality powered by Google Veo3',
              'Natural lip-sync with dialogue',
              'Premium character animation',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <AvatarAdsShowcasePage />
    </>
  );
}
