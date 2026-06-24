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

const CREDITS_CACHE_PREFIX = 'flowtra:credits:';
const CREDITS_CACHE_TTL_MS = 5 * 60 * 1000;
const CREDITS_FETCH_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 6000 : 4000;

interface CachedCredits {
  credits_remaining: number;
  cached_at: number;
}

const getCreditsCacheKey = (userId: string) => `${CREDITS_CACHE_PREFIX}${userId}`;

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

const readCachedCredits = (userId: string): CreditsData | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.sessionStorage.getItem(getCreditsCacheKey(userId));
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as Partial<CachedCredits>;
    if (
      typeof cached.credits_remaining !== 'number' ||
      !Number.isFinite(cached.credits_remaining) ||
      typeof cached.cached_at !== 'number' ||
      Date.now() - cached.cached_at > CREDITS_CACHE_TTL_MS
    ) {
      window.sessionStorage.removeItem(getCreditsCacheKey(userId));
      return undefined;
    }
    return { credits_remaining: cached.credits_remaining };
  } catch {
    return undefined;
  }
};

const writeCachedCredits = (userId: string, remainingCredits: number) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      getCreditsCacheKey(userId),
      JSON.stringify({ credits_remaining: remainingCredits, cached_at: Date.now() })
    );
  } catch {
    // Ignore storage failures in private browsing or quota-limited sessions.
  }
};

const fetchCreditsWithTimeout = async () => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CREDITS_FETCH_TIMEOUT_MS);
  try {
    return await fetch('/api/credits/check', {
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export function CreditsProvider({ children }: CreditsProviderProps) {
  const { user, isLoaded } = useUser();
  const [credits, setCredits] = useState<number | undefined>(undefined);
  const [creditsData, setCreditsData] = useState<CreditsData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useSupabaseBrowserClient();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchCredits = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const cachedCredits = readCachedCredits(user.id);
    if (cachedCredits && isMountedRef.current) {
      setCreditsData(cachedCredits);
      setCredits(cachedCredits.credits_remaining);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    const request = (async () => {
      try {
        const response = await fetchCreditsWithTimeout();
        const data = await response.json();
        const remainingCredits = readCreditsRemaining(data?.credits);

        if (data?.success && remainingCredits !== undefined) {
          writeCachedCredits(user.id, remainingCredits);
          if (isMountedRef.current) {
            setCreditsData({ credits_remaining: remainingCredits });
            setCredits(remainingCredits);
          }
          return;
        }

        if (data?.success && data?.credits == null) {
          writeCachedCredits(user.id, 0);
          if (isMountedRef.current) {
            setCreditsData({ credits_remaining: 0 });
            setCredits(0);
          }
          return;
        }

        throw new Error(data?.error || 'Unknown credits API error');
      } catch (error) {
        // Keep the dashboard usable when local Supabase is slow or unavailable.
        // The next explicit refetch or Realtime update will refresh the balance.
        console.warn('Credits fetch skipped or timed out:', error);
        if (!cachedCredits && isMountedRef.current) {
          setCredits(undefined);
          setCreditsData(undefined);
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, [user?.id]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!user?.id) {
      setCredits(undefined);
      setCreditsData(undefined);
      setIsLoading(false);
      return;
    }

    if (credits === undefined) {
      fetchCredits();
    }
  }, [user?.id, isLoaded, credits, fetchCredits]);

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
            writeCachedCredits(user.id, newCredits.credits_remaining);
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
    if (user?.id) {
      writeCachedCredits(user.id, newCredits);
    }
    setCreditsData({ credits_remaining: newCredits });
    setCredits(newCredits);
  };

  return (
    <CreditsContext.Provider value={{ credits, creditsData, refetchCredits, updateCredits, isLoading }}>
      {children}
    </CreditsContext.Provider>
  );
}
