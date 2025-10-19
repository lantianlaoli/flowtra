'use client';

import { useState } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { handleCreemCheckout } from '@/lib/payment';

type PackageName = 'lite' | 'basic' | 'pro';

interface PricingButtonProps {
  packageName: PackageName;
}

export function PricingButton({ packageName }: PricingButtonProps) {
  const { isLoaded, user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);

  const purchaseButtonClass = packageName === 'basic'
    ? 'w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
    : 'w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

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

  if (!user) {
    return (
      <SignInButton mode="modal" forceRedirectUrl="/dashboard">
        <button className={purchaseButtonClass}>
          Get Started
        </button>
      </SignInButton>
    );
  }

  const handleClick = async () => {
    if (isProcessing) {
      return;
    }

    const email = user.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      alert('Email address is required for purchase. Please check your account settings.');
      return;
    }

    try {
      await handleCreemCheckout({
        packageName,
        userEmail: email,
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
      {isProcessing ? 'Processing...' : 'Get Started'}
    </button>
  );
}
