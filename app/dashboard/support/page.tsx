'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { ExternalLink, MessageSquare, HelpCircle, Mail } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads } from 'react-icons/fa6';

export default function SupportPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  const contactLinks = [
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: FaXTwitter,
      description: 'Quick responses and updates',
      color: 'text-gray-700'
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: FaLinkedin,
      description: 'Professional inquiries and partnerships',
      color: 'text-blue-600'
    },
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: FaTiktok,
      description: 'Follow for tips and updates',
      color: 'text-gray-800'
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: FaThreads,
      description: 'Community discussions',
      color: 'text-gray-700'
    }
  ];

  const helpTopics = [
    {
      icon: HelpCircle,
      title: 'Getting Started',
      description: 'Learn how to upload images and generate your first video ad'
    },
    {
      icon: MessageSquare,
      title: 'Common Issues',
      description: 'Solutions to frequently encountered problems'
    },
    {
      icon: Mail,
      title: 'Feature Requests',
      description: 'Suggest new features or improvements'
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar 
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
      />
      
      <div className="flex-1 lg:pl-64">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Support & Contact
            </h1>
            <p className="text-gray-600">
              Get help, report issues, or share feedback with our team
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Contact Channels */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Contact Channels
              </h2>
              <p className="text-gray-600 mb-6">
                Choose the best way to reach us based on your needs:
              </p>
              
              <div className="space-y-4">
                {contactLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <link.icon className={`text-2xl ${link.color}`} />
                      <div>
                        <div className="font-medium text-gray-900">{link.name}</div>
                        <div className="text-sm text-gray-500">{link.description}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                  </a>
                ))}
              </div>
            </div>

            {/* Help Topics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Common Help Topics
              </h2>
              
              <div className="space-y-4">
                {helpTopics.map((topic, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      <topic.icon className="w-5 h-5 text-gray-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">{topic.title}</h3>
                        <p className="text-sm text-gray-600">{topic.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-medium text-blue-900 mb-2">💡 Before Contacting Support</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Include specific error messages if any</li>
                  <li>• Describe the steps that led to the issue</li>
                  <li>• Mention your browser and device type</li>
                  <li>• Share screenshots if helpful</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Response Time */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Response Times</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <FaXTwitter className="text-xl text-gray-700" />
                <div>
                  <div className="font-medium text-gray-900">X (Twitter)</div>
                  <div className="text-sm text-gray-600">Usually within 2-4 hours</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <FaLinkedin className="text-xl text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">LinkedIn</div>
                  <div className="text-sm text-gray-600">1-2 business days</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}