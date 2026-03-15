'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import type { PostHog } from 'posthog-js'

function PostHogRuntimeInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [client, setClient] = useState<PostHog | null>(null)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (typeof window === 'undefined' || !apiKey) {
      return
    }

    let cancelled = false
    let cleanup: (() => void) | undefined

    const initPosthog = async () => {
      if (cancelled) {
        return
      }

      const { default: posthog } = await import('posthog-js')
      if (cancelled) {
        return
      }

      const sessionReplayEnabled = process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED === 'true'
      const sampleRate = parseFloat(process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE || '0.1')

      posthog.init(apiKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
        capture_heatmaps: true,
        capture_dead_clicks: true,
        session_recording: sessionReplayEnabled ? {
          recordCrossOriginIframes: false,
          maskAllInputs: true,
          maskAllText: false,
          maskInputOptions: {
            password: true,
            email: true,
          },
          maskTextSelector: '.ph-mask-text, .sensitive-info',
          maskInputSelector: '.ph-mask-input, .sensitive-input',
        } as any : undefined,
        loaded: (loadedClient) => {
          if (process.env.NODE_ENV === 'development') {
            loadedClient.debug()
          }

          if (sessionReplayEnabled) {
            loadedClient.startSessionRecording()

            if (Math.random() > sampleRate) {
              loadedClient.stopSessionRecording()
            }
          }
        },
      })

      const handleWindowError = (event: ErrorEvent) => {
        posthog.captureException(event.error, {
          $exception_level: 'error',
          $exception_source: 'window_error',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        })
      }

      const handleRejection = (event: PromiseRejectionEvent) => {
        const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
        posthog.captureException(error, {
          $exception_level: 'error',
          $exception_source: 'unhandled_rejection',
        })
      }

      window.addEventListener('error', handleWindowError)
      window.addEventListener('unhandledrejection', handleRejection)
      cleanup = () => {
        window.removeEventListener('error', handleWindowError)
        window.removeEventListener('unhandledrejection', handleRejection)
      }

      setClient(posthog)
    }

    const idleCallback = (
      window as typeof window & {
        requestIdleCallback?: (cb: () => void) => number
        cancelIdleCallback?: (id: number) => void
      }
    ).requestIdleCallback

    if (idleCallback) {
      const idleId = idleCallback(() => {
        void initPosthog()
      })

      return () => {
        cancelled = true
        cleanup?.()
        ;(window as typeof window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleId)
      }
    }

    const timeout = window.setTimeout(() => {
      void initPosthog()
    }, 1)

    return () => {
      cancelled = true
      cleanup?.()
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (!client || !pathname) {
      return
    }

    let url = window.origin + pathname
    if (searchParams.toString()) {
      url = `${url}?${searchParams.toString()}`
    }

    client.capture('$pageview', {
      $current_url: url,
    })
  }, [client, pathname, searchParams])

  useEffect(() => {
    if (!client || !user) {
      return
    }

    client.identify(user.id, {
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
    })
  }, [client, user])

  return null
}

export function PostHogRuntime() {
  return (
    <Suspense fallback={null}>
      <PostHogRuntimeInner />
    </Suspense>
  )
}
