'use client'

import { useState, useEffect } from 'react'
import { FireIcon, GiftIcon } from '@heroicons/react/24/solid'
import { useToast } from '@/contexts/ToastContext'

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export default function BlackFridayBadge() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const { showSuccess } = useToast()

  useEffect(() => {
    // Black Friday 2025: November 29, 2025 00:00:00 EST
    const blackFridayDate = new Date('2025-11-29T00:00:00-05:00')

    const calculateTimeLeft = (): TimeLeft => {
      const now = new Date()
      const difference = blackFridayDate.getTime() - now.getTime()

      if (difference <= 0) {
        setIsExpired(true)
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      }
    }

    // Initial calculation
    setTimeLeft(calculateTimeLeft())

    // Update every minute for performance
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 60000) // Update every 60 seconds

    return () => clearInterval(timer)
  }, [])

  const handleClick = async () => {
    // Copy discount code to clipboard
    const discountCode = 'SQZPVT9QUJ'
    try {
      await navigator.clipboard.writeText(discountCode)
      showSuccess('Discount code copied! Redirecting to pricing...', 3000)

      // Wait a moment then scroll to pricing
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({
          behavior: 'smooth',
        })
      }, 500)
    } catch {
      // Fallback: just scroll to pricing if clipboard fails
      showSuccess('Discount code: ' + discountCode, 3000)
      document.getElementById('pricing')?.scrollIntoView({
        behavior: 'smooth',
      })
    }
  }

  // Don't render if expired or still calculating
  if (isExpired || !timeLeft) return null

  const getTimeDisplay = () => {
    if (timeLeft.days > 0) {
      return `${timeLeft.days}d ${timeLeft.hours}h`
    }
    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}min`
    }
    return `${timeLeft.minutes}min`
  }

  return (
    <button
      onClick={handleClick}
      className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white px-6 py-3 rounded-full border-2 border-orange-500 shadow-lg shadow-orange-500/50 hover:shadow-xl hover:shadow-orange-500/70 hover:scale-105 transition-all duration-300 animate-pulse-glow cursor-pointer"
      aria-label="Black Friday promotion - Click to view pricing"
    >
      {/* Fire icon with subtle rotation animation */}
      <FireIcon className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 animate-pulse" />

      {/* Main content */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3">
        {/* Black Friday label */}
        <span className="font-bold text-sm sm:text-base tracking-wide">
          BLACK FRIDAY
        </span>

        {/* Countdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-300">
            ⏱️ Ends in: <span className="font-semibold text-orange-400">{getTimeDisplay()}</span>
          </span>
        </div>

        {/* Discount badge */}
        <div className="flex items-center gap-2">
          <GiftIcon className="w-4 h-4 text-orange-500" />
          <span className="font-bold text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
            20% OFF
          </span>
        </div>

        {/* Discount code */}
        <div className="hidden lg:flex items-center gap-1.5 bg-orange-500/20 border border-orange-500/50 rounded px-2 py-1">
          <span className="text-xs text-orange-300">Code:</span>
          <code className="text-xs font-mono font-bold text-orange-400">SQZPVT9QUJ</code>
        </div>
      </div>

      {/* Arrow indicator */}
      <svg
        className="w-4 h-4 text-orange-500 group-hover:translate-x-1 transition-transform"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>

      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
    </button>
  )
}
