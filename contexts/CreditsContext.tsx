'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

interface CreditsContextType {
  credits: number | undefined;
  refetchCredits: () => Promise<void>;
  updateCredits: (newCredits: number) => void;
  isLoading: boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

export function useCredits() {
  const context = useContext(CreditsContext);
  if (context === undefined) {
    throw new Error('useCredits must be used within a CreditsProvider');
  }
  return context;
}

interface CreditsProviderProps {
  children: React.ReactNode;
}

export function CreditsProvider({ children }: CreditsProviderProps) {
  const { user } = useUser();
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const fetchCredits = async () => {
    if (!user?.id || isLoading) return;

    setIsLoading(true);
    try {
      const maxAttempts = 4; // initial + 3 retries
      let lastError: unknown = undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch('/api/credits/check', { cache: 'no-store' });
          const data = await response.json();

          if (data?.success) {
            if (isMountedRef.current) setCredits(data.credits);
            lastError = undefined;
            break;
          }

          // If API responded but not successful, treat as retryable unless final attempt
          lastError = new Error(data?.error || 'Unknown credits API error');
        } catch (err) {
          // Network/parse error
          lastError = err;
        }

        if (attempt < maxAttempts) {
          // Exponential backoff with jitter: ~300ms, 700ms, 1500ms
          const base = [300, 700, 1500][attempt - 1] ?? 2000;
          const jitter = Math.floor(Math.random() * 200);
          await sleep(base + jitter);
          // Continue to next attempt
          continue;
        } else {
          // Final failure after retries
          if (isMountedRef.current) setCredits(0);
        }
      }

      if (lastError) {
        console.error('Error fetching credits (with retries):', lastError);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && credits === undefined) {
      fetchCredits();
    }
  }, [user?.id, credits]);

  const refetchCredits = async () => {
    await fetchCredits();
  };

  const updateCredits = (newCredits: number) => {
    setCredits(newCredits);
  };

  return (
    <CreditsContext.Provider value={{ credits, refetchCredits, updateCredits, isLoading }}>
      {children}
    </CreditsContext.Provider>
  );
}
