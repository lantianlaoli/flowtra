import Link from 'next/link';
import { Clock3, Globe2, Scissors } from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureBenefitRow from '@/components/features/FeatureBenefitRow';
import FeatureHero from '@/components/features/FeatureHero';
import FeatureStepsSection from '@/components/features/FeatureStepsSection';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const steps = [
  {
    title: 'Add your product context',
    description: 'Upload the product and brand details that should replace the original ad assets.'
  },
  {
    title: 'Import the viral reference',
    description: 'Choose the reference video you want to break down and recreate.'
  },
  {
    title: 'Review the generated structure',
    description: 'Let Flowtra map the scenes, prompts, timing, and shot order before generation.'
  },
  {
    title: 'Adjust prompts and assets',
        description: 'Refine image prompts, video prompts, and replacements until the result matches your goals.'
  },
  {
    title: 'Generate and merge the final ad',
    description: 'Run the segments, review the outputs, and merge the final version when every scene is ready.'
  }
];

const analysisShots = [
  {
    id: '01',
    timeRange: '0.0s - 2.1s',
    action: 'Macro beauty close-up introduces the product with immediate application motion.',
    audio: 'Hook lands immediately with a direct promise and tight pacing.',
    visual: 'High-contrast cosmetic framing, face-forward composition, premium clean background.'
  },
  {
    id: '02',
    timeRange: '2.1s - 5.4s',
    action: 'Product texture and hand movement stay centered while the subject continues the demo.',
    audio: 'Middle section explains the benefit while maintaining the same rhythm.',
    visual: 'Controlled hand placement, product label visibility, consistent skin-tone lighting.'
  },
  {
    id: '03',
    timeRange: '5.4s - 8.0s',
    action: 'Ending pose and product hold create a clean finish for the final CTA beat.',
    audio: 'Closing line resolves the promise and cues the conversion moment.',
    visual: 'Held frame, minimal camera movement, reusable end-card composition.'
  }
];

const primaryCta = { href: '/dashboard/video-clone', label: 'Start Video Clone' };
const secondaryCta = { href: '/#pricing', label: 'View Pricing' };
const CLONE_TUTORIAL_EMBED_URL = 'https://www.youtube.com/embed/BX5XLe3JbQ8?rel=0';

export default function VideoCloneFeaturePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <FeatureHero
        title="Video Clone"
        description="Start from a reference video, swap in your product, and move to launch-ready output without rebuilding the structure from scratch."
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
                  src="/showcase/video-clone/reference-source.mp4"
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
                Your Version
              </p>
              <div className="relative aspect-[9/16] overflow-hidden rounded-[20px] border border-black bg-[#F5F5F5]">
                <LazyVideoPlayer
                  src="/showcase/video-clone/reference-result.mp4"
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
        title="Move from reference video to editable clone workflow"
        steps={steps}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="w-full max-w-[760px] overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-black shadow-[0_18px_40px_rgba(0,0,0,0.06)] lg:ml-auto">
            <div className="aspect-video w-full">
              <iframe
                className="h-full w-full"
                src={CLONE_TUTORIAL_EMBED_URL}
                title="Flowtra Video Clone tutorial"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        }
      />

      <section className="px-4 py-16 md:px-6 md:py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-start gap-14 lg:grid-cols-[0.98fr_1.02fr] lg:gap-20">
          <div className="space-y-8">
            <div>
              <p className="inline-flex rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                AI Analysis Result
              </p>
              <h2 className="mt-5 text-[30px] font-bold tracking-[-0.02em] text-black md:text-[40px]">
                Deep video understanding
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#666666]">
                Flowtra breaks the winning ad into timing, actions, spoken beats, and visual structure before generation starts, so the clone stays faithful to what made the reference work.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] font-medium text-black shadow-sm">
                <Globe2 className="h-4 w-4" />
                <span>10+ Languages Detected</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] font-medium text-black shadow-sm">
                <Clock3 className="h-4 w-4" />
                <span>Up to 60s Structure</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 text-[13px] font-medium text-black shadow-sm">
                <Scissors className="h-4 w-4" />
                <span>Auto-Scene Detection</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-white shadow-[0_18px_40px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between border-b border-[#EDEDED] bg-[#FAFAFA] px-4 py-3">
                <span className="text-[13px] font-semibold text-black">Video Blueprint</span>
                <span className="text-[12px] text-[#666666]">8s • 3 shots detected</span>
              </div>
              <div className="max-h-[420px] overflow-y-auto">
                {analysisShots.map((shot) => (
                  <div key={shot.id} className="border-b border-[#F1F1F1] px-4 py-4 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#666666]">
                        {shot.timeRange}
                      </span>
                      <span className="rounded-full bg-[#F5F5F5] px-2.5 py-1 text-[11px] font-semibold text-black">
                        Shot {shot.id}
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999999]">Action</p>
                        <p className="mt-1 text-[14px] leading-6 text-black">{shot.action}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999999]">Audio</p>
                        <p className="mt-1 text-[14px] leading-6 text-[#666666]">{shot.audio}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#999999]">Visual</p>
                        <p className="mt-1 text-[13px] leading-6 text-[#666666]">{shot.visual}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href={primaryCta.href}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#1A1A1A]"
              >
                {primaryCta.label}
              </Link>
              <Link
                href={secondaryCta.href}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white px-6 py-3 text-[15px] font-semibold text-black transition-colors hover:bg-[#F7F7F7]"
              >
                {secondaryCta.label}
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-sm overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="/showcase/video-clone/reference-analysis.mp4"
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              showControls={false}
              playsInline
              loop
              autoPlay
            />
          </div>
        </div>
      </section>

      <FeatureBenefitRow
        title="Prompt control for video clone"
        bullets={[
          'Rewrite image prompts and video prompts while preserving the structure you want to keep.',
          'Adjust each segment independently so the final ad fits your product, pacing, and audience.',
          'Use a cleaner review loop instead of committing to the first generated version.'
        ]}
        reverse
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="grid gap-4">
            <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_prompt_image.mp4"
                wrapperClassName="w-full"
                className="w-full h-auto"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
            <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
              <LazyVideoPlayer
                src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_prompt_video.mp4"
                wrapperClassName="w-full"
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

      <FeatureSignupCTA
        title="Ready to clone a winning ad?"
        description="Create your account and start turning references into launch-ready clones."
      />

      <Footer />
    </div>
  );
}
