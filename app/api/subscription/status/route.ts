import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserSubscription, revokeSubscriptionAccess } from '@/lib/subscription'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription details
    const result = await getUserSubscription(userId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    const subscription = result.subscription

    // Defensive check: Auto-expire trial if period has passed (webhook missed)
    if (subscription && subscription.status === 'trialing' && subscription.current_period_end) {
      const endDate = new Date(subscription.current_period_end)
      const now = new Date()

      if (now > endDate) {
        console.warn(`⚠️ Auto-expiring trial for user ${userId} (webhook missed)`)
        console.warn(`   Trial ended: ${endDate.toISOString()}, Current time: ${now.toISOString()}`)

        const supabase = getSupabaseAdmin()

        // Update subscription status to expired
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'expired',
            updated_at: now.toISOString()
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('❌ Failed to auto-expire trial:', updateError)
        } else {
          // Revoke subscription credits
          await revokeSubscriptionAccess(userId)

          // Update the subscription object to reflect new status
          subscription.status = 'expired'

          console.log(`✅ Trial auto-expired for user ${userId}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      subscription: subscription || null
    })
  } catch (error) {
    console.error('Get subscription status error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}
