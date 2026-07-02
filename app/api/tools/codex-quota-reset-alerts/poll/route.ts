// POST /api/tools/codex-quota-reset-alerts/poll
// Protected by CODEX_QUOTA_RESET_ALERT_CRON_SECRET bearer token.
// Pulls new X Recent Search matches from OpenAI official/staff accounts,
// persists them, and emails active subscribers. Idempotent by (subscription, post).

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/resend'
import {
  CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
  POST_WINDOW_DAYS,
  buildAlertEmail,
  chargeAlertCredits,
  fetchSubscriptionsByStatus,
  hasAlertCreditBalance,
  hasNotificationRecord,
  refreshCodexResetPosts,
  recordNotification,
  type StoredResetPost,
} from '@/lib/tools/codex-quota-reset-alerts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

export async function POST(request: Request) {
  const cronSecret = process.env.CODEX_QUOTA_RESET_ALERT_CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const summary = {
    fetched: 0,
    new_posts: 0,
    subscriptions: 0,
    notifications_sent: 0,
    notifications_skipped: 0,
    notifications_failed: 0,
    credits_charged: 0,
  }

  try {
    const refresh = await refreshCodexResetPosts()
    summary.fetched = refresh.fetched
    summary.new_posts = refresh.inserted
    if (refresh.error) {
      console.error('[codex-quota-reset-alerts] poll: refresh failed:', refresh.error)
    }

    const subscriptions = await fetchSubscriptionsByStatus('active')
    summary.subscriptions = subscriptions.length

    if (subscriptions.length === 0) {
      return NextResponse.json({ success: true, summary })
    }

    const supabase = getSupabaseAdmin()
    const cutoffIso = new Date(Date.now() - POST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { data: posts, error: postsError } = await supabase
      .from('codex_quota_reset_posts')
      .select('*')
      .gte('posted_at', cutoffIso)
      .order('posted_at', { ascending: false })
      .limit(200)

    if (postsError || !posts) {
      console.error('[codex-quota-reset-alerts] poll: load posts failed:', postsError)
      return NextResponse.json({ success: true, summary })
    }

    const postRows = posts as unknown as StoredResetPost[]

    for (const subscription of subscriptions) {
      let notificationsSent = subscription.notifications_sent
      const subscribedAt = Date.parse(subscription.created_at)
      for (const post of postRows) {
        const postedAt = Date.parse(post.posted_at)
        if (Number.isFinite(subscribedAt) && Number.isFinite(postedAt) && postedAt < subscribedAt) {
          summary.notifications_skipped += 1
          continue
        }

        const already = await hasNotificationRecord({
          subscriptionId: subscription.id,
          postId: post.id,
        })
        if (already) {
          summary.notifications_skipped += 1
          continue
        }

        const creditBalance = await hasAlertCreditBalance(subscription.user_id)
        if (!creditBalance.success || !creditBalance.hasEnoughCredits) {
          summary.notifications_skipped += 1
          await recordNotification({
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            postId: post.id,
            status: 'skipped',
            creditsCharged: 0,
            errorMessage: creditBalance.error ?? `Insufficient credits for ${CODEX_QUOTA_RESET_ALERT_CREDIT_COST}-credit alert`,
          })
          continue
        }

        const { subject, html, text } = buildAlertEmail({
          email: subscription.email,
          post,
        })

        let providerId: string | undefined
        let sendError: string | undefined
        try {
          const result = await sendEmail({
            to: subscription.email,
            subject,
            html,
            text,
          })
          providerId = result?.data?.id
          if (result?.error) {
            sendError = String(result.error)
          }
        } catch (err) {
          sendError = err instanceof Error ? err.message : 'Unknown email error'
        }

        if (sendError) {
          summary.notifications_failed += 1
          await recordNotification({
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            postId: post.id,
            status: 'failed',
            creditsCharged: 0,
            errorMessage: sendError,
          })
          continue
        }

        const charged = await chargeAlertCredits({
          userId: subscription.user_id,
          postTweetId: post.tweet_id,
        })
        if (!charged.success) {
          summary.notifications_failed += 1
          await recordNotification({
            subscriptionId: subscription.id,
            userId: subscription.user_id,
            postId: post.id,
            status: 'failed',
            creditsCharged: 0,
            errorMessage: charged.error ?? 'Failed to charge credits',
          })
          continue
        }

        summary.notifications_sent += 1
        summary.credits_charged += CODEX_QUOTA_RESET_ALERT_CREDIT_COST
        notificationsSent += 1
        await recordNotification({
          subscriptionId: subscription.id,
          userId: subscription.user_id,
          postId: post.id,
          status: 'sent',
          creditsCharged: CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
          providerId: providerId ?? null,
        })

        await supabase
          .from('codex_quota_reset_subscriptions')
          .update({
            last_notified_post_id: post.tweet_id,
            notifications_sent: notificationsSent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
      }
    }

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('[codex-quota-reset-alerts] poll failed:', error)
    return NextResponse.json({ success: false, error: 'Poll failed', summary }, { status: 500 })
  }
}
