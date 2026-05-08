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
    if (!isLoaded || !user || isCreditsLoading || credits === undefined) return

    if (credits <= 0) {
      router.replace('/select-plan')
      return
    }

    setIsCheckingPurchase(false)
  }, [credits, isCreditsLoading, user, isLoaded, router])

  if (!isLoaded || isCheckingPurchase || isCreditsLoading || credits === undefined) {
    return <FlowtraLoading />
  }

  return <div className="min-h-screen bg-[#F5F5F3] text-foreground">{children}</div>
}
