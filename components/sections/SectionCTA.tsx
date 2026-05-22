'use client';

import Link from 'next/link';
import { useUser, SignInButton } from '@clerk/nextjs';

interface SectionCTAProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  signedInText?: string;
  className?: string;
}

export default function SectionCTA({
  title = 'Start Creating AI Videos',
  subtitle = 'Create your first AI ad in minutes.',
  buttonText = 'Make My First Ad',
  signedInText = 'Go to Dashboard',
  className = '',
}: SectionCTAProps) {
  const { isSignedIn } = useUser();

  return (
    <div className={`mt-8 md:mt-10`}>
      <div className={`max-w-5xl mx-auto bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-center sm:text-left">
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="text-gray-600 text-sm mt-1">{subtitle}</p>
          </div>
          <div className="text-center sm:text-right">
            {!isSignedIn ? (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="landing-press-button landing-press-button--compact font-semibold">
                  {buttonText}
                </button>
              </SignInButton>
            ) : (
              <Link href="/dashboard" className="landing-press-button landing-press-button--compact font-semibold">
                {signedInText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
