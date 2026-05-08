import posthog from 'posthog-js'
import { isPostHogEnabled } from '@/lib/analytics/posthog-env'

export const initPostHog = () => {
  if (typeof window !== 'undefined' && isPostHogEnabled()) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      advanced_disable_flags: true,
      capture_pageview: false,
      capture_pageleave: true,
    })
  }
  return posthog
}
