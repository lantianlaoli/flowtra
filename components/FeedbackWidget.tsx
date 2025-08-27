'use client';

import { useState } from 'react';
import { MessageSquare, X, ExternalLink } from 'lucide-react';
import { FaXTwitter, FaLinkedin, FaTiktok, FaThreads } from 'react-icons/fa6';

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);

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
    <>
      {/* Feedback Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <MessageSquare className="w-5 h-5" />
        <span className="font-medium">Feedback & Support</span>
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Contact Us</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <p className="text-gray-600 mb-6">
                Have questions or suggestions? Choose the best way to reach us:
              </p>
              
              <div className="space-y-3">
                {contactLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className="text-2xl text-gray-700" />
                      <div>
                        <div className="font-medium text-gray-900">{link.name}</div>
                        <div className="text-sm text-gray-500">{link.description}</div>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                  </a>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  💡 <strong>Tip:</strong> When describing issues, please include specific error messages and steps to reproduce the problem. This helps us assist you more quickly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}