import { PostHog } from 'posthog-node'

let posthogServer: PostHog | null = null

export function getPostHogServer(): PostHog {
  if (!posthogServer) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      throw new Error('NEXT_PUBLIC_POSTHOG_KEY is not set')
    }

    posthogServer = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    })

    console.log('PostHog server instance initialized')
  }

  return posthogServer
}

export function captureServerException(
  error: Error,
  distinctId?: string,
  properties?: Record<string, unknown>
) {
  try {
    const posthog = getPostHogServer()

    posthog.capture({
      distinctId: distinctId || 'anonymous',
      event: '$exception',
      properties: {
        $exception_message: error.message,
        $exception_type: error.name,
        $exception_stack_trace: error.stack,
        $exception_level: 'error',
        ...properties,
      },
    })

    posthog.flush()
  } catch (captureError) {
    console.error('Failed to capture exception to PostHog:', captureError)
  }
}

export async function shutdownPostHog() {
  if (posthogServer) {
    await posthogServer.shutdown()
    posthogServer = null
  }
}