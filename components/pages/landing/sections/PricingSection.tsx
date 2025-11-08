import { PricingButton } from '@/components/pages/landing/PricingButton';

interface PricingSectionProps {
  liteVideos: number;
  basicVideos: number;
  proVideos: number;
}

export default function PricingSection({ liteVideos, basicVideos, proVideos }: PricingSectionProps) {
  // Black Friday discount
  const DISCOUNT_RATE = 0.2; // 20% off
  const LITE_PRICE = 9;
  const BASIC_PRICE = 29;
  const PRO_PRICE = 49;

  const calculateDiscount = (price: number) => ({
    original: price,
    discounted: (price * (1 - DISCOUNT_RATE)).toFixed(2),
    savings: (price * DISCOUNT_RATE).toFixed(2)
  });

  const litePricing = calculateDiscount(LITE_PRICE);
  const basicPricing = calculateDiscount(BASIC_PRICE);
  const proPricing = calculateDiscount(PRO_PRICE);

  return (
    <section id="pricing" className="py-12 scroll-mt-24">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Pay Once, Use Forever</h2>
        <p className="text-base text-gray-600">One-time purchase. No subscriptions. Flexible billing: Basic models (free generation, paid download) or Premium models (paid generation, free download)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
        {/* Lite Plan */}
        <article className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col" itemScope itemType="https://schema.org/Offer">
          <h3 className="text-xl font-semibold text-gray-900 mb-2" itemProp="name">Lite</h3>

          {/* Price with discount */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg line-through text-[#9b9a97]">${litePricing.original}</span>
              <span className="bg-[#f7f6f3] text-[#787774] text-xs font-medium px-2 py-1 rounded">
                Save ${litePricing.savings}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={litePricing.discounted}>${litePricing.discounted}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="500 credits. Approximately 25 Veo3 Fast videos. Includes Standard Ads, Multi-Variant Ads, and Character Ads. Mixed billing model with free image generation." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600"><span className="font-bold text-gray-900">500</span> credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{liteVideos}</span> Veo3 Fast videos</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Mixed billing model</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Always free image generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Character Ads</span>
            </li>
          </ul>
          <PricingButton packageName="lite" />
        </article>

        {/* Basic Plan (Recommended) */}
        <article className="bg-white rounded-2xl border-2 border-gray-900 p-6 md:p-8 shadow-sm transform scale-105 flex flex-col" itemScope itemType="https://schema.org/Offer">
          <div className="bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium mb-4 inline-block">
            Recommended
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2" itemProp="name">Basic</h3>

          {/* Price with discount */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg line-through text-[#9b9a97]">${basicPricing.original}</span>
              <span className="bg-[#f7f6f3] text-[#787774] text-xs font-medium px-2 py-1 rounded">
                Save ${basicPricing.savings}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={basicPricing.discounted}>${basicPricing.discounted}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="2,000 credits. Approximately 100 Veo3 Fast videos. Free unlimited downloads and image generation. Includes all features: Standard Ads, Multi-Variant Ads, Character Ads." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600"><span className="font-bold text-gray-900">2,000</span> credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{basicVideos}</span> Veo3 Fast videos</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Free unlimited downloads</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Free image generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Character Ads</span>
            </li>
          </ul>
          <PricingButton packageName="basic" />
        </article>

        {/* Pro Plan */}
        <article className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col" itemScope itemType="https://schema.org/Offer">
          <h3 className="text-xl font-semibold text-gray-900 mb-2" itemProp="name">Pro</h3>

          {/* Price with discount */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg line-through text-[#9b9a97]">${proPricing.original}</span>
              <span className="bg-[#f7f6f3] text-[#787774] text-xs font-medium px-2 py-1 rounded">
                Save ${proPricing.savings}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={proPricing.discounted}>${proPricing.discounted}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="3,500 credits. Approximately 175 Veo3 Fast videos. Priority processing, mixed billing model, free image generation. Includes Standard Ads, Multi-Variant Ads, and Character Ads." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600"><span className="font-bold text-gray-900">3,500</span> credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{proVideos}</span> Veo3 Fast videos</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Mixed billing model</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Always free image generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Character Ads</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gray-600 rounded-full" aria-hidden="true"></div>
              <span className="text-gray-600">Priority processing</span>
            </li>
          </ul>
          <PricingButton packageName="pro" />
        </article>
      </div>
    </section>
  );
}
