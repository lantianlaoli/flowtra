'use server'

import { getSupabaseAdmin } from '@/lib/supabase'
import { PACKAGES } from '@/lib/constants'
import { recordCreditTransaction } from '@/lib/credits'

interface Subscription {
  id: string
  user_id: string
  creem_subscription_id: string | null
  creem_customer_id: string | null
  creem_product_id: string | null
  tier: 'lite' | 'basic' | 'pro'
  status: string
  monthly_credits: number
  credits_used_this_cycle: number
  current_period_start: string | null
  current_period_end: string | null
  subscribed_at: string
  canceled_at: string | null
  created_at: string
  updated_at: string
}

// Grant subscription access by allocating monthly credits
export async function grantSubscriptionAccess(
  userId: string,
  monthlyCredits: number,
  tier?: 'lite' | 'basic' | 'pro'
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('user_credits')
    .update({
      credits_remaining: monthlyCredits
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to grant subscription access:', error)
    return { success: false, error: 'Database error' }
  }

  // Record transaction for audit trail
  const tierLabel = tier ? ` - ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan` : ''
  const transactionResult = await recordCreditTransaction(
    userId,
    'purchase',
    monthlyCredits,
    `Subscription credits granted${tierLabel}`,
    undefined,
    true // Use admin client
  )

  if (!transactionResult.success) {
    // Log warning but don't fail the grant (non-blocking)
    console.warn(`⚠️ Failed to record transaction for subscription grant: ${transactionResult.error}`)
  }

  console.log(`✅ Granted ${monthlyCredits} subscription credits to user ${userId}`)
  console.log(`📝 Transaction recorded: ${transactionResult.success ? 'Yes' : 'Failed (non-blocking)'}`)
  return { success: true }
}

// Revoke subscription access by zeroing out credits
export async function revokeSubscriptionAccess(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('user_credits')
    .update({ credits_remaining: 0 })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to revoke subscription access:', error)
    return { success: false, error: 'Database error' }
  }

  console.log(`🚫 Revoked subscription credits for user ${userId} (purchased credits preserved)`)
  return { success: true }
}

// Reset monthly credits on billing cycle renewal
export async function resetMonthlyCredits(
  userId: string,
  creemSubscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  // Get subscription details
  const { data: subscription, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('monthly_credits, tier')
    .eq('creem_subscription_id', creemSubscriptionId)
    .single()

  if (fetchError || !subscription) {
    console.error('Subscription not found:', creemSubscriptionId)
    return { success: false, error: 'Subscription not found' }
  }

  // Reset credits_remaining to monthly allocation
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({ credits_remaining: subscription.monthly_credits })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to reset credits:', updateError)
    return { success: false, error: 'Failed to reset credits' }
  }

  // Record transaction for monthly renewal
  const tierLabel = subscription.tier
    ? ` - ${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)} plan`
    : ''
  const transactionResult = await recordCreditTransaction(
    userId,
    'purchase',
    subscription.monthly_credits,
    `Monthly subscription credits${tierLabel}`,
    undefined,
    true // Use admin client
  )

  if (!transactionResult.success) {
    console.warn(`⚠️ Failed to record transaction for monthly reset: ${transactionResult.error}`)
  }

  // Reset usage tracking
  const { error: resetError } = await supabase
    .from('user_subscriptions')
    .update({ credits_used_this_cycle: 0 })
    .eq('creem_subscription_id', creemSubscriptionId)

  if (resetError) {
    console.error('Failed to reset usage tracking:', resetError)
  }

  console.log(`🔄 Reset monthly credits for user ${userId}: ${subscription.monthly_credits}`)
  console.log(`📝 Transaction recorded: ${transactionResult.success ? 'Yes' : 'Failed (non-blocking)'}`)
  return { success: true }
}

// Check if user has active subscription
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('user_subscriptions')
    .select('status')
    .eq('user_id', userId)
    .single()

  return !!data && ['active', 'trialing'].includes(data.status)
}

// Get user's subscription details
export async function getUserSubscription(userId: string): Promise<{
  success: boolean
  subscription?: Subscription
  error?: string
}> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Failed to fetch subscription:', error)
    return { success: false, error: 'Failed to fetch subscription' }
  }

  return { success: true, subscription: data || undefined }
}

// Create new subscription record from Creem webhook data
export async function createSubscription(
  userId: string,
  creemData: any
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  // Extract tier from product_id
  const productId = creemData.product?.id || creemData.product
  const tier = getTierFromProductId(productId)

  if (!tier) {
    console.error('Unknown product ID:', productId)
    return { success: false, error: 'Unknown product ID' }
  }

  const monthlyCredits = PACKAGES[tier].credits

  const { error } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      creem_subscription_id: creemData.id,
      creem_customer_id: creemData.customer?.id || creemData.customer,
      creem_product_id: productId,
      tier,
      status: creemData.status || 'active',
      monthly_credits: monthlyCredits,
      credits_used_this_cycle: 0,
      current_period_start: creemData.current_period_start_date,
      current_period_end: creemData.current_period_end_date,
      subscribed_at: new Date().toISOString()
    })

  if (error) {
    console.error('Failed to create subscription:', error)
    return { success: false, error: 'Failed to create subscription' }
  }

  console.log(`📝 Created subscription for user ${userId}: ${tier} tier`)
  return { success: true }
}

// Update subscription status
export async function updateSubscriptionStatus(
  creemSubscriptionId: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  const updateData: any = { status, updated_at: new Date().toISOString() }

  // Add canceled_at timestamp if status is canceled
  if (status === 'canceled') {
    updateData.canceled_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('user_subscriptions')
    .update(updateData)
    .eq('creem_subscription_id', creemSubscriptionId)

  if (error) {
    console.error('Failed to update subscription status:', error)
    return { success: false, error: 'Failed to update status' }
  }

  console.log(`📊 Updated subscription ${creemSubscriptionId} status to: ${status}`)
  return { success: true }
}

// Update subscription billing period dates
export async function updateSubscriptionPeriod(
  creemSubscriptionId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      current_period_start: periodStart,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString()
    })
    .eq('creem_subscription_id', creemSubscriptionId)

  if (error) {
    console.error('Failed to update subscription period:', error)
    return { success: false, error: 'Failed to update period' }
  }

  return { success: true }
}

// Record subscription event for audit trail
export async function recordSubscriptionEvent(
  userId: string,
  creemSubscriptionId: string,
  eventType: string,
  creemEventId: string,
  metadata?: any
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin()

  // Get subscription ID
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('id')
    .eq('creem_subscription_id', creemSubscriptionId)
    .single()

  if (!subscription) {
    console.warn('Subscription not found for event recording:', creemSubscriptionId)
    return { success: false, error: 'Subscription not found' }
  }

  const { error } = await supabase
    .from('subscription_events')
    .insert({
      user_id: userId,
      subscription_id: subscription.id,
      event_type: eventType,
      creem_event_id: creemEventId,
      metadata
    })

  if (error) {
    console.error('Failed to record subscription event:', error)
    return { success: false, error: 'Failed to record event' }
  }

  return { success: true }
}

// Check if event has already been processed (deduplication)
export async function isEventProcessed(creemEventId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('subscription_events')
    .select('id')
    .eq('creem_event_id', creemEventId)
    .single()

  return !!data
}

// Helper: Get tier from product ID
function getTierFromProductId(productId: string): 'lite' | 'basic' | 'pro' | null {
  // Check against subscription product IDs (using PACK env vars)
  const isDevMode = process.env.CREEM_ENVIRONMENT === 'development'

  const liteId = isDevMode ? process.env.LITE_PACK_CREEM_DEV_ID : process.env.LITE_PACK_CREEM_PROD_ID
  const basicId = isDevMode ? process.env.BASIC_PACK_CREEM_DEV_ID : process.env.BASIC_PACK_CREEM_PROD_ID
  const proId = isDevMode ? process.env.PRO_PACK_CREEM_DEV_ID : process.env.PRO_PACK_CREEM_PROD_ID

  if (productId === liteId) return 'lite'
  if (productId === basicId) return 'basic'
  if (productId === proId) return 'pro'

  return null
}

// Helper: Get monthly credits for a tier
export async function getMonthlyCreditsForTier(tier: 'lite' | 'basic' | 'pro'): Promise<number> {
  return PACKAGES[tier].credits
}
