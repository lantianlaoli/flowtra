import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { KIE_CREDIT_THRESHOLD } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { enforceRateLimit, RateLimitError } from '@/lib/security/rate-limit';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `check-kie-credits:${userId}`,
      limit: 20,
      windowMs: 60 * 1000,
    });

    if (!process.env.KIE_API_KEY) {
      console.error('KIE_API_KEY not configured');
      return NextResponse.json({
        success: false,
        sufficient: false,
        error: 'KIE API key not configured'
      }, { status: 500 });
    }

    // Call KIE API to check credits with high retry count
    const response = await fetchWithRetry('https://api.kie.ai/api/v1/chat/credit', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }, 10, 30000);

    if (!response.ok) {
      console.error('KIE API request failed:', response.status, response.statusText);
      return NextResponse.json({
        success: false,
        sufficient: false,
        error: 'Failed to check KIE credits'
      }, { status: 500 });
    }

    const result = await response.json();

    // Expected response format: { "code": 200, "msg": "success", "data": 100 }
    if (result.code !== 200) {
      console.error('KIE API returned error:', result);
      return NextResponse.json({
        success: false,
        sufficient: false,
        error: result.msg || 'KIE API error'
      }, { status: 500 });
    }

    const currentCredits = result.data;
    const sufficient = currentCredits >= KIE_CREDIT_THRESHOLD;

    console.log(`KIE Credits check: ${currentCredits}/${KIE_CREDIT_THRESHOLD} - ${sufficient ? 'Sufficient' : 'Insufficient'}`);

    return NextResponse.json({
      success: true,
      sufficient,
      currentCredits,
      threshold: KIE_CREDIT_THRESHOLD
    });

  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { success: false, error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    console.error('KIE credits check error:', error);
    return NextResponse.json({
      success: false,
      sufficient: false,
      error: 'Failed to check KIE credits'
    }, { status: 500 });
  }
}
