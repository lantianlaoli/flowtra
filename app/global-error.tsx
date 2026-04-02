'use client'

import { useEffect, useState } from 'react'
import { captureException } from '@/lib/error-tracking'
import { SITE_LOCALE_STORAGE_KEY, normalizeSiteLocale, type SiteLocale } from '@/lib/i18n/site'
import { siteMessages } from '@/lib/i18n/site-messages'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [locale, setLocale] = useState<SiteLocale>('en')
  const errorMessages = siteMessages[locale].error

  useEffect(() => {
    if (typeof window === 'undefined') return
    setLocale(normalizeSiteLocale(window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY)))
  }, [])

  useEffect(() => {
    captureException(error, {
      metadata: {
        $exception_level: 'error',
        $exception_source: 'global_error_boundary',
        digest: error.digest,
        environment: process.env.NODE_ENV,
      },
    })

    // Log error to console for development
    console.error('Global error caught:', error)
  }, [error])

  return (
    <html>
      <body className="antialiased">
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center px-4">
            <div className="bg-red-50 p-6 rounded-lg border border-red-200">
              <div className="text-red-600 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {errorMessages.title}
              </h2>
              <p className="text-gray-600 mb-4">
                {errorMessages.description}
              </p>
              <div className="space-y-3">
                <button
                  onClick={reset}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  {errorMessages.retry}
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  {errorMessages.backToHome}
                </button>
              </div>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  {errorMessages.details}
                </summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto text-gray-800">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
