'use client';

import { BadgeDollarSign, Check, FolderKanban, Layers3 } from "lucide-react";
import { getPackageModelDurationRows } from "@/lib/constants";
import { useI18n } from "@/providers/I18nProvider";

export default function ComparisonSection() {
  const { messages } = useI18n();
  const comparisonMessages = messages.landing.comparison;
  const basicModelDurations = getPackageModelDurationRows("basic");
  const formatModelDuration = (durationLabel: string, durationLabels?: string[]) =>
    durationLabels?.length ? durationLabels.join(" / ") : durationLabel;

  return (
    <section className="landing-section-surface bg-white py-14 md:py-20 lg:py-24">
      <div className="text-center mb-10 md:mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">{comparisonMessages.title}</h2>
        <p className="text-base md:text-lg text-[#666666]">{comparisonMessages.description}</p>
      </div>

      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Table View */}
        <div className="landing-table-shell hidden overflow-x-auto rounded-[28px] border border-[#E7E7E7] bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)] lg:block">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[54%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#E7E7E7] bg-[linear-gradient(180deg,#fcfcfc_0%,#f7f7f7_100%)] text-[12px] font-bold uppercase tracking-[0.18em] text-[#111111]">
                <th className="px-8 py-6">
                  <span className="inline-flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-[#555555]" />
                    <span>{comparisonMessages.platform}</span>
                  </span>
                </th>
                <th className="border-l border-[#E7E7E7] px-8 py-6">
                  <span className="inline-flex items-center gap-2">
                    <BadgeDollarSign className="h-4 w-4 text-[#555555]" />
                    <span>{comparisonMessages.cost}</span>
                  </span>
                </th>
                <th className="border-l border-[#E7E7E7] px-8 py-6">
                  <span className="inline-flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-[#555555]" />
                    <span>{comparisonMessages.included}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] bg-white">
              {/* Flowtra AI */}
              <tr className="bg-white transition-colors duration-200 hover:bg-[#FCFCFC]">
                <td className="px-8 py-6 align-top">
                  <div className="text-[18px] font-bold tracking-tight text-black">Flowtra</div>
                </td>
                <td className="border-l border-[#E7E7E7] px-8 py-6 align-top text-[18px] font-bold tracking-tight text-black">
                  {comparisonMessages.flowtraPrice}
                </td>
                <td className="border-l border-[#E7E7E7] px-8 py-6 align-top text-[14px] text-[#666666]">
                  <ul className="space-y-2">
                    {comparisonMessages.flowtraIncluded.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-black flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {basicModelDurations.map((item) => (
                      <li key={item.model} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-black flex-shrink-0" />
                        <span>{item.label}: {formatModelDuration(item.durationLabel, item.durationLabels)}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span className="font-semibold text-black">AI Agent</span>
                    </li>
                  </ul>
                </td>
              </tr>

              {/* Arcads */}
              <tr className="bg-white transition-colors duration-200 hover:bg-[#FCFCFC]">
                <td className="px-8 py-6 align-top">
                  <div className="text-[18px] font-bold tracking-tight text-black">Arcads</div>
                </td>
                <td className="border-l border-[#E7E7E7] px-8 py-6 align-top text-[18px] font-bold tracking-tight text-black">
                  {comparisonMessages.arcadsPrice}
                </td>
                <td className="border-l border-[#E7E7E7] px-8 py-6 align-top text-[14px] text-[#666666]">
                  <ul className="space-y-2">
                    {comparisonMessages.arcadsIncluded.map((item) => (
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
          <div className="landing-info-card landing-info-card--featured relative space-y-5 rounded-[24px] border border-black bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.08)] sm:p-8">
             <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest rounded-bl-xl">
              {comparisonMessages.bestValue}
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-bold text-black">Flowtra</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white">
                  {comparisonMessages.flowtraPrice.replace('Basic ', 'Basic: ')}
                </div>
              </div>
            </div>

            <div className="space-y-5 pt-5 border-t border-[#E5E5E5]">
              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">{comparisonMessages.included}</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  {comparisonMessages.flowtraIncluded.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                  {basicModelDurations.map((item) => (
                    <li key={item.model} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-black flex-shrink-0" />
                      <span>{item.label}: {formatModelDuration(item.durationLabel, item.durationLabels)}</span>
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-black flex-shrink-0" />
                    <span className="font-semibold text-black">AI Agent</span>
                  </li>
                </ul>
              </div>
           </div>
          </div>

           {/* Arcads Card */}
           <div className="landing-info-card space-y-5 rounded-[24px] border border-[#E7E7E7] bg-white p-6 shadow-[0_14px_36px_rgba(0,0,0,0.04)] sm:p-7">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-semibold text-black">Arcads</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F7F7F7] text-black border border-[#E5E5E5]">
                  {comparisonMessages.arcadsPrice.replace('Creator ', 'Creator: ')}
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-[#E5E5E5]">
              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">{comparisonMessages.included}</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  {comparisonMessages.arcadsIncluded.map((item) => (
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
