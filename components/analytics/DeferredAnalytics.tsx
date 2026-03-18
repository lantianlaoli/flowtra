'use client'

import dynamic from 'next/dynamic'
import Script from 'next/script'
import { useCookieConsent } from '@/providers/cookie-consent'

const PostHogPageView = dynamic(
  () => import('@/providers/posthog').then((mod) => mod.PostHogRuntime),
  { ssr: false }
)
const Analytics = dynamic(
  () => import('@vercel/analytics/react').then((mod) => mod.Analytics),
  { ssr: false }
)
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/react').then((mod) => mod.SpeedInsights),
  { ssr: false }
)

export function DeferredAnalytics() {
  const { isHydrated, analyticsEnabled } = useCookieConsent()

  if (!isHydrated || !analyticsEnabled) {
    return null
  }

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-CP7HSQFTCP"
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CP7HSQFTCP');
        `}
      </Script>
      <PostHogPageView />
      <Analytics />
      <SpeedInsights />
    </>
  )
}
