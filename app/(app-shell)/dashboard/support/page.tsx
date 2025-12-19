'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { ExternalLink, Mail, ArrowUpRight } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads, FaInstagram, FaDiscord, FaYoutube } from 'react-icons/fa6';
import FounderCard from '@/components/ui/FounderCard';

export default function SupportPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

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
      url: process.env.NEXT_PUBLIC_DISCORD || 'https://discord.gg/dd5Qh54S',
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

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-white min-h-screen pt-14 md:pt-0">
        <div className="max-w-[1280px] mx-auto p-8 lg:p-12">
          
          {/* Header Section */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-black mb-6">
              Support & Contact
            </h1>
            <p className="text-lg md:text-xl text-[#666666] max-w-2xl leading-relaxed">
              We&apos;re here to help. Choose the best channel to reach us. TikTok is our fastest way to respond.
            </p>
          </div>

          {/* Founder Section - Full Width */}
          <div className="mb-16">
            <FounderCard variant="featured" showGreeting={true} />
          </div>

          {/* Main Content Area */}
          <div className="space-y-16">
            
            {/* Contact Grid */}
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-black mb-8 tracking-tight">All Channels</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            </div>

            {/* Additional Resources Section */}
            <div className="pt-10 border-t border-[#E5E5E5]">
               <h2 className="text-3xl md:text-4xl font-semibold text-black mb-8 tracking-tight">Resources</h2>
               <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <a href={process.env.NEXT_PUBLIC_YOUTUBE || 'https://www.youtube.com/@liantianlaoli'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-base font-medium text-black hover:opacity-70 transition-opacity bg-white p-4 rounded-lg border border-[#E5E5E5]">
                      <div className="w-10 h-10 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#666666] font-semibold">1</span>
                      </div>
                      <span>Watch the Platform Tutorial Video</span>
                      <ExternalLink className="w-4 h-4 text-[#666666] ml-auto" />
                    </a>
                    
                    <a href={process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-base font-medium text-black hover:opacity-70 transition-opacity bg-white p-4 rounded-lg border border-[#E5E5E5]">
                      <div className="w-10 h-10 rounded-full bg-[#F7F7F7] border border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                        <span className="text-[#666666] font-semibold">2</span>
                      </div>
                      <span>Join our TikTok Community for updates</span>
                      <ExternalLink className="w-4 h-4 text-[#666666] ml-auto" />
                    </a>
                  </div>
               </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}