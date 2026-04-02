'use client';

import { useState, useEffect } from 'react';
import { SignInButton, useUser } from '@clerk/nextjs';
import { handleCreemCheckout } from '@/lib/payment';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';
import { useI18n } from '@/providers/I18nProvider';

type PackageName = 'lite' | 'basic' | 'pro';

interface PricingButtonProps {
  packageName: PackageName;
}

export function PricingButton({ packageName }: PricingButtonProps) {
  const { messages } = useI18n();
  const buttonMessages = messages.landing.pricing.buttons;
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
    ? 'landing-press-button landing-press-button--wide text-[15px] font-semibold'
    : 'landing-press-button landing-press-button--secondary landing-press-button--wide text-[15px] font-semibold';

  if (!isLoaded || isCheckingSubscription) {
    return (
      <button
        disabled
        className="landing-press-button landing-press-button--wide text-[15px] font-semibold"
      >
        {buttonMessages.loading}
      </button>
    );
  }

  if (!user) {
    return (
      <SignInButton mode="modal" forceRedirectUrl="/dashboard">
        <button
          className={purchaseButtonClass}
          onClick={() => {
            trackEvent(ANALYTICS_EVENTS.landing_sign_in_clicked, {
              feature: 'landing',
              surface: 'pricing',
              cta_name: `pricing_sign_in_${packageName}`,
              package_name: packageName,
            });
          }}
        >
          {buttonMessages.getStarted}
        </button>
      </SignInButton>
    );
  }

  // If user subscribed to THIS specific tier, show "Already Subscribed"
  if (subscribedTier === packageName) {
    return (
      <button
        disabled
        className="landing-press-button landing-press-button--success landing-press-button--wide text-[15px] font-semibold"
      >
        {buttonMessages.alreadySubscribed}
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
      alert(buttonMessages.emailRequired);
      return;
    }

    // Warn user if they already have a subscription to a different tier
    if (subscribedTier) {
      const currentTier = subscribedTier.charAt(0).toUpperCase() + subscribedTier.slice(1);
      const newTier = packageName.charAt(0).toUpperCase() + packageName.slice(1);
      const confirmed = confirm(buttonMessages.planChangeConfirm(currentTier, newTier));
      if (!confirmed) {
        return;
      }
    }

    try {
      trackEvent(ANALYTICS_EVENTS.landing_pricing_cta_clicked, {
        feature: 'landing',
        surface: 'pricing',
        section: 'pricing',
        package_name: packageName,
        subscribed_tier: subscribedTier || undefined,
      });
      trackEvent(ANALYTICS_EVENTS.checkout_started, {
        feature: 'billing',
        surface: 'pricing',
        package_name: packageName,
        billing_mode: 'subscription',
      });
      await handleCreemCheckout({
        packageName,
        userEmail: email,
        isSubscription: true,
        onLoading: (loading) => setIsProcessing(loading),
        onError: (error) => alert(`${buttonMessages.purchaseFailed}${error}`),
      });
    } catch (error) {
      console.error('Unexpected error during checkout:', error);
      alert(buttonMessages.unexpectedError);
      setIsProcessing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isProcessing}
      className={purchaseButtonClass}
    >
      {isProcessing ? buttonMessages.processing : subscribedTier ? buttonMessages.changePlan : buttonMessages.getStarted}
    </button>
  );
}
