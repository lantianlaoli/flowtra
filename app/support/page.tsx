'use client';

import Link from 'next/link';
import { ArrowUpRight, Mail, ArrowLeft } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads, FaInstagram, FaDiscord, FaYoutube } from 'react-icons/fa6';
import Header from '@/components/layout/Header';
import { useI18n } from '@/providers/I18nProvider';

export default function SupportPage() {
  const { messages } = useI18n();
  const supportMessages = messages.support;
  const contactLinks = [
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: FaTiktok,
      description: supportMessages.links.tiktok.description,
      cta: supportMessages.links.tiktok.cta,
      priority: true
    },
    {
      name: 'Discord Community',
      url: process.env.NEXT_PUBLIC_DISCORD || 'https://discord.gg/gStwqdpRzt',
      icon: FaDiscord,
      description: supportMessages.links.discord.description,
      cta: supportMessages.links.discord.cta
    },
    {
      name: 'YouTube',
      url: process.env.NEXT_PUBLIC_YOUTUBE || 'https://www.youtube.com/@liantianlaoli',
      icon: FaYoutube,
      description: supportMessages.links.youtube.description,
      cta: supportMessages.links.youtube.cta
    },
    {
      name: 'Email Support',
      url: `mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`,
      icon: Mail,
      description: supportMessages.links.email.description,
      cta: supportMessages.links.email.cta
    },
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: FaXTwitter,
      description: supportMessages.links.x.description,
      cta: supportMessages.links.x.cta
    },
    {
      name: 'Instagram',
      url: process.env.NEXT_PUBLIC_INSTAGRAM || 'https://www.instagram.com/lantianlaoli/',
      icon: FaInstagram,
      description: supportMessages.links.instagram.description,
      cta: supportMessages.links.instagram.cta
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: FaLinkedin,
      description: supportMessages.links.linkedin.description,
      cta: supportMessages.links.linkedin.cta
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: FaThreads,
      description: supportMessages.links.threads.description,
      cta: supportMessages.links.threads.cta
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
          {supportMessages.backToHome}
        </Link>

        {/* Header Section */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black mb-4">
            {supportMessages.title}
          </h1>
          <p className="text-lg text-[#666666] max-w-2xl">
            {supportMessages.description}
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
                    {supportMessages.priority}
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
          <h2 className="text-2xl font-semibold text-black mb-6">{supportMessages.commonQuestions}</h2>
          <div className="space-y-4">
            {supportMessages.questions.map((item) => (
              <div key={item.question}>
                <h3 className="font-medium text-black mb-2">{item.question}</h3>
                <p className="text-[#666666]">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
