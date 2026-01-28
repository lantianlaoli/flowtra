import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  parseTikTokHandle,
  fetchTikTokUserInfo,
  fetchTikTokUserPosts,
  buildTikTokVideoUrl,
  extractTikTokCoverUrl,
  extractTikTokDuration,
  extractTikTokPlayUrl
} from '@/lib/tiktok-creator-source';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const handleInput = typeof body.handle === 'string' ? body.handle.trim() : '';

    const handle = parseTikTokHandle(handleInput);
    if (!handle) {
      return NextResponse.json({ error: 'TikTok username is required' }, { status: 400 });
    }

    const userInfo = await fetchTikTokUserInfo(handle);
    const profile = userInfo.userInfo?.user;

    if (!profile?.secUid || !profile.uniqueId) {
      return NextResponse.json({ error: 'TikTok profile not found' }, { status: 404 });
    }

    const posts = await fetchTikTokUserPosts(profile.secUid, 10);
    const itemList = (posts.data?.itemList || []).slice(0, 10);

    const videos = itemList.map((item: Record<string, any>) => {
      const videoId = String(item.id || '');
      if (!videoId) return null;
      const video = item.video || {};

      return {
        platform_video_id: videoId,
        video_url: buildTikTokVideoUrl(profile.uniqueId as string, videoId),
        play_url: extractTikTokPlayUrl(video),
        cover_url: extractTikTokCoverUrl(video),
        description: item.desc || null,
        duration_seconds: extractTikTokDuration(video)
      };
    }).filter(Boolean);

    return NextResponse.json({
      creator: {
        handle: profile.uniqueId,
        display_name: profile.nickname || null,
        avatar_url: profile.avatarLarger || profile.avatarMedium || profile.avatarThumb || null
      },
      videos
    });
  } catch (error) {
    console.error('[Creator Videos Preview] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
