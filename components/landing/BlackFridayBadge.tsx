'use client'

import { useState, useEffect } from 'react'
import { Ticket, Copy, Check } from 'lucide-react'
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
  const [isCopied, setIsCopied] = useState(false)
  const { showSuccess } = useToast()

  // Price information
  const DISCOUNT_RATE = 0.2 // 20% off
  const LITE_PRICE = 9
  const LITE_DISCOUNTED = (LITE_PRICE * (1 - DISCOUNT_RATE)).toFixed(2)
  const SAVINGS = (LITE_PRICE - parseFloat(LITE_DISCOUNTED)).toFixed(2)
  const DISCOUNT_CODE = 'SQZPVT9QUJ'

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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE)
      setIsCopied(true)
      showSuccess('Discount code copied!', 2000)

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)

      // Scroll to pricing
      setTimeout(() => {
        document.getElementById('pricing')?.scrollIntoView({
          behavior: 'smooth',
        })
      }, 500)
    } catch {
      // Fallback: just show message and scroll
      showSuccess('Code: ' + DISCOUNT_CODE, 3000)
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
    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 px-5 py-3 sm:py-3.5 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl shadow-sm">
      {/* Black Friday Label */}
      <div className="flex items-center gap-2">
        <Ticket className="w-5 h-5 text-red-600" />
        <span className="font-bold text-gray-900">Black Friday Sale</span>
      </div>

      {/* Separator - hidden on mobile */}
      <div className="hidden sm:block text-gray-300">·</div>

      {/* Price Comparison */}
      <div className="flex items-center gap-2 text-center sm:text-left">
        <span className="text-sm text-gray-600">Lite Pack:</span>
        <span className="line-through text-gray-400 text-sm">${LITE_PRICE}</span>
        <span className="text-lg sm:text-xl font-bold text-red-600">${LITE_DISCOUNTED}</span>
        <span className="text-xs sm:text-sm text-gray-600 bg-white px-2 py-0.5 rounded-md border border-gray-200">
          Save ${SAVINGS}
        </span>
      </div>

      {/* Separator - hidden on mobile */}
      <div className="hidden sm:block text-gray-300">·</div>

      {/* Discount Code with Copy Button */}
      <div className="flex items-center gap-2">
        <div className="font-mono text-sm bg-white px-3 py-1.5 rounded-md border border-gray-300 flex items-center gap-2">
          <span className="text-gray-600">Code:</span>
          <span className="font-bold text-blue-600">{DISCOUNT_CODE}</span>
        </div>
        <button
          onClick={handleCopyCode}
          className="p-1.5 hover:bg-white rounded-md transition-colors cursor-pointer"
          aria-label="Copy discount code"
          title="Copy code"
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-600 hover:text-blue-600" />
          )}
        </button>
      </div>

      {/* Separator - hidden on mobile */}
      <div className="hidden sm:block text-gray-300">·</div>

      {/* Countdown */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-600">Ends in:</span>
        <span className="font-bold text-red-600 tabular-nums text-sm sm:text-base">
          {getTimeDisplay()}
        </span>
      </div>
    </div>
  )
}
