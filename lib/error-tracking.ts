'use client'

import posthog from 'posthog-js'

interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  metadata?: Record<string, unknown>
}

/**
 * Capture an exception manually with PostHog
 */
export function captureException(
  error: Error,
  context?: ErrorContext
) {
  try {
    posthog.captureException(error, {
      $exception_level: 'error',
      $exception_source: 'manual_capture',
      component: context?.component,
      action: context?.action,
      user_id: context?.userId,
      environment: process.env.NODE_ENV,
      ...context?.metadata,
    })
  } catch (captureError) {
    console.error('Failed to capture exception:', captureError)
  }
}

/**
 * Capture a custom error event with PostHog
 */
export function captureErrorEvent(
  message: string,
  context?: ErrorContext
) {
  try {
    posthog.capture('$exception', {
      $exception_message: message,
      $exception_level: 'error',
      $exception_source: 'custom_event',
      component: context?.component,
      action: context?.action,
      user_id: context?.userId,
      environment: process.env.NODE_ENV,
      ...context?.metadata,
    })
  } catch (captureError) {
    console.error('Failed to capture error event:', captureError)
  }
}

/**
 * Higher-order function to wrap async functions with error tracking
 */
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Omit<ErrorContext, 'metadata'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error))
      captureException(errorInstance, {
        ...context,
        metadata: {
          function_name: fn.name,
          arguments: args,
        },
      })
      throw error
    }
  }) as T
}

/**
 * React hook for error tracking in components
 */
export function useErrorTracking(componentName: string) {
  const trackError = (error: Error, action?: string, metadata?: Record<string, unknown>) => {
    captureException(error, {
      component: componentName,
      action,
      metadata,
    })
  }

  const trackErrorEvent = (message: string, action?: string, metadata?: Record<string, unknown>) => {
    captureErrorEvent(message, {
      component: componentName,
      action,
      metadata,
    })
  }

  return { trackError, trackErrorEvent }
}