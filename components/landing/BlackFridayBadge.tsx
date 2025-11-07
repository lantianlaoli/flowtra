'use client'

import { useState, useEffect } from 'react'
import { Ticket } from 'lucide-react'
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

    // Update every second for accurate countdown
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000) // Update every second

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
      return `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
    }
    if (timeLeft.hours > 0) {
      return `${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
    }
    if (timeLeft.minutes > 0) {
      return `${timeLeft.minutes}m ${timeLeft.seconds}s`
    }
    return `${timeLeft.seconds}s`
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-full hover:bg-gray-200 transition-colors cursor-pointer text-sm sm:text-base"
      aria-label="Black Friday promotion - Click to copy discount code and view pricing"
    >
      {/* Ticket icon */}
      <Ticket className="w-4 h-4 text-[#2383e2]" />

      {/* Black Friday label with discount */}
      <span className="font-semibold text-gray-900">
        Black Friday Sale: <span className="text-[#2383e2]">20% OFF</span>
      </span>

      {/* Separator */}
      <span className="text-gray-400">·</span>

      {/* Countdown */}
      <span className="font-bold text-[#2383e2] tabular-nums">
        {getTimeDisplay()}
      </span>

      {/* Separator */}
      <span className="text-gray-400 hidden sm:inline">·</span>

      {/* Call to action hint */}
      <span className="text-gray-600 hidden sm:inline">
        Click to copy code
      </span>
    </button>
  )
}
