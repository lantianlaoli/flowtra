import { NextRequest, NextResponse } from 'next/server';
import { checkCredits, deductCredits, addCredits, getUserCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { action, userId, amount } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    switch (action) {
      case 'check':
        const checkResult = await checkCredits(userId, amount || 0);
        return NextResponse.json(checkResult);

      case 'deduct':
        if (typeof amount !== 'number') {
          return NextResponse.json({ error: 'Amount required for deduct' }, { status: 400 });
        }
        const deductResult = await deductCredits(userId, amount);
        return NextResponse.json(deductResult);

      case 'add':
        if (typeof amount !== 'number') {
          return NextResponse.json({ error: 'Amount required for add' }, { status: 400 });
        }
        const addResult = await addCredits(userId, amount);
        return NextResponse.json(addResult);

      case 'get':
        const getResult = await getUserCredits(userId);
        return NextResponse.json(getResult);

      case 'test-concurrent':
        // Simulate concurrent deduction test
        const testAmount = amount || 60;
        console.log(`Testing concurrent deduction of ${testAmount} credits for user ${userId}`);
        
        const promises = Array.from({ length: 3 }, () => deductCredits(userId, testAmount));
        const results = await Promise.allSettled(promises);
        
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failureCount = results.length - successCount;
        
        const finalCredits = await getUserCredits(userId);
        
        return NextResponse.json({
          testResults: {
            concurrent_attempts: results.length,
            successful_deductions: successCount,
            failed_deductions: failureCount,
            final_credits: finalCredits.credits?.credits_remaining || 0
          },
          details: results.map((r, i) => ({
            attempt: i + 1,
            status: r.status,
            result: r.status === 'fulfilled' ? r.value : r.reason
          }))
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Test credits API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Credits Test API',
    endpoints: {
      'POST /api/test-credits': 'Test credits operations',
      actions: [
        'check - Check if user has enough credits',
        'deduct - Deduct credits from user',
        'add - Add credits to user',
        'get - Get user current credits',
        'test-concurrent - Test concurrent credit deduction'
      ],
      'body': {
        userId: 'string (required)',
        action: 'string (required)',
        amount: 'number (optional, required for deduct/add/check)'
      }
    }
  });
}