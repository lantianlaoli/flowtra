'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const sessionReplayEnabled = process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED === 'true'
    const sampleRate = parseFloat(process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE || '0.1')

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
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
      loaded: (posthog) => {
        if (process.env.NODE_ENV === 'development') {
          posthog.debug()
        }

        if (sessionReplayEnabled) {
          posthog.startSessionRecording()

          if (Math.random() > sampleRate) {
            posthog.stopSessionRecording()
          }
        }

        // Set up global error handler for unhandled errors
        window.addEventListener('error', (event) => {
          posthog.captureException(event.error, {
            $exception_level: 'error',
            $exception_source: 'window_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
          })
        })

        // Set up global handler for unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
          const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
          posthog.captureException(error, {
            $exception_level: 'error',
            $exception_source: 'unhandled_rejection',
          })
        })
      }
    })
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

function PostHogPageViewInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useUser()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams])

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
      })
    }
  }, [user])

  return <></>
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  )
}