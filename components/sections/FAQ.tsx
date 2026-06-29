'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import FAQSchema from '@/components/seo/FAQSchema';
import { useI18n } from '@/providers/I18nProvider';

export default function FAQ({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { messages } = useI18n();
  const faqMessages = messages.landing.faq;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section
      id="faq"
      className={`landing-section-surface scroll-mt-24 bg-white ${
        compact ? 'py-10 md:py-12' : 'py-14 md:py-24'
      }`}
    >
      <FAQSchema faqData={faqMessages.items} />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center ${compact ? 'mb-6' : 'mb-10 md:mb-16'}`}>
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            {faqMessages.title}
          </h2>
          <p className="text-base md:text-lg text-[#666666] max-w-2xl mx-auto">
            {faqMessages.description}
          </p>
        </div>

        <div className="landing-faq-shell mx-auto flex max-w-3xl flex-col gap-3 rounded-[30px] border border-[#E5E5E5] bg-white p-3 sm:p-4">
          {faqMessages.items.map((item, index) => (
            <div
              key={index}
              className={`landing-faq-item-card rounded-[24px] border border-[#E5E5E5] px-4 py-3 transition-all duration-300 sm:px-5 ${
                openIndex === index ? 'landing-faq-item-card--open' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-expanded={openIndex === index}
                className="landing-faq-trigger group flex w-full items-start justify-between gap-4 rounded-[20px] px-1 py-1 text-left"
              >
                <h3 className="text-[17px] md:text-[18px] font-bold leading-snug text-black group-hover:text-[#666666] transition-colors">
                  {item.question}
                </h3>
                <span
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180 text-black' : 'text-[#666666]'
                  }`}
                  aria-hidden={true}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100 pt-3' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="landing-faq-body rounded-[18px] border border-[#EFEFEF] bg-[linear-gradient(180deg,#fcfcfc_0%,#f7f7f7_100%)] px-4 py-3 text-[15px] leading-relaxed text-[#666666] md:text-[16px]">
                  {item.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
