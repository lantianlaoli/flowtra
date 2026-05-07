'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FlowtraLoading from '@/components/ui/FlowtraLoading'
import { useCredits } from '@/contexts/CreditsContext'
import { applyDashboardTheme, getPreferredDashboardTheme } from '@/lib/theme'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const { credits, isLoading: isCreditsLoading } = useCredits()
  const router = useRouter()
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

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
    const readCreditsRemaining = (creditsPayload: unknown): number | undefined => {
      if (typeof creditsPayload === 'number' && Number.isFinite(creditsPayload)) {
        return creditsPayload
      }

      if (
        creditsPayload &&
        typeof creditsPayload === 'object' &&
        'credits_remaining' in creditsPayload
      ) {
        const value = (creditsPayload as { credits_remaining?: unknown }).credits_remaining
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value
        }
      }

      return undefined
    }

    const checkPurchaseStatus = async () => {
      if (!isLoaded || !user) return

      try {
        // Call API to check purchase status
        const response = await fetch('/api/credits/check')
        const data = await response.json()
        const remainingCredits = readCreditsRemaining(data?.credits)

        if (data.success) {
          // Allow access if user has credits_remaining > 0 (active subscription)
          const hasAccess = (remainingCredits ?? 0) > 0

          if (!hasAccess) {
            // User has no credits, redirect to plan selection
            router.push('/select-plan')
            return
          }
        }

        setIsCheckingPurchase(false)
      } catch (error) {
        console.error('Failed to check purchase status:', error)
        setIsCheckingPurchase(false)
      }
    }

    checkPurchaseStatus()
  }, [user, isLoaded, router])

  if (!isLoaded || isCheckingPurchase || isCreditsLoading || credits === undefined) {
    return <FlowtraLoading />
  }

  return <div className="min-h-screen bg-[#F5F5F3] text-foreground">{children}</div>
}
