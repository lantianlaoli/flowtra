'use client';

import Link from 'next/link';
import { ArrowRight, Mail, MessageCircle, Calendar } from 'lucide-react';
import type { VideoAnalysisResult } from '@/hooks/useVideoAnalysis';
import { BOOKING_URL } from '@/lib/booking';

interface CTASectionProps {
  result: VideoAnalysisResult;
}

export function CTASection({ result }: CTASectionProps) {
  const handleStartCloning = () => {
    // Save analysis to sessionStorage for pre-selection in dashboard
    if (result) {
      sessionStorage.setItem('showcase_analysis', JSON.stringify(result));
    }
  };

  const contactEmail = process.env.NEXT_PUBLIC_EMAIL || 'hello@flowtra.com';
  const discordLink = process.env.NEXT_PUBLIC_DISCORD;
  const linkedinLink = process.env.NEXT_PUBLIC_LINKEDIN;

  return (
    <div className="mt-8 space-y-8 border-t border-gray-200 pt-8">
      {/* Primary CTA */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-bold text-gray-900">
            Ready to Clone This Video?
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our AI has mapped every shot. Now let&apos;s create your version with your product in minutes.
          </p>

          <Link
            href="/dashboard/competitor-ugc-replication"
            onClick={handleStartCloning}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-all hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Start Cloning This Video
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="text-sm text-gray-500 mt-4">
            Starting at $29/month • 1,930 credits ≈ 12.8 minutes of UGC video
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm font-medium text-gray-500">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Secondary CTAs */}
      <div className="text-center space-y-4">
        <h4 className="text-lg font-semibold text-gray-900">
          Need Help Getting Started?
        </h4>
        <p className="text-gray-600">
          Our team is here to help you create amazing UGC videos
        </p>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {/* Email */}
          <a
            href={`mailto:${contactEmail}?subject=Help with Viral Clone&body=Hi, I just analyzed a video and would like to learn more about cloning it.`}
            className="inline-flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:border-black hover:bg-gray-50 transition-all"
          >
            <Mail className="w-4 h-4" />
            Email Us
          </a>

          {/* Discord */}
          {discordLink && (
            <a
              href={discordLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:border-black hover:bg-gray-50 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              Join Discord
            </a>
          )}

          {/* LinkedIn */}
          {linkedinLink && (
            <a
              href={linkedinLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:border-black hover:bg-gray-50 transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              LinkedIn
            </a>
          )}

          {/* Calendar booking */}
          {BOOKING_URL && (
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-200 rounded-lg font-medium text-gray-700 hover:border-black hover:bg-gray-50 transition-all"
            >
              <Calendar className="w-4 h-4" />
              Book a Call
            </a>
          )}
        </div>

        {/* Social proof */}
        <p className="text-sm text-gray-500 mt-6">
          Trusted by 500+ e-commerce brands
        </p>
      </div>
    </div>
  );
}
