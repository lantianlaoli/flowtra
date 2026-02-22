'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import PricingSection from '@/components/pages/landing/sections/PricingSection';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12 text-center text-gray-400">Loading...</div>
});

export default function SelectPlanPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [showWelcomeBonusCard, setShowWelcomeBonusCard] = useState(true);
  const [welcomeBonusCredits, setWelcomeBonusCredits] = useState(100);

  useEffect(() => {
    const checkWelcomeCredits = async () => {
      if (!isLoaded || !user) {
        return;
      }

      try {
        const response = await fetch('/api/credits/check');
        const data = await response.json();

        const hasPurchased = Boolean(data?.credits?.has_purchased);
        const creditsRemaining = data?.credits?.credits_remaining || 0;

        // Show for new (not purchased) users; hide only for purchased users.
        if (!hasPurchased) {
          setShowWelcomeBonusCard(true);
          setWelcomeBonusCredits(Math.max(100, creditsRemaining));
        } else {
          setShowWelcomeBonusCard(false);
        }
      } catch (error) {
        console.error('Failed to check welcome bonus credits:', error);
      }
    };

    checkWelcomeCredits();
  }, [isLoaded, user]);

  // TEMPORARY: All subscription checks disabled to allow all users access
  // TODO: Re-enable after fixing webhook handling
  /*
  const [isChecking, setIsChecking] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    const checkPurchaseStatus = async () => {
      if (!isLoaded || !user) return;

      try {
        const response = await fetch('/api/credits/check');
        const data = await response.json();

        if (data.success && data.credits) {
          // User has access if they have purchased OR have active subscription
          const hasAccess = data.credits.has_purchased ||
                           (data.credits.subscription_credits || 0) > 0;

          if (hasAccess) {
            // User has already purchased or subscribed, redirect to dashboard
            router.push('/dashboard');
            return;
          }
        }

        setIsChecking(false);
        // Start polling to detect when payment completes
        setIsPolling(true);
      } catch (error) {
        console.error('Failed to check purchase status:', error);
        setIsChecking(false);
      }
    };

    checkPurchaseStatus();
  }, [user, isLoaded, router]);

  // Poll for purchase status every 2 seconds
  useEffect(() => {
    if (!isPolling || !user) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/credits/check');
        const data = await response.json();

        if (data.success && data.credits) {
          // Check if user has purchased OR has active subscription
          const hasAccess = data.credits.has_purchased ||
                           (data.credits.subscription_credits || 0) > 0;

          if (hasAccess) {
            clearInterval(pollInterval);
            router.push('/dashboard');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      setIsPolling(false);
    }, 300000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [isPolling, user, router]);

  if (!isLoaded || isChecking) {
    return <FlowtraLoading />;
  }
  */

  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  if (!user) {
    router.push('/sign-in?redirect_url=/select-plan');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 inset-x-0 z-50 border-b border-[#E5E5E5] bg-white">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <p className="hidden sm:block text-sm text-gray-600">Not ready to choose a plan yet?</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#222222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            Back to Home
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Select a plan to start creating AI-powered videos
          </p>
        </div>

        <PricingSection
          showTitle={false}
          showWelcomeBonusCard={showWelcomeBonusCard}
          welcomeBonusCredits={welcomeBonusCredits}
        />

        <div className="text-center mt-8 text-sm text-gray-500">
          Need help choosing? <a href="/support" className="text-black underline">Contact support</a>
        </div>
      </div>

      <FAQ />
    </div>
  );
}
