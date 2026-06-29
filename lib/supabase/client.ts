'use client'

import { useAuth } from '@clerk/nextjs'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useMemo } from 'react'

type TokenGetter = () => Promise<string | null>

const clientCache = new Map<string, SupabaseClient>()
const nullTokenGetter: TokenGetter = async () => null
let latestBrowserTokenGetter: TokenGetter = nullTokenGetter
const browserAuthTokenGetter: TokenGetter = async () => latestBrowserTokenGetter()

export const getSupabaseBrowserClientCacheKey = (isLoaded: boolean) => (
  isLoaded ? 'browser-auth' : 'browser-anonymous'
)

export function createClient(getToken: TokenGetter, cacheKey = 'default'): SupabaseClient {
  const cached = clientCache.get(cacheKey)
  if (cached) return cached

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public URL or publishable key is not configured')
  }

  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => getToken(),
    realtime: {
      logger: (kind: string, msg: string, data: unknown) => {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Supabase Realtime ${kind}]`, msg, data);
        }
      },
    },
  })

  clientCache.set(cacheKey, client)
  return client
}

export function useSupabaseBrowserClient(): SupabaseClient {
  const { getToken, isLoaded } = useAuth()

  useEffect(() => {
    latestBrowserTokenGetter = async () => {
      if (!isLoaded || typeof getToken !== 'function') return null
      const token = await getToken()
      return token ?? null
    }
  }, [getToken, isLoaded])

  return useMemo(
    () => {
      const cacheKey = getSupabaseBrowserClientCacheKey(isLoaded)
      return createClient(isLoaded ? browserAuthTokenGetter : nullTokenGetter, cacheKey)
    },
    [isLoaded]
  )
}
