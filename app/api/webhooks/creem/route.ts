import { NextRequest, NextResponse } from 'next/server'
import { addCredits, recordCreditTransaction } from '@/lib/credits'
import { getCreditsFromProductId } from '@/lib/constants'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  isEventProcessed,
  recordSubscriptionEvent,
  createSubscription,
  grantSubscriptionAccess,
  resetMonthlyCredits,
  revokeSubscriptionAccess,
  updateSubscriptionStatus,
  updateSubscriptionPeriod,
  getUserSubscription
} from '@/lib/subscription'

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Webhook POST request received')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))

    const payload = await request.json()

    console.log('📄 Creem webhook payload received:', JSON.stringify(payload, null, 2))

    // Extract data from webhook payload
    const { object, eventType, id: eventId } = payload
    console.log(`Processing event: ${eventType} (ID: ${eventId})`)

    // Extract userId from metadata
    const userId = object.metadata?.userId

    if (!userId) {
      console.error('❌ No userId found in webhook metadata')
      console.error('Available metadata:', object.metadata)
      return NextResponse.json({ error: 'No userId in metadata' }, { status: 400 })
    }

    // Deduplication check for subscription events
    if (eventId && eventType.startsWith('subscription.')) {
      const alreadyProcessed = await isEventProcessed(eventId)
      if (alreadyProcessed) {
        console.log(`⏭️ Event ${eventId} already processed, skipping`)
        return NextResponse.json({ success: true, message: 'Event already processed' })
      }
    }

    try {
      // ===== CHECKOUT COMPLETED EVENTS =====

      // checkout.completed with subscription - Acknowledge and let subscription.active handle it
      if (eventType === 'checkout.completed' && object.subscription) {
        console.log(`✅ Subscription checkout completed for user ${userId}`)
        console.log(`   Subscription ID: ${object.subscription.id}`)
        console.log(`   Will be processed by subscription.active event`)

        // Record event for audit trail
        if (eventId) {
          await recordSubscriptionEvent(
            userId,
            object.subscription.id,
            eventType,
            eventId,
            object
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Subscription checkout acknowledged'
        })
      }

      // checkout.completed WITHOUT subscription - One-time purchase (LEGACY)
      // Note: New purchases should use subscriptions. This is kept for existing one-time customers.
      if (eventType === 'checkout.completed' && !object.subscription) {
        const checkoutId = object.id
        const productId = object.product?.id || object.order?.product

        console.log(`📦 One-time purchase - Product ID: ${productId}`)
        console.log(`👤 User ID: ${userId}`)
        console.log(`🛒 Checkout ID: ${checkoutId}`)

        if (!productId) {
          console.error('❌ No productId found in webhook payload')
          return NextResponse.json({ error: 'No productId in webhook payload' }, { status: 400 })
        }

        // Get credits and package info from product_id
        const packageInfo = getCreditsFromProductId(productId)

        if (!packageInfo) {
          console.error(`❌ Unknown product ID: ${productId}`)
          return NextResponse.json({ error: 'Unknown product ID' }, { status: 400 })
        }

        console.log(`💳 Found package: ${packageInfo.packageName} with ${packageInfo.credits} credits`)

        // Add credits to purchased_credits (not subscription_credits)
        const supabase = getSupabaseAdmin()
        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('purchased_credits')
          .eq('user_id', userId)
          .single()

        const newPurchasedCredits = (currentCredits?.purchased_credits || 0) + packageInfo.credits

        const { error: updateError } = await supabase
          .from('user_credits')
          .update({
            purchased_credits: newPurchasedCredits,
            has_purchased: true
          })
          .eq('user_id', userId)

        if (updateError) {
          console.error('❌ Failed to add credits:', updateError)
          return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
        }

        // Record the purchase transaction
        const transactionResult = await recordCreditTransaction(
          userId,
          'purchase',
          packageInfo.credits,
          `Purchase ${packageInfo.packageName} package (one-time)`,
          undefined,
          true
        )

        console.log(`✅ Successfully added ${packageInfo.credits} purchased credits to user ${userId}`)
        console.log(`📝 Transaction recorded: ${transactionResult.success ? 'Yes' : 'Failed'}`)

        return NextResponse.json({
          success: true,
          message: 'One-time purchase credits added successfully',
          creditsAdded: packageInfo.credits,
          packageName: packageInfo.packageName
        })
      }

      // ===== SUBSCRIPTION EVENTS =====

      // subscription.active - New subscription created successfully
      if (eventType === 'subscription.active') {
        console.log(`🆕 New subscription activated for user ${userId}`)

        const creemSubscriptionId = object.id
        const productId = object.product?.id || object.product

        // Create subscription record
        const createResult = await createSubscription(userId, object)
        if (!createResult.success) {
          console.error('❌ Failed to create subscription:', createResult.error)
          return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
        }

        // Grant initial monthly credits
        const subscription = await getUserSubscription(userId)
        if (subscription.subscription) {
          await grantSubscriptionAccess(userId, subscription.subscription.monthly_credits)
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription activated for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription activated' })
      }

      // subscription.paid - Monthly payment succeeded, RESET credits
      if (eventType === 'subscription.paid') {
        console.log(`💰 Subscription payment succeeded for user ${userId}`)

        const creemSubscriptionId = object.id

        // Reset monthly credits to full allocation
        const resetResult = await resetMonthlyCredits(userId, creemSubscriptionId)
        if (!resetResult.success) {
          console.error('❌ Failed to reset monthly credits:', resetResult.error)
        }

        // Update billing period dates
        if (object.current_period_start_date && object.current_period_end_date) {
          await updateSubscriptionPeriod(
            creemSubscriptionId,
            object.current_period_start_date,
            object.current_period_end_date
          )
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Monthly credits reset for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Monthly credits reset' })
      }

      // subscription.canceled - Subscription canceled, REVOKE access
      if (eventType === 'subscription.canceled') {
        console.log(`🚫 Subscription canceled for user ${userId}`)

        const creemSubscriptionId = object.id

        // Revoke subscription credits immediately
        await revokeSubscriptionAccess(userId)

        // Update subscription status
        await updateSubscriptionStatus(creemSubscriptionId, 'canceled')

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription access revoked for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription access revoked' })
      }

      // subscription.paused - Subscription paused, REVOKE access
      if (eventType === 'subscription.paused') {
        console.log(`⏸️ Subscription paused for user ${userId}`)

        const creemSubscriptionId = object.id

        // Revoke subscription credits during pause
        await revokeSubscriptionAccess(userId)

        // Update subscription status
        await updateSubscriptionStatus(creemSubscriptionId, 'paused')

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription paused for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription paused' })
      }

      // subscription.expired - Subscription expired (payment failed)
      if (eventType === 'subscription.expired') {
        console.log(`⏰ Subscription expired for user ${userId}`)

        const creemSubscriptionId = object.id

        // Revoke subscription credits
        await revokeSubscriptionAccess(userId)

        // Update subscription status
        await updateSubscriptionStatus(creemSubscriptionId, 'expired')

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription expired for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription expired' })
      }

      // subscription.update - Subscription object updated
      if (eventType === 'subscription.update') {
        console.log(`🔄 Subscription updated for user ${userId}`)

        const creemSubscriptionId = object.id
        const status = object.status

        console.log(`   Current status: ${status}`)

        // If subscription exists in our database, update its status
        const subscription = await getUserSubscription(userId)
        if (subscription.subscription) {
          await updateSubscriptionStatus(creemSubscriptionId, status)

          // Update billing period dates if provided
          if (object.current_period_start_date && object.current_period_end_date) {
            await updateSubscriptionPeriod(
              creemSubscriptionId,
              object.current_period_start_date,
              object.current_period_end_date
            )
          }
        } else {
          console.log(`   No existing subscription found, will be created on subscription.active`)
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription update recorded for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription updated' })
      }

      // subscription.trialing - Subscription started trial period
      if (eventType === 'subscription.trialing') {
        console.log(`🎁 Subscription trial started for user ${userId}`)

        const creemSubscriptionId = object.id

        // Update subscription status
        const subscription = await getUserSubscription(userId)
        if (subscription.subscription) {
          await updateSubscriptionStatus(creemSubscriptionId, 'trialing')
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription trial started for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription trial started' })
      }

      // Unsupported event type
      console.log(`⚠️ Unsupported event type: ${eventType}`)
      return NextResponse.json({ success: true, message: 'Event type not handled' })

    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at webhook endpoint')
  const url = new URL(request.url)
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()))
  
  return NextResponse.json({ 
    success: true, 
    message: 'Webhook endpoint is active',
    timestamp: new Date().toISOString()
  })
}