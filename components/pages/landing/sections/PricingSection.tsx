import { PricingButton } from "@/components/pages/landing/PricingButton";
import { Check, Zap, TrendingUp, Crown } from "lucide-react";
import Link from "next/link";

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

  return (
    <section id="pricing" className="py-20">
      {showTitle && (
        <div className="text-center mb-16 px-4">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            Choose Your Plan
          </h2>
          <p className="text-lg text-[#666666] mb-6">
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
          <article className="bg-white rounded-xl border border-[#E5E5E5] p-8 flex flex-col">
            <h3 className="text-[20px] font-bold text-black tracking-tight mb-2">
              Welcome Bonus
            </h3>
            <p className="text-[14px] text-[#666666] mb-6 leading-6">
              Congratulations. You received{" "}
              <span className="font-semibold text-black">{welcomeBonusCredits} credits</span>.
            </p>

            <ul className="space-y-4 mb-10 flex-grow">
              {[
                "Avatar Ads",
                "Clone viral video",
                "Motion Swap",
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
                className="w-full inline-flex items-center justify-center rounded-lg bg-black px-4 py-3 text-[14px] font-semibold text-white hover:bg-[#1f1f1f] transition-colors"
              >
                Enter Console
              </Link>
            </div>
          </article>
        )}

        {/* Lite Plan */}

        <article
          className="bg-white rounded-xl border border-[#E5E5E5] p-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col"
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
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-black bg-white px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
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
            {[
              { label: "1,930 Credits", bold: true },

              { label: "Avatar Ads" },

              { label: "Clone viral videos" },

              { label: "Motion Swap" },

              { label: "12.8 minutes of video", bold: true },

              { label: "10+ languages" },

              { label: "Latest video models" },

              { label: "TikTok publishing support" },
            ].map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>
                  {item.label}
                </span>
              </li>
            ))}

          </ul>

          <PricingButton packageName="lite" />
        </article>

        {/* Basic Plan (Recommended) */}

        <article
          className="relative bg-white rounded-xl border-2 border-black p-8 shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col"
          itemScope
          itemType="https://schema.org/Offer"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-black text-white px-4 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider shadow-md">
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
            {[
              { label: "3,930 Credits", bold: true },

              { label: "Avatar Ads" },

              { label: "Clone viral videos" },

              { label: "Motion Swap" },

              { label: "26.2 minutes of video", bold: true },

              { label: "10+ languages" },

              { label: "Latest video models" },

              { label: "TikTok publishing support" },
            ].map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <PricingButton packageName="basic" />
        </article>

        {/* Pro Plan */}

        <article
          className="bg-white rounded-xl border border-[#E5E5E5] p-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col"
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
            {[
              { label: "6,600 Credits", bold: true },

              { label: "Avatar Ads" },

              { label: "Clone viral videos" },

              { label: "Motion Swap" },

              { label: "44.0 minutes of video", bold: true },

              { label: "10+ languages" },

              { label: "Latest video models" },

              { label: "TikTok publishing support" },
            ].map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 text-[14px] text-[#666666]"
              >
                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>
                  {item.label}
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
