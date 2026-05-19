'use client';

import Link from 'next/link';
import { ArrowRight, Bot, Check, Copy, RefreshCw, UserPlus } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import { useI18n } from '@/providers/I18nProvider';

type FeatureCardProps = {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  bullets: string[];
  media: ReactNode;
  isNew?: boolean;
  className?: string;
};

function FeatureCard({
  title,
  description,
  href,
  icon: Icon,
  bullets,
  media,
  isNew = false,
  className = '',
}: FeatureCardProps) {
  const { messages } = useI18n();
  const featureMessages = messages.landing.features;

  return (
    <article
      className={`landing-info-card grid overflow-hidden rounded-[28px] border border-[#E7E7E7] bg-white p-5 shadow-[0_16px_38px_rgba(0,0,0,0.04)] md:p-6 ${className}`}
    >
      <div className="flex min-h-0 flex-col">
        <div className="mb-4 flex items-start gap-3">
          <div
            className="landing-feature-icon flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F7F7F7]"
            aria-hidden="true"
          >
            <Icon className="h-5 w-5 text-black" />
          </div>

          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h3 className="text-[21px] font-bold tracking-tight text-black">{title}</h3>
              {isNew ? (
                <span className="inline-flex items-center rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  {featureMessages.newBadge}
                </span>
              ) : null}
            </div>
            <p className="text-[14px] leading-6 text-[#666666] md:text-[15px]">{description}</p>
          </div>
        </div>

        <ul className="mb-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {bullets.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13px] leading-5 text-[#666666]">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-black" />
              <span className="font-medium">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto">{media}</div>

        <Link
          href={href}
          className="landing-press-button landing-press-button--secondary landing-press-button--compact mt-4 w-fit text-[13px] font-semibold"
        >
          {featureMessages.learnMore}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function ComparisonMedia({
  firstLabel,
  secondLabel,
  firstSrc,
  secondSrc,
}: {
  firstLabel: string;
  secondLabel: string;
  firstSrc: string;
  secondSrc: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: firstLabel, src: firstSrc, emphasized: false },
        { label: secondLabel, src: secondSrc, emphasized: true },
      ].map((item) => (
        <div key={item.label} className="space-y-2">
          <div
            className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
              item.emphasized
                ? 'bg-black text-white'
                : 'border border-[#E5E5E5] bg-[#F7F7F7] text-black'
            }`}
          >
            {item.label}
          </div>
          <div className="landing-feature-media relative aspect-[9/12] overflow-hidden rounded-[20px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_16px_28px_rgba(0,0,0,0.08)]">
            <LazyVideoPlayer
              src={item.src}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              eager
              playsInline
              loop
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeaturesSection() {
  const { messages } = useI18n();
  const featureMessages = messages.landing.features;
  const [agent, videoClone, avatarAds, motionClone] = featureMessages.items;

  return (
    <section className="py-10 md:py-12 lg:py-14">
      <div className="mx-auto mb-7 max-w-3xl px-4 text-center md:mb-8">
        <h2 className="mb-3 text-[32px] font-bold tracking-tight text-black md:text-[40px]">
          {featureMessages.title}
        </h2>
        <p className="text-base text-[#666666] md:text-lg">{featureMessages.description}</p>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <FeatureCard
            title={agent.title}
            description={agent.description}
            href={agent.href}
            icon={Bot}
            bullets={agent.bullets}
            isNew={agent.isNew}
            media={
              <div className="landing-feature-media relative aspect-video overflow-hidden rounded-[22px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_18px_30px_rgba(0,0,0,0.08)]">
                <LazyVideoPlayer
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/canvas_avatar_ads.mp4"
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  eager
                  playsInline
                  loop
                />
              </div>
            }
          />

          <FeatureCard
            title={videoClone.title}
            description={videoClone.description}
            href={videoClone.href}
            icon={Copy}
            bullets={videoClone.bullets}
            media={
              <ComparisonMedia
                firstLabel={videoClone.mediaLabels[0]}
                secondLabel={videoClone.mediaLabels[1]}
                firstSrc="/showcase/video-clone/reference-source.mp4"
                secondSrc="/showcase/video-clone/reference-result.mp4"
              />
            }
          />

          <FeatureCard
            title={avatarAds.title}
            description={avatarAds.description}
            href={avatarAds.href}
            icon={UserPlus}
            bullets={avatarAds.bullets}
            media={
              <div className="landing-feature-media relative mx-auto aspect-[9/12] w-full max-w-[220px] overflow-hidden rounded-[22px] border border-[#E5E5E5] bg-[#F1F1F1] shadow-[0_18px_30px_rgba(0,0,0,0.08)]">
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

          <FeatureCard
            title={motionClone.title}
            description={motionClone.description}
            href={motionClone.href}
            icon={RefreshCw}
            bullets={motionClone.bullets}
            media={
              <ComparisonMedia
                firstLabel={motionClone.mediaLabels[0]}
                secondLabel={motionClone.mediaLabels[1]}
                firstSrc="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_refer.mp4"
                secondSrc="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/motion_swap_result.mp4"
              />
            }
          />
        </div>
      </div>
    </section>
  );
}
