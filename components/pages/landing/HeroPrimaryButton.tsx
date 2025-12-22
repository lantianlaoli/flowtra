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
        className="bg-gray-300 text-gray-500 h-14 px-6 rounded-lg text-lg font-semibold cursor-not-allowed opacity-50 flex items-center gap-2 flex-1 justify-center"
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
        className="bg-black text-white h-14 px-8 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer transition-all duration-200 hover:bg-[#333333] hover:-translate-y-[1px] active:translate-y-0"
      >
        <Copy className="w-5 h-5" />
        <span className="sm:hidden">Clone Now</span>
        <span className="hidden sm:inline">Clone Viral UGC</span>
      </button>
    );
  }

  return (
    <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
      <button className="bg-black text-white h-14 px-8 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer transition-all duration-200 hover:bg-[#333333] hover:-translate-y-[1px] active:translate-y-0">
        <Copy className="w-5 h-5" />
        <span className="sm:hidden">Clone Now</span>
        <span className="hidden sm:inline">Clone Viral UGC</span>
      </button>
    </SignInButton>
  );
}
