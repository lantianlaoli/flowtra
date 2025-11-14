import { NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { sendEmail } from '@/lib/resend'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const storeUrl = typeof body?.storeUrl === 'string' ? body.storeUrl.trim() : ''
    const platform = typeof body?.platform === 'string' ? body.platform.trim() : ''

    if (!storeUrl) {
      return NextResponse.json({ success: false, error: 'Missing storeUrl' }, { status: 400 })
    }

    // Basic URL validation
    try {
      // eslint-disable-next-line no-new
      new URL(storeUrl)
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 })
    }

    const notifyTo = process.env.NOTIFY_EMAIL_TO
    if (!process.env.RESEND_API_KEY || !notifyTo) {
      return NextResponse.json({ success: false, error: 'Email not configured' }, { status: 500 })
    }

    // Fetch user email for admin notification (support both client instance and getter)
    type ClerkUsersApi = { getUser: (id: string) => Promise<{ emailAddresses?: Array<{ emailAddress: string }> }> }
    type ClerkLike = { users: ClerkUsersApi }
    let userEmail: string | null = null
    try {
      const maybeFn = clerkClient as unknown
      const resolved: unknown = typeof maybeFn === 'function' ? await (maybeFn as () => Promise<unknown>)() : maybeFn
      const hasUsers = (obj: unknown): obj is ClerkLike => !!obj && typeof (obj as { users?: unknown }).users === 'object' && typeof (obj as ClerkLike).users.getUser === 'function'
      if (hasUsers(resolved)) {
        const user = await resolved.users.getUser(userId)
        userEmail = user?.emailAddresses?.[0]?.emailAddress || null
      }
    } catch (e) {
      console.warn('Failed to load Clerk user for email in store-link lead:', e)
    }

    const subject = 'New store link submitted'
    const html = `
      <div>
        <h2>New store link submitted</h2>
        <p><strong>URL:</strong> <a href="${storeUrl}" target="_blank" rel="noopener noreferrer">${storeUrl}</a></p>
        ${platform ? `<p><strong>Platform:</strong> ${platform}</p>` : ''}
        <p><strong>Submitted By (Clerk User ID):</strong> ${userId}</p>
        ${userEmail ? `<p><strong>Submitted Email:</strong> ${userEmail}</p>` : ''}
        <p>Timestamp: ${new Date().toISOString()}</p>
      </div>
    `
    const text = `New store link submitted\nURL: ${storeUrl}\n` +
      (platform ? `Platform: ${platform}\n` : '') +
      `Submitted By (Clerk User ID): ${userId}\n` +
      (userEmail ? `Submitted Email: ${userEmail}\n` : '') +
      `Timestamp: ${new Date().toISOString()}`

    await sendEmail({ to: notifyTo, subject, html, text })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Store link capture failed:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
