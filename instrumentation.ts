export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { captureServerException } = await import('./lib/posthog-server')

    // Register global error handler for uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error)
      captureServerException(error, 'server', {
        error_type: 'uncaught_exception',
        environment: process.env.NODE_ENV,
      })
    })

    // Register global error handler for unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      captureServerException(error, 'server', {
        error_type: 'unhandled_rejection',
        environment: process.env.NODE_ENV,
        promise: promise.toString(),
      })
    })

    console.log('PostHog server-side error tracking initialized')
  }
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: {
    path?: string
    headers?: { [key: string]: string | string[] | undefined }
  },
  context: {
    routerKind?: 'Pages Router' | 'App Router'
    routePath?: string
    routeType?: 'render' | 'route' | 'action' | 'middleware'
  }
) {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { captureServerException } = await import('./lib/posthog-server')

    // Extract user information from headers if available
    const sessionId = request.headers?.['x-session-id'] as string
    const distinctId = request.headers?.['x-distinct-id'] as string || 'anonymous'

    captureServerException(err, distinctId, {
      error_type: 'request_error',
      request_path: request.path,
      route_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
      session_id: sessionId,
      digest: err.digest,
      environment: process.env.NODE_ENV,
    })
  }
}