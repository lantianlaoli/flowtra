'use client'

import { Suspense, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { identifyUser } from '@/lib/analytics/client'
import { isPostHogEnabled } from '@/lib/analytics/posthog-env'
import { useCookieConsent } from '@/providers/cookie-consent'

function PostHogRuntimeInner() {
  const { user } = useUser()
  const { analyticsEnabled } = useCookieConsent()

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (typeof window === 'undefined' || !apiKey || !analyticsEnabled || !isPostHogEnabled()) {
      return
    }

    let cancelled = false
    let cleanup: (() => void) | undefined

    const initPosthog = async () => {
      if (cancelled) {
        return
      }

      const sessionReplayEnabled = process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED === 'true'
      const sampleRate = parseFloat(process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE || '0.1')

      posthog.init(apiKey, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        defaults: '2026-01-30',
        person_profiles: 'identified_only',
        advanced_disable_flags: true,
        capture_pageview: true,
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
  }, [analyticsEnabled])

  useEffect(() => {
    if (!isPostHogEnabled()) {
      return
    }

    if (!analyticsEnabled) {
      posthog.opt_out_capturing()
      posthog.stopSessionRecording()
      return
    }

    posthog.opt_in_capturing()
  }, [analyticsEnabled])

  useEffect(() => {
    if (!user || !analyticsEnabled || !isPostHogEnabled()) {
      return
    }

    identifyUser(user.id, {
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    })
  }, [analyticsEnabled, user])

  return null
}

export function PostHogRuntime() {
  return (
    <Suspense fallback={null}>
      <PostHogRuntimeInner />
    </Suspense>
  )
}
