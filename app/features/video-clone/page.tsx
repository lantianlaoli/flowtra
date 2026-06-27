import { type Metadata } from 'next';
import VideoCloneFeaturePage from '@/components/pages/VideoCloneFeaturePage';
import { DEFAULT_SOCIAL_IMAGE_PATH } from '@/lib/social-image';
import { SITE_URL, siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Video Clone - Recreate High-Performing Videos with AI | Flowtra',
  description: 'Turn a reference video into a launch-ready ad with AI. Rebuild the structure, swap in your product, and refine each scene before generation.',
  keywords: 'video clone, reference video cloning, AI video recreation, product video adaptation, creative remixes',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/video-clone',
  },
  openGraph: {
    title: 'Video Clone - Recreate High-Performing Videos with AI | Flowtra',
    description: 'Turn a reference video into a launch-ready ad with AI. Rebuild the structure, swap in your product, and refine each scene before generation.',
    url: siteUrl('/features/video-clone'),
    siteName: 'Flowtra',
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'Video Clone - AI Video Recreation',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Video Clone - Recreate High-Performing Videos with AI | Flowtra',
    description: 'Turn a reference video into a launch-ready ad with AI.',
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
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
            name: 'Video Clone - AI Video Recreation',
            description: 'Turn a reference video into a launch-ready ad with AI. Rebuild the structure, swap in your product, and refine each scene before generation.',
            url: siteUrl('/features/video-clone'),
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
              'Clone reference video structures',
              'Smart product replacement',
              'Preserve creative narrative',
              'Multiple AI models support',
              'Fast generation (minutes)',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: SITE_URL,
            },
          })
        }}
      />
      <VideoCloneFeaturePage />
    </>
  );
}
