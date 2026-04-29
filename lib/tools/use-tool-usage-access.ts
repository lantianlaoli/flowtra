"use client";

import { useEffect, useState } from "react";

const UNLIMITED_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

type ToolUsageAccess = {
  isLoading: boolean;
  hasUnlimitedAccess: boolean;
};

export function useToolUsageAccess(): ToolUsageAccess {
  const [access, setAccess] = useState<ToolUsageAccess>({
    isLoading: true,
    hasUnlimitedAccess: false,
  });

  useEffect(() => {
    let canceled = false;

    async function loadSubscriptionStatus() {
      try {
        const response = await fetch("/api/subscription/status", {
          method: "GET",
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (!canceled) {
            setAccess({ isLoading: false, hasUnlimitedAccess: false });
          }
          return;
        }

        const data = await response.json();
        const status = data?.subscription?.status;

        if (!canceled) {
          setAccess({
            isLoading: false,
            hasUnlimitedAccess: typeof status === "string" && UNLIMITED_SUBSCRIPTION_STATUSES.has(status),
          });
        }
      } catch {
        if (!canceled) {
          setAccess({ isLoading: false, hasUnlimitedAccess: false });
        }
      }
    }

    void loadSubscriptionStatus();

    return () => {
      canceled = true;
    };
  }, []);

  return access;
}
