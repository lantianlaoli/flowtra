import { type Metadata } from 'next';
import CharacterAdsShowcasePage from '@/components/pages/CharacterAdsShowcasePage';

export const metadata: Metadata = {
  title: 'Character Ads - AI Character-Driven Video Ads | Flowtra',
  description: 'Create character-driven video advertisements with AI. Custom characters, dialogue, and realistic performances powered by Google Veo3. Perfect for brand storytelling and product demos.',
  keywords: 'AI character ads, character animation, video spokesperson, brand ambassador, AI video characters, Google Veo3',
  openGraph: {
    title: 'Character Ads - AI Character-Driven Video Ads | Flowtra',
    description: 'Create character-driven video advertisements with realistic AI characters powered by Google Veo3.',
    type: 'website',
  },
};

export default function Page() {
  return <CharacterAdsShowcasePage />;
}
