// POST /api/tools/codex-quota-reset-alerts/subscribe
// Body: { email: string }
// Requires Clerk auth. Initializes user_credits (zero balance) if missing,
// stores the subscription, and returns whether notifications are active or
// paused because the user lacks sufficient credits.

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
  buildSubscriptionStatus,
  upsertSubscription,
  validateEmail,
} from '@/lib/tools/codex-quota-reset-alerts'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: { email?: unknown }
    try {
      body = (await request.json()) as { email?: unknown }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = validateEmail(typeof body.email === 'string' ? body.email : null)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.reason }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: creditsRow, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .maybeSingle()

    if (creditsError) {
      console.error('[codex-quota-reset-alerts] subscribe: credits lookup failed:', creditsError)
      return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 })
    }

    let creditsRemaining: number
    if (!creditsRow) {
      const { error: insertError } = await supabase
        .from('user_credits')
        .insert({ user_id: userId, credits_remaining: 0 })
      if (insertError) {
        // Treat duplicate (race) as success
        if (insertError.code !== '23505') {
          console.error('[codex-quota-reset-alerts] subscribe: init credits failed:', insertError)
          return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 })
        }
      }
      creditsRemaining = 0
    } else {
      creditsRemaining = creditsRow.credits_remaining
    }

    const status = buildSubscriptionStatus({ creditsRemaining })
    const upsert = await upsertSubscription({
      userId,
      email: validation.email,
      status: status.state === 'active' ? 'active' : 'paused',
    })

    if (upsert.error || !upsert.subscription) {
      return NextResponse.json({ error: upsert.error ?? 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      subscription: upsert.subscription,
      billing: {
        cost_per_email: CODEX_QUOTA_RESET_ALERT_CREDIT_COST,
        credits_remaining: creditsRemaining,
        state: status.state,
      },
    })
  } catch (error) {
    console.error('[codex-quota-reset-alerts] POST /subscribe failed:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}