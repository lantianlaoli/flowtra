'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser, SignInButton } from '@clerk/nextjs';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { CREDIT_COSTS } from '@/lib/constants';
import { handleCreemCheckout } from '@/lib/payment';
import type { ReactNode } from 'react';

const pricingPlanItems = {
  lite: [
    { key: 'credits', content: (videos: number) => <><span className="font-bold text-gray-900">1,930</span> credits/month</> },
    { key: 'videos', content: (videos: number) => <>≈ <span className="font-bold text-gray-900">{videos}</span> Veo3 Fast videos</> },
    {
      key: 'agent',
      content: () => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-900">AI Agent</span>
        </span>
      ),
    },
    { key: 'images', content: () => 'Always free image generation' },
    { key: 'viral', content: () => 'Viral Clone' },
    { key: 'avatar', content: () => 'Avatar Ads' },
    { key: 'motion', content: () => 'Motion Clone' },
    { key: 'tiktok', content: () => 'TikTok publishing support' },
  ],
  basic: [
    { key: 'credits', content: () => <><span className="font-bold text-gray-900">3,930</span> credits/month</> },
    { key: 'videos', content: (videos: number) => <>≈ <span className="font-bold text-gray-900">{videos}</span> Veo3 Fast videos</> },
    {
      key: 'agent',
      content: () => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-900">AI Agent</span>
        </span>
      ),
    },
    { key: 'images', content: () => 'Free image generation' },
    { key: 'viral', content: () => 'Viral Clone' },
    { key: 'avatar', content: () => 'Avatar Ads' },
    { key: 'motion', content: () => 'Motion Clone' },
    { key: 'tiktok', content: () => 'TikTok publishing support' },
  ],
  pro: [
    { key: 'credits', content: () => <><span className="font-bold text-gray-900">6,600</span> credits/month</> },
    { key: 'videos', content: (videos: number) => <>≈ <span className="font-bold text-gray-900">{videos}</span> Veo3 Fast videos</> },
    {
      key: 'agent',
      content: () => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-gray-900">AI Agent</span>
        </span>
      ),
    },
    { key: 'images', content: () => 'Always free image generation' },
    { key: 'viral', content: () => 'Viral Clone' },
    { key: 'avatar', content: () => 'Avatar Ads' },
    { key: 'motion', content: () => 'Motion Clone' },
    { key: 'tiktok', content: () => 'TikTok publishing support' },
    { key: 'priority', content: () => 'Priority processing' },
  ],
} satisfies Record<'lite' | 'basic' | 'pro', { key: string; content: (videos: number) => ReactNode }[]>;

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12 flex justify-center"><div className="text-gray-400">Loading...</div></div>
});

export default function PricingPage() {
  const { user, isLoaded } = useUser();
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);

  // Video generation estimates (generation-time billing)
  const liteVideos = Math.floor(500 / CREDIT_COSTS.veo3_fast);
  const basicVideos = Math.floor(2000 / CREDIT_COSTS.veo3_fast);
  const proVideos = Math.floor(3500 / CREDIT_COSTS.veo3_fast);

  const handlePurchase = async (packageName: 'lite' | 'basic' | 'pro') => {
    if (!isLoaded) {
      alert('Please wait for the page to fully load');
      return;
    }
    if (!user) {
      alert('Please log in before purchasing a package');
      return;
    }
    if (!user.emailAddresses || user.emailAddresses.length === 0) {
      alert('No email address found. Please check your account settings.');
      return;
    }
    const userEmail = user.emailAddresses[0].emailAddress;
    if (!userEmail) {
      alert('Email address is required for purchase');
      return;
    }

    try {
      await handleCreemCheckout({
        packageName,
        userEmail,
        isSubscription: true,
        onLoading: (isLoading) => setLoadingPackage(isLoading ? packageName : null),
        onError: (error) => alert(`Purchase failed: ${error}`)
      });
    } catch {
      alert('An unexpected error occurred. Please try again.');
    }
  };

  // PricingButton identical to LandingPage
  const PricingButton = ({ packageName }: { packageName: 'lite' | 'basic' | 'pro' }) => {
    if (!isLoaded) {
      return (
        <button
          disabled
          className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg cursor-not-allowed opacity-50"
        >
          Loading...
        </button>
      );
    }

    if (user) {
      const isLoading = loadingPackage === packageName;
      const buttonClass = packageName === 'basic'
        ? "w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        : "w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

      return (
        <button
          onClick={() => handlePurchase(packageName)}
          disabled={isLoading}
          className={buttonClass}
        >
          {isLoading ? 'Processing...' : 'Get Started'}
        </button>
      );
    }

    const buttonClass = packageName === 'basic'
      ? "w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-black transition-colors cursor-pointer"
      : "w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer";

    return (
      <SignInButton mode="modal" forceRedirectUrl="/dashboard">
        <button className={buttonClass}>
          Get Started
        </button>
      </SignInButton>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Pricing Section (mirrors LandingPage) */}
        <div className="py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h2>
            <p className="text-base text-gray-600 mb-6">Monthly subscription with automatic credit reset</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {/* Lite Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lite</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $29
                <span className="text-lg font-normal text-gray-600">
                  /month
                </span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                {pricingPlanItems.lite.map((item) => (
                  <li key={item.key} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    <span className="flex-1 text-gray-600">{item.content(liteVideos)}</span>
                  </li>
                ))}
              </ul>
              <PricingButton packageName="lite" />
            </div>

            {/* Basic Plan (Recommended) */}
            <div className="relative bg-white rounded-2xl border-2 border-gray-900 p-6 md:p-8 shadow-xl transform scale-105 flex flex-col z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-gray-900 text-white px-4 py-1 rounded-full text-sm font-medium shadow-md whitespace-nowrap border border-gray-900">
                  Recommended
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Basic</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $59
                <span className="text-lg font-normal text-gray-600">
                  /month
                </span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                {pricingPlanItems.basic.map((item) => (
                  <li key={item.key} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                    <span className="flex-1 text-gray-600">{item.content(basicVideos)}</span>
                  </li>
                ))}
              </ul>
              <PricingButton packageName="basic" />
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $99
                <span className="text-lg font-normal text-gray-600">
                  /month
                </span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                {pricingPlanItems.pro.map((item) => (
                  <li key={item.key} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    <span className="flex-1 text-gray-600">{item.content(proVideos)}</span>
                  </li>
                ))}
              </ul>
              <PricingButton packageName="pro" />
            </div>
          </div>
        </div>
      </main>

      {/* FAQ Section (same as LandingPage) */}
      <FAQ />

      <Footer />
    </div>
  );
}
