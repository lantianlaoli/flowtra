import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { hasUserPurchased } from '@/lib/credits'

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/create-checkout(.*)',
  '/api/credits(.*)',
  '/api/upload(.*)'
])

// Routes that require purchase (all dashboard routes except select-plan)
const isPurchaseRequiredRoute = createRouteMatcher([
  '/dashboard(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
    
    // Additional check for purchase requirement
    const { userId } = await auth()
    if (userId && isPurchaseRequiredRoute(req) && !req.nextUrl.pathname.startsWith('/select-plan')) {
      const purchaseStatus = await hasUserPurchased(userId)

      if (purchaseStatus.success && !purchaseStatus.hasPurchased) {
        // User hasn't purchased, redirect to plan selection
        const selectPlanUrl = new URL('/select-plan', req.url)
        return NextResponse.redirect(selectPlanUrl)
      }
    }
  }
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - webhooks (webhook endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)|.*webhooks.*).*)',
  ],
}
