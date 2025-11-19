import { Zap, Check } from 'lucide-react';
import { SiGoogle, SiOpenai, SiX } from 'react-icons/si';

export default function ModelPricingSection() {
  // Credit to USD conversion rate
  const CREDIT_TO_USD = 0.018; // $0.018 per credit

  const models = [
    {
      name: 'Veo3 Fast',
      description: 'Quick generation for rapid testing',
      icon: SiGoogle,
      badge: 'Popular',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      durationRange: '8-32s',
      billingType: 'download' as const,
      pricingOptions: [
        { duration: '8s', credits: 20, unit: 'per 8s' },
        { duration: '16s', credits: 40, unit: 'per 8s (2 segments)' },
        { duration: '24s', credits: 60, unit: 'per 8s (3 segments)' },
        { duration: '32s', credits: 80, unit: 'per 8s (4 segments)' },
      ],
    },
    {
      name: 'Sora2',
      description: 'Standard quality for most use cases',
      icon: SiOpenai,
      badge: null,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      durationRange: '10s',
      billingType: 'download' as const,
      pricingOptions: [
        { duration: '10s', credits: 6, unit: 'per 10s' },
      ],
    },
    {
      name: 'Veo3',
      description: 'High-quality professional content',
      icon: SiGoogle,
      badge: null,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      durationRange: '8-32s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '8s', credits: 150, unit: 'per 8s' },
        { duration: '16s', credits: 300, unit: 'per 8s (2 segments)' },
        { duration: '24s', credits: 450, unit: 'per 8s (3 segments)' },
        { duration: '32s', credits: 600, unit: 'per 8s (4 segments)' },
      ],
    },
    {
      name: 'Sora2 Pro',
      description: 'Premium quality with flexible options',
      icon: SiOpenai,
      badge: 'Premium',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      durationRange: '10-15s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '10s Standard', credits: 36, unit: 'Standard quality' },
        { duration: '15s Standard', credits: 54, unit: 'Standard quality' },
        { duration: '10s HD', credits: 80, unit: 'HD quality' },
        { duration: '15s HD', credits: 160, unit: 'HD quality' },
      ],
    },
    {
      name: 'Grok',
      description: 'Grok’s kid-safe pipeline supports 6-second segments up to 60s',
      icon: SiX,
      badge: 'New',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      durationRange: '6-60s',
      billingType: 'generation' as const,
      pricingOptions: [
        { duration: '6s', credits: 20, unit: 'per 6s segment' },
        { duration: '12s', credits: 40, unit: 'per 6s segment' },
        { duration: '18s', credits: 60, unit: 'per 6s segment' },
        { duration: '24s', credits: 80, unit: 'per 6s segment' },
        { duration: '30s', credits: 100, unit: 'per 6s segment' },
        { duration: '36s', credits: 120, unit: 'per 6s segment' },
        { duration: '42s', credits: 140, unit: 'per 6s segment' },
        { duration: '48s', credits: 160, unit: 'per 6s segment' },
        { duration: '54s', credits: 180, unit: 'per 6s segment' },
        { duration: '60s', credits: 200, unit: 'per 6s segment' },
      ],
    },
  ];

  return (
    <section id="model-pricing" className="py-12 scroll-mt-24">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Video Model Pricing</h2>
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
                Duration
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Generation Cost
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Download Cost
              </th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Est. Cost (USD)
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
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${model.bgColor} mt-0.5`}>
                            <Icon className={`w-6 h-6 ${model.color}`} />
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

                    {/* Duration */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {option.duration}
                      </span>
                    </td>

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
                          <span className="text-sm font-semibold text-green-600">
                            Free
                          </span>
                          <Zap className="w-3.5 h-3.5 text-green-600" />
                        </div>
                      )}
                    </td>

                    {/* Download Cost */}
                    <td className="px-6 py-4">
                      {model.billingType === 'download' ? (
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {option.credits} credits
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {option.unit}
                          </p>
                          {isFirstRow && (
                            <p className="text-xs text-blue-600 mt-1">
                              *Deducted only upon the first successful download of an advertisement
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-green-600">
                            Free
                          </span>
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        </div>
                      )}
                    </td>

                    {/* Est. Cost USD */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-900">
                        ~${usdCost}
                      </span>
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
              <div className="flex items-start gap-3 mb-4">
                <div className={`p-2 rounded-lg ${model.bgColor}`}>
                  <Icon className={`w-6 h-6 ${model.color}`} />
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
                    Duration: <span className="font-medium text-gray-700">{model.durationRange}</span>
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
                        ~${(option.credits * CREDIT_TO_USD).toFixed(2)}
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
                          <span className="flex items-center gap-1 text-green-600 font-semibold">
                            Free <Zap className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Download:</span>
                        {model.billingType === 'download' ? (
                          <span className="font-medium text-gray-900">
                            {option.credits} credits
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600 font-semibold">
                            Free <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 mt-1 italic">
                        {option.unit}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Download billing notice for free-generation models */}
                {model.billingType === 'download' && (
                  <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 leading-snug">
                    Credits are deducted only on the first successful download you keep.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Footnote */}
      <div className="mt-8 space-y-3 text-center max-w-[90rem] mx-auto">
        <div className="bg-gray-50 rounded-lg p-4 text-left">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Billing Rules</h4>
          <ul className="space-y-1.5 text-xs text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><strong>Veo3 & Veo3 Fast:</strong> Videos are generated in 8-second segments. Longer videos (16s/24s/32s) cost multiples of the base 8s price.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><strong>Sora2 Pro:</strong> 4 quality tiers available - Standard/HD quality at 10s/15s durations.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><strong>Grok:</strong> Charged per 6-second segment, ideal for safer kid-focused storyboards (6s to 60s).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><strong>Download Billing (Veo3 Fast, Sora2):</strong> Credits are deducted only when you download a video you&apos;re satisfied with, and only on first download. Re-downloading is free.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span><strong>Generation Billing (Veo3, Sora2 Pro):</strong> Credits are charged upfront when generation starts. Downloads are free. Failed generations are automatically refunded.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-0.5">•</span>
              <span>All prices based on conversion rate of <strong>$0.018 per credit</strong>.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
