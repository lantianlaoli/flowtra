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
    <div className="max-w-2xl mx-auto bg-[#fafafa] border border-[#e9e9e7] rounded-lg p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Ticket className="w-5 h-5 text-[#787774]" />
        <span className="text-base font-semibold text-[#37352f]">Black Friday Special Offer</span>
      </div>

      {/* Main Content - Price Comparison */}
      <div className="mb-6">
        <div className="text-sm text-[#787774] mb-2">Lite Package</div>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl line-through text-[#9b9a97]">${LITE_PRICE}</span>
          <span className="text-3xl font-bold text-[#37352f]">${LITE_DISCOUNTED}</span>
          <span className="text-base text-[#787774]">Save ${SAVINGS}</span>
        </div>
      </div>

      {/* Secondary Info */}
      <div className="space-y-3 pt-4 border-t border-[#e9e9e7]">
        {/* Discount Code */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#787774]">Discount code</span>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono bg-white px-3 py-1.5 rounded border border-[#e9e9e7] text-[#37352f]">
              {DISCOUNT_CODE}
            </code>
            <button
              onClick={handleCopyCode}
              className="p-2 hover:bg-white rounded transition-colors"
              aria-label="Copy discount code"
              title="Copy code"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-[#787774]" />
              ) : (
                <Copy className="w-4 h-4 text-[#787774]" />
              )}
            </button>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#787774]">Offer ends in</span>
          <span className="text-sm font-medium text-[#37352f] tabular-nums">
            {getTimeDisplay()}
          </span>
        </div>
      </div>
    </div>
  )
}
