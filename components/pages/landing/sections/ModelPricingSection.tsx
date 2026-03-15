import { Google, ByteDance, Kling } from '@lobehub/icons';
import { BadgeDollarSign, Boxes, Coins, ScanLine } from 'lucide-react';

export default function ModelPricingSection() {
  // Credit to USD conversion rate
  const CREDIT_TO_USD = 0.015; // $0.015 per credit

  type PricingOption = {
    resolution: string;
    credits: number;
    comingSoon?: boolean;
  };

  const models = [
    {
      name: 'Veo3.1 fast',
      description: 'Fast generation with balanced quality and cost',
      icon: Google,
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '720p', credits: 150 },
        { resolution: '1080p', credits: 187.5 },
        { resolution: '4K', credits: 450 },
      ] as PricingOption[],
    },
    {
      name: 'Veo3.1',
      description: 'Premium quality generation',
      icon: Google,
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '720p', credits: 1125 },
        { resolution: '1080p', credits: 1162.5 },
        { resolution: '4K', credits: 1425 },
      ] as PricingOption[],
    },
    {
      name: 'Nano Banana 2',
      description: 'Consistent image generation for multi-angle and reference photos',
      icon: Google,
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '1K', credits: 0 },
      ] as PricingOption[],
    },
    {
      name: 'Kling 3.0 Motion Control',
      description: 'Motion-control generation priced at the latest Standard and Pro API rates',
      icon: Kling,
      badge: 'New',
      durationRange: '3-30s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '720p', credits: 1200 },
        { resolution: '1080p', credits: 1620 },
      ] as PricingOption[],
    },
    {
      name: 'Kling 3.0',
      description: 'Clone video generation with audio enabled, matched to the latest API pricing',
      icon: Kling,
      badge: 'New',
      durationRange: '3-60s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '720p', credits: 1200 },
        { resolution: '1080p', credits: 1620 },
      ] as PricingOption[],
    },
    {
      name: 'Seedance 1.5 Pro',
      description: 'ByteDance model with built-in audio generation',
      icon: ByteDance,
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '480p', credits: 210 },
        { resolution: '720p', credits: 420 },
        { resolution: '1080p', credits: 900 },
      ] as PricingOption[],
    },
    {
      name: 'Seedance 2',
      description: 'Next-generation Seedance model. Coming soon.',
      icon: ByteDance,
      durationRange: '-',
      billingType: 'generation' as const,
      pricingOptions: [
        { resolution: '1080p', credits: 0, comingSoon: true },
      ] as PricingOption[],
    },
  ];

  const formatUsdPerSecond = (creditsPerMinute: number) => {
    const usdPerSecond = (creditsPerMinute * CREDIT_TO_USD) / 60;
    return `$${usdPerSecond.toFixed(2)}`;
  };

  const formatCreditsPerSecond = (creditsPerMinute: number) => {
    const creditsPerSecond = creditsPerMinute / 60;
    return Number.isInteger(creditsPerSecond)
      ? String(creditsPerSecond)
      : creditsPerSecond.toFixed(2);
  };

  return (
    <section
      id="model-pricing"
      className="scroll-mt-24 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfb_100%)] px-4 py-14 md:px-6 md:py-24"
    >
      <div className="mb-10 md:mb-14 text-center">
        <h2 className="mb-4 text-[32px] font-bold tracking-tight text-black md:text-[40px]">Price details</h2>
        <p className="text-base md:text-lg text-[#666666] max-w-2xl mx-auto">
          Transparent pricing for all models. Choose the right model for your needs.
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="mx-auto hidden max-w-6xl overflow-x-auto rounded-[28px] border border-[#E7E7E7] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)] md:block">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-[#E7E7E7] bg-[linear-gradient(180deg,#fcfcfc_0%,#f7f7f7_100%)]">
              <th className="px-8 py-6 text-left text-[12px] font-bold uppercase tracking-[0.18em] text-[#111111] lg:px-9">
                <span className="inline-flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-[#555555]" />
                  <span>Model</span>
                </span>
              </th>
              <th className="border-l border-[#E7E7E7] px-8 py-6 text-left text-[12px] font-bold uppercase tracking-[0.18em] text-[#111111] lg:px-9">
                <span className="inline-flex items-center gap-2">
                  <ScanLine className="h-4 w-4 text-[#555555]" />
                  <span>Resolution</span>
                </span>
              </th>
              <th className="border-l border-[#E7E7E7] px-8 py-6 text-left text-[12px] font-bold uppercase tracking-[0.18em] text-[#111111] lg:px-9">
                <span className="inline-flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#555555]" />
                  <span>Credits / Sec</span>
                </span>
              </th>
              <th className="border-l border-[#E7E7E7] px-8 py-6 text-left text-[12px] font-bold uppercase tracking-[0.18em] text-[#111111] lg:px-9">
                <span className="inline-flex items-center gap-2">
                  <BadgeDollarSign className="h-4 w-4 text-[#555555]" />
                  <span>Generation Cost / Sec</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#EEEEEE]">
            {models.map((model) => {
              const Icon = model.icon;
              const isMultiRow = model.pricingOptions.length > 1;

              return model.pricingOptions.map((option, optionIndex) => {
                const isFirstRow = optionIndex === 0;
                const rowSpan = isMultiRow ? model.pricingOptions.length : 1;
                const isComingSoon = Boolean(option.comingSoon);
                const isFree = option.credits === 0;

                return (
                  <tr
                    key={`${model.name}-${optionIndex}`}
                    className="transition-colors duration-200 hover:bg-[#FCFCFC]"
                  >
                    {/* Model Name & Description - only show on first row */}
                    {isFirstRow && (
                      <td className="px-8 py-6 align-middle lg:px-9 lg:py-6" rowSpan={rowSpan}>
                        <div className="flex items-center gap-4">
                          <div className="rounded-2xl border border-[#E8E8E8] bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f8_100%)] p-2.5 shadow-[0_6px_20px_rgba(0,0,0,0.03)]">
                            <Icon className="h-5 w-5 text-black" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5">
                              <h3 className="text-[17px] font-bold tracking-tight text-black">
                                {model.name}
                              </h3>
                              {model.badge && (
                                <span className="rounded-full border border-black bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                                  {model.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Resolution */}
                    <td className="border-l border-[#E7E7E7] px-8 py-6 align-middle lg:px-9 lg:py-6">
                      <span className="text-[17px] font-bold tracking-tight text-black uppercase">
                        {option.resolution}
                      </span>
                    </td>

                    {/* Credits / Sec */}
                    <td className="border-l border-[#E7E7E7] px-8 py-6 align-middle lg:px-9 lg:py-6">
                      <div className="text-[17px] font-bold tracking-tight text-black">
                        {isComingSoon ? 'Coming soon' : (isFree ? 'Free' : formatCreditsPerSecond(option.credits))}
                      </div>
                    </td>

                    {/* Generation Cost */}
                    <td className="border-l border-[#E7E7E7] px-8 py-6 align-middle lg:px-9 lg:py-6">
                      <div className="text-[17px] font-bold tracking-tight text-black">
                        {isComingSoon ? 'Coming soon' : (isFree ? 'Free' : formatUsdPerSecond(option.credits))}
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="mx-auto grid max-w-lg grid-cols-1 gap-4 md:hidden">
        {models.map((model) => {
          const Icon = model.icon;
          return (
            <article
              key={model.name}
              className="rounded-[24px] border border-[#E7E7E7] bg-white p-5 shadow-[0_14px_36px_rgba(0,0,0,0.04)] sm:p-6"
            >
              {/* Header */}
              <div className="mb-5 flex items-center gap-3.5">
                <div className="rounded-2xl border border-[#E7E7E7] bg-[linear-gradient(180deg,#ffffff_0%,#f8f8f8_100%)] p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.03)]">
                  <Icon className="h-6 w-6 text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[17px] font-bold tracking-tight text-black">
                      {model.name}
                    </h3>
                    {model.badge && (
                      <span className="rounded-full border border-black bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                        {model.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing Details */}
              <div className="space-y-3.5">
                {model.pricingOptions.map((option, idx) => (
                  <div key={idx} className="rounded-2xl border border-[#ECECEC] bg-[linear-gradient(180deg,#fbfbfb_0%,#f7f7f7_100%)] p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#666666]">
                          Credits / Sec
                        </span>
                        <div className="mt-1 text-[18px] font-bold tracking-tight text-black">
                          {option.comingSoon
                            ? 'Coming soon'
                            : option.credits === 0
                            ? 'Free'
                            : formatCreditsPerSecond(option.credits)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#666666]">
                          Generation Cost / Sec
                        </span>
                        <div className="mt-1 text-[18px] font-bold tracking-tight text-black">
                          {option.comingSoon
                            ? 'Coming soon'
                            : option.credits === 0
                            ? 'Free'
                            : formatUsdPerSecond(option.credits)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#E9E9E9] pt-3 text-xs text-[#666666]">
                      <span className="font-medium uppercase tracking-[0.1em]">Resolution</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        <span className="text-[18px] font-bold tracking-tight text-black uppercase">
                          {option.resolution}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
