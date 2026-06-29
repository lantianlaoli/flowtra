'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import FlowtraLoading from '@/components/ui/FlowtraLoading'
import {
  shouldCheckPlanForDashboardEntry,
  shouldRedirectDashboardEntryToSelectPlan,
} from '@/lib/dashboard-access'
import { applyDashboardTheme, getPreferredDashboardTheme } from '@/lib/theme'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [isCheckingEntryPlan, setIsCheckingEntryPlan] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const hasCheckedEntryPlanRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.remove('dark')
    document.body.classList.remove('dark')
    const enabled = getPreferredDashboardTheme()
    setIsDarkMode(enabled)
    applyDashboardTheme(enabled)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    applyDashboardTheme(isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail
      if (typeof detail === 'boolean') {
        setIsDarkMode(detail)
      }
    }
    window.addEventListener('flowtra-dashboard-theme-change', handler as EventListener)
    return () => window.removeEventListener('flowtra-dashboard-theme-change', handler as EventListener)
  }, [])

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.replace('/sign-in')
      return
    }

    if (typeof window === 'undefined') {
      setIsCheckingEntryPlan(false)
      return
    }

    const isLandingUploadEntry = shouldCheckPlanForDashboardEntry({
      upload: new URLSearchParams(window.location.search).get('upload'),
    })

    if (!isLandingUploadEntry || hasCheckedEntryPlanRef.current) {
      setIsCheckingEntryPlan(false)
      return
    }

    hasCheckedEntryPlanRef.current = true
    let cancelled = false

    const checkEntryPlan = async () => {
      setIsCheckingEntryPlan(true)
      try {
        const response = await fetch('/api/credits/check', { cache: 'no-store' })
        const payload = await response.json()
        const subscriptionStatus = typeof payload?.subscription?.status === 'string'
          ? payload.subscription.status
          : null

        if (shouldRedirectDashboardEntryToSelectPlan({
          isLandingUploadEntry,
          subscriptionStatus,
        })) {
          router.replace('/select-plan')
          return
        }
      } catch (error) {
        console.warn('Dashboard entry plan check failed:', error)
      }

      if (!cancelled) {
        setIsCheckingEntryPlan(false)
      }
    }

    void checkEntryPlan()

    return () => {
      cancelled = true
    }
  }, [user, isLoaded, router])

  if (!isLoaded || isCheckingEntryPlan) {
    return <FlowtraLoading />
  }

  return <div className="min-h-screen bg-[#F5F5F3] text-foreground">{children}</div>
}
