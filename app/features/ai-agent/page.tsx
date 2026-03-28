import { type Metadata } from 'next';
import AIAgentShowcasePage from '@/components/pages/AIAgentShowcasePage';
import { DEFAULT_SOCIAL_IMAGE_PATH } from '@/lib/social-image';

export const metadata: Metadata = {
  title: 'AI Agent - Prompt-Guided Clone Workflows | Flowtra',
  description: 'Use Flowtra Agent to replace people and products in prompts, manage long TikTok clone workflows, and generate images plus videos through conversation.',
  keywords: 'AI agent, prompt editing agent, TikTok clone workflow, image prompt agent, video prompt agent, UGC clone assistant',
  authors: [{ name: 'Flowtra Team' }],
  creator: 'Flowtra',
  publisher: 'Flowtra',
  alternates: {
    canonical: '/features/ai-agent',
  },
  openGraph: {
    title: 'AI Agent - Prompt-Guided Clone Workflows | Flowtra',
    description: 'Replace people and products in prompts, manage 60-second TikTok clone workflows, and create images plus videos through conversation.',
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
    title: 'AI Agent - Prompt-Guided Clone Workflows | Flowtra',
    description: 'Talk to an AI agent that rewrites image prompts, video prompts, and clone workflows around your assets.',
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
            description: 'Use Flowtra Agent to replace people and products in prompts, manage long TikTok clone workflows, and generate images plus videos through conversation.',
            url: 'https://www.flowtra.store/features/ai-agent',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              availability: 'https://schema.org/InStock',
              description: 'AI-guided prompt editing and clone workflow planning'
            },
            featureList: [
              'Automatic people and product replacement in prompts',
              '@mention-based asset referencing',
              'Support for TikTok clone workflows up to 60 seconds',
              'Conversation-led image and video generation',
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
