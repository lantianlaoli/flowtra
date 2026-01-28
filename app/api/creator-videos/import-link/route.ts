import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  fetchTikTokCoverByUrl,
  parseTikTokHandle,
  resolveTikTokProfileUrl
} from '@/lib/tiktok-creator-source';
import { fetchTikTokVideoUrl, isValidTikTokUrl } from '@/lib/fetch-tiktok-video';
import { downloadVideoBuffer, uploadCreatorVideoCoverToStorage, uploadCreatorVideoToStorage } from '@/lib/creator-videos-storage';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const extractHandleAndVideoId = (url: string) => {
  const handleMatch = url.match(/tiktok\.com\/@([^/]+)/i);
  const videoMatch = url.match(/\/video\/(\d+)/i);
  return {
    handle: handleMatch?.[1] ? handleMatch[1].trim() : null,
    videoId: videoMatch?.[1] ? videoMatch[1].trim() : null
  };
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'TikTok video link is required' }, { status: 400 });
    }
    if (!isValidTikTokUrl(url)) {
      return NextResponse.json({ error: 'Invalid TikTok video link' }, { status: 400 });
    }

    const { handle: rawHandle, videoId } = extractHandleAndVideoId(url);
    const handle = rawHandle ? parseTikTokHandle(rawHandle) : null;
    const sourceName = handle || 'Imported';

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-28): creator_sources
    const { data: existingSources, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    if (sourceError) {
      console.error('[Creator Videos Import Link] Source fetch error:', sourceError);
      return NextResponse.json({ error: 'Failed to load creator source' }, { status: 500 });
    }

    let source = existingSources?.[0] || null;

    if (!source) {
      const { data: createdSource, error: createError } = await supabase
        .from('creator_sources')
        .insert({
          user_id: userId,
          source_name: sourceName
        })
        .select()
        .single();

      if (createError || !createdSource) {
        console.error('[Creator Videos Import Link] Source create error:', createError);
        return NextResponse.json({ error: 'Failed to create creator source' }, { status: 500 });
      }

      source = createdSource;
    }

    if (handle) {
      // Schema verified via Supabase MCP (2026-01-28): creator_source_platforms
      await supabase
        .from('creator_source_platforms')
        .upsert({
          user_id: userId,
          source_id: source.id,
          platform: 'tiktok',
          handle,
          profile_url: resolveTikTokProfileUrl(handle)
        }, { onConflict: 'source_id,platform' });
    }

    let cdnUrl: string | null = null;
    try {
      cdnUrl = await fetchTikTokVideoUrl(url);
    } catch (error) {
      console.warn('[Creator Videos Import Link] Failed to fetch TikTok CDN url:', error);
    }

    if (!cdnUrl) {
      return NextResponse.json({ error: 'Failed to fetch TikTok video URL' }, { status: 500 });
    }

    const { buffer, contentType } = await downloadVideoBuffer(cdnUrl);
    const uploadResult = await uploadCreatorVideoToStorage({
      userId,
      fileName: `${videoId || 'tiktok'}.mp4`,
      buffer,
      contentType
    });

    let coverUrl: string | null = null;
    try {
      const fallbackCover = await fetchTikTokCoverByUrl(url);
      if (fallbackCover) {
        const coverFile = await downloadVideoBuffer(fallbackCover);
        const coverUpload = await uploadCreatorVideoCoverToStorage({
          userId,
          fileName: `${videoId || 'tiktok'}.png`,
          buffer: coverFile.buffer,
          contentType: coverFile.contentType
        });
        coverUrl = coverUpload.publicUrl;
      }
    } catch (fallbackError) {
      console.warn('[Creator Videos Import Link] Cover download failed:', fallbackError);
    }

    const platformVideoId = videoId || crypto.randomUUID();

    // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_status
    const { data: storedVideo, error: videoError } = await supabase
      .from('creator_source_videos')
      .upsert({
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        platform_video_id: platformVideoId,
        video_url: url,
        video_cdn_url: uploadResult.publicUrl,
        cover_url: coverUrl,
        analysis_status: 'pending',
        analysis_error: null
      }, { onConflict: 'source_id,platform,platform_video_id' })
      .select()
      .single();

    if (videoError || !storedVideo) {
      console.error('[Creator Videos Import Link] Video insert error:', videoError);
      return NextResponse.json({ error: 'Failed to save video' }, { status: 500 });
    }

    await analyzeCreatorVideoAndUpdate({
      supabase,
      videoId: storedVideo.id,
      videoUrl: storedVideo.video_cdn_url || storedVideo.video_url,
      sourceName: source.source_name,
      durationSeconds: storedVideo.duration_seconds
    });

    const { data: analyzedVideo, error: analyzedError } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('id', storedVideo.id)
      .single();

    if (analyzedError || !analyzedVideo) {
      console.error('[Creator Videos Import Link] Analysis fetch error:', analyzedError);
      return NextResponse.json({
        video: {
          ...storedVideo,
          source_name: source.source_name
        }
      });
    }

    return NextResponse.json({
      video: {
        ...analyzedVideo,
        source_name: source.source_name
      }
    });
  } catch (error) {
    console.error('[Creator Videos Import Link] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
