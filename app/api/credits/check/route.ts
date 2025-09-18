import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export const revalidate = 0
import { auth } from '@clerk/nextjs/server'
import { getUserCredits } from '@/lib/credits'

export async function GET() {
  // Ensure this route is dynamic and not statically evaluated at build time
  try {
    // Safe dev fallback when Supabase env is not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: true,
        credits: 0,
        hasCredits: false,
        userId: null,
        note: 'Dev fallback: Supabase env not configured'
      })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getUserCredits(userId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    if (!result.credits) {
      return NextResponse.json({
        success: true,
        credits: 0,
        hasCredits: false,
        message: 'User credits not initialized'
      })
    }

    return NextResponse.json({
      success: true,
      credits: result.credits.credits_remaining,
      hasCredits: result.credits.credits_remaining > 0,
      userId: userId
    })

  } catch (error) {
    console.error('Check credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check credits' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Safe dev fallback when Supabase env is not configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { requiredCredits } = await request.json()
      const currentCredits = 0
      return NextResponse.json({
        success: true,
        hasEnoughCredits: currentCredits >= (requiredCredits || 0),
        currentCredits,
        requiredCredits: requiredCredits || 0,
        shortfall: Math.max(0, (requiredCredits || 0) - currentCredits),
        note: 'Dev fallback: Supabase env not configured'
      })
    }

    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requiredCredits } = await request.json()

    if (!requiredCredits || requiredCredits <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid required credits amount is needed' },
        { status: 400 }
      )
    }

    const result = await getUserCredits(userId)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    if (!result.credits) {
      return NextResponse.json({
        success: false,
        hasEnoughCredits: false,
        currentCredits: 0,
        requiredCredits,
        error: 'User credits not initialized'
      })
    }

    const hasEnoughCredits = result.credits.credits_remaining >= requiredCredits

    return NextResponse.json({
      success: true,
      hasEnoughCredits,
      currentCredits: result.credits.credits_remaining,
      requiredCredits,
      shortfall: hasEnoughCredits ? 0 : requiredCredits - result.credits.credits_remaining
    })

  } catch (error) {
    console.error('Check credits error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check credits' },
      { status: 500 }
    )
  }
}
