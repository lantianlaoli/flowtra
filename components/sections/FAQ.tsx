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
      'Flowtra runs on one-time plans starting at $9—no subscriptions or recurring fees. Pay once, keep your credits forever, and unlock premium templates or tutorials whenever you’re ready.'
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
    <section id="faq" className="py-16 scroll-mt-24">
      <FAQSchema faqData={faqData} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            FAQ
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Answers for Etsy, Shopify, Gumroad, and Stan sellers using Flowtra to launch scroll-stopping marketing assets
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div
              key={index}
              className={`border-b border-gray-200 last:border-b-0 py-3 transition-all duration-200 ${
                openIndex === index ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-expanded={openIndex === index}
                className="flex w-full items-center justify-between text-left px-4 py-2"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {item.question}
                </h3>
                <span
                  className={`flex h-8 w-8 items-center justify-center transition-transform ${
                    openIndex === index ? 'rotate-180 text-gray-900' : 'text-gray-500'
                  }`}
                  aria-hidden={true}
                >
                  <ChevronDownIcon className="h-5 w-5" />
                </span>
              </button>
              <p
                className={`text-gray-700 leading-relaxed px-4 transition-all duration-200 ${
                  openIndex === index ? 'mt-2 pb-2 opacity-100' : 'mt-0 h-0 overflow-hidden opacity-0'
                }`}
              >
                  {item.answer}
                </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
