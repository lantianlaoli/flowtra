import type { Metadata } from 'next';
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';
import { siteUrl } from '@/lib/seo';

const description = 'Generate bilingual social media cover images from a portrait and product or logo reference.';

export const metadata: Metadata = {
  title: 'Social Cover Generator | Flowtra',
  description,
  alternates: {
    canonical: '/tools/social-cover-generator',
  },
  openGraph: {
    title: 'Social Cover Generator | Flowtra',
    description,
    url: siteUrl('/tools/social-cover-generator'),
    siteName: 'Flowtra',
    type: 'website',
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'Flowtra Social Cover Generator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Social Cover Generator | Flowtra',
    description,
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function SocialCoverGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
