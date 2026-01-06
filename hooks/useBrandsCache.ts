'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { UserBrand } from '@/lib/supabase';

interface BrandsCacheState {
  brands: UserBrand[];
  isLoading: boolean;
  error: Error | null;
}

// Module-level cache that persists across component instances
const globalBrandsCache = {
  data: null as UserBrand[] | null,
  promise: null as Promise<UserBrand[]> | null,
  fetching: false,
  error: null as Error | null,
  userId: null as string | null
};

export function useBrandsCache() {
  const { isLoaded, isSignedIn, userId } = useAuth();

  const [state, setState] = useState<BrandsCacheState>(() => {
    if (!isLoaded || !isSignedIn || !userId) {
      return { brands: [], isLoading: false, error: null };
    }

    if (globalBrandsCache.userId === userId && globalBrandsCache.data !== null) {
      return {
        brands: globalBrandsCache.data,
        isLoading: false,
        error: null
      };
    }
    return {
      brands: [],
      isLoading: globalBrandsCache.userId === userId && (globalBrandsCache.fetching || globalBrandsCache.promise !== null),
      error: globalBrandsCache.userId === userId ? globalBrandsCache.error : null
    };
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const startFetch = useCallback((): Promise<UserBrand[]> => {
    if (globalBrandsCache.promise) return globalBrandsCache.promise;
    if (globalBrandsCache.fetching) {
      return Promise.reject(new Error('Brands fetch already in progress'));
    }

    globalBrandsCache.fetching = true;
    globalBrandsCache.error = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);

    const promise = fetch('/api/brands', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch brands: ${response.status}`);
        }
        const data = await response.json();
        const brands = Array.isArray(data.brands) ? data.brands : [];
        globalBrandsCache.data = brands;
        return brands;
      })
      .catch((error) => {
        const normalized = error instanceof Error ? error : new Error('Unknown error');
        globalBrandsCache.error = normalized;
        globalBrandsCache.data = null;
        throw normalized;
      })
      .finally(() => {
        clearTimeout(timeoutId);
        globalBrandsCache.fetching = false;
        globalBrandsCache.promise = null;
      });

    globalBrandsCache.promise = promise;
    return promise;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn || !userId) {
      globalBrandsCache.data = null;
      globalBrandsCache.error = null;
      globalBrandsCache.promise = null;
      globalBrandsCache.fetching = false;
      globalBrandsCache.userId = null;

      if (isMountedRef.current) {
        setState({ brands: [], isLoading: false, error: null });
      }
      return;
    }

    if (globalBrandsCache.userId !== userId) {
      globalBrandsCache.data = null;
      globalBrandsCache.error = null;
      globalBrandsCache.promise = null;
      globalBrandsCache.fetching = false;
      globalBrandsCache.userId = userId;
    }

    if (globalBrandsCache.data !== null) {
      if (isMountedRef.current) {
        setState({
          brands: globalBrandsCache.data,
          isLoading: false,
          error: null
        });
      }
      return;
    }

    if (isMountedRef.current) {
      setState((prev) => ({
        brands: prev.brands,
        isLoading: true,
        error: null
      }));
    }

    const promise = globalBrandsCache.promise ?? startFetch();

    promise
      .then((brands) => {
        if (isMountedRef.current) {
          setState({
            brands,
            isLoading: false,
            error: null
          });
        }
      })
      .catch((error) => {
        if (isMountedRef.current) {
          setState({
            brands: [],
            isLoading: false,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      });
  }, [isLoaded, isSignedIn, startFetch, userId]);

  const refresh = useCallback(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    globalBrandsCache.data = null;
    globalBrandsCache.error = null;
    globalBrandsCache.promise = null;
    globalBrandsCache.fetching = false;
    globalBrandsCache.userId = userId;

    if (isMountedRef.current) {
      setState({ brands: [], isLoading: true, error: null });
    }

    startFetch()
      .then((brands) => {
        if (isMountedRef.current) {
          setState({ brands, isLoading: false, error: null });
        }
      })
      .catch((error) => {
        if (isMountedRef.current) {
          setState({
            brands: [],
            isLoading: false,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      });
  }, [isLoaded, isSignedIn, startFetch, userId]);

  return { ...state, refresh };
}
