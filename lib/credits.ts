'use server'

import { supabase, UserCredits } from '@/lib/supabase'

// Get user's current credits
export async function getUserCredits(userId: string): Promise<{
  success: boolean
  credits?: UserCredits
  error?: string
}> {
  try {
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

// Initialize credits for new user with free starter credits
export async function initializeUserCredits(userId: string, initialCredits: number = 100): Promise<{
  success: boolean
  credits?: UserCredits
  error?: string
}> {
  try {
    const { data: credits, error } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        credits_remaining: initialCredits
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to initialize user credits:', error)
      return {
        success: false,
        error: 'Failed to initialize credits'
      }
    }

    console.log(`✅ Initialized ${initialCredits} credits for new user:`, userId)
    
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

// Check if user has enough credits for an operation
export async function checkCredits(userId: string, requiredCredits: number): Promise<{
  success: boolean
  hasEnoughCredits?: boolean
  currentCredits?: number
  error?: string
}> {
  try {
    const result = await getUserCredits(userId)
    
    if (!result.success) {
      return {
        success: false,
        error: result.error
      }
    }

    if (!result.credits) {
      console.warn('User credits not found, this suggests initialization failed:', userId)
      return {
        success: false,
        error: 'User credits not initialized. Please refresh the page and try again.'
      }
    }

    const currentCredits = result.credits.credits_remaining
    const hasEnoughCredits = currentCredits >= requiredCredits

    return {
      success: true,
      hasEnoughCredits,
      currentCredits
    }
  } catch (error) {
    console.error('Check credits error:', error)
    return {
      success: false,
      error: 'Something went wrong'
    }
  }
}

// Deduct credits from user account
export async function deductCredits(userId: string, creditsToDeduct: number): Promise<{
  success: boolean
  remainingCredits?: number
  error?: string
}> {
  try {
    // First check if user has enough credits
    const checkResult = await checkCredits(userId, creditsToDeduct)
    
    if (!checkResult.success) {
      return {
        success: false,
        error: checkResult.error
      }
    }

    if (!checkResult.hasEnoughCredits) {
      return {
        success: false,
        error: 'Insufficient credits'
      }
    }

    // Deduct credits
    const { data: updatedCredits, error } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: (checkResult.currentCredits || 0) - creditsToDeduct
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Failed to deduct credits:', error)
      return {
        success: false,
        error: 'Failed to deduct credits'
      }
    }

    return {
      success: true,
      remainingCredits: updatedCredits.credits_remaining
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
export async function addCredits(userId: string, creditsToAdd: number, creemId?: string): Promise<{
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
      const { data: updatedCredits, error } = await supabase
        .from('user_credits')
        .update({
          credits_remaining: newBalance,
          creem_id: creemId || null
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
      const { data: newCredits, error } = await supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          credits_remaining: newBalance,
          creem_id: creemId || null
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