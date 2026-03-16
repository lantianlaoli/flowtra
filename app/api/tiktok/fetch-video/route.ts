import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchTikTokVideoUrl, TikTokFetchError } from '@/lib/fetch-tiktok-video';
import { enforceRateLimit, getRequestIp, RateLimitError } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `tiktok-fetch-video:${userId}:${getRequestIp(request)}`,
      limit: 8,
      windowMs: 60 * 1000,
    });

    const { tiktok_url } = await request.json();

    if (!tiktok_url) {
      return NextResponse.json({ error: 'tiktok_url is required' }, { status: 400 });
    }

    const videoUrl = await fetchTikTokVideoUrl(tiktok_url);

    return NextResponse.json({ success: true, video_url: videoUrl });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    console.error('[fetch-video] Error:', error);
    if (error instanceof TikTokFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
