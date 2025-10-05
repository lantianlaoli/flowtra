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
  subtitle = 'No subscription. Create your first AI ad in minutes.',
  buttonText = 'Make My First Ad',
  signedInText = 'Go to Dashboard',
  className = '',
}: SectionCTAProps) {
  return (
    <div className={`mt-8 md:mt-10`}>
      <div className={`max-w-5xl mx-auto bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-center sm:text-left">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="text-gray-600 text-sm mt-1">{subtitle}</p>
          </div>
          <div className="text-center sm:text-right">
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="inline-flex items-center justify-center bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                  {buttonText}
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="inline-flex items-center justify-center bg-gray-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                {signedInText}
              </Link>
            </SignedIn>
          </div>
        </div>
      </div>
    </div>
  );
}
