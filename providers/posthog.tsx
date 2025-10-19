'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      return;
    }

    let cancelled = false;

    const initPosthog = () => {
      if (cancelled) {
        return;
      }

      const sessionReplayEnabled = process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_ENABLED === 'true';
      const sampleRate = parseFloat(process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE || '0.1');

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
        loaded: (client) => {
          if (process.env.NODE_ENV === 'development') {
            client.debug();
          }

          if (sessionReplayEnabled) {
            client.startSessionRecording();

            if (Math.random() > sampleRate) {
              client.stopSessionRecording();
            }
          }

          const handleWindowError = (event: ErrorEvent) => {
            client.captureException(event.error, {
              $exception_level: 'error',
              $exception_source: 'window_error',
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
            });
          };

          const handleRejection = (event: PromiseRejectionEvent) => {
            const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
            client.captureException(error, {
              $exception_level: 'error',
              $exception_source: 'unhandled_rejection',
            });
          };

          window.addEventListener('error', handleWindowError);
          window.addEventListener('unhandledrejection', handleRejection);
        },
      });
    };

    const idleCallback = (window as typeof window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }).requestIdleCallback;

    if (idleCallback) {
      const idleId = idleCallback(() => initPosthog());
      return () => {
        cancelled = true;
        (window as typeof window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(idleId);
      };
    }

    const timeout = window.setTimeout(initPosthog, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
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
