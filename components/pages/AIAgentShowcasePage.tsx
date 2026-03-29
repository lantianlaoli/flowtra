import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureBenefitRow from '@/components/features/FeatureBenefitRow';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureStepsSection from '@/components/features/FeatureStepsSection';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const steps = [
  {
    title: 'Drag in your assets',
    description: 'Drop the person, product, and reference video cards onto the canvas to set up the workflow.'
  },
  {
    title: 'Drag in the function you want',
    description: 'Add the canvas function you need, whether it is video clone, motion clone, or batch talking-head generation.'
  },
  {
    title: 'Click start to run it',
    description: 'Start the selected function when the canvas looks right and let the agent execute the flow from there.'
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
        description="Build clone workflows in canvas mode, drag in people, products, videos, and functions, then launch generation from one clear visual flow."
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
        title="Build the workflow in canvas mode"
        steps={steps}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)] lg:ml-auto">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src="https://www.youtube.com/embed/11CrLHYJ6sA?rel=0"
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
        title="Build clone workflows in canvas mode"
        bullets={[
          'Drag cards to rearrange the workflow and keep every generation step readable at a glance.',
          'Connect nodes quickly for video clone flows, motion clone setups, and action-driven variations.',
          'Batch-generate talking-head product videos and sales-ready character ads from one canvas.'
        ]}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_manual_select.mp4"
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
        title="Name the assets you want and let the canvas connect them"
        bullets={[
          'Mention the exact person, product, or reference video in chat and the agent can place the matching cards on the canvas.',
          'Turn a named request into the right workflow structure for video clone, motion clone, or avatar ads without rebuilding the canvas by hand.',
          'Keep every selected asset and connection visible so follow-up edits refine the current graph instead of starting over.'
        ]}
        reverse
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_chat.mp4"
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
        title="Ready to build your first canvas workflow?"
        description="Create your account and start dragging assets, functions, and clone flows into place."
      />

      <Footer />
    </div>
  );
}
