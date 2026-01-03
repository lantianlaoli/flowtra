'use client';

import { useState, useEffect } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { handleCreemCheckout } from '@/lib/payment';

type PackageName = 'lite' | 'basic' | 'pro';

interface PricingButtonProps {
  packageName: PackageName;
}

export function PricingButton({ packageName }: PricingButtonProps) {
  const { isLoaded, user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscribedTier, setSubscribedTier] = useState<string | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);

  // Check if user already has an active subscription
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setIsCheckingSubscription(false);
        return;
      }

      try {
        const response = await fetch('/api/credits/check');
        const data = await response.json();

        if (data.success && data.subscription) {
          // User has active subscription if status is active or trialing
          const activeStatuses = ['active', 'trialing'];
          if (activeStatuses.includes(data.subscription.status)) {
            setSubscribedTier(data.subscription.tier);
          }
        }
      } catch (error) {
        console.error('Failed to check subscription status:', error);
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user]);

  const purchaseButtonClass = packageName === 'basic'
    ? 'w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
    : 'w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  if (!isLoaded || isCheckingSubscription) {
    return (
      <button
        disabled
        className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg cursor-not-allowed opacity-50"
      >
        Loading...
      </button>
    );
  }

  if (!user) {
    return (
      <SignInButton mode="modal" forceRedirectUrl="/dashboard">
        <button className={purchaseButtonClass}>
          Get Started
        </button>
      </SignInButton>
    );
  }

  // If user subscribed to THIS specific tier, show "Already Subscribed"
  if (subscribedTier === packageName) {
    return (
      <button
        disabled
        className="w-full bg-green-600 text-white py-3 rounded-lg cursor-not-allowed opacity-75"
      >
        Already Subscribed
      </button>
    );
  }

  // If user subscribed to a different tier, allow upgrade/downgrade
  const handleClick = async () => {
    if (isProcessing) {
      return;
    }

    const email = user.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      alert('Email address is required for purchase. Please check your account settings.');
      return;
    }

    // Warn user if they already have a subscription to a different tier
    if (subscribedTier) {
      const currentTier = subscribedTier.charAt(0).toUpperCase() + subscribedTier.slice(1);
      const newTier = packageName.charAt(0).toUpperCase() + packageName.slice(1);
      const confirmed = confirm(
        `You are currently subscribed to the ${currentTier} plan. ` +
        `This will create a new ${newTier} subscription. ` +
        `Please cancel your existing subscription in your account settings first.`
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      await handleCreemCheckout({
        packageName,
        userEmail: email,
        isSubscription: true,
        onLoading: (loading) => setIsProcessing(loading),
        onError: (error) => alert(`Purchase failed: ${error}`),
      });
    } catch (error) {
      console.error('Unexpected error during checkout:', error);
      alert('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isProcessing}
      className={purchaseButtonClass}
    >
      {isProcessing ? 'Processing...' : subscribedTier ? 'Change Plan' : 'Get Started'}
    </button>
  );
}
