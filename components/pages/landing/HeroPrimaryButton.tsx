'use client';

import { SignInButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Sparkles, TrendingUp } from 'lucide-react';

export function HeroPrimaryButton() {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <button
        disabled
        className="bg-gray-300 text-gray-500 h-14 px-6 rounded-lg text-lg font-semibold cursor-not-allowed opacity-50 flex items-center gap-2 flex-1 justify-center"
      >
        <Sparkles className="w-5 h-5" />
        <span>Loading...</span>
      </button>
    );
  }

  if (user) {
    return (
      <button
        onClick={() => router.push('/dashboard?upload=true')}
        className="silk-button relative h-14 px-6 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer"
      >
        <span className="sm:hidden">Start</span>
        <span className="hidden sm:inline silk-content">
          <span className="silk-default">
            <Sparkles className="w-5 h-5" />
            <span>Create My First Ad</span>
          </span>
          <span className="silk-hover">
            <TrendingUp className="w-5 h-5" />
            <span>Increase sales</span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
      <button className="silk-button relative h-14 px-6 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer">
        <span className="sm:hidden">Start</span>
        <span className="hidden sm:inline silk-content">
          <span className="silk-default">
            <Sparkles className="w-5 h-5" />
            <span>Create My First Ad</span>
          </span>
          <span className="silk-hover">
            <TrendingUp className="w-5 h-5" />
            <span>Increase sales</span>
          </span>
        </span>
      </button>
    </SignInButton>
  );
}
