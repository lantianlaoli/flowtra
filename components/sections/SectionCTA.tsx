'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

interface SectionCTAProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  signedInText?: string;
  className?: string;
}

export default function SectionCTA({
  title = 'Start with 100 free credits',
  subtitle = "No subscription. Create your first AI ad in minutes.",
  buttonText = 'Make My First Ad',
  signedInText = 'Go to Dashboard',
  className = '',
}: SectionCTAProps) {
  return (
    <div className={`mt-10 md:mt-12`}>
      <div className={`max-w-3xl mx-auto bg-white/70 backdrop-blur-md backdrop-saturate-150 border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm ${className}`}>
        <div className="text-center space-y-3">
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <p className="text-gray-600">{subtitle}</p>
          <div className="pt-2">
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="inline-flex items-center justify-center bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                  {buttonText}
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="inline-flex items-center justify-center bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                {signedInText}
              </Link>
            </SignedIn>
          </div>
        </div>
      </div>
    </div>
  );
}

