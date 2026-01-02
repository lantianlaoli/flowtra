'use client';

import Link from 'next/link';
import { ArrowUpRight, Mail, ArrowLeft } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads, FaInstagram, FaDiscord, FaYoutube } from 'react-icons/fa6';
import Header from '@/components/layout/Header';

export default function SupportPage() {
  const contactLinks = [
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: FaTiktok,
      description: 'Fastest reply channel - usually within 24 hours.',
      cta: 'Send DM',
      priority: true
    },
    {
      name: 'Discord Community',
      url: process.env.NEXT_PUBLIC_DISCORD || 'https://discord.gg/gStwqdpRzt',
      icon: FaDiscord,
      description: 'Join our community for real-time help and discussions.',
      cta: 'Join Discord'
    },
    {
      name: 'YouTube',
      url: process.env.NEXT_PUBLIC_YOUTUBE || 'https://www.youtube.com/@liantianlaoli',
      icon: FaYoutube,
      description: 'Tutorials, feature updates, and AI video tips.',
      cta: 'Watch Tutorials'
    },
    {
      name: 'Email Support',
      url: `mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`,
      icon: Mail,
      description: 'For detailed inquiries and account support.',
      cta: 'Send Email'
    },
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: FaXTwitter,
      description: 'Quick updates and product news.',
      cta: 'Follow'
    },
    {
      name: 'Instagram',
      url: process.env.NEXT_PUBLIC_INSTAGRAM || 'https://www.instagram.com/lantianlaoli/',
      icon: FaInstagram,
      description: 'Visual content and behind the scenes.',
      cta: 'View Profile'
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: FaLinkedin,
      description: 'Business partnerships and professional inquiries.',
      cta: 'Connect'
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: FaThreads,
      description: 'Community discussions and casual feedback.',
      cta: 'Join Thread'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="max-w-[1280px] mx-auto px-6 md:px-8 py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-4">
            Support & Contact
          </h1>
          <p className="text-lg text-[#666666] max-w-2xl">
            We&apos;re here to help. Choose the best channel to reach us. TikTok is our fastest way to respond.
          </p>
        </div>

        {/* Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {contactLinks.map((link, index) => (
            <a
              key={index}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col p-6 bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl hover:shadow-md transition-all duration-200"
            >
              {/* Card Header: Icon */}
              <div className="flex justify-between items-start mb-5">
                <div className="w-12 h-12 bg-white rounded-lg border border-[#E5E5E5] flex items-center justify-center text-black">
                  <link.icon className="w-6 h-6" />
                </div>
                {link.priority && (
                  <span className="px-2 py-1 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Priority
                  </span>
                )}
              </div>

              {/* Card Content */}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-black mb-2 group-hover:text-black/80 transition-colors">
                  {link.name}
                </h3>
                <p className="text-base text-[#666666] line-clamp-3 leading-relaxed mb-6">
                  {link.description}
                </p>
              </div>

              {/* Card Action */}
              <div className="mt-auto">
                <button className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-[#E5E5E5] rounded-lg text-sm font-medium text-black group-hover:border-black/20 transition-colors">
                  {link.cta}
                  <ArrowUpRight className="w-4 h-4 text-[#666666]" />
                </button>
              </div>
            </a>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-black mb-6">Common Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-black mb-2">How do I get started?</h3>
              <p className="text-[#666666]">
                Click &quot;Get Started&quot; to sign up, select a plan that fits your needs, and start creating AI-powered videos immediately.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-black mb-2">What payment methods do you accept?</h3>
              <p className="text-[#666666]">
                We accept all major credit cards, PayPal, and various other payment methods through our secure payment processor.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-black mb-2">Can I upgrade or downgrade my plan?</h3>
              <p className="text-[#666666]">
                We offer one-time purchase plans. You can purchase additional credits at any time to fit your needs.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-black mb-2">What is your refund policy?</h3>
              <p className="text-[#666666]">
                If you encounter issues with your purchase or are not satisfied, please contact us via TikTok or email within 7 days for assistance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
