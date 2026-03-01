import Link from 'next/link';
import type { ReactNode } from 'react';

type FeatureStep = {
  title: string;
  description: string;
};

type FeatureStepsSectionProps = {
  title: string;
  description?: string;
  steps: FeatureStep[];
  media: ReactNode;
  primaryCta?: {
    href: string;
    label: string;
  };
  secondaryCta?: {
    href: string;
    label: string;
  };
};

export default function FeatureStepsSection({
  title,
  description,
  steps,
  media,
  primaryCta,
  secondaryCta,
}: FeatureStepsSectionProps) {
  return (
    <section className="bg-white px-4 py-16 md:px-6 md:py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="space-y-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#666666]">
              How It Works
            </p>
            <h2 className="mt-3 text-[30px] font-bold tracking-[-0.02em] text-black md:text-[40px]">
              {title}
            </h2>
            {description ? (
              <p className="mt-4 max-w-xl text-[16px] leading-7 text-[#666666]">
                {description}
              </p>
            ) : null}
          </div>

          <div className="space-y-5">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-[14px] font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <h3 className="text-[18px] font-semibold text-black">{step.title}</h3>
                  <p className="mt-1 text-[15px] leading-6 text-[#666666]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {primaryCta ? (
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
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white px-6 py-3 text-[15px] font-semibold text-black transition-colors hover:bg-[#F3F3F3]"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        <div>{media}</div>
      </div>
    </section>
  );
}
