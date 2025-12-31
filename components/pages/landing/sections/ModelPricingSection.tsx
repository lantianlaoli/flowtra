import { Zap, Check } from 'lucide-react';
import { SiGoogle, SiOpenai, SiX, SiBytedance } from 'react-icons/si';

export default function ModelPricingSection() {
  // Credit to USD conversion rate
  const CREDIT_TO_USD = 0.015; // $0.015 per credit

  const models = [
    {
      name: 'Veo3.1 fast',
      description: 'Fast generation with balanced quality and cost',
      icon: SiGoogle,
      badge: 'Popular',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 150, unit: 'per min' },
      ],
      quality: ['1080P'],
    },
    {
      name: 'Seedance 1.5 Pro',
      description: 'ByteDance model with built-in audio generation',
      icon: SiBytedance,
      badge: 'New',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 420, unit: 'per min' },
      ],
      quality: ['720P'],
    },
    {
      name: 'Veo3.1',
      description: 'Premium quality generation',
      icon: SiGoogle,
      badge: 'Premium',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1 min', credits: 1125, unit: 'per min' },
      ],
      quality: ['1080P'],
    },
  ];

  return (
    <section id="model-pricing" className="py-20 scroll-mt-24">
      <div className="text-center mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">Price details</h2>
        <p className="text-lg text-[#666666] max-w-2xl mx-auto">
          Transparent pricing for all video models. Choose the right model for your needs.
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block max-w-[1280px] mx-auto overflow-x-auto rounded-xl border border-[#E5E5E5] shadow-[0_20px_40px_rgba(0,0,0,0.05)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F7F7F7] border-b border-[#E5E5E5]">
              <th className="px-6 py-5 text-left text-[12px] font-bold text-black uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-5 text-left text-[12px] font-bold text-black uppercase tracking-wider">
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
                const usdCost = (option.credits * CREDIT_TO_USD).toFixed(2);

                return (
                  <tr
                    key={`${model.name}-${optionIndex}`}
                    className="hover:bg-[#F7F7F7] transition-colors"
                  >
                    {/* Model Name & Description - only show on first row */}
                    {isFirstRow && (
                      <td className="px-6 py-6" rowSpan={rowSpan}>
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 rounded-lg bg-[#F7F7F7] border border-[#E5E5E5]">
                            <Icon className="w-5 h-5 text-black" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[16px] font-bold text-black">
                                {model.name}
                              </h3>
                              {model.badge && (
                                <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                  {model.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Generation Cost */}
                    <td className="px-6 py-6">
                      <div className="text-[16px] font-bold text-black">
                        ${usdCost}
                      </div>
                      <p className="text-[12px] text-[#666666] mt-0.5">
                        {option.unit}
                      </p>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden grid grid-cols-1 gap-4 max-w-lg mx-auto">
        {models.map((model) => {
          const Icon = model.icon;
          return (
            <article
              key={model.name}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Icon className="w-6 h-6 text-gray-900" />
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
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Generation Cost
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900 block">
                          ${(option.credits * CREDIT_TO_USD).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {option.unit}
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
