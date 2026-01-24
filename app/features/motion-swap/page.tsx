import { type Metadata } from 'next';
import MotionSwapShowcasePage from '@/components/pages/MotionSwapShowcasePage';

export const metadata: Metadata = {
  title: 'Motion Swap - Clone Viral Ads Instantly | Flowtra',
  description: 'Clone viral TikTok ads in seconds. Enter a creator\'s name and AI swaps the person and product while preserving movements, actions, and background. Smart frame editing for higher success rates.',
  keywords: 'AI motion swap, viral ad cloning, TikTok creator clone, video motion transfer, product swap AI, viral content replication',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/motion-swap',
  },
  openGraph: {
    title: 'Motion Swap - Clone Viral Ads Instantly | Flowtra',
    description: 'Clone viral TikTok ads by entering a creator\'s name. AI swaps person and product while preserving the exact movements that made it go viral.',
    url: 'https://www.flowtra.store/features/motion-swap',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Motion Swap - Clone Viral Ads Instantly',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Motion Swap - Clone Viral Ads Instantly | Flowtra',
    description: 'Clone viral ads in seconds. AI preserves movements while swapping person and product. Smart frame editing included.',
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
            name: 'Motion Swap - AI Viral Ad Cloning Tool',
            description: 'Clone viral TikTok ads in seconds. Enter a creator\'s name and AI swaps the person and product while preserving movements, actions, and background that made it go viral. Smart frame editing for higher success rates.',
            url: 'https://www.flowtra.store/features/motion-swap',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              description: 'AI-powered motion cloning for viral content replication',
            },
            featureList: [
              'Creator name search and instant analysis',
              'Motion and action preservation',
              'Smart first frame editing and preview',
              'Automatic person and product swapping',
              'Higher success rate with visual controls',
              'Professional quality output',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <MotionSwapShowcasePage />
    </>
  );
}
