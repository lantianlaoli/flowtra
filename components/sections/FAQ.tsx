'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import FAQSchema from '@/components/seo/FAQSchema';
import SectionCTA from '@/components/sections/SectionCTA';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: "How does AI video generation work for Amazon and Walmart product ads?",
    answer: "Our AI analyzes your product photos using advanced computer vision technology. It identifies key features, generates compelling marketing copy, creates engaging visuals, and produces professional video advertisements optimized for Amazon and Walmart marketplace requirements. The entire process takes just seconds and requires no video editing skills."
  },
  {
    question: "Can I use Flowtra for digital products like courses, templates, and ebooks?",
    answer: "Absolutely! Flowtra works perfectly for creators selling digital products on platforms like Gumroad, Stan, Payhip, and Beacons. Turn product screenshots, course previews, or template mockups into engaging video ads for social media marketing. Many digital creators use our AI to promote their courses, Notion templates, design assets, and ebooks."
  },
  {
    question: "How long does it take to create a professional video advertisement from a product photo?",
    answer: "Most video advertisements are generated within 30-60 seconds using our VEO3 Fast model. For higher quality videos using VEO3, processing takes 2-5 minutes. This is significantly faster than traditional video production which can take days or weeks."
  },
  {
    question: "What's the difference between VEO3 Fast and VEO3 High Quality video models?",
    answer: "VEO3 Fast generates videos in 30-60 seconds and costs 30 credits per video, perfect for rapid testing and iteration. VEO3 High Quality takes 2-5 minutes and costs 150 credits per video, delivering premium cinematic quality with enhanced details, smoother animations, and professional-grade output suitable for high-stakes campaigns."
  },
  {
    question: "How much do AI-generated video advertisements cost compared to traditional video production?",
    answer: "Traditional video production costs $500-5000+ per video and takes weeks. Our AI solution costs as little as $0.45 per video (VEO3 Fast) or $2.25 per video (VEO3 High Quality) and generates videos in seconds. This represents a 99% cost reduction while maintaining professional quality suitable for commercial use."
  },
  {
    question: "Are there any restrictions on how I can use the AI-generated videos commercially?",
    answer: "You receive full commercial usage rights for all generated videos. Use them in Amazon listings, Walmart marketplace, paid advertising campaigns, social media marketing, website product pages, email campaigns, and any other commercial applications. No attribution required, and no additional licensing fees."
  }
];

export default function FAQ() {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <section id="faq" className="py-16 scroll-mt-24">
      <FAQSchema faqData={faqData} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about AI-powered video advertisement generation for your e-commerce business
          </p>
        </div>

        <div className="space-y-4">
          {faqData.map((item, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <button
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                onClick={() => toggleItem(index)}
              >
                <h3 className="text-lg font-semibold text-gray-900 pr-4">
                  {item.question}
                </h3>
                <ChevronDownIcon 
                  className={`w-5 h-5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
                    openItems.has(index) ? 'transform rotate-180' : ''
                  }`}
                />
              </button>
              {openItems.has(index) && (
                <div className="px-6 pb-5">
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-gray-700 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* CTA below FAQ */}
      <SectionCTA 
        title="Still have questions? Try it free"
        subtitle="Sign in to generate your first AI ad with 100 free credits."
      />
    </section>
  );
}
