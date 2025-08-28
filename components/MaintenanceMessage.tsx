'use client';

import { ExternalLink, Wrench } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads } from 'react-icons/fa6';

interface MaintenanceMessageProps {
  message?: string;
}

export default function MaintenanceMessage({ message }: MaintenanceMessageProps) {
  const contactLinks = [
    {
      name: 'X (Twitter)',
      url: process.env.NEXT_PUBLIC_X || 'https://x.com/lantianlaoli',
      icon: FaXTwitter,
      description: 'Quick responses'
    },
    {
      name: 'LinkedIn',
      url: process.env.NEXT_PUBLIC_LINKEDIN ? `https://${process.env.NEXT_PUBLIC_LINKEDIN}` : 'https://www.linkedin.com/in/laoli-lantian-5ab8632bb',
      icon: FaLinkedin,
      description: 'Professional inquiries'
    },
    {
      name: 'TikTok',
      url: process.env.NEXT_PUBLIC_TIKTOK || 'https://www.tiktok.com/@laolilantian',
      icon: FaTiktok,
      description: 'Follow for updates'
    },
    {
      name: 'Threads',
      url: process.env.NEXT_PUBLIC_THREADS || 'https://www.threads.com/@lantianlaoli',
      icon: FaThreads,
      description: 'Community discussions'
    }
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <div className="text-center space-y-6">
          {/* Notion-style maintenance icon */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <Wrench className="w-6 h-6 text-gray-600" />
          </div>
          
          {/* Maintenance message */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Service Under Maintenance
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              {message?.includes('maintenance') || message?.includes('维护中') ? 'Our system is currently undergoing maintenance upgrades and cannot process new requests at this time. We are working hard to restore service as soon as possible. Please try again later.' : message}
            </p>
            
            {/* Notion-style info callout */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-gray-600">ℹ️</span>
                </div>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Estimated Recovery Time:</span> Maintenance usually completes within 30 minutes
                </p>
              </div>
            </div>
          </div>
          
          {/* Contact information - Notion style */}
          <div className="space-y-4">
            <h4 className="text-base font-medium text-gray-900">
              For urgent inquiries, contact us:
            </h4>
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
              {contactLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 group"
                >
                  <link.icon className="text-lg text-gray-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{link.name}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Additional help - Notion style */}
          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Thank you for your patience. We will update the maintenance progress promptly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}