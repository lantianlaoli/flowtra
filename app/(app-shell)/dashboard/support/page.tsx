'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { ExternalLink, Mail, Heart } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads, FaInstagram } from 'react-icons/fa6';
import FounderCard from '@/components/ui/FounderCard';

export default function SupportPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  const contactLinks = [
    // TikTok - Most Active (Priority #1)
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: FaTiktok,
      description: 'Fastest reply channel - usually within 24 hours',
      color: 'text-gray-800',
      priority: true,
      badge: 'Fastest Reply'
    },
    {
      name: 'Email',
      url: `mailto:${process.env.NEXT_PUBLIC_EMAIL || 'lantianlaoli@gmail.com'}`,
      icon: Mail,
      description: 'For detailed inquiries and support',
      color: 'text-red-600'
    },
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: FaXTwitter,
      description: 'Quick updates and product news',
      color: 'text-gray-700'
    },
    {
      name: 'Instagram',
      url: process.env.NEXT_PUBLIC_INSTAGRAM || 'https://www.instagram.com/lantianlaoli/',
      icon: FaInstagram,
      description: 'Visual content and updates',
      color: 'text-pink-600'
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: FaLinkedin,
      description: 'Business partnerships and inquiries',
      color: 'text-blue-600'
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: FaThreads,
      description: 'Community discussions and feedback',
      color: 'text-gray-700'
    }
  ];



  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Support & Contact
              </h1>
            </div>
          </div>

          {/* Main Content with white background wrapper */}
          <div className="relative bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-sm">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Founder Introduction */}
              <div className="text-center">
                <FounderCard variant="featured" showGreeting={true} />
              </div>

              {/* Contact Channels */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Contact Channels
                </h2>
                <p className="text-sm text-gray-600 mb-6">
                  Choose the best way to reach out. I&apos;ll reply as soon as possible - TikTok usually within 24 hours, Email may take 1-2 business days.
                </p>

                <div className="space-y-3">
                  {contactLinks.map((link, index) => {
                    const isPriority = link.priority;
                    return (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          flex items-center justify-between p-4 rounded-lg transition-colors group
                          ${isPriority
                            ? 'bg-gray-50 border-2 border-gray-300 hover:border-gray-400'
                            : 'border border-gray-200 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <link.icon className={`text-xl ${link.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-medium text-gray-900">{link.name}</span>
                              {link.badge && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-900 text-white">
                                  {link.badge}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">{link.description}</div>
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400 group-hover:text-gray-600" />
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Additional Resources */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  Other Resources
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Check out our <a href="https://www.youtube.com/watch?v=pMxwEIh6ciQ" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">tutorial video</a> to learn the platform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Join our community on TikTok for updates and tips</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    <span>Have feature suggestions? I&apos;d love to hear your ideas!</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
