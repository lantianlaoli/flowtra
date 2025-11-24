import { type Metadata } from 'next';
import CompetitorReplicaShowcasePage from '@/components/pages/CompetitorReplicaShowcasePage';

export const metadata: Metadata = {
  title: 'Competitor Replica - Clone Competitor Videos with AI | Flowtra',
  description: 'Recreate top-performing competitor videos in minutes with AI. Clone proven creative structures and adapt them to your product. Perfect for quick market entry and competitive analysis.',
  keywords: 'competitor video cloning, UGC replica, video recreation, AI video cloning, competitor analysis, creative adaptation',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/competitor-replica',
  },
  openGraph: {
    title: 'Competitor Replica - Clone Competitor Videos with AI | Flowtra',
    description: 'Recreate top-performing competitor videos in minutes with AI. Clone proven creative structures and adapt them to your product.',
    url: 'https://www.flowtra.store/features/competitor-replica',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Competitor Replica - AI Video Cloning',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Competitor Replica - Clone Competitor Videos with AI | Flowtra',
    description: 'Recreate top-performing competitor videos in minutes with AI.',
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
            name: 'Competitor Replica - AI Video Cloning',
            description: 'Recreate top-performing competitor videos in minutes with AI. Clone proven creative structures and adapt them to your product. Perfect for quick market entry and competitive analysis.',
            url: 'https://www.flowtra.store/features/competitor-replica',
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
              'Clone competitor video structures',
              'Smart product replacement',
              'Preserve creative narrative',
              'Multiple AI models support',
              'Fast generation (minutes)',
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <CompetitorReplicaShowcasePage />
    </>
  );
}
