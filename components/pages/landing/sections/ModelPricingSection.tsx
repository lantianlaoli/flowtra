import { Google, ByteDance, Kling } from '@lobehub/icons';

export default function ModelPricingSection() {
  // Credit to USD conversion rate
  const CREDIT_TO_USD = 0.015; // $0.015 per credit

  type PricingOption = {
    duration: string;
    credits: number;
    unit: string;
    comingSoon?: boolean;
  };

  const models = [
    {
      name: 'Veo3.1 fast',
      description: 'Fast generation with balanced quality and cost',
      icon: Google,
      badge: 'Popular',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 150, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1080p', '4K'],
    },
    {
      name: 'Veo3.1',
      description: 'Premium quality generation',
      icon: Google,
      badge: 'Premium',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 1125, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1080p', '4K'],
    },
    {
      name: 'Nano Banana Pro',
      description: 'High-resolution generation with zero cost',
      icon: Google,
      badge: 'Free',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 0, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1K', '2K', '4K'],
    },
    {
      name: 'Kling 2.6 Motion Control',
      description: 'Precise motion control for dynamic video generation',
      icon: Kling,
      badge: 'New',
      durationRange: '5-10s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 540, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1080p'],
    },
    {
      name: 'Kling 3.0',
      description: 'Latest Kling model for clone video generation with audio',
      icon: Kling,
      badge: 'Latest',
      durationRange: '3-60s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 2400, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1080p'],
    },
    {
      name: 'Seedance 1.5 Pro',
      description: 'ByteDance model with built-in audio generation',
      icon: ByteDance,
      badge: 'New',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 900, unit: 'per min' },
      ] as PricingOption[],
      quality: ['1080p'],
    },
    {
      name: 'Seedance 2',
      description: 'Next-generation Seedance model. Coming soon.',
      icon: ByteDance,
      badge: 'Soon',
      durationRange: '-',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 0, unit: 'coming soon', comingSoon: true },
      ] as PricingOption[],
      quality: ['1080p'],
    },
  ];

  return (
    <section id="model-pricing" className="scroll-mt-24 px-4 py-20 md:px-6 md:py-24">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-[32px] font-bold tracking-tight text-black md:text-[40px]">Price details</h2>
        <p className="text-lg text-[#666666] max-w-2xl mx-auto">
          Transparent pricing for all models. Choose the right model for your needs.
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="mx-auto hidden max-w-6xl overflow-x-auto rounded-2xl border border-[#E5E5E5] bg-white md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-6 py-5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-black lg:px-7">
                Model
              </th>
              <th className="px-6 py-5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-black lg:px-7">
                Resolution
              </th>
              <th className="px-6 py-5 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-black lg:px-7">
                Generation Cost
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#E5E5E5]">
            {models.map((model) => {
              const Icon = model.icon;
              const isMultiRow = model.pricingOptions.length > 1;

              return model.pricingOptions.map((option, optionIndex) => {
                const isFirstRow = optionIndex === 0;
                const rowSpan = isMultiRow ? model.pricingOptions.length : 1;
                const isComingSoon = Boolean(option.comingSoon);
                const isFree = option.credits === 0;
                const usdCost = (option.credits * CREDIT_TO_USD).toFixed(2);

                return (
                  <tr
                    key={`${model.name}-${optionIndex}`}
                    className="transition-colors hover:bg-[#FCFCFC]"
                  >
                    {/* Model Name & Description - only show on first row */}
                    {isFirstRow && (
                      <td className="px-6 py-6 lg:px-7 lg:py-7" rowSpan={rowSpan}>
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg border border-[#E5E5E5] bg-white p-2.5">
                            <Icon className="w-5 h-5 text-black" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[16px] font-bold text-black">
                                {model.name}
                              </h3>
                              {model.badge && (
                                <span className="rounded bg-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                                  {model.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Resolution */}
                    {isFirstRow && (
                      <td className="px-6 py-6 lg:px-7 lg:py-7" rowSpan={rowSpan}>
                        <div className="flex flex-wrap items-center gap-2">
                          {model.quality.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[#E5E5E5] bg-[#F7F7F7] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-black"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </td>
                    )}

                    {/* Generation Cost */}
                    <td className="px-6 py-6 lg:px-7 lg:py-7">
                      <div className="text-[16px] font-bold tracking-tight text-black">
                        {isComingSoon ? 'Coming soon' : (isFree ? 'Free' : `$${usdCost}`)}
                      </div>
                      {!isComingSoon && !isFree && (
                        <p className="mt-1 text-[12px] text-[#666666]">
                          {option.unit}
                        </p>
                      )}
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
              className="rounded-2xl border border-[#E5E5E5] bg-white p-5"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] p-2">
                  <Icon className="h-6 w-6 text-gray-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900">
                      {model.name}
                    </h3>
                    {model.badge && (
                      <span className="bg-gray-900 text-white text-xs font-medium px-2 py-0.5 rounded">
                        {model.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {model.description}
                  </p>
                </div>
              </div>

              {/* Pricing Details */}
              <div className="space-y-3">
                {model.pricingOptions.map((option, idx) => (
                  <div key={idx} className="rounded-xl border border-[#EDEDED] bg-[#FAFAFA] p-3.5">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Generation Cost
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900 block">
                          {option.comingSoon
                            ? 'Coming soon'
                            : option.credits === 0
                            ? 'Free'
                            : `$${(option.credits * CREDIT_TO_USD).toFixed(2)}`}
                        </span>
                        {!option.comingSoon && option.credits !== 0 && (
                          <span className="text-xs text-gray-500">
                            {option.unit}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Resolution</span>
                      <div className="flex flex-wrap justify-end gap-1">
                        {model.quality.map((item) => (
                          <span
                            key={item}
                            className="text-[10px] font-semibold text-gray-800 uppercase tracking-wide border border-gray-200 bg-white px-2 py-0.5 rounded-full"
                          >
                            {item}
                          </span>
                        ))}
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
