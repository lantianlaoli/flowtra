import { NextRequest, NextResponse } from 'next/server';
import { fetchTikTokVideoUrl, TikTokFetchError } from '@/lib/fetch-tiktok-video';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { tiktok_url } = await request.json();

    if (!tiktok_url) {
      return NextResponse.json({ error: 'tiktok_url is required' }, { status: 400 });
    }

    const videoUrl = await fetchTikTokVideoUrl(tiktok_url);

    return NextResponse.json({ success: true, video_url: videoUrl });
  } catch (error) {
    console.error('[fetch-video] Error:', error);
    if (error instanceof TikTokFetchError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
