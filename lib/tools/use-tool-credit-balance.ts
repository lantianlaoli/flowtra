"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type CreditBalanceStatus = {
  isLoading: boolean;
  creditsRemaining: number | null;
  hasActiveSubscription: boolean;
  isSignedIn: boolean;
  isUserLoaded: boolean;
  error: string | null;
};

export function useToolCreditBalance(): CreditBalanceStatus {
  const { isLoaded, isSignedIn } = useUser();
  const [status, setStatus] = useState<Omit<CreditBalanceStatus, "isSignedIn" | "isUserLoaded">>({
    isLoading: false,
    creditsRemaining: null,
    hasActiveSubscription: false,
    error: null,
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus({
        isLoading: false,
        creditsRemaining: null,
        hasActiveSubscription: false,
        error: null,
      });
      return;
    }

    let canceled = false;

    async function loadCredits() {
      setStatus((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const response = await fetch("/api/credits/check", { cache: "no-store" });
        const payload = await response.json();
        if (canceled) return;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to check credits.");
        }

        const subscriptionStatus = payload.subscription?.status;
        setStatus({
          isLoading: false,
          creditsRemaining:
            typeof payload.credits?.credits_remaining === "number"
              ? payload.credits.credits_remaining
              : 0,
          hasActiveSubscription: subscriptionStatus === "active" || subscriptionStatus === "trialing",
          error: null,
        });
      } catch (error) {
        if (canceled) return;
        setStatus({
          isLoading: false,
          creditsRemaining: null,
          hasActiveSubscription: false,
          error: error instanceof Error ? error.message : "Failed to check credits.",
        });
      }
    }

    void loadCredits();

    return () => {
      canceled = true;
    };
  }, [isLoaded, isSignedIn]);

  return {
    ...status,
    isSignedIn: Boolean(isSignedIn),
    isUserLoaded: isLoaded,
  };
}

export function getToolCreditBalanceHeroState(status: CreditBalanceStatus) {
  if (!status.isUserLoaded || (status.isSignedIn && status.isLoading)) {
    return { label: "Checking...", tone: "loading" as const };
  }
  if (!status.isSignedIn) {
    return { label: "Please sign in", tone: "warning" as const };
  }
  if (status.error) {
    return { label: "Please retry", tone: "warning" as const };
  }
  if (!status.hasActiveSubscription) {
    return { label: "Please subscribe", tone: "warning" as const };
  }
  return { label: String(status.creditsRemaining ?? 0), tone: "credits" as const };
}
