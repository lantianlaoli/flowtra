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
    question: 'What kind of videos can I make with Flowtra?',
    answer:
      'Create product showcases for Etsy or Shopify listings, promotional videos for Instagram Reels or TikTok, and course or digital product intros for Gumroad or Stan. Flowtra automatically matches visuals, captions, and music to your product.'
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
    question: 'Can I customize my videos?',
    answer:
      'Yes. Edit text, upload your logo, pick different music, and choose from multiple layouts. Flowtra adapts camera movement, captions, and pacing automatically to keep everything on-brand.'
  },
  {
    question: 'I sell on Etsy, Shopify, Gumroad, or Stan. Is Flowtra right for me?',
    answer:
      'Definitely. Flowtra was designed for independent sellers and creators who need scroll-stopping visuals to boost sales across Etsy, Shopify, Gumroad, and Stan storefronts.'
  },
  {
    question: 'Does Flowtra take a long time to generate videos?',
    answer:
      'Not at all. Flowtra uses fast models like VEO3 Fast and Sora2 to produce polished videos in seconds, so you can launch new campaigns faster than making a coffee.'
  },
  {
    question: 'Can I re-generate a video if I don’t like the result?',
    answer:
      'Yes. Re-generate as many times as you need. Flowtra offers unlimited generations so you can tweak prompts until you get the perfect video.'
  },
  {
    question: 'Can I use the images and videos commercially?',
    answer:
      'Yes. Everything you create with Flowtra is yours to use across ads, social media, product pages, or paid campaigns. There are no watermarks or extra licensing fees.'
  },
  {
    question: 'Can I use Flowtra on my phone?',
    answer:
      'Yes. Flowtra is web-based and works on mobile, tablet, and desktop—no app download required.'
  },
  {
    question: 'What if I need help or have questions?',
    answer:
      'Reach out through the Flowtra Help Center or email support. The team is ready to assist with setup, troubleshooting, or feature requests.'
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
            Flowtra AI FAQ
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Answers for Etsy, Shopify, Gumroad, and Stan sellers using Flowtra to launch scroll-stopping marketing assets
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {faqData.map((item, index) => (
            <div
              key={index}
              className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                openIndex === index
                  ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white shadow-lg'
                  : 'border-gray-200 bg-white shadow-sm'
              }`}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => toggleItem(index)}
                aria-expanded={openIndex === index}
                className="flex flex-1 flex-col text-left p-6"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 pr-6">
                    {item.question}
                  </h3>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all ${
                      openIndex === index
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}
                    aria-hidden={true}
                  >
                    <ChevronDownIcon
                      className={`h-4 w-4 transition-transform ${
                        openIndex === index ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </div>
                <p
                  className={`text-gray-700 leading-relaxed transition-all duration-200 ${
                    openIndex === index ? 'mt-4 opacity-100' : 'mt-0 h-0 overflow-hidden opacity-0'
                  }`}
                >
                  {item.answer}
                </p>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
