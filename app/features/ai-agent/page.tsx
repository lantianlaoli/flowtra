import { type Metadata } from 'next';
import AIAgentShowcasePage from '@/components/pages/AIAgentShowcasePage';
import { DEFAULT_SOCIAL_IMAGE_PATH } from '@/lib/social-image';

export const metadata: Metadata = {
  title: 'AI Agent - Canvas Clone Workflows | Flowtra',
  description: 'Build clone workflows in canvas mode, drag in people, products, videos, and functions, then launch video clone, motion clone, and talking-head generation from one workspace.',
  keywords: 'AI agent canvas, canvas clone workflow, video clone canvas, motion clone canvas, talking head video generation, UGC workflow builder',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/ai-agent',
  },
  openGraph: {
    title: 'AI Agent - Canvas Clone Workflows | Flowtra',
    description: 'Drag cards into a canvas, connect clone functions, and run video clone, motion clone, and talking-head workflows from one place.',
    url: 'https://www.flowtra.store/features/ai-agent',
    siteName: 'Flowtra',
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'Flowtra AI Agent feature page',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Agent - Canvas Clone Workflows | Flowtra',
    description: 'Use canvas mode to arrange assets, connect functions, and launch clone workflows without rebuilding everything by hand.',
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
            name: 'Flowtra AI Agent',
            description: 'Use Flowtra Agent in canvas mode to arrange assets, connect functions, and launch clone workflows for video clone, motion clone, and talking-head generation.',
            url: 'https://www.flowtra.store/features/ai-agent',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              description: 'Canvas-based workflow building for clone video generation'
            },
            featureList: [
              'Canvas-based workflow builder for clone generation',
              'Drag-and-drop cards for people, products, videos, and functions',
              'Support for video clone, motion clone, and talking-head outputs',
              'Fast node linking and visual workflow editing',
              'Unlimited agent usage for subscribers without credit deductions'
            ],
            provider: {
              '@type': 'Organization',
              name: 'Flowtra',
              url: 'https://www.flowtra.store',
            },
          })
        }}
      />
      <AIAgentShowcasePage />
    </>
  );
}
