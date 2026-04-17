'use client'

import { useAuth } from '@clerk/nextjs'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useMemo } from 'react'

type TokenGetter = () => Promise<string | null>

const clientCache = new Map<TokenGetter, SupabaseClient>()
const nullTokenGetter: TokenGetter = async () => null

export function createClient(getToken: TokenGetter): SupabaseClient {
  const cached = clientCache.get(getToken)
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

  clientCache.set(getToken, client)
  return client
}

export function useSupabaseBrowserClient(): SupabaseClient {
  const { getToken, isLoaded } = useAuth()
  const tokenGetter = useCallback(async () => {
    const token = await getToken()
    return token ?? null
  }, [getToken])

  return useMemo(
    () => {
      if (!isLoaded || typeof getToken !== 'function') {
        return createClient(nullTokenGetter)
      }

      return createClient(tokenGetter)
    },
    [getToken, isLoaded, tokenGetter]
  )
}
