'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import { ExternalLink, Mail, ArrowUpRight } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads, FaInstagram, FaDiscord, FaYoutube } from 'react-icons/fa6';
import FounderCard from '@/components/ui/FounderCard';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

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

  // Loading state
  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen ">
        <div className="max-w-[1280px] mx-auto px-6 md:px-8 pb-6 md:pb-8 pt-14 md:pt-8">
          
          {/* Header Section */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
              Support & Contact
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed">
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
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-8 tracking-tight">All Channels</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {contactLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col p-6 bg-card border border-border rounded-xl hover:shadow-md transition-all duration-200"
                  >
                    {/* Card Header: Icon */}
                    <div className="flex justify-between items-start mb-5">
                      <div className="w-12 h-12 bg-background rounded-lg border border-border flex items-center justify-center text-foreground">
                        <link.icon className="w-6 h-6" />
                      </div>
                      {link.priority && (
                         <span className="px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                           Priority
                         </span>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-foreground/80 transition-colors">
                        {link.name}
                      </h3>
                      <p className="text-base text-muted-foreground line-clamp-3 leading-relaxed mb-6">
                        {link.description}
                      </p>
                    </div>

                    {/* Card Action */}
                    <div className="mt-auto">
                      <button className="w-full flex items-center justify-center gap-2 py-3 bg-background border border-border rounded-lg text-sm font-medium text-foreground group-hover:border-border/70 transition-colors">
                        {link.cta}
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Additional Resources Section */}
            <div className="pt-10 border-t border-border">
               <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-8 tracking-tight">Resources</h2>
               <div className="bg-card border border-border rounded-xl p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <a href={process.env.NEXT_PUBLIC_YOUTUBE || 'https://www.youtube.com/@liantianlaoli'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-base font-medium text-foreground hover:opacity-70 transition-opacity bg-background p-4 rounded-lg border border-border">
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                        <span className="text-muted-foreground font-semibold">1</span>
                      </div>
                      <span>Watch the Platform Tutorial Video</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
                    </a>
                    
                    <a href={process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 text-base font-medium text-foreground hover:opacity-70 transition-opacity bg-background p-4 rounded-lg border border-border">
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                        <span className="text-muted-foreground font-semibold">2</span>
                      </div>
                      <span>Join our TikTok Community for updates</span>
                      <ExternalLink className="w-4 h-4 text-muted-foreground ml-auto" />
                    </a>
                  </div>
               </div>
            </div>

          </div>

        </div>
      </DashboardContentTransition>
    </div>
  );
}
