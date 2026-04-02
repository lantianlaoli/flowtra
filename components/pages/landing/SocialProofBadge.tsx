'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useI18n } from '@/providers/I18nProvider'
import { formatLocaleNumber } from '@/lib/i18n/site'

export function SocialProofBadge() {
  const { locale, messages } = useI18n()
  const heroMessages = messages.landing.hero
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadCount = async () => {
      try {
        const response = await fetch('/api/public/metrics/user-count', {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as { success?: boolean; count?: number }
        if (data.success && typeof data.count === 'number' && data.count > 0) {
          setCount(data.count)
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
      }
    }

    loadCount()

    return () => controller.abort()
  }, [])

  if (!count) {
    return null
  }

  const localizedCount = formatLocaleNumber(locale, count)

  return (
    <div className="pt-3" aria-label={heroMessages.socialProofLabel}>
      <div
        className="inline-flex w-full sm:w-auto items-center gap-3 rounded-xl px-4 py-2
                   bg-[#F7F7F7] border border-[#E5E5E5] transition-colors"
      >
        <div className="flex -space-x-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="inline-block w-7 h-7 rounded-full ring-2 ring-white overflow-hidden"
            >
              <Image
                src={`https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/landing/user_avatar_${i}.${i === 1 ? 'jpg' : 'png'}`}
                alt={`User avatar ${i}`}
                width={28}
                height={28}
                className="w-full h-full object-cover"
                loading="lazy"
                sizes="28px"
              />
            </div>
          ))}
        </div>
        <span
          className="text-xs sm:text-sm font-semibold text-black whitespace-normal sm:whitespace-nowrap leading-relaxed"
          title={`${localizedCount} ${heroMessages.socialProofTitle}`}
        >
          {locale === 'zh' ? '已有 ' : 'Trusted by '}
          <span className="font-bold tabular-nums">{localizedCount}</span>
          {locale === 'zh' ? ` ${heroMessages.socialProofSuffix}` : ` ${heroMessages.socialProofSuffix}`}
        </span>
      </div>
    </div>
  )
}
