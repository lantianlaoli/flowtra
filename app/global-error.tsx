'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useUser } from '@clerk/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const posthog = usePostHog()
  const { user } = useUser()

  useEffect(() => {
    // Capture the error to PostHog
    if (posthog) {
      posthog.captureException(error, {
        $exception_level: 'error',
        $exception_source: 'global_error_boundary',
        user_id: user?.id,
        digest: error.digest,
        environment: process.env.NODE_ENV,
      })
    }

    // Log error to console for development
    console.error('Global error caught:', error)
  }, [error, posthog, user])

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
                出现了意外错误
              </h2>
              <p className="text-gray-600 mb-4">
                抱歉，应用遇到了一个问题。我们已经记录了这个错误，正在努力修复。
              </p>
              <div className="space-y-3">
                <button
                  onClick={reset}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  返回首页
                </button>
              </div>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  显示错误详情 (开发模式)
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