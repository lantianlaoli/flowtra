import { type Metadata } from 'next';
import MultiVariantAdsShowcasePage from '@/components/pages/MultiVariantAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Multi-Variant Ads - Generate Multiple Ad Versions | Flowtra',
  description: 'Generate multiple ad variants from one image. Free image generation with diverse styles and backgrounds. Perfect for A/B testing and social media marketing campaigns.',
  keywords: 'multiple ad variants, A/B testing ads, batch ad generation, social media ads, product variations, free image generation',
  openGraph: {
    title: 'Multi-Variant Ads - Generate Multiple Ad Versions | Flowtra',
    description: 'Generate multiple ad variants from one image with AI. Free image generation.',
    type: 'website',
  },
};

export default function Page() {
  return <MultiVariantAdsShowcasePage />;
}
