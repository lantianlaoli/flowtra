import type { WebhookEvent } from '@clerk/nextjs/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { NextRequest } from 'next/server'
import { ensureClerkUserWelcomeState, purgeClerkUserData } from '@/lib/clerk-user-sync'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getUserIdFromEvent(evt: WebhookEvent) {
  const id = evt.data?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)
    const userId = getUserIdFromEvent(evt)

    if (!userId) {
      console.warn('[Clerk Webhook] Ignoring event without user id:', evt.type)
      return new Response('Missing user id', { status: 200 })
    }

    if (evt.type === 'user.created') {
      const result = await ensureClerkUserWelcomeState(userId)
      console.log('[Clerk Webhook] user.created synced', {
        eventId: evt.data.id,
        userId,
        insertedCredits: result.insertedCredits,
        insertedWelcomeTransaction: result.insertedWelcomeTransaction,
      })
      return new Response('Webhook processed', { status: 200 })
    }

    if (evt.type === 'user.deleted') {
      const result = await purgeClerkUserData(userId)
      console.log('[Clerk Webhook] user.deleted purged', {
        eventId: evt.data.id,
        userId,
        removedStorageObjects: result.removedStorageObjects,
      })
      return new Response('Webhook processed', { status: 200 })
    }

    console.log('[Clerk Webhook] Ignored event type', {
      eventId: evt.data.id,
      type: evt.type,
      userId,
    })
    return new Response('Ignored event', { status: 200 })
  } catch (error) {
    console.error('[Clerk Webhook] Verification or processing failed:', error)
    return new Response('Error verifying webhook', { status: 400 })
  }
}
