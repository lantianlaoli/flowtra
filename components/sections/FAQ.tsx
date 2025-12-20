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
    question: 'What is Flowtra, and how can it help my business?',
    answer:
      'Flowtra is an AI-powered tool that helps small business owners and creators make marketing videos and product images in minutes. Upload a product photo or type a short description and Flowtra instantly generates ready-to-use ad visuals for Etsy, Shopify, Gumroad, or Stan.'
  },
  {
    question: 'I’m not a designer or video editor. Can I still use Flowtra?',
    answer:
      'Absolutely. Flowtra is built for beginners with zero editing skills. Each template comes with pre-set scripts, scenes, and music—you just customize the text or images and click “Generate.”'
  },
  {
    question: 'Can I use Flowtra for free?',
    answer:
    'Yes. Free users get unlimited image generation and video creation, so you can test different prompts, styles, and templates without worrying about usage limits.'
  },
  {
    question: 'How does Flowtra pricing work?',
    answer:
      'Flowtra runs on one-time plans starting at $29—no subscriptions or recurring fees. Pay once, keep your credits forever, and unlock premium templates or tutorials whenever you\'re ready.'
  },
  {
    question: 'Can I use the images and videos commercially?',
    answer:
      'Yes. Everything you create with Flowtra is yours to use across ads, social media, product pages, or paid campaigns. There are no watermarks or extra licensing fees.'
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
            Answers for Etsy, Shopify, Gumroad, and Stan sellers using Flowtra to launch scroll-stopping marketing assets
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
