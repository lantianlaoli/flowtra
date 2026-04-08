'use client';

import Link from "next/link";
import { UserPlus, Copy, ArrowRight, Check, RefreshCw, Bot } from "lucide-react";
import { LazyVideoPlayer } from "@/components/pages/landing/LazyVideoPlayer";
import { useI18n } from "@/providers/I18nProvider";

type FeatureSectionProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  bullets: string[];
  media: React.ReactNode;
  mediaFirst?: boolean;
  isNew?: boolean;
};

function FeatureSection({
  title,
  description,
  href,
  icon: Icon,
  bullets,
  media,
  mediaFirst = false,
  isNew = false,
}: FeatureSectionProps) {
  const { messages } = useI18n();
  const featureMessages = messages.landing.features;

  return (
    <article className="grid items-center gap-10 border-t border-[#E8E8E8] py-10 first:border-t-0 first:pt-0 md:gap-16 md:py-14 lg:grid-cols-2 lg:py-16">
      <div
        className={`flex-1 space-y-8 ${
          mediaFirst ? "lg:order-2" : "lg:order-1"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className="landing-feature-icon flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F7F7F7]"
            aria-hidden="true"
          >
            <Icon className="w-6 h-6 text-black" />
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[24px] font-bold text-black">{title}</h3>
              {isNew ? (
                <span className="inline-flex items-center rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  {featureMessages.newBadge}
                </span>
              ) : null}
            </div>

            <p className="text-lg text-[#666666] leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="space-y-4 pl-0 md:pl-12">
          <ul className="space-y-4">
            {bullets.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[#666666]">
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>

          <Link
            href={href}
            className="landing-press-button landing-press-button--secondary landing-press-button--compact mt-2 text-[14px] font-semibold"
          >
            {featureMessages.learnMore}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div
        className={`flex-1 w-full ${
          mediaFirst ? "lg:order-1" : "lg:order-2"
        }`}
      >
        {media}
      </div>
    </article>
  );
}

export default function FeaturesSection() {
  const { messages } = useI18n();
  const featureMessages = messages.landing.features;

  return (
    <section className="py-12 md:py-16 lg:py-24">
      <div className="text-center max-w-3xl mx-auto mb-10 md:mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
          {featureMessages.title}
        </h2>

        <p className="text-base md:text-lg text-[#666666]">
          {featureMessages.description}
        </p>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-14 md:gap-24">
          <FeatureSection
            title={featureMessages.items[0].title}
            description={featureMessages.items[0].description}
            href={featureMessages.items[0].href}
            icon={Bot}
            bullets={featureMessages.items[0].bullets}
            isNew={featureMessages.items[0].isNew}
            media={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
                    {featureMessages.items[0].mediaLabels[0]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_refer_1.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    {featureMessages.items[0].mediaLabels[1]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/agent_result_1.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            }
          />

          <FeatureSection
            title={featureMessages.items[1].title}
            description={featureMessages.items[1].description}
            href={featureMessages.items[1].href}
            icon={Copy}
            mediaFirst
            bullets={featureMessages.items[1].bullets}
            media={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
                    {featureMessages.items[1].mediaLabels[0]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="/showcase/video-clone/reference-source.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    {featureMessages.items[1].mediaLabels[1]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="/showcase/video-clone/reference-result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            }
          />

          <FeatureSection
            title={featureMessages.items[2].title}
            description={featureMessages.items[2].description}
            href={featureMessages.items[2].href}
            icon={UserPlus}
            bullets={featureMessages.items[2].bullets}
            media={
              <div className="landing-feature-media relative mx-auto aspect-[9/16] max-w-[320px] overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/character_ads_case.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  eager
                  playsInline
                  loop
                />
              </div>
            }
          />

          <FeatureSection
            title={featureMessages.items[3].title}
            description={featureMessages.items[3].description}
            href={featureMessages.items[3].href}
            icon={RefreshCw}
            mediaFirst
            bullets={featureMessages.items[3].bullets}
            media={
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full text-[12px] font-bold uppercase tracking-wider text-black">
                    {featureMessages.items[3].mediaLabels[0]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_refer.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[12px] font-bold uppercase tracking-wider">
                    {featureMessages.items[3].mediaLabels[1]}
                  </div>

                  <div className="landing-feature-media relative aspect-[9/16] w-full overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      eager
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}
