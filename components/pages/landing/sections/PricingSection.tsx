'use client';

import { PricingButton } from "@/components/pages/landing/PricingButton";
import { Check, Zap, TrendingUp, Crown } from "lucide-react";
import { getPackageModelDurationRows } from "@/lib/constants";
import { useI18n } from "@/providers/I18nProvider";

type PlanFeatureItem = {
  label: string;
  bold?: boolean;
  badges?: string[];
};

export default function PricingSection({
  showTitle = true,
}: {
  showTitle?: boolean;
}) {
  const { messages } = useI18n();
  const pricingMessages = messages.landing.pricing;
  const LITE_PRICE = 29;
  const BASIC_PRICE = 59;
  const PRO_PRICE = 99;

  const litePricing = LITE_PRICE;
  const basicPricing = BASIC_PRICE;
  const proPricing = PRO_PRICE;
  const liteModelDurations = getPackageModelDurationRows("lite");
  const basicModelDurations = getPackageModelDurationRows("basic");
  const proModelDurations = getPackageModelDurationRows("pro");
  const planFeatureItems: Record<"lite" | "basic" | "pro", PlanFeatureItem[]> = {
    lite: pricingMessages.planFeatureItems.lite.map((label, index) => ({ label, bold: index < 2 })),
    basic: pricingMessages.planFeatureItems.basic.map((label, index) => ({ label, bold: index < 2 })),
    pro: pricingMessages.planFeatureItems.pro.map((label, index) => ({ label, bold: index < 2 })),
  };
  const formatModelDuration = (durationLabel: string, durationLabels?: string[]) =>
    durationLabels?.length ? durationLabels.join(" / ") : durationLabel;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 lg:grid-cols-3">
        {/* Lite Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-6 sm:p-8"
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
              <data itemProp="price" value={litePricing}>
                ${litePricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>

          </div>

          <ul className="space-y-4 mb-10 flex-grow">
            {planFeatureItems.lite.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="flex flex-wrap items-center gap-2">
                  <span className={item.bold ? "font-semibold text-black" : ""}>
                    {item.label}
                  </span>
                  {(item.badges ?? []).map((badge: string) => (
                    <span
                      key={badge}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        badge === "Free"
                          ? "border border-[#16A34A] bg-[#F0FDF4] text-[#15803D]"
                          : "text-black/55"
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </li>
            ))}
            {liteModelDurations.map((item) => (
              <li
                key={item.model}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="font-semibold text-black">
                  {item.label}: {formatModelDuration(item.durationLabel, item.durationLabels)}
                </span>
              </li>
            ))}
          </ul>

          <PricingButton packageName="lite" />
        </article>

        {/* Basic Plan (Recommended) */}

        <article
          className="landing-plan-card landing-plan-card--featured relative flex flex-col rounded-[24px] border-2 border-black bg-white p-6 shadow-[0_20px_40px_rgba(0,0,0,0.1)] sm:p-8"
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
              {pricingMessages.plans.basic.name}
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            {pricingMessages.plans.basic.description}
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={basicPricing}>
                ${basicPricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>
          </div>

          <ul className="space-y-4 mb-10 flex-grow">
            {planFeatureItems.basic.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="flex flex-wrap items-center gap-2">
                  <span className={item.bold ? "font-semibold text-black" : ""}>
                    {item.label}
                  </span>
                  {(item.badges ?? []).map((badge: string) => (
                    <span
                      key={badge}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        badge === "Free"
                          ? "border border-[#16A34A] bg-[#F0FDF4] text-[#15803D]"
                          : "text-black/55"
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </li>
            ))}
            {basicModelDurations.map((item) => (
              <li
                key={item.model}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="font-semibold text-black">
                  {item.label}: {formatModelDuration(item.durationLabel, item.durationLabels)}
                </span>
              </li>
            ))}
          </ul>

          <PricingButton packageName="basic" />
        </article>

        {/* Pro Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-6 sm:p-8"
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
              <data itemProp="price" value={proPricing}>
                ${proPricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                {pricingMessages.perMonth}
              </span>
            </div>
          </div>

          <ul className="space-y-4 mb-10 flex-grow">
            {planFeatureItems.pro.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="flex flex-wrap items-center gap-2">
                  <span className={item.bold ? "font-semibold text-black" : ""}>
                    {item.label}
                  </span>
                  {(item.badges ?? []).map((badge: string) => (
                    <span
                      key={badge}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        badge === "Free"
                          ? "border border-[#16A34A] bg-[#F0FDF4] text-[#15803D]"
                          : "text-black/55"
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </span>
              </li>
            ))}
            {proModelDurations.map((item) => (
              <li
                key={item.model}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />
                <span className="font-semibold text-black">
                  {item.label}: {formatModelDuration(item.durationLabel, item.durationLabels)}
                </span>
              </li>
            ))}
          </ul>

          <PricingButton packageName="pro" />
        </article>
      </div>
    </section>
  );
}
