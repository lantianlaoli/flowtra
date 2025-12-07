import { PricingButton } from '@/components/pages/landing/PricingButton';
import { Check } from 'lucide-react';

export default function PricingSection() {
  // Black Friday discount
  const LITE_PRICE = 9;
  const BASIC_PRICE = 29;
  const PRO_PRICE = 49;

  const litePricing = LITE_PRICE;
  const basicPricing = BASIC_PRICE;
  const proPricing = PRO_PRICE;

  return (
    <section id="pricing" className="py-12 scroll-mt-24">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Pay Once, Use Forever</h2>
        <p className="text-base text-gray-600">One-time purchase. No subscriptions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
        {/* Lite Plan */}
        <article className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col" itemScope itemType="https://schema.org/Offer">
          <h3 className="text-xl font-semibold text-gray-900 mb-2" itemProp="name">Lite</h3>

          {/* Price with discount */}
          <div className="mb-4">
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={litePricing}>${litePricing}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="500 credits. Unlimited image generation and download. Unlimited video generation, pay only when satisfied. 83 video downloads." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">500</span> Credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Character UGC Video Generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Competitor UGC Video & Image Cloning</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">200 minutes</span> of UGC video generation quota</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Unlimited Brands & Character Configurations</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Supports English, Chinese, & 10+ Languages</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Latest AI Models (Kling2.6, Veo3.1, Nano Banana Pro, etc.)</span>
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
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={basicPricing}>${basicPricing}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="2,000 credits. Unlimited image generation and download. Unlimited video generation, pay only when satisfied. 333 video downloads." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">2,000</span> Credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Character UGC Video Generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Competitor UGC Video & Image Cloning</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">800 minutes</span> of UGC video generation quota</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Unlimited Brands & Character Configurations</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Supports English, Chinese, & 10+ Languages</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Latest AI Models (Kling2.6, Veo3.1, Nano Banana Pro, etc.)</span>
            </li>
          </ul>
          <PricingButton packageName="basic" />
        </article>

        {/* Pro Plan */}
        <article className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col" itemScope itemType="https://schema.org/Offer">
          <h3 className="text-xl font-semibold text-gray-900 mb-2" itemProp="name">Pro</h3>

          {/* Price with discount */}
          <div className="mb-4">
            <div className="text-3xl font-bold text-gray-900">
              <data itemProp="price" value={proPricing}>${proPricing}</data>
              <span className="text-lg font-normal text-gray-600">/package</span>
            </div>
          </div>
          <meta itemProp="priceCurrency" content="USD" />
          <meta itemProp="availability" content="https://schema.org/InStock" />
          <meta itemProp="url" content="https://www.flowtra.store/#pricing" />
          <meta itemProp="description" content="3,500 credits. Unlimited image generation and download. Unlimited video generation, pay only when satisfied. 583 video downloads." />
          <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">3,500</span> Credits</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Character UGC Video Generation</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Competitor UGC Video & Image Cloning</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700"><span className="font-semibold text-gray-900">1,400 minutes</span> of UGC video generation quota</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Unlimited Brands & Character Configurations</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Supports English, Chinese, & 10+ Languages</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                <Check className="w-2.5 h-2.5 text-blue-600" />
              </div>
              <span className="text-gray-700">Latest AI Models (Kling2.6, Veo3.1, Nano Banana Pro, etc.)</span>
            </li>
          </ul>
          <PricingButton packageName="pro" />
        </article>
      </div>
    </section>
  );
}