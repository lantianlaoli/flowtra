'use client';

import { useState } from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { BookDemoDialog } from '@/components/modals/BookDemoDialog';

interface BookDemoCTAProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'compact';
}

export function BookDemoCTA({
  title = "Ready to Transform Your Video Marketing?",
  description = "Book a personalized demo and get trial access to explore Flowtra's AI-powered video generation platform.",
  variant = 'default'
}: BookDemoCTAProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleBookDemo = () => {
    setIsDialogOpen(true);
  };

  if (variant === 'compact') {
    return (
      <>
        <div className="bg-[#F7F7F7] rounded-xl p-8 border border-[#E5E5E5]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-[20px] font-bold text-black mb-2">{title}</h3>
              <p className="text-[14px] text-[#666666]">{description}</p>
            </div>
            <button
              onClick={handleBookDemo}
              className="flex-shrink-0 bg-black text-white px-6 py-3 rounded-lg font-medium text-[14px] transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.98] flex items-center gap-2 group whitespace-nowrap"
            >
              <Mail className="w-4 h-4" />
              <span>Book Demo</span>
              <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
        <BookDemoDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
      </>
    );
  }

  return (
    <>
      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border-2 border-black p-8 lg:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
            <div className="text-center space-y-6">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black">
                <Mail className="w-8 h-8 text-white" />
              </div>

              {/* Title */}
              <h2 className="text-[32px] lg:text-[40px] font-bold text-black leading-tight">
                {title}
              </h2>

              {/* Description */}
              <p className="text-[16px] lg:text-[18px] text-[#666666] leading-relaxed max-w-2xl mx-auto">
                {description}
              </p>

              {/* CTA Button */}
              <div className="pt-4">
                <button
                  onClick={handleBookDemo}
                  className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-lg font-semibold text-[16px] transition-all duration-200 hover:bg-[#1a1a1a] hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] active:scale-[0.98] group"
                >
                  <Mail className="w-5 h-5" />
                  <span>Book a Demo</span>
                  <ArrowUpRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
              </div>

              {/* Fine Print */}
              <p className="text-[12px] text-[#999999] uppercase tracking-wider">
                Get personalized trial access • Quick response
              </p>
            </div>
          </div>
        </div>
      </section>
      <BookDemoDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </>
  );
}
