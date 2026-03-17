import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureBenefitRow from '@/components/features/FeatureBenefitRow';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureStepsSection from '@/components/features/FeatureStepsSection';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const steps = [
  {
    title: 'Load the reference context',
    description: 'Choose the source ad and give the agent the exact clone context it should work from.'
  },
  {
    title: 'Choose the replacement assets',
    description: 'Pick the product and character you want the agent to carry through the workflow.'
  },
  {
    title: 'Refine prompts in chat',
    description: 'Adjust image prompts, video prompts, and scene intent through conversation before generation.'
  },
  {
    title: 'Generate when the workflow is ready',
    description: 'Move into images, videos, and final merge only after the clone plan looks right.'
  }
];

const primaryCta = { href: '/dashboard/agent', label: 'Open Agent' };
const secondaryCta = { href: '/#pricing', label: 'View Pricing' };

export default function AIAgentShowcasePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <FeatureHero
        title="AI Agent"
        description="Guide a clone workflow through conversation, keep asset swaps explicit, and refine prompts before you spend credits on generation."
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        mediaVariant="comparison"
        media={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#666666]">
                Reference Video
              </p>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-[#F5F5F5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_refer_1.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  showControls={false}
                  playsInline
                  loop
                  autoPlay
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-black">
                Agent Result
              </p>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-black bg-[#F5F5F5]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_result_1.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
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
        title="Set the clone up in chat before you generate"
        steps={steps}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)] lg:ml-auto">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/FUkzZvssJTY?rel=0"
                title="Flowtra AI Agent tutorial"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        }
      />

      <FeatureBenefitRow
        title="Choose the video you want to clone"
        bullets={[
          'Start from one reference so the clone structure, pacing, and scene order stay grounded.',
          'Give the agent a clean source context before any prompt rewrites begin.',
          'Keep the workflow transparent instead of losing the logic behind the clone.'
        ]}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_clone_video_select_video.mp4"
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

      <FeatureBenefitRow
        title="Pick the person and product to replace"
        bullets={[
          'Keep the chosen character and product explicit so the agent can rewrite prompts cleanly.',
          'Carry the same asset choices through image prompts, video prompts, and final generation.',
          'Stay in control of the swap logic instead of rebuilding every scene by hand.'
        ]}
        reverse
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_clone_video_select_product_and_character.mp4"
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

      <FeatureSignupCTA
        title="Ready to plan your first agent-driven clone?"
        description="Create your account and start shaping clone workflows in chat."
      />

      <Footer />
    </div>
  );
}
