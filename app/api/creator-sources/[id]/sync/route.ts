import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  fetchTikTokUserInfo,
  fetchTikTokUserPosts,
  resolveTikTokProfileUrl,
  buildTikTokVideoUrl,
  extractTikTokCoverUrl,
  extractTikTokDuration,
  extractTikTokPlayUrl
} from '@/lib/tiktok-creator-source';
import { fetchTikTokVideoUrl } from '@/lib/fetch-tiktok-video';
import { downloadVideoBuffer, uploadCreatorVideoCoverToStorage, uploadCreatorVideoToStorage } from '@/lib/creator-videos-storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-28): creator_source_platforms
    const { data: platform, error: platformError } = await supabase
      .from('creator_source_platforms')
      .select('*')
      .eq('source_id', id)
      .eq('platform', 'tiktok')
      .eq('user_id', userId)
      .single();

    let handle = platform?.unique_id || platform?.handle;
    try {
      const body = await request.json();
      if (body?.handle && typeof body.handle === 'string') {
        handle = body.handle.trim();
      }
    } catch {
      // Ignore empty body
    }
    if (!handle) {
      const { data: source } = await supabase
        .from('creator_sources')
        .select('source_name')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      handle = source?.source_name || null;
    }

    if (!handle) {
      return NextResponse.json({ error: 'TikTok handle missing' }, { status: 400 });
    }

    const userInfo = await fetchTikTokUserInfo(handle);
    const profile = userInfo.userInfo?.user;

    if (!profile?.secUid || !profile.uniqueId) {
      return NextResponse.json({ error: 'TikTok profile not found' }, { status: 404 });
    }

    let itemList: Array<Record<string, any>> = [];
    try {
      const posts = await fetchTikTokUserPosts(profile.secUid, 12);
      itemList = posts.data?.itemList || [];
    } catch (error) {
      console.error('[Creator Sources Sync] Posts fetch error:', error);
    }

    const platformPayload = {
      user_id: userId,
      source_id: id,
      platform: 'tiktok',
      handle: profile.uniqueId,
      profile_url: resolveTikTokProfileUrl(profile.uniqueId),
      avatar_url: profile.avatarLarger || profile.avatarMedium || profile.avatarThumb || null,
      display_name: profile.nickname || null,
      sec_uid: profile.secUid,
      unique_id: profile.uniqueId,
      stats: userInfo.userInfo?.stats || userInfo.userInfo?.statsV2 || null
    };

    // Schema verified via Supabase MCP (2026-01-28): creator_source_platforms
    const { error: platformUpsertError } = await supabase
      .from('creator_source_platforms')
      .upsert(platformPayload, { onConflict: 'source_id,platform' });

    if (platformUpsertError) {
      console.error('[Creator Sources Sync] Platform upsert error:', platformUpsertError);
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
        console.warn('[Creator Sources Sync] Failed to fetch Rapid video URL, using fallback:', error);
      }

      if (!cdnUrl) {
        console.warn('[Creator Sources Sync] Missing CDN url, skipping video:', videoId);
        return null;
      }

      let storedUrl: string | null = null;
      let coverUrl: string | null = null;
      try {
        const { buffer, contentType } = await downloadVideoBuffer(cdnUrl);
        const uploadResult = await uploadCreatorVideoToStorage({
          userId,
          fileName: `${videoId}.mp4`,
          buffer,
          contentType
        });
        storedUrl = uploadResult.publicUrl;
      } catch (error) {
        console.warn('[Creator Sources Sync] Storage upload failed, skipping video:', error);
        return null;
      }
      const fallbackCover = extractTikTokCoverUrl(video);
      if (fallbackCover) {
        try {
          const coverFile = await downloadVideoBuffer(fallbackCover);
          const coverUpload = await uploadCreatorVideoCoverToStorage({
            userId,
            fileName: `${videoId}.png`,
            buffer: coverFile.buffer,
            contentType: coverFile.contentType
          });
          coverUrl = coverUpload.publicUrl;
        } catch (coverError) {
          console.warn('[Creator Sources Sync] Cover upload failed:', coverError);
        }
      }

      return {
        user_id: userId,
        source_id: id,
        platform: 'tiktok',
        platform_video_id: videoId,
        video_url: videoUrl,
        video_cdn_url: storedUrl,
        cover_url: coverUrl,
        description: item.desc || null,
        stats,
        duration_seconds: durationSeconds
      };
    }))).filter((row): row is NonNullable<typeof row> => Boolean(row?.platform_video_id));

    if (videoRows.length > 0) {
      // Schema verified via Supabase MCP (2026-01-28): creator_source_videos
      const { error: videoError } = await supabase
        .from('creator_source_videos')
        .upsert(videoRows, { onConflict: 'source_id,platform,platform_video_id' });

      if (videoError) {
        console.error('[Creator Sources Sync] Video upsert error:', videoError);
      }
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_sources, creator_source_platforms, creator_source_videos
    // Schema verified via Supabase MCP (2026-01-28): creator_sources has id, user_id, source_name
    const { data: sourceRow, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('id', id)
      .single();

    if (sourceError || !sourceRow) {
      console.error('[Creator Sources Sync] Source load error:', sourceError);
      return NextResponse.json({ error: 'Creator source not found' }, { status: 404 });
    }

    if (sourceRow.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_source_platforms columns include source_id
    const { data: platforms, error: platformsError } = await supabase
      .from('creator_source_platforms')
      .select('*')
      .eq('source_id', id);

    if (platformsError) {
      console.error('[Creator Sources Sync] Platform fetch error:', platformsError);
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_source_videos columns include source_id
    const { data: videos, error: videosError } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('source_id', id);

    if (videosError) {
      console.error('[Creator Sources Sync] Videos fetch error:', videosError);
    }

    return NextResponse.json({
      source: {
        ...sourceRow,
        creator_source_platforms: platforms || [],
        creator_source_videos: videos || []
      }
    });
  } catch (error) {
    console.error('[Creator Sources Sync] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
