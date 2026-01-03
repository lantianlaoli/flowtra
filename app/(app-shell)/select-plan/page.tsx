'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import PricingSection from '@/components/pages/landing/sections/PricingSection';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

export default function SelectPlanPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
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

  if (!user) {
    router.push('/sign-in?redirect_url=/select-plan');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-black mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-gray-600">
            Select a plan to start creating AI-powered videos
          </p>
        </div>

        <PricingSection showTitle={false} />

        <div className="text-center mt-8 text-sm text-gray-500">
          Need help choosing? <a href="/support" className="text-black underline">Contact support</a>
        </div>
      </div>
    </div>
  );
}
