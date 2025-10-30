import { type Metadata } from 'next';
import StandardAdsShowcasePage from '@/components/pages/StandardAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Standard Ads - AI Video Generator | Flowtra',
  description: 'Transform product images into engaging video ads with AI. Support 50+ languages including Urdu, Arabic, Hindi. Custom WhatsApp display for direct customer contact. Free image generation.',
  keywords: 'AI video ads, product video generator, e-commerce video ads, multilingual ads, WhatsApp business ads, Urdu ads, Arabic ads',
  openGraph: {
    title: 'Standard Ads - AI Video Generator | Flowtra',
    description: 'Transform product images into engaging video ads with AI. Support 50+ languages.',
    type: 'website',
  },
};

export default function Page() {
  return <StandardAdsShowcasePage />;
}
