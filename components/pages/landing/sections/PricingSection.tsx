import { PricingButton } from '@/components/pages/landing/PricingButton';
import { DemoContactCard } from '@/components/pages/landing/DemoContactCard';
import { Check, Zap, TrendingUp, Crown } from 'lucide-react';

export default function PricingSection({ showTitle = true }: { showTitle?: boolean }) {
  const LITE_PRICE = 29;
  const BASIC_PRICE = 59;
  const PRO_PRICE = 99;

  const litePricing = LITE_PRICE;
  const basicPricing = BASIC_PRICE;
  const proPricing = PRO_PRICE;



  return (

    <section id="pricing" className="py-20 scroll-mt-24">

      {showTitle && (
        <div className="text-center mb-16 px-4">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">Choose Your Plan</h2>
          <p className="text-lg text-[#666666] mb-6">Monthly subscription with automatic credit reset</p>
        </div>
      )}



      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Demo Contact Card */}

        <DemoContactCard />

        {/* Lite Plan */}

        <article className="bg-white rounded-xl border border-[#E5E5E5] p-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col" itemScope itemType="https://schema.org/Offer">

          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">Lite</h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">Perfect for small creators starting out.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={litePricing}>${litePricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/month</span>

            </div>

            {/* Trial Badge */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7F7] border border-[#E5E5E5] rounded-full">
              <span className="text-[10px] font-medium text-[#000000] uppercase tracking-wider">
                1 Day Free Trial
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="opacity-60"
              >
                <path
                  d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z"
                  fill="#000000"
                />
              </svg>
            </div>

          </div>

          <ul className="space-y-4 mb-10 flex-grow">

            {[

              { label: "1,930 Credits", bold: true },

              { label: "Character UGC Video Generation" },

              { label: "Competitor UGC Cloning" },

              { label: "12.8 minutes of UGC video", bold: true },

              { label: "Unlimited Brands" },

              { label: "Supports 10+ Languages" },

              { label: "Latest AI Models" }

            ].map((item, idx) => (

              <li key={idx} className="flex items-center gap-3 text-[14px] text-[#666666]">

                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>{item.label}</span>

              </li>

            ))}

            {/* Bonus: n8n Workflow */}
            <li className="flex items-start gap-3 text-[14px] pt-2 border-t border-[#E5E5E5]">
              <Check className="w-4 h-4 text-black flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold text-black">
                  Bonus: TikTok Clone n8n Workflow
                </span>
                <div className="text-[12px] text-[#666666] mt-1">
                  ($39.9 value) •{' '}
                  <a
                    href="https://lantianlaoli.gumroad.com/l/ivzajh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black underline hover:no-underline"
                  >
                    Preview
                  </a>
                </div>
              </div>
            </li>

          </ul>

          <PricingButton packageName="lite" />

        </article>



        {/* Basic Plan (Recommended) */}

        <article className="relative bg-white rounded-xl border-2 border-black p-8 shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col" itemScope itemType="https://schema.org/Offer">

          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">

            <div className="bg-black text-white px-4 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider shadow-md">

              Recommended

            </div>

          </div>

          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">Basic</h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">Most popular for growing brands.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={basicPricing}>${basicPricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/month</span>

            </div>

          </div>

          <ul className="space-y-4 mb-10 flex-grow">

            {[

              { label: "3,930 Credits", bold: true },

              { label: "Character UGC Video Generation" },

              { label: "Competitor UGC Cloning" },

              { label: "26.2 minutes of UGC video", bold: true },

              { label: "Unlimited Brands" },

              { label: "Supports 10+ Languages" },

              { label: "Latest AI Models" }

            ].map((item, idx) => (

              <li key={idx} className="flex items-center gap-3 text-[14px] text-[#666666]">

                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>{item.label}</span>

              </li>

            ))}

          </ul>

          <PricingButton packageName="basic" />

        </article>



        {/* Pro Plan */}

        <article className="bg-white rounded-xl border border-[#E5E5E5] p-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col" itemScope itemType="https://schema.org/Offer">

          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-5 h-5 text-black flex-shrink-0" />
            <h3 className="text-[20px] font-bold text-black" itemProp="name">Pro</h3>
          </div>

          <p className="text-[14px] text-[#666666] mb-6">For power users and agencies.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={proPricing}>${proPricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/month</span>

            </div>

          </div>

          <ul className="space-y-4 mb-10 flex-grow">

            {[

              { label: "6,600 Credits", bold: true },

              { label: "Character UGC Video Generation" },

              { label: "Competitor UGC Cloning" },

              { label: "44.0 minutes of UGC video", bold: true },

              { label: "Unlimited Brands" },

              { label: "Supports 10+ Languages" },

              { label: "Latest AI Models" }

            ].map((item, idx) => (

              <li key={idx} className="flex items-center gap-3 text-[14px] text-[#666666]">

                <Check className="w-4 h-4 text-black flex-shrink-0" />

                <span className={item.bold ? "font-semibold text-black" : ""}>{item.label}</span>

              </li>

            ))}

          </ul>

          <PricingButton packageName="pro" />

        </article>

      </div>

    </section>

  );

}
