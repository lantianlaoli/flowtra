import { PricingButton } from '@/components/pages/landing/PricingButton';
import { Check } from 'lucide-react';

export default function PricingSection() {

  const LITE_PRICE = 29;

  const BASIC_PRICE = 59;

  const PRO_PRICE = 99;



  const litePricing = LITE_PRICE;

  const basicPricing = BASIC_PRICE;

  const proPricing = PRO_PRICE;



  return (

    <section id="pricing" className="py-20 scroll-mt-24">

      <div className="text-center mb-16 px-4">

        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">Pay Once, Use Forever</h2>

        <p className="text-lg text-[#666666]">One-time purchase. No subscriptions.</p>

      </div>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Lite Plan */}

        <article className="bg-white rounded-xl border border-[#E5E5E5] p-8 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col" itemScope itemType="https://schema.org/Offer">

          <h3 className="text-[20px] font-bold text-black mb-1" itemProp="name">Lite</h3>

          <p className="text-[14px] text-[#666666] mb-6">Perfect for small creators starting out.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={litePricing}>${litePricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/package</span>

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

          </ul>

          <PricingButton packageName="lite" />

        </article>



        {/* Basic Plan (Recommended) */}

        <article className="relative bg-white rounded-xl border-2 border-black p-8 shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col z-10" itemScope itemType="https://schema.org/Offer">

          <div className="absolute -top-4 left-1/2 -translate-x-1/2">

            <div className="bg-black text-white px-4 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider shadow-md">

              Recommended

            </div>

          </div>

          <h3 className="text-[20px] font-bold text-black mb-1" itemProp="name">Basic</h3>

          <p className="text-[14px] text-[#666666] mb-6">Most popular for growing brands.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={basicPricing}>${basicPricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/package</span>

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

          <h3 className="text-[20px] font-bold text-black mb-1" itemProp="name">Pro</h3>

          <p className="text-[14px] text-[#666666] mb-6">For power users and agencies.</p>



          <div className="mb-8">

            <div className="text-[40px] font-bold text-black leading-none">

              <data itemProp="price" value={proPricing}>${proPricing}</data>

              <span className="text-[16px] font-medium text-[#666666] ml-1">/package</span>

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
