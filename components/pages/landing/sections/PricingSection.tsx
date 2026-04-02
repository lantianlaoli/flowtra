import { PricingButton } from "@/components/pages/landing/PricingButton";
import { Check, Zap, TrendingUp, Crown } from "lucide-react";
import Link from "next/link";
import { getPackageModelDurationRows } from "@/lib/constants";

type PlanFeatureItem = {
  label: string;
  bold?: boolean;
  badges?: string[];
};

const planFeatureItems: Record<"lite" | "basic" | "pro", PlanFeatureItem[]> = {
  lite: [
    { label: "1,930 Credits", bold: true },
    { label: "AI Agent", bold: true },
    { label: "Avatar Ads" },
    { label: "Clone viral videos" },
    { label: "Motion Clone" },
    { label: "10+ languages" },
    { label: "Latest video models" },
    { label: "TikTok publishing support" },
  ],
  basic: [
    { label: "3,930 Credits", bold: true },
    { label: "AI Agent", bold: true },
    { label: "Avatar Ads" },
    { label: "Clone viral videos" },
    { label: "Motion Clone" },
    { label: "10+ languages" },
    { label: "Latest video models" },
    { label: "TikTok publishing support" },
  ],
  pro: [
    { label: "6,600 Credits", bold: true },
    { label: "AI Agent", bold: true },
    { label: "Avatar Ads" },
    { label: "Clone viral videos" },
    { label: "Motion Clone" },
    { label: "10+ languages" },
    { label: "Latest video models" },
    { label: "TikTok publishing support" },
  ],
};

export default function PricingSection({
  showTitle = true,
  showWelcomeBonusCard = false,
  welcomeBonusCredits = 100,
}: {
  showTitle?: boolean;
  showWelcomeBonusCard?: boolean;
  welcomeBonusCredits?: number;
}) {
  const LITE_PRICE = 29;
  const BASIC_PRICE = 59;
  const PRO_PRICE = 99;

  const litePricing = LITE_PRICE;
  const basicPricing = BASIC_PRICE;
  const proPricing = PRO_PRICE;
  const liteModelDurations = getPackageModelDurationRows("lite");
  const basicModelDurations = getPackageModelDurationRows("basic");
  const proModelDurations = getPackageModelDurationRows("pro");

  return (
    <section id="pricing" className="py-14 md:py-20">
      {showTitle && (
        <div className="text-center mb-10 md:mb-16 px-4">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            Choose Your Plan
          </h2>
          <p className="text-base md:text-lg text-[#666666] mb-6">
            Monthly subscription with automatic credit reset
          </p>
        </div>
      )}

      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-8 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 ${
          showWelcomeBonusCard ? "lg:grid-cols-4" : "lg:grid-cols-3"
        }`}
      >
        {showWelcomeBonusCard && (
          <article className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-8">
            <h3 className="text-[20px] font-bold text-black tracking-tight mb-2">
              Welcome Bonus
            </h3>
            <p className="text-[14px] text-[#666666] mb-6 leading-6">
              Congratulations. You received{" "}
              <span className="font-semibold text-black">{welcomeBonusCredits} credits</span>.
            </p>

            <ul className="space-y-4 mb-10 flex-grow">
              {[
                "AI Agent",
                "Avatar Ads",
                "Clone viral video",
                "Motion Clone",
                "Unlimited product configuration",
                "Unlimited character configuration",
                "Import TikTok videos",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-[#666666]">
                  <Check className="w-4 h-4 text-black flex-shrink-0" />
                  <span className="font-medium text-black">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto">
              <Link
                href="/dashboard"
                className="landing-press-button landing-press-button--wide text-[14px] font-semibold"
              >
                Enter Console
              </Link>
            </div>
          </article>
        )}

        {/* Lite Plan */}

        <article
          className="landing-plan-card flex flex-col rounded-[24px] border border-[#E5E5E5] bg-white p-6 sm:p-8"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              Lite
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            Perfect for small creators starting out.
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={litePricing}>
                ${litePricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                /month
              </span>
            </div>

            {/* Trial Badge */}
            <div className="landing-plan-chip mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
              <span className="inline-flex items-center rounded-full bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                Trial
              </span>
              <span className="text-[12px] font-semibold leading-none text-black">
                1 Day Free Trial
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-green-500 motion-safe:animate-pulse motion-reduce:animate-none"
              />
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
                  {item.label}: {item.durationLabel}
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
              Recommended
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">
              Basic
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            Most popular for growing brands.
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={basicPricing}>
                ${basicPricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                /month
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
                  {item.label}: {item.durationLabel}
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
              Pro
            </h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">
            For power users and agencies.
          </p>

          <div className="mb-8">
            <div className="text-[40px] font-bold text-black leading-none">
              <data itemProp="price" value={proPricing}>
                ${proPricing}
              </data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">
                /month
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
                  {item.label}: {item.durationLabel}
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
