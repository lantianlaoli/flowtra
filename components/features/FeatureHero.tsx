import Link from 'next/link';
import type { ReactNode } from 'react';

type FeatureHeroProps = {
  title: string;
  description: string;
  primaryCta: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
  media?: ReactNode;
  mediaVariant?: 'singleVideo' | 'comparison' | 'emptyPlaceholder';
};

export default function FeatureHero({
  title,
  description,
  primaryCta,
  secondaryCta,
  media,
  mediaVariant = 'singleVideo',
}: FeatureHeroProps) {
  const mediaShellClassName =
    mediaVariant === 'comparison'
      ? 'w-full rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1'
      : mediaVariant === 'emptyPlaceholder'
        ? 'w-full rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_18px_40px_rgba(0,0,0,0.04)] transition-transform duration-200 hover:-translate-y-1'
        : 'w-fit max-w-full lg:ml-auto rounded-[28px] border border-[#E5E5E5] bg-[#FAFAFA] shadow-[0_20px_48px_rgba(0,0,0,0.06)] transition-transform duration-200 hover:-translate-y-1';

  return (
    <section className="px-4 py-16 md:px-6 md:py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-[40px] font-bold tracking-[-0.03em] text-black md:text-[56px] lg:text-[68px]">
            {title}
          </h1>
          <p className="max-w-xl text-[16px] leading-7 text-[#666666] md:text-[18px]">
            {description}
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href={primaryCta.href}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-black px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#1A1A1A]"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white px-6 py-3 text-[15px] font-semibold text-black transition-colors hover:bg-[#F7F7F7]"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>

        <div>
          <div className={mediaShellClassName}>{media}</div>
        </div>
      </div>
    </section>
  );
}
