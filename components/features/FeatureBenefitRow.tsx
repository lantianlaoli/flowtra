import Link from 'next/link';
import type { ReactNode } from 'react';

type FeatureBenefitRowProps = {
  title: string;
  description?: string;
  bullets: string[];
  media: ReactNode;
  reverse?: boolean;
  primaryCta?: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
};

export default function FeatureBenefitRow({
  title,
  description,
  bullets,
  media,
  reverse = false,
  primaryCta,
  secondaryCta,
}: FeatureBenefitRowProps) {
  return (
    <section className="px-4 py-16 md:px-6 md:py-20 lg:py-28">
      <div
        className={`mx-auto grid max-w-7xl items-center gap-14 lg:gap-20 ${
          reverse ? 'lg:grid-cols-[1.08fr_0.92fr]' : 'lg:grid-cols-[0.92fr_1.08fr]'
        }`}
      >
        <div className={`space-y-6 ${reverse ? 'order-2 lg:order-2' : 'order-2 lg:order-1'}`}>
          <div>
            <h2 className="text-[30px] font-bold tracking-[-0.02em] text-black md:text-[40px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#666666]">
                {description}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-black" />
                <p className="text-[15px] leading-6 text-[#666666]">{bullet}</p>
              </div>
            ))}
          </div>

          {primaryCta ? (
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href={primaryCta.href}
                className="landing-press-button text-[15px] font-semibold"
              >
                {primaryCta.label}
              </Link>
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="landing-press-button landing-press-button--secondary text-[15px] font-semibold"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={reverse ? 'order-1 lg:order-1' : 'order-1 lg:order-2'}>{media}</div>
      </div>
    </section>
  );
}
