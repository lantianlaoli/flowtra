import { Zap, Check } from 'lucide-react';
import { SiGoogle, SiOpenai, SiX } from 'react-icons/si';

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
        { duration: '8s segment', credits: 20, unit: 'per 8s' },
      ],
      quality: ['720p'],
    },
    {
      name: 'Veo3.1',
      description: 'Premium quality generation',
      icon: SiGoogle,
      badge: 'Premium',
      durationRange: '8-64s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '8s segment', credits: 150, unit: 'per 8s' },
      ],
      quality: ['720p'],
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
                Quality
              </th>
              <th className="px-6 py-5 text-left text-[12px] font-bold text-black uppercase tracking-wider">
                Generation
              </th>
              <th className="px-6 py-5 text-left text-[12px] font-bold text-black uppercase tracking-wider">
                Download
              </th>
              <th className="px-6 py-5 text-left text-[12px] font-bold text-black uppercase tracking-wider">
                USD
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

                    {/* Quality */}
                    {isFirstRow && (
                      <td className="px-6 py-6" rowSpan={rowSpan}>
                        <span className="text-[14px] font-medium text-black">
                          {model.quality.join(', ')}
                        </span>
                      </td>
                    )}

                    {/* Generation Cost */}
                    <td className="px-6 py-6">
                      <div className="text-[14px] font-bold text-black">
                        {option.credits} credits
                      </div>
                      <p className="text-[12px] text-[#666666] mt-0.5">
                        {option.unit}
                      </p>
                    </td>

                    {/* Download Cost */}
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-black uppercase tracking-wider">
                          Free
                        </span>
                        <Check className="w-4 h-4 text-black" />
                      </div>
                    </td>

                    {/* Est. Cost USD */}
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

                  <p className="text-xs text-gray-500 mt-1">
                    Quality: <span className="font-medium text-gray-700">{model.quality.join(', ')}</span>
                  </p>
                </div>
              </div>

              {/* Pricing Details */}
              <div className="space-y-3">
                {model.pricingOptions.map((option, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {option.duration}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ${(option.credits * CREDIT_TO_USD).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between items-center">
                        <span>Generation:</span>
                        {model.billingType === 'generation' ? (
                          <span className="font-medium text-gray-900">
                            {option.credits} credits
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-900 font-semibold">
                            Free <Zap className="w-3 h-3 text-gray-900" />
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Download:</span>
                        {/* Version 2.0: All downloads are FREE */}
                        <span className="flex items-center gap-1 text-gray-900 font-semibold">
                          Free <Check className="w-3 h-3 text-gray-900" />
                        </span>
                      </div>
                      <p className="text-gray-500 mt-1 italic">
                        {option.unit}
                      </p>
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
