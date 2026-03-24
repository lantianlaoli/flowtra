import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchTikTokVideoUrl, TikTokFetchError } from '@/lib/fetch-tiktok-video';
import { isValidSocialVideoUrl } from '@/lib/fetch-social-video';
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

    const body = await request.json();
    // Accept both 'url' (generic) and 'tiktok_url' (legacy) for backwards compatibility
    const tiktok_url = body.url || body.tiktok_url;

    if (!tiktok_url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    if (!isValidSocialVideoUrl(tiktok_url)) {
      return NextResponse.json(
        { error: 'Unsupported URL. Please provide a TikTok, Instagram, YouTube, or Facebook video link.' },
        { status: 400 }
      );
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
