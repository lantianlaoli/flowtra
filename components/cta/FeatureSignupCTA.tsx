'use client';

import Image from 'next/image';
import { PricingButton } from '@/components/pages/landing/PricingButton';
import { useI18n } from '@/providers/I18nProvider';

const SITE_ASSET_BASE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets';

const PRODUCT_IMAGES = [
  `${SITE_ASSET_BASE_URL}/landing/case-1.png`,
  `${SITE_ASSET_BASE_URL}/landing/case-2.png`,
  `${SITE_ASSET_BASE_URL}/landing/case-3.png`,
  `${SITE_ASSET_BASE_URL}/landing/case-4.png`,
];

const STACK_CLASSES = [
  'left-2 top-10 -rotate-6',
  'left-[22%] top-0 rotate-3',
  'right-[20%] top-7 -rotate-3',
  'right-2 top-14 rotate-6',
];

type FeatureSignupCTAProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
};

export function FeatureSignupCTA({
  eyebrow,
  title,
  description,
  buttonLabel,
}: FeatureSignupCTAProps) {
  const { messages } = useI18n();
  const copy = messages.landing.liteCta;

  const resolvedEyebrow = eyebrow ?? copy.eyebrow;
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const resolvedButtonLabel = buttonLabel ?? copy.buttonLabel;

  return (
    <section className="px-4 py-12 md:px-6 md:py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-8 overflow-hidden rounded-[32px] border border-[#E7E7E7] bg-[#F7F7F7] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.04)] md:grid-cols-[0.95fr_1.05fr] md:p-8 lg:p-10">
        <div>
          <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.18em] text-[#666666]">{resolvedEyebrow}</p>
          <h2 className="max-w-xl text-[28px] font-bold tracking-tight text-black md:text-[34px]">{resolvedTitle}</h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-[#666666]">{resolvedDescription}</p>
          <div className="mt-6 max-w-[220px]">
            <PricingButton packageName="lite" label={resolvedButtonLabel} />
          </div>
        </div>

        <div className="relative h-[220px] sm:h-[260px]">
          {PRODUCT_IMAGES.map((src, index) => (
            <div
              key={src}
              className={`absolute h-[180px] w-[138px] overflow-hidden rounded-[24px] border border-white bg-white shadow-[0_20px_40px_rgba(0,0,0,0.14)] transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_28px_56px_rgba(0,0,0,0.18)] sm:h-[220px] sm:w-[168px] ${STACK_CLASSES[index]}`}
            >
              <Image
                src={src}
                alt="Product example"
                fill
                sizes="(max-width: 640px) 138px, 168px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
