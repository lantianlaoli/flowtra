import { Check } from "lucide-react";

export default function ComparisonSection() {
  return (
    <section className="py-14 md:py-20 lg:py-24 bg-white">
      <div className="text-center mb-10 md:mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">Arcads Alternative</h2>
        <p className="text-base md:text-lg text-[#666666]">Discover a superior alternative for your video generation needs</p>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#E5E5E5] shadow-[0_20px_40px_rgba(0,0,0,0.05)]">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[54%]" />
            </colgroup>
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#E5E5E5] text-[12px] font-bold text-black uppercase tracking-wider">
                <th className="px-5 py-5">Platform</th>
                <th className="px-5 py-5">Cost</th>
                <th className="px-5 py-5 pl-10">Included</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {/* Flowtra AI */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-5 py-8 align-top">
                  <div className="font-semibold text-[16px] text-black">Flowtra</div>
                </td>
                <td className="px-5 py-8 align-top font-bold text-black text-[18px]">
                  Basic $59/mo
                </td>
                <td className="px-5 py-8 align-top text-[#666666] text-[14px] pl-10">
                  <ul className="space-y-2">
                    {[
                      "3,930 credits",
                      "Avatar Ads",
                      "Clone viral videos",
                      "Motion Swap",
                      "26.2 minutes of video",
                      "10+ languages",
                      "Latest video models",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-black flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span className="flex flex-1 flex-wrap items-center gap-2">
                        <span className="font-semibold text-black">AI Agent</span>
                        <span className="inline-flex items-center rounded-full border border-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#15803D]">
                          Free
                        </span>
                      </span>
                    </li>
                  </ul>
                </td>
              </tr>

              {/* Arcads */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-5 py-8 align-top">
                  <div className="font-semibold text-[16px] text-black">Arcads</div>
                </td>
                <td className="px-5 py-8 align-top font-semibold text-black text-[16px]">
                  Creator $220/mo
                </td>
                <td className="px-5 py-8 align-top text-[#666666] text-[14px] pl-10">
                  <ul className="space-y-2">
                    {[
                      "20 credits per month",
                      "300 Natural AI Actors",
                      "Use 35 languages",
                      "Delivered in 2 minutes",
                      "Play videos up to 120 sec",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-black flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-5">
          {/* Flowtra Card */}
          <div className="bg-white rounded-xl border-2 border-black p-6 sm:p-8 space-y-5 relative shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
             <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest rounded-bl-xl">
              BEST VALUE
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-bold text-black">Flowtra</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white">
                  Basic: $59/mo
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-5 border-t border-[#E5E5E5]">
              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">Included</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  {[
                    "3,930 credits",
                    "Avatar Ads",
                    "Clone viral videos",
                    "Motion Swap",
                    "26.2 minutes of video",
                    "10+ languages",
                    "Latest video models",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-black flex-shrink-0" />
                    <span className="flex flex-1 flex-wrap items-center gap-2">
                      <span className="font-semibold text-black">AI Agent</span>
                      <span className="inline-flex items-center rounded-full border border-[#16A34A] bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#15803D]">
                        Free
                      </span>
                    </span>
                  </li>
                </ul>
              </div>
           </div>
          </div>

           {/* Arcads Card */}
           <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 sm:p-7 space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-semibold text-black">Arcads</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F7F7F7] text-black border border-[#E5E5E5]">
                  Creator: $220/mo
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-[#E5E5E5]">
              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">Included</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  {[
                    "20 credits per month",
                    "300 Natural AI Actors",
                    "Use 35 languages",
                    "Delivered in 2 minutes",
                    "Play videos up to 120 sec",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
