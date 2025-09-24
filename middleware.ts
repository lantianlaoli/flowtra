import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/create-checkout(.*)',
  '/api/credits(.*)',
  '/api/upload(.*)'
])

// Define routes that should NOT be protected (no authentication required)
const isPublicRoute = createRouteMatcher([
  '/api/webhooks(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  // Skip authentication for webhook routes
  if (isPublicRoute(req)) {
    return
  }

  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
