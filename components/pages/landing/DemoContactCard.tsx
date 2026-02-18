'use client';

import { getSocialMediaLinks } from '@/lib/social-links';
import { ArrowUpRight, Mail, Sparkles } from 'lucide-react';
import { BOOKING_URL } from '@/lib/booking';

interface DemoContactCardProps {
  className?: string;
}

export function DemoContactCard({ className = '' }: DemoContactCardProps) {
  const socialLinks = getSocialMediaLinks();

  return (
    <article
      className={`bg-white rounded-xl border border-[#E5E5E5] p-7 transition-all hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden ${className}`}
      itemScope
      itemType="https://schema.org/ContactPage"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Mail className="w-5 h-5 text-black flex-shrink-0" />
          <h3 className="text-[20px] font-bold text-black leading-tight" itemProp="name">
            Book a Demo
          </h3>
        </div>
        <p className="text-[14px] text-[#666666] leading-6">
          Connect with us for trial access
        </p>
      </div>

      {/* Social Links - Vertical List */}
      <div className="space-y-2.5 mb-6 flex-grow">
        {socialLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 h-12 px-2.5 rounded-lg bg-[#F7F7F7] border border-transparent hover:border-black hover:bg-white transition-all duration-200 group"
              title={link.description || link.label}
              style={{
                animationDelay: `${index * 50}ms`
              }}
            >
              {/* Icon Container */}
              <div className="w-9 h-9 rounded-full bg-white border border-[#E5E5E5] flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105 group-hover:border-black group-hover:shadow-sm">
                <Icon className="w-4.5 h-4.5 text-black" />
              </div>

              {/* Label */}
              <span className="text-[13px] leading-none text-[#666666] font-medium group-hover:text-black transition-colors">
                {link.label}
              </span>
            </a>
          );
        })}
      </div>

      {/* CTA Button with Icon */}
      <a
        href={BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-black text-white py-3 px-4 rounded-lg font-semibold text-[14px] transition-all duration-200 hover:bg-[#1a1a1a] hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 group"
      >
        <Mail className="w-4 h-4" />
        <span>Schedule Call</span>
        <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </a>
    </article>
  );
}
