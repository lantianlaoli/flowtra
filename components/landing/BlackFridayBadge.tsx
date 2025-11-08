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
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-[#fafafa] border border-[#e9e9e7] rounded-full text-sm">
      {/* Icon and Label */}
      <div className="flex items-center gap-1.5">
        <Ticket className="w-4 h-4 text-[#787774]" />
        <span className="text-[#37352f] font-medium">Black Friday</span>
      </div>

      {/* Separator */}
      <div className="text-[#d9d9d7]">·</div>

      {/* Discount Rate */}
      <div className="flex items-center">
        <span className="font-semibold text-[#37352f]">20% OFF</span>
      </div>

      {/* Separator */}
      <div className="text-[#d9d9d7]">·</div>

      {/* Price Comparison */}
      <div className="flex items-center gap-2">
        <span className="line-through text-[#9b9a97]">${LITE_PRICE}</span>
        <span className="font-semibold text-[#37352f]">${LITE_DISCOUNTED}</span>
      </div>

      {/* Separator */}
      <div className="text-[#d9d9d7]">·</div>

      {/* Copy Code Button */}
      <button
        onClick={handleCopyCode}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-[#37352f] text-white rounded-md hover:bg-[#2c2a26] transition-colors"
      >
        {isCopied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Copy Code</span>
          </>
        )}
      </button>

      {/* Separator */}
      <div className="text-[#d9d9d7]">·</div>

      {/* Countdown */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#787774]">Ends in</span>
        <span className="font-medium text-[#37352f] tabular-nums">{getTimeDisplay()}</span>
      </div>
    </div>
  )
}
