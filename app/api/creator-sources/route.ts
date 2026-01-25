import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  parseTikTokHandle,
  fetchTikTokUserInfo,
  fetchTikTokUserPosts,
  resolveTikTokProfileUrl,
  buildTikTokVideoUrl,
  extractTikTokCoverUrl,
  extractTikTokDuration,
  extractTikTokPlayUrl
} from '@/lib/tiktok-creator-source';
import { fetchTikTokVideoUrl } from '@/lib/fetch-tiktok-video';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): creator_sources, creator_source_platforms, creator_source_videos
    // Schema verified via Supabase MCP (2026-02-01): creator_sources, creator_source_platforms, creator_source_videos
    const { data: sources, error } = await supabase
      .from('creator_sources')
      .select('*, creator_source_platforms(*), creator_source_videos(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Creator Sources GET] Error:', error);
      return NextResponse.json({ error: 'Failed to fetch creator sources' }, { status: 500 });
    }

    return NextResponse.json({ sources: sources || [] });
  } catch (error) {
    console.error('[Creator Sources GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const tiktokInput = typeof body.tiktok_handle === 'string' ? body.tiktok_handle.trim() : '';
    const videoCount = typeof body.video_count === 'number'
      ? Math.min(Math.max(body.video_count, 1), 10) // Clamp between 1-10
      : 10; // Default to 10

    if (!tiktokInput) {
      return NextResponse.json({ error: 'TikTok username is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): creator_sources
    const handle = parseTikTokHandle(tiktokInput);
    if (!handle) {
      return NextResponse.json({ error: 'Invalid TikTok handle or URL' }, { status: 400 });
    }

    const { data: source, error: sourceError } = await supabase
      .from('creator_sources')
      .insert({
        user_id: userId,
        source_name: handle
      })
      .select()
      .single();

    if (sourceError || !source) {
      console.error('[Creator Sources POST] Source create error:', sourceError);
      return NextResponse.json({ error: 'Failed to create creator source' }, { status: 500 });
    }

    const userInfo = await fetchTikTokUserInfo(handle);
    const profile = userInfo.userInfo?.user;

    if (!profile?.secUid || !profile.uniqueId) {
      return NextResponse.json({ error: 'TikTok profile not found' }, { status: 404 });
    }

    let itemList: Array<Record<string, any>> = [];
    try {
      const posts = await fetchTikTokUserPosts(profile.secUid, videoCount);
      itemList = posts.data?.itemList || [];
    } catch (error) {
      console.error('[Creator Sources POST] Posts fetch error:', error);
    }

    const platformPayload = {
      user_id: userId,
      source_id: source.id,
      platform: 'tiktok',
      handle: profile.uniqueId,
      profile_url: resolveTikTokProfileUrl(profile.uniqueId),
      avatar_url: profile.avatarLarger || profile.avatarMedium || profile.avatarThumb || null,
      display_name: profile.nickname || null,
      sec_uid: profile.secUid,
      unique_id: profile.uniqueId,
      stats: userInfo.userInfo?.stats || userInfo.userInfo?.statsV2 || null
    };

    // Schema verified via Supabase MCP (2026-02-01): creator_source_platforms
    const { error: platformError } = await supabase
      .from('creator_source_platforms')
      .upsert(platformPayload, { onConflict: 'source_id,platform' });

    if (platformError) {
      console.error('[Creator Sources POST] Platform upsert error:', platformError);
    }

    const videoRows = (await Promise.all(itemList.map(async (item: Record<string, any>) => {
      const videoId = String(item.id || '');
      if (!videoId) return null;

      const video = item.video || {};
      const stats = item.stats || item.statsV2 || null;
      const durationSeconds = extractTikTokDuration(video);
      const videoUrl = buildTikTokVideoUrl(profile.uniqueId as string, videoId);
      let cdnUrl = extractTikTokPlayUrl(video);

      try {
        cdnUrl = await fetchTikTokVideoUrl(videoUrl);
      } catch (error) {
        console.warn('[Creator Sources POST] Failed to fetch Rapid video URL, using fallback:', error);
      }

      return {
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        platform_video_id: videoId,
        video_url: videoUrl,
        video_cdn_url: cdnUrl,
        cover_url: extractTikTokCoverUrl(video),
        description: item.desc || null,
        stats,
        duration_seconds: durationSeconds
      };
    }))).filter((row): row is NonNullable<typeof row> => Boolean(row?.platform_video_id));

    if (videoRows.length > 0) {
      // Schema verified via Supabase MCP (2026-02-01): creator_source_videos
      const { error: videoError } = await supabase
        .from('creator_source_videos')
        .upsert(videoRows, { onConflict: 'source_id,platform,platform_video_id' });

      if (videoError) {
        console.error('[Creator Sources POST] Video upsert error:', videoError);
      }
    }

    // Schema verified via Supabase MCP (2026-02-01): creator_sources has id, user_id, source_name
    const { data: sourceRow, error: hydrateSourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('id', source.id)
      .eq('user_id', userId)
      .single();

    if (hydrateSourceError || !sourceRow) {
      console.error('[Creator Sources POST] Source load error:', hydrateSourceError);
      return NextResponse.json({ source });
    }

    // Schema verified via Supabase MCP (2026-02-01): creator_source_platforms columns include source_id
    const { data: platforms } = await supabase
      .from('creator_source_platforms')
      .select('*')
      .eq('source_id', source.id)
      .eq('user_id', userId);

    // Schema verified via Supabase MCP (2026-02-01): creator_source_videos columns include source_id
    const { data: videos } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('source_id', source.id)
      .eq('user_id', userId);

    return NextResponse.json({
      source: {
        ...sourceRow,
        creator_source_platforms: platforms || [],
        creator_source_videos: videos || []
      }
    });
  } catch (error) {
    console.error('[Creator Sources POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
