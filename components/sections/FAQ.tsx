'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import FAQSchema from '@/components/seo/FAQSchema';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'What is Flowtra, and how does it help TikTok dropshippers?',
    answer:
      'Flowtra helps TikTok dropshippers turn product photos and viral references into scroll‑stopping UGC ads in minutes. Use Viral Clone, Avatar Ads, or Motion Clone to ship new creatives fast without a full production team.'
  },
  {
    question: 'I’m not a video editor. Can I still use Flowtra?',
    answer:
      'Yes. Flowtra is built for non‑editors. Upload your product image or a viral reference, pick a style, and click “Generate.”'
  },
  {
    question: 'How does pricing work?',
    answer:
      'Flowtra uses monthly subscriptions with credits. Credits are deducted when you generate videos. Image generation is free, so you can test looks before spending credits.'
  },
  {
    question: 'Can I clone viral TikTok ads for my products?',
    answer:
      'Yes. Viral Clone lets you upload a viral TikTok video and recreate the structure with your product, so you can launch new ads fast.'
  },
  {
    question: 'Can I use the videos commercially?',
    answer:
      'Yes. Everything you generate is yours to use for ads, product pages, and paid campaigns. No watermarks or extra licensing fees.'
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <section id="faq" className="landing-section-surface py-14 md:py-24 scroll-mt-24 bg-white">
      <FAQSchema faqData={faqData} />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-base md:text-lg text-[#666666] max-w-2xl mx-auto">
            Answers for TikTok dropshippers using Flowtra to launch viral UGC ads fast
          </p>
        </div>

        <div className="landing-faq-shell mx-auto flex max-w-3xl flex-col gap-3 rounded-[30px] border border-[#E5E5E5] bg-white p-3 sm:p-4">
          {faqData.map((item, index) => (
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
