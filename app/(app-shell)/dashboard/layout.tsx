'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import FlowtraLoading from '@/components/ui/FlowtraLoading'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [isCheckingPurchase, setIsCheckingPurchase] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.remove('dark')
    document.body.classList.remove('dark')
    const stored = window.localStorage.getItem('flowtra-dashboard-dark')
    const enabled = stored === null ? true : stored === 'true'
    setIsDarkMode(enabled)
    document.documentElement.classList.toggle('dashboard-theme', enabled)
    document.body.classList.toggle('dashboard-theme', enabled)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.toggle('dashboard-theme', isDarkMode)
    document.body.classList.toggle('dashboard-theme', isDarkMode)
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
    const checkPurchaseStatus = async () => {
      if (!isLoaded || !user) return

      try {
        // TEMPORARY: Disabled subscription check to allow all users into dashboard
        // TODO: Re-enable after fixing webhook handling
        /*
        // Call API to check purchase status
        const response = await fetch('/api/credits/check')
        const data = await response.json()

        if (data.success && data.credits) {
          // Allow access if user has purchased OR has subscription credits (subscription active)
          const hasAccess = data.credits.has_purchased || data.credits.subscription_credits > 0

          if (!hasAccess) {
            // User hasn't purchased and has no subscription, redirect to plan selection
            router.push('/select-plan')
            return
          }
        }
        */

        setIsCheckingPurchase(false)
      } catch (error) {
        console.error('Failed to check purchase status:', error)
        setIsCheckingPurchase(false)
      }
    }

    checkPurchaseStatus()
  }, [user, isLoaded, router])

  if (!isLoaded || isCheckingPurchase) {
    return <FlowtraLoading />
  }

  return <div className="min-h-screen bg-[#F5F5F3] text-foreground">{children}</div>
}
