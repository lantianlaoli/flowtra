'use client';

import { SignInButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Copy } from 'lucide-react';

export function HeroPrimaryButton() {
  const { isLoaded, user } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <button
        disabled
        className="landing-press-button flex-1 text-lg font-semibold"
      >
        <Copy className="w-5 h-5" />
        <span>Loading...</span>
      </button>
    );
  }

  if (user) {
    return (
      <button
        onClick={() => router.push('/dashboard?upload=true')}
        className="landing-press-button flex-1 text-lg font-semibold"
      >
        <Copy className="w-5 h-5" />
        <span className="sm:hidden">Clone Now</span>
        <span className="hidden sm:inline">Clone Viral UGC</span>
      </button>
    );
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
      <button className="landing-press-button flex-1 text-lg font-semibold">
        <Copy className="w-5 h-5" />
        <span className="sm:hidden">Clone Now</span>
        <span className="hidden sm:inline">Clone Viral UGC</span>
      </button>
    </SignInButton>
  );
}
