import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureStepsSection from '@/components/features/FeatureStepsSection';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const steps = [
  {
    title: 'Set your product and brand',
    description: 'Upload the product you want to feature and give the workflow the brand context it should follow.'
  },
  {
    title: 'Choose the character',
    description: 'Pick the actor or avatar photo that should front the ad before generation begins.'
  },
  {
    title: 'Write the script',
    description: 'Add the talking points, hook, and CTA you want the character to deliver on camera.'
  },
  {
    title: 'Select format and duration',
    description: 'Choose the right aspect ratio and runtime for the channel you want to publish to.'
  },
  {
    title: 'Generate and review',
    description: 'Run the workflow, inspect the output, and keep refining until the ad is ready to ship.'
  }
];

const primaryCta = { href: '/dashboard/character-ads', label: 'Start Avatar Ads' };
const secondaryCta = { href: '/#pricing', label: 'View Pricing' };

export default function AvatarAdsShowcasePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <FeatureHero
        title="Avatar Ads"
        description="Create spokesperson-style product videos with a custom character, your script, and a clean workflow built for fast ad production."
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        mediaVariant="singleVideo"
        media={
          <div className="relative aspect-[9/16] w-full max-w-[340px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#F5F5F5]">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/character_ads_case.mp4"
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              showControls={false}
              playsInline
              loop
              autoPlay
            />
          </div>
        }
      />

      <FeatureStepsSection
        title="Launch a character-led ad in a few clear steps"
        steps={steps}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)] lg:ml-auto">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/canvas_avatar_ads.mp4"
              wrapperClassName="w-full"
              className="w-full h-auto"
              showControls={false}
              playsInline
              loop
              autoPlay
            />
          </div>
        }
      />

      <FeatureSignupCTA />

      <Footer />
    </div>
  );
}
