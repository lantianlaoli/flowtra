import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUserCredits } from '@/lib/credits'

export async function GET(request: NextRequest) {
  try {
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