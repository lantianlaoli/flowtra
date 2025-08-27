'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, MessageSquare } from 'lucide-react';
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
      <div className="bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-xl p-8">
        <div className="text-center space-y-6">
          {/* Maintenance icon */}
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto border-4 border-orange-200">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
          
          {/* Maintenance message */}
          <div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">
              Service Under Maintenance
            </h3>
            <p className="text-gray-700 text-base leading-relaxed mb-6">
              {message?.includes('维护中') ? 'Our system is currently undergoing maintenance upgrades and cannot process new requests at this time. We are working hard to restore service as soon as possible. Please try again later.' : message}
            </p>
            <div className="bg-white/60 rounded-lg p-4 border border-orange-200/50 mb-6">
              <p className="text-sm text-gray-600">
                <strong>Estimated Recovery Time:</strong> Maintenance usually completes within 30 minutes
              </p>
            </div>
          </div>
          
          {/* Contact information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              For urgent inquiries, please contact us:
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {contactLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-300 shadow-sm group"
                >
                  <div className="flex items-center gap-3">
                    <link.icon className="text-xl text-gray-700" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{link.name}</div>
                      <div className="text-xs text-gray-500">{link.description}</div>
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Support Button */}
          <div className="pt-4">
            <Link
              href="/dashboard/support"
              className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-sm"
            >
              <MessageSquare className="w-4 h-4" />
              Get Support
            </Link>
          </div>
          
          {/* Additional help */}
          <div className="pt-4 border-t border-orange-200">
            <p className="text-sm text-gray-600">
              Thank you for your patience. We will update the maintenance progress promptly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}