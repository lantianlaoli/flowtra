'use server'

import { getSupabase, getSupabaseAdmin, UserCredits } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/resend'
import { clerkClient } from '@clerk/nextjs/server'

interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'usage' | 'purchase' | 'refund';
  amount: number;
  description: string;
  history_id?: string;
  created_at: string;
}

// Get user's current credits
export async function getUserCredits(userId: string): Promise<{
  success: boolean
  credits?: UserCredits
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin() // Use admin client to bypass RLS
    const { data: credits, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to fetch user credits:', error)
      return {
        success: false,
        error: 'Failed to fetch credits'
      }
    }

    if (!credits) {
      return {
        success: true,
        credits: undefined
      }
    }

    return {
      success: true,
      credits
    }
  } catch (error) {
    console.error('Get user credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

// Initialize credits for new user with free initial credits
export async function initializeUserCredits(userId: string, initialCredits: number = 100): Promise<{
  success: boolean
  credits?: UserCredits
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin() // Use admin client to bypass RLS
    
    // Use UPSERT to prevent duplicate initialization
    const { data: credits, error } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        credits_remaining: initialCredits
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: true  // Don't update if record already exists
      })
      .select()
      .maybeSingle()

    if (error) {
      // Webhook and fallback initialization can race. In that case PostgREST may
      // return 0 rows from the upsert/select path even though the row now exists.
      if (error.code === 'PGRST116') {
        const existingResult = await getUserCredits(userId)
        if (existingResult.success && existingResult.credits) {
          return {
            success: true,
            credits: existingResult.credits
          }
        }
      }

      // If it's a duplicate key error, user already has credits - this is not an error
      if (error.code === '23505' || error.message?.includes('duplicate')) {
        console.log(`👤 User ${userId} already has credits initialized, skipping duplicate initialization`)
        // Get existing credits
        const existingResult = await getUserCredits(userId)
        if (existingResult.success && existingResult.credits) {
          return {
            success: true,
            credits: existingResult.credits
          }
        }
      }
      
      console.error('Failed to initialize user credits:', error)
      return {
        success: false,
        error: 'Failed to initialize credits'
      }
    }

    if (!credits) {
      const existingResult = await getUserCredits(userId)
      if (existingResult.success && existingResult.credits) {
        return {
          success: true,
          credits: existingResult.credits
        }
      }
    }

    // Only log and record transaction if this is a new initialization with credits
    if (credits) {
      console.log(`✅ Initialized ${initialCredits} credits for new user:`, userId)

      // Only record transaction and send emails if user is getting credits (old migration path)
      // New users get 0 credits and must purchase, so skip this
      if (initialCredits > 0) {
        // Record the initial credit transaction
        await recordCreditTransaction(
          userId,
          'purchase',
          initialCredits,
          'Initial free credits for new user',
          undefined,
          true // Use admin client
        )

        // Fire-and-forget: send welcome email to new user
        try {
          // clerkClient can be a function returning a ClerkClient in this runtime
          const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient
          const user = await client.users.getUser(userId)
          const primaryEmail = user.emailAddresses?.[0]?.emailAddress
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || null

          // Send welcome email to new user
          if (primaryEmail) {
            await sendWelcomeEmail({ to: primaryEmail, name: fullName })
            console.log(`✉️ Welcome email sent to new user: ${primaryEmail}`)
          } else {
            console.warn('⚠️ No primary email found for user, skipping welcome email:', userId)
          }
        } catch (notifyError) {
          console.warn('sendWelcomeEmail failed or skipped:', notifyError)
        }
      }
    } else {
      console.log(`👤 User ${userId} already has credits, no initialization needed`)
    }
    
    return {
      success: true,
      credits
    }
  } catch (error) {
    console.error('Initialize user credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

/**
 * Check if user has made their first purchase
 * Used to determine if user can access dashboard
 */
export async function hasUserPurchased(userId: string): Promise<{
  success: boolean
  hasPurchased?: boolean
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin()
    const { data: credits, error } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Failed to check purchase status:', error)
      return { success: false, error: 'Failed to check purchase status' }
    }

    if (!credits) {
      return { success: true, hasPurchased: false }
    }

    return { success: true, hasPurchased: credits.credits_remaining > 0 }
  } catch (error) {
    console.error('Check purchase status error:', error)
    return { success: false, error: 'Something went wrong' }
  }
}

// Check if user has enough credits for an operation
export async function checkCredits(userId: string, requiredCredits: number): Promise<{
  success: boolean
  hasEnoughCredits?: boolean
  currentCredits?: number
  error?: string
}> {
  try {
    console.log('🔍 checkCredits called:', { userId, requiredCredits });
    
    const result = await getUserCredits(userId)
    console.log('📊 getUserCredits result:', result);
    
    if (!result.success) {
      console.error('❌ getUserCredits failed:', result.error);
      return {
        success: false,
        error: result.error
      }
    }

    if (!result.credits) {
      console.warn('⚠️ User credits not found, this suggests initialization failed:', userId)
      return {
        success: false,
        error: 'User credits not initialized. Please refresh the page and try again.'
      }
    }

    const currentCredits = result.credits.credits_remaining
    const hasEnoughCredits = currentCredits >= requiredCredits
    
    console.log('💰 Credits comparison:', {
      currentCredits,
      requiredCredits,
      hasEnoughCredits,
      difference: currentCredits - requiredCredits
    });

    return {
      success: true,
      hasEnoughCredits,
      currentCredits
    }
  } catch (error) {
    console.error('💥 Check credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

// Deduct credits from user account (supports negative values for refunds)
export async function deductCredits(userId: string, creditsToDeduct: number): Promise<{
  success: boolean
  remainingCredits?: number
  error?: string
}> {
  try {
    const supabase = getSupabaseAdmin()

    // Get current credit balance
    const { data: credits, error: fetchError } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single()

    if (fetchError || !credits) {
      console.error('Failed to fetch user credits:', fetchError)
      return {
        success: false,
        error: 'Failed to fetch credits'
      }
    }

    // Check if user has enough credits (for positive deductions)
    if (creditsToDeduct > 0 && credits.credits_remaining < creditsToDeduct) {
      console.warn(`Insufficient credits for user ${userId}: needs ${creditsToDeduct}, has ${credits.credits_remaining}`)
      return {
        success: false,
        error: 'Insufficient credits'
      }
    }

    // For refunds (negative), add to balance; for deductions, subtract
    const newCreditsRemaining = credits.credits_remaining - creditsToDeduct

    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits_remaining: newCreditsRemaining })
      .eq('user_id', userId)

    if (updateError) {
      console.error('Failed to update credits:', updateError)
      return {
        success: false,
        error: 'Failed to update credits'
      }
    }

    console.log(`💳 Deducted ${creditsToDeduct} credits from user ${userId}`)
    console.log(`   credits_remaining: ${credits.credits_remaining} → ${newCreditsRemaining}`)

    return {
      success: true,
      remainingCredits: newCreditsRemaining
    }
  } catch (error) {
    console.error('Deduct credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

// Add credits to user account (for purchases)
export async function addCredits(userId: string, creditsToAdd: number): Promise<{
  success: boolean
  newBalance?: number
  error?: string
}> {
  try {
    // Get current credits or initialize if needed
    const currentResult = await getUserCredits(userId)
    
    if (!currentResult.success) {
      return {
        success: false,
        error: currentResult.error
      }
    }

    let currentCredits = 0
    let shouldUpdate = false

    if (currentResult.credits) {
      currentCredits = currentResult.credits.credits_remaining
      shouldUpdate = true
    }

    const newBalance = currentCredits + creditsToAdd

    if (shouldUpdate) {
      // Update existing record
      const supabase = getSupabaseAdmin() // Use admin client to bypass RLS
      const { data: updatedCredits, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: newBalance
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Failed to update credits:', error)
        return {
          success: false,
          error: 'Failed to update credits'
        }
      }

      return {
        success: true,
        newBalance: updatedCredits.credits_remaining
      }
    } else {
      // Create new record
      const supabase = getSupabaseAdmin() // Use admin client to bypass RLS
      const { data: newCredits, error } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits_remaining: newBalance
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create credits record:', error)
        return {
          success: false,
          error: 'Failed to create credits record'
        }
      }

      return {
        success: true,
        newBalance: newCredits.credits_remaining
      }
    }
  } catch (error) {
    console.error('Add credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

/**
 * Refund credits to user account (wrapper for deductCredits with negative value)
 * Used when generation fails after credits were deducted
 */
export async function refundCredits(
  userId: string,
  creditsToRefund: number,
  reason: string,
  projectId?: string
): Promise<{
  success: boolean;
  newBalance?: number;
  error?: string;
}> {
  try {
    console.log(`💰 Refunding ${creditsToRefund} credits to user ${userId}: ${reason}`);

    // Use deductCredits with negative value to add credits back
    const refundResult = await deductCredits(userId, -creditsToRefund);

    if (!refundResult.success) {
      return {
        success: false,
        error: refundResult.error
      };
    }

    // Record refund transaction
    await recordCreditTransaction(
      userId,
      'refund',
      creditsToRefund,
      reason,
      projectId,
      true // Use admin client
    );

    console.log(`✅ Refunded ${creditsToRefund} credits, new balance: ${refundResult.remainingCredits}`);

    return {
      success: true,
      newBalance: refundResult.remainingCredits
    };
  } catch (error) {
    console.error('Refund credits error:', error);
    return {
      success: false,
      error: 'Something went wrong'
    };
  }
}

// Record a credit transaction
export async function recordCreditTransaction(
  userId: string,
  type: 'usage' | 'purchase' | 'refund',
  amount: number,
  description: string,
  historyId?: string,
  useAdminClient: boolean = false
): Promise<{
  success: boolean
  transaction?: CreditTransaction
  error?: string
}> {
  try {
    const hasServiceKey = !!process.env.SUPABASE_SECRET_KEY;
    // Prefer admin client when requested and available; otherwise fallback to public client
    const usedAdmin = useAdminClient && hasServiceKey;
    const primaryClient = usedAdmin ? getSupabaseAdmin() : getSupabase();

    const payload = {
      user_id: userId,
      type,
      amount: type === 'usage' ? -amount : amount,
      description,
      history_id: historyId || null
    } as const;

    let transaction: CreditTransaction | null = null;
    let error: unknown;
    const primary = await primaryClient
      .from('credit_transactions')
      .insert(payload)
      .select()
      .single();
    transaction = (primary.data as CreditTransaction | null) ?? null;
    error = primary.error;

    // If the public client hits RLS, retry with admin if available
    if (error && !usedAdmin && hasServiceKey) {
      console.warn('recordCreditTransaction public client failed, retrying with admin:', error);
      const adminClient = getSupabaseAdmin();
      const retry = await adminClient
        .from('credit_transactions')
        .insert(payload)
        .select()
        .single();
      transaction = (retry.data as CreditTransaction | null) ?? null;
      error = retry.error;
    }

    if (error) {
      console.error('Failed to record transaction:', error);
      return { success: false, error: 'Failed to record transaction' };
    }

    return { success: true, transaction: transaction ?? undefined };
  } catch (error) {
    console.error('Record transaction error:', error);
    return { success: false, error: 'Something went wrong' };
  }
}

// Get user's credit transactions
export async function getCreditTransactions(userId: string): Promise<{
  success: boolean
  transactions?: CreditTransaction[]
  error?: string
}> {
  try {
    // Use admin client to bypass RLS since we're using Clerk auth instead of Supabase auth
    const { data: transactions, error } = await getSupabaseAdmin()
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50) // Limit to recent 50 transactions

    if (error) {
      console.error('Failed to fetch transactions:', error)
      return {
        success: false,
        error: 'Failed to fetch transactions'
      }
    }

    return {
      success: true,
      transactions: transactions || []
    }
  } catch (error) {
    console.error('Get transactions error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}
