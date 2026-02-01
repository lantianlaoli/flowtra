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
      'Flowtra helps TikTok dropshippers turn product photos and viral references into scroll‑stopping UGC ads in minutes. Use Viral Clone, Avatar Ads, or Motion Swap to ship new creatives fast without a full production team.'
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
    <section id="faq" className="py-24 scroll-mt-24 bg-white">
      <FAQSchema faqData={faqData} />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-[#666666] max-w-2xl mx-auto">
            Answers for TikTok dropshippers using Flowtra to launch viral UGC ads fast
          </p>
        </div>

        <div className="max-w-3xl mx-auto border-t border-[#E5E5E5]">
          {faqData.map((item, index) => (
            <div
              key={index}
              className="border-b border-[#E5E5E5] py-4"
            >
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-expanded={openIndex === index}
                className="flex w-full items-center justify-between text-left py-4 group"
              >
                <h3 className="text-[18px] font-bold text-black group-hover:text-[#666666] transition-colors">
                  {item.question}
                </h3>
                <span
                  className={`flex h-6 w-6 items-center justify-center transition-transform duration-300 ${
                    openIndex === index ? 'rotate-180 text-black' : 'text-[#666666]'
                  }`}
                  aria-hidden={true}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100 mb-4' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="text-[16px] text-[#666666] leading-relaxed">
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
