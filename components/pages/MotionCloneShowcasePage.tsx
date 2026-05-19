import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureStepsSection from '@/components/features/FeatureStepsSection';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const steps = [
  {
    title: 'Import the reference clip',
    description: 'Bring in a TikTok URL, local upload, or saved creator video to start the motion clone flow.'
  },
  {
    title: 'Set the replacement assets',
    description: 'Choose the model you want the workflow to substitute into the source motion.'
  },
  {
    title: 'Preview and generate',
    description: 'Review the first frame, adjust the setup if needed, then generate the final motion-preserving version.'
  }
];

const primaryCta = { href: '/dashboard/motion-clone', label: 'Start Motion Clone' };
const secondaryCta = { href: '/#pricing', label: 'View Pricing' };

export default function MotionCloneShowcasePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <FeatureHero
        title="Motion Clone"
        description="Preserve the movement, pacing, and camera behavior of a strong reference ad while placing your own product in the scene."
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        mediaVariant="comparison"
        media={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#666666]">
                Original
              </p>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-[#F5F5F5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_refer.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  eager
                  showControls={false}
                  playsInline
                  loop
                  autoPlay
                />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-black">
                Motion Clone
              </p>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-black bg-[#F5F5F5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_result.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  eager
                  showControls={false}
                  playsInline
                  loop
                  autoPlay
                />
              </div>
            </div>
          </div>
        }
      />

      <FeatureStepsSection
        title="Bring in a reference and turn it into your version"
        steps={steps}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="w-fit max-w-full lg:ml-auto">
            <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.06)]">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/canvas_motion_clone.mp4"
                wrapperClassName="w-full max-w-[720px] min-w-[280px]"
                className="w-full h-auto"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
          </div>
        }
      />

      <FeatureSignupCTA />

      <Footer />
    </div>
  );
}
