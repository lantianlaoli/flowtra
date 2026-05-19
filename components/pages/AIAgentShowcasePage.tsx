'use client';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { FeatureSignupCTA } from '@/components/cta/FeatureSignupCTA';
import FeatureBenefitRow from '@/components/features/FeatureBenefitRow';
import FeatureHero from '@/components/features/FeatureHero';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import { useI18n } from '@/providers/I18nProvider';

export default function AIAgentShowcasePage() {
  const { messages } = useI18n();
  const aiAgentMessages = messages.featurePages.aiAgent;
  const primaryCta = { href: '/dashboard/agent', label: aiAgentMessages.primaryCta };
  const secondaryCta = { href: '/#pricing', label: aiAgentMessages.secondaryCta };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <FeatureHero
        title={aiAgentMessages.title}
        description={aiAgentMessages.description}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        mediaVariant="comparison"
        media={
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#666666]">
                {aiAgentMessages.mediaLabels.referenceVideo}
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
                {aiAgentMessages.mediaLabels.result}
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

      <FeatureBenefitRow
        title={aiAgentMessages.benefits.workflow.title}
        bullets={aiAgentMessages.benefits.workflow.bullets}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/canvas_video_clone.mp4"
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
        title={aiAgentMessages.benefits.naming.title}
        bullets={aiAgentMessages.benefits.naming.bullets}
        reverse
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
            <LazyVideoPlayer
              src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/canvas_config_1.mp4"
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
        title={aiAgentMessages.benefits.avatarAds.title}
        bullets={aiAgentMessages.benefits.avatarAds.bullets}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        media={
          <div className="overflow-hidden rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1">
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
