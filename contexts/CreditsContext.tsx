'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import type { UserCredits } from '@/lib/supabase';

interface CreditsData {
  credits_remaining: number;
}

interface CreditsContextType {
  credits: number | undefined;
  creditsData: CreditsData | undefined;
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
  const [creditsData, setCreditsData] = useState<CreditsData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true); // Start with true to prevent 0 flash
  const isMountedRef = useRef(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useSupabaseBrowserClient();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const readCreditsRemaining = (creditsPayload: unknown): number | undefined => {
    if (typeof creditsPayload === 'number' && Number.isFinite(creditsPayload)) {
      return creditsPayload;
    }

    if (
      creditsPayload &&
      typeof creditsPayload === 'object' &&
      'credits_remaining' in creditsPayload
    ) {
      const value = (creditsPayload as { credits_remaining?: unknown }).credits_remaining;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return undefined;
  };

  const fetchCredits = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const maxAttempts = 4; // initial + 3 retries
      let lastError: unknown = undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch('/api/credits/check', { cache: 'no-store' });
          const data = await response.json();
          const remainingCredits = readCreditsRemaining(data?.credits);

          if (data?.success && remainingCredits !== undefined) {
            if (isMountedRef.current) {
              setCreditsData({ credits_remaining: remainingCredits });
              setCredits(remainingCredits);
            }
            lastError = undefined;
            break;
          }

          if (data?.success && data?.credits == null) {
            if (isMountedRef.current) {
              setCreditsData({ credits_remaining: 0 });
              setCredits(0);
            }
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
          // Final failure after retries - keep undefined instead of setting to 0
          // This prevents showing misleading "0 credits" when API is actually failing
          console.error('Failed to fetch credits after all retries, keeping credits as undefined');
          if (isMountedRef.current) setCredits(undefined);
        }
      }

      if (lastError) {
        console.error('Error fetching credits (with retries):', lastError);
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && credits === undefined) {
      fetchCredits();
    }
  }, [user?.id, credits, fetchCredits]);

  // Set up Realtime subscription for credit updates
  useEffect(() => {
    if (!user?.id) {
      // Cleanup if user logs out
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Only set up subscription after initial fetch completes (credits is no longer undefined)
    if (credits === undefined) {
      return;
    }

    const channel = supabase
      .channel(`user-credits:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Credits Realtime] Credits updated:', payload.new);

          if (payload.new && isMountedRef.current) {
            const newCredits = payload.new as UserCredits;
            setCreditsData({
              credits_remaining: newCredits.credits_remaining,
            });
            setCredits(newCredits.credits_remaining);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to credits updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Realtime subscription error - retrying on next update');
        }
      });

    channelRef.current = channel;

    // Cleanup subscription on unmount or user change
    return () => {
      console.log('[Credits Realtime] Unsubscribing');
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [credits, supabase, user?.id]);

  const refetchCredits = async () => {
    await fetchCredits();
  };

  const updateCredits = (newCredits: number) => {
    setCredits(newCredits);
  };

  return (
    <CreditsContext.Provider value={{ credits, creditsData, refetchCredits, updateCredits, isLoading }}>
      {children}
    </CreditsContext.Provider>
  );
}
