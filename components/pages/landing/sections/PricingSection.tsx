'use client';

import Link from "next/link";
import { PricingButton } from "@/components/pages/landing/PricingButton";
import {
  Sparkles,
  Zap,
  TrendingUp,
  Crown,
  Coins,
  UserRound,
  Clapperboard,
  Activity,
  Search,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { getPackageSeedance2Mini15sVideoCount } from "@/lib/constants";
import { useI18n } from "@/providers/I18nProvider";

type PlanFeatureItem = {
  label: string;
  bold?: boolean;
  badges?: string[];
};

// Plan-feature icons indexed to match the i18n planFeatureItems order.
// Both en and zh locales must keep the same 5-entry array shape:
//   0. Credits        → Coins
//   1. AI Agent       → Sparkles
//   2. Avatar Ads     → UserRound
//   3. Clone viral videos → Clapperboard
//   4. Motion Clone   → Activity
// If you add/remove a feature, update both locales and this array together.
const PLAN_FEATURE_ICONS: readonly LucideIcon[] = [
  Coins,
  Sparkles,
  UserRound,
  Clapperboard,
  Activity,
];

type PackageKey = 'lite' | 'plus' | 'basic' | 'pro';

export default function PricingSection({
  showTitle = true,
}: {
  showTitle?: boolean;
}) {
  const { messages } = useI18n();
  const pricingMessages = messages.landing.pricing;
  const LITE_PRICE = 19;
  const PLUS_PRICE = 29;
  const BASIC_PRICE = 59;
  const PRO_PRICE = 99;

  const liteSeedance2Mini = pricingMessages.modelBenchmarkLine(
    getPackageSeedance2Mini15sVideoCount("lite")
  );
  const plusSeedance2Mini = pricingMessages.modelBenchmarkLine(
    getPackageSeedance2Mini15sVideoCount("plus")
  );
  const basicSeedance2Mini = pricingMessages.modelBenchmarkLine(
    getPackageSeedance2Mini15sVideoCount("basic")
  );
  const proSeedance2Mini = pricingMessages.modelBenchmarkLine(
    getPackageSeedance2Mini15sVideoCount("pro")
  );
  const planFeatureItems: Record<PackageKey, PlanFeatureItem[]> = {
    lite: pricingMessages.planFeatureItems.lite.map((label) => ({ label, bold: true })),
    plus: pricingMessages.planFeatureItems.plus.map((label) => ({ label, bold: true })),
    basic: pricingMessages.planFeatureItems.basic.map((label) => ({ label, bold: true })),
    pro: pricingMessages.planFeatureItems.pro.map((label) => ({ label, bold: true })),
  };

  return (
    <section id="pricing" className="py-14 md:py-20">
      {showTitle && (
        <div className="text-center mb-10 md:mb-16 px-4">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            {pricingMessages.title}
          </h2>
          <p className="text-base md:text-lg text-[#666666] mb-6">
            {pricingMessages.description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Explore Card (no plan, jump into dashboard preview) */}

        <Link
          href="/dashboard?preview=1"
          className="landing-plan-card flex flex-col items-center justify-center text-center rounded-[24px] border border-[#E5E5E5] bg-white p-5 sm:p-6 transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
            <Search className="w-6 h-6" aria-hidden="true" />
          </div>
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#666666] mb-1">
            {pricingMessages.exploreCard.eyebrow}
          </p>
          <h3 className="text-[20px] font-bold text-black mb-2">
            {pricingMessages.exploreCard.title}
          </h3>
          <p className="text-[14px] text-[#444444] mb-6">
            {pricingMessages.exploreCard.pitch}
          </p>
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white">
            {pricingMessages.exploreCard.cta}
            <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" />
          </span>
        </Link>

        {/* Lite Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-5 sm:p-6"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              {pricingMessages.plans.lite.name}
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            {pricingMessages.plans.lite.description}
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={LITE_PRICE}>
                ${LITE_PRICE}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>

          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {planFeatureItems.lite.map((item, idx) => {
              const FeatureIcon = PLAN_FEATURE_ICONS[idx] ?? Sparkles;
              return (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-[14px] font-bold text-black"
                >
                  <FeatureIcon className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="font-bold text-black">{item.label}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 text-[14px] font-bold text-black">
              <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
              <span className="font-bold text-black">
                <span className="underline">{liteSeedance2Mini.count}</span>
                {` ${liteSeedance2Mini.suffix}`}
              </span>
            </li>
          </ul>

          <PricingButton packageName="lite" />
        </article>

        {/* Plus Plan (Recommended) */}

        <article
          className="landing-plan-card landing-plan-card--featured relative flex flex-col rounded-[24px] border-2 border-black bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.1)] sm:p-6"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
            <div className="landing-plan-recommended bg-black px-4 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider text-white shadow-md">
              {pricingMessages.recommended}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              {pricingMessages.plans.plus.name}
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            {pricingMessages.plans.plus.description}
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={PLUS_PRICE}>
                ${PLUS_PRICE}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {planFeatureItems.plus.map((item, idx) => {
              const FeatureIcon = PLAN_FEATURE_ICONS[idx] ?? Sparkles;
              return (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-[14px] font-bold text-black"
                >
                  <FeatureIcon className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="font-bold text-black">{item.label}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 text-[14px] font-bold text-black">
              <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
              <span className="font-bold text-black">
                <span className="underline">{plusSeedance2Mini.count}</span>
                {` ${plusSeedance2Mini.suffix}`}
              </span>
            </li>
          </ul>

          <PricingButton packageName="plus" />
        </article>

        {/* Pro Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-5 sm:p-6"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              {pricingMessages.plans.basic.name}
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            {pricingMessages.plans.basic.description}
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={BASIC_PRICE}>
                ${BASIC_PRICE}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {planFeatureItems.basic.map((item, idx) => {
              const FeatureIcon = PLAN_FEATURE_ICONS[idx] ?? Sparkles;
              return (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-[14px] font-bold text-black"
                >
                  <FeatureIcon className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="font-bold text-black">{item.label}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 text-[14px] font-bold text-black">
              <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
              <span className="font-bold text-black">
                <span className="underline">{basicSeedance2Mini.count}</span>
                {` ${basicSeedance2Mini.suffix}`}
              </span>
            </li>
          </ul>

          <PricingButton packageName="basic" />
        </article>

        {/* Ultra Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-5 sm:p-6"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              {pricingMessages.plans.pro.name}
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            {pricingMessages.plans.pro.description}
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={PRO_PRICE}>
                ${PRO_PRICE}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>
          </div>

          <ul className="space-y-3 mb-8 flex-grow">
            {planFeatureItems.pro.map((item, idx) => {
              const FeatureIcon = PLAN_FEATURE_ICONS[idx] ?? Sparkles;
              return (
                <li
                  key={idx}
                  className="flex items-center gap-3 text-[14px] font-bold text-black"
                >
                  <FeatureIcon className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="font-bold text-black">{item.label}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 text-[14px] font-bold text-black">
              <Sparkles className="w-4 h-4 text-black flex-shrink-0" />
              <span className="font-bold text-black">
                <span className="underline">{proSeedance2Mini.count}</span>
                {` ${proSeedance2Mini.suffix}`}
              </span>
            </li>
          </ul>

          <PricingButton packageName="pro" />
        </article>
      </div>
    </section>
  );
}
