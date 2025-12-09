import { Zap, Check } from 'lucide-react';
import { SiGoogle, SiOpenai, SiX } from 'react-icons/si';

export default function ModelPricingSection() {
  // Credit to USD conversion rate
  const CREDIT_TO_USD = 0.018; // $0.018 per credit

  const models = [
    {
      name: 'Veo3.1 Fast',
      description: '',
      icon: SiGoogle,
      badge: 'Popular',
      durationRange: '1m 20s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1m 20s', credits: 20, unit: 'per 8s' },
      ],
      quality: ['720p', '1080p'],
    },
    {
      name: 'Sora2',
      description: '',
      icon: SiOpenai,
      badge: null,
      durationRange: '1m 20s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1m 20s', credits: 6, unit: 'per 10s' },
      ],
      quality: ['720p', '1080p'],
    },
    {
      name: 'Grok Imagine',
      description: '',
      icon: SiX,
      badge: 'New',
      durationRange: '1m 20s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1m 20s', credits: 20, unit: 'per 6s' },
      ],
      quality: ['360p', '720p'],
    },
    {
      name: 'Veo3.1',
      description: '',
      icon: SiGoogle,
      badge: null,
      durationRange: '1m 20s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1m 20s', credits: 150, unit: 'per 8s' },
      ],
      quality: ['720p', '1080p'],
    },
    {
      name: 'Sora2 Pro',
      description: '',
      icon: SiOpenai,
      badge: 'Premium',
      durationRange: '1m 20s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '1m 20s', credits: 75, unit: 'per 10s (720p)' },
        { duration: '1m 20s', credits: 165, unit: 'per 10s (1080p)' },
      ],
      quality: ['720p', '1080p'],
    },
    {
      name: 'Kling 2.6',
      description: '',
      icon: Zap, // Using Zap icon from lucide-react
      badge: null,
      durationRange: '1m 20s',
      billingType: 'generation' as const, // User specified "生成收费"
      pricingOptions: [
        { duration: '5s', credits: 110, unit: 'per 5s' }, // User specified "5 s 110 credits"
      ],
      quality: ['1080p'], // User specified "画质是1080P"
    },
  ];

  return (
    <section id="model-pricing" className="py-12 scroll-mt-24">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Price details</h2>
        <p className="text-base text-gray-600 max-w-2xl mx-auto">
          Transparent pricing for all video models. Choose the right model for your needs.
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block max-w-[90rem] mx-auto overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Model
              </th>

              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Quality
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Generation Cost
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Download Cost
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                USD
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
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
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Model Name & Description - only show on first row */}
                    {isFirstRow && (
                      <td className="px-6 py-5" rowSpan={rowSpan}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-100 mt-0.5">
                            <Icon className="w-6 h-6 text-gray-900" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
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
                      </td>
                    )}



                    {/* Quality */}
                    {isFirstRow && (
                      <td className="px-6 py-4" rowSpan={rowSpan}>
                        <span className="text-sm font-medium text-gray-900">
                          {model.quality.join(', ')}
                        </span>
                      </td>
                    )}

                    {/* Generation Cost */}
                    <td className="px-6 py-4">
                      {model.billingType === 'generation' ? (
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {option.credits} credits
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {option.unit}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            Free
                          </span>
                          <Zap className="w-3.5 h-3.5 text-gray-900" />
                        </div>
                      )}
                    </td>

                    {/* Download Cost */}
                    <td className="px-6 py-4">
                      {/* Version 2.0: All downloads are FREE */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          Free
                        </span>
                        <Check className="w-3.5 h-3.5 text-gray-900" />
                      </div>
                    </td>

                    {/* Est. Cost USD */}
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          ${usdCost}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {option.unit}
                        </p>
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
