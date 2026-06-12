import { NextRequest, NextResponse } from 'next/server'
import { addCredits, recordCreditTransaction } from '@/lib/credits'
import { getCreditsFromProductId } from '@/lib/constants'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyCreemWebhookSignature } from '@/lib/security/creem-webhook'
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

    const rawBody = await request.text()
    if (!verifyCreemWebhookSignature(rawBody, request)) {
      console.error('❌ Invalid Creem webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = JSON.parse(rawBody)

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

      // checkout.completed with subscription - Handle subscription creation directly
      // CRITICAL: In production, Creem may only send checkout.completed before subscription.active.
      // So we must handle subscription creation here to ensure it works in all environments
      if (eventType === 'checkout.completed' && object.subscription) {
        console.log(`✅ Subscription checkout completed for user ${userId}`)
        console.log(`   Subscription ID: ${object.subscription.id}`)
        console.log(`   Subscription status: ${object.subscription.status}`)

        const creemSubscriptionId = object.subscription.id
        const subscriptionStatus = object.subscription.status

        // Check if subscription already exists (idempotency)
        const existingSubscription = await getUserSubscription(userId)

        if (!existingSubscription.subscription) {
          // Subscription doesn't exist yet - create it now
          console.log(`   Creating subscription from checkout.completed event`)

          const createResult = await createSubscription(userId, object.subscription)
          if (!createResult.success) {
            console.error('❌ Failed to create subscription:', createResult.error)
            return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
          }

          // Grant initial credits only for paid active subscriptions. Trial statuses are
          // stored for compatibility but do not receive onboarding credits.
          if (subscriptionStatus === 'active') {
            const subscription = await getUserSubscription(userId)
            if (subscription.subscription) {
              const monthlyCredits = subscription.subscription.monthly_credits
              const tier = subscription.subscription.tier
              console.log(`   Granting ${monthlyCredits} credits (status: ${subscriptionStatus})`)
              await grantSubscriptionAccess(userId, monthlyCredits, tier)
            }
          }
        } else {
          console.log(`   Subscription already exists, skipping creation`)
        }

        // Record event for audit trail
        if (eventId) {
          await recordSubscriptionEvent(
            userId,
            creemSubscriptionId,
            eventType,
            eventId,
            object
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Subscription checkout processed'
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

        // Add credits to credits_remaining
        const addResult = await addCredits(userId, packageInfo.credits)

        if (!addResult.success) {
          console.error('❌ Failed to add credits:', addResult.error)
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

        console.log(`✅ Successfully added ${packageInfo.credits} credits to user ${userId}, new balance: ${addResult.newBalance}`)
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
        console.log(`🆕 Subscription activated for user ${userId}`)

        const creemSubscriptionId = object.id
        const productId = object.product?.id || object.product

        // Check if subscription already exists (idempotency)
        const existingSubscription = await getUserSubscription(userId)

        if (existingSubscription.subscription) {
          console.log(`   Subscription exists, updating status`)
          const previousStatus = existingSubscription.subscription.status

          // Only update status to active
          const statusResult = await updateSubscriptionStatus(creemSubscriptionId, 'active')
          if (!statusResult.success) {
            console.error('❌ Failed to update status:', statusResult.error)
            return NextResponse.json({ error: statusResult.error }, { status: 500 })
          }

          // Update billing period dates if provided
          if (object.current_period_start_date && object.current_period_end_date) {
            const periodResult = await updateSubscriptionPeriod(
              creemSubscriptionId,
              object.current_period_start_date,
              object.current_period_end_date
            )
            if (!periodResult.success) {
              console.error('❌ Failed to update period:', periodResult.error)
              return NextResponse.json({ error: periodResult.error }, { status: 500 })
            }
          }

          if (previousStatus === 'trialing') {
            const subscription = await getUserSubscription(userId)
            if (subscription.subscription) {
              const monthlyCredits = subscription.subscription.monthly_credits
              const tier = subscription.subscription.tier
              console.log(`   Granting ${monthlyCredits} paid credits after active conversion`)
              const grantResult = await grantSubscriptionAccess(userId, monthlyCredits, tier)
              if (!grantResult.success) {
                console.error('❌ Failed to grant credits:', grantResult.error)
                return NextResponse.json({ error: grantResult.error }, { status: 500 })
              }
            }
          } else {
            console.log(`   Preserving existing credits (no reset)`)
          }
        } else {
          // NEW SUBSCRIPTION: No existing record
          console.log(`   Creating new subscription`)

          // Create subscription record
          const createResult = await createSubscription(userId, object)
          if (!createResult.success) {
            console.error('❌ Failed to create subscription:', createResult.error)
            return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
          }

          // Grant initial monthly credits
          const subscription = await getUserSubscription(userId)
          if (subscription.subscription) {
            const grantResult = await grantSubscriptionAccess(
              userId,
              subscription.subscription.monthly_credits,
              subscription.subscription.tier
            )
            if (!grantResult.success) {
              console.error('❌ Failed to grant credits:', grantResult.error)
              return NextResponse.json({ error: grantResult.error }, { status: 500 })
            }
          }
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

        // Check if subscription exists (handle race condition: paid arrives before active)
        const existingSubscription = await getUserSubscription(userId)

        if (!existingSubscription.subscription) {
          // Subscription doesn't exist yet - create it (subscription.paid arrived before subscription.active)
          console.log(`⚠️ subscription.paid arrived before subscription creation - creating now`)

          const createResult = await createSubscription(userId, object)
          if (!createResult.success) {
            console.error('❌ Failed to create subscription:', createResult.error)
            return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
          }
        }

        // 🔧 FIX: Update status (was missing - critical bug)
        const statusResult = await updateSubscriptionStatus(
          creemSubscriptionId,
          object.status || 'active'
        )
        if (!statusResult.success) {
          console.error('❌ Failed to update status:', statusResult.error)
          return NextResponse.json({ error: statusResult.error }, { status: 500 })
        }

        // Reset monthly credits to full allocation
        const resetResult = await resetMonthlyCredits(userId, creemSubscriptionId)
        if (!resetResult.success) {
          console.error('❌ Failed to reset monthly credits:', resetResult.error)
          return NextResponse.json({ error: resetResult.error }, { status: 500 })
        }

        // Update billing period dates
        if (object.current_period_start_date && object.current_period_end_date) {
          const periodResult = await updateSubscriptionPeriod(
            creemSubscriptionId,
            object.current_period_start_date,
            object.current_period_end_date
          )
          if (!periodResult.success) {
            console.error('❌ Failed to update period:', periodResult.error)
            return NextResponse.json({ error: periodResult.error }, { status: 500 })
          }
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Monthly credits reset and status updated for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Monthly credits reset and status updated' })
      }

      // subscription.canceled - Subscription canceled, preserve credits until expiration
      if (eventType === 'subscription.canceled') {
        console.log(`🚫 Subscription canceled for user ${userId}`)

        const creemSubscriptionId = object.id

        // Update subscription status
        await updateSubscriptionStatus(creemSubscriptionId, 'canceled')

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription marked as canceled for user ${userId} (credits preserved until expiration)`)
        return NextResponse.json({
          success: true,
          message: 'Subscription canceled, credits preserved until period ends'
        })
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

        // Check if subscription exists
        const subscription = await getUserSubscription(userId)

        if (subscription.subscription) {
          // Subscription exists - just update it
          const statusResult = await updateSubscriptionStatus(creemSubscriptionId, status)
          if (!statusResult.success) {
            console.error('❌ Failed to update status:', statusResult.error)
            return NextResponse.json({ error: statusResult.error }, { status: 500 })
          }

          // Update billing period dates if provided
          if (object.current_period_start_date && object.current_period_end_date) {
            const periodResult = await updateSubscriptionPeriod(
              creemSubscriptionId,
              object.current_period_start_date,
              object.current_period_end_date
            )
            if (!periodResult.success) {
              console.error('❌ Failed to update period:', periodResult.error)
              return NextResponse.json({ error: periodResult.error }, { status: 500 })
            }
          }
        } else {
          // CRITICAL: In production, Creem can send subscription.update before subscription.active.
          // We must create subscription here to avoid missing subscriptions
          console.log(`   No existing subscription found - creating from subscription.update`)

          // Create subscription
          const createResult = await createSubscription(userId, object)
          if (!createResult.success) {
            console.error('❌ Failed to create subscription:', createResult.error)
            return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
          }

          // Grant initial credits only for paid active subscriptions. Existing trialing records
          // remain compatible in access checks, but new trial events do not grant credits.
          if (status === 'active') {
            const newSubscription = await getUserSubscription(userId)
            if (newSubscription.subscription) {
              const monthlyCredits = newSubscription.subscription.monthly_credits
              const tier = newSubscription.subscription.tier
              console.log(`   Granting ${monthlyCredits} credits (status: ${status})`)
              const grantResult = await grantSubscriptionAccess(userId, monthlyCredits, tier)
              if (!grantResult.success) {
                console.error('❌ Failed to grant credits:', grantResult.error)
                return NextResponse.json({ error: grantResult.error }, { status: 500 })
              }
            }
          }
        }

        // Record event
        await recordSubscriptionEvent(userId, creemSubscriptionId, eventType, eventId, object)

        console.log(`✅ Subscription update recorded for user ${userId}`)
        return NextResponse.json({ success: true, message: 'Subscription updated' })
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
