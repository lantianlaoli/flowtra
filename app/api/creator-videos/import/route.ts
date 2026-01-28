import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  parseTikTokHandle,
  fetchTikTokUserInfo,
  resolveTikTokProfileUrl
} from '@/lib/tiktok-creator-source';
import { fetchTikTokVideoUrl } from '@/lib/fetch-tiktok-video';
import { downloadVideoBuffer, uploadCreatorVideoCoverToStorage, uploadCreatorVideoToStorage } from '@/lib/creator-videos-storage';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

interface ImportVideoPayload {
  platform_video_id: string;
  video_url: string;
  play_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  duration_seconds?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const handleInput = typeof body.handle === 'string' ? body.handle.trim() : '';
    const videos = Array.isArray(body.videos) ? body.videos as ImportVideoPayload[] : [];

    const handle = parseTikTokHandle(handleInput);
    if (!handle) {
      return NextResponse.json({ error: 'TikTok username is required' }, { status: 400 });
    }

    if (!videos.length) {
      return NextResponse.json({ error: 'No videos selected for import' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const userInfo = await fetchTikTokUserInfo(handle);
    const profile = userInfo.userInfo?.user;
    if (!profile?.uniqueId) {
      return NextResponse.json({ error: 'TikTok profile not found' }, { status: 404 });
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_sources
    const { data: existingSources, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_name', profile.uniqueId);

    if (sourceError) {
      console.error('[Creator Videos Import] Source fetch error:', sourceError);
      return NextResponse.json({ error: 'Failed to load creator source' }, { status: 500 });
    }

    let source = existingSources?.[0] || null;

    if (!source) {
      const { data: createdSource, error: createError } = await supabase
        .from('creator_sources')
        .insert({
          user_id: userId,
          source_name: profile.uniqueId
        })
        .select()
        .single();

      if (createError || !createdSource) {
        console.error('[Creator Videos Import] Source create error:', createError);
        return NextResponse.json({ error: 'Failed to create creator source' }, { status: 500 });
      }

      source = createdSource;
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_source_platforms
    const { error: platformError } = await supabase
      .from('creator_source_platforms')
      .upsert({
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        handle: profile.uniqueId,
        profile_url: resolveTikTokProfileUrl(profile.uniqueId),
        avatar_url: profile.avatarLarger || profile.avatarMedium || profile.avatarThumb || null,
        display_name: profile.nickname || null,
        sec_uid: profile.secUid || null,
        unique_id: profile.uniqueId || null,
        stats: userInfo.userInfo?.stats || userInfo.userInfo?.statsV2 || null
      }, { onConflict: 'source_id,platform' });

    if (platformError) {
      console.error('[Creator Videos Import] Platform upsert error:', platformError);
    }

    const videoRows = await Promise.all(videos.map(async (video) => {
      const videoUrl = video.video_url;
      const platformVideoId = String(video.platform_video_id || '').trim();
      if (!videoUrl || !platformVideoId) return null;

      let cdnUrl: string | null = null;
      const playUrl = video.play_url && typeof video.play_url === 'string' ? video.play_url : null;
      if (playUrl) {
        cdnUrl = playUrl;
      } else {
        try {
          cdnUrl = await fetchTikTokVideoUrl(videoUrl);
        } catch (error) {
          console.warn('[Creator Videos Import] Failed to fetch TikTok CDN url:', error);
        }
      }

      if (!cdnUrl) {
        console.warn('[Creator Videos Import] Missing CDN url, skipping video:', platformVideoId);
        return null;
      }

      let storedUrl: string | null = null;
      let coverUrl: string | null = null;
      try {
        let downloadTarget = cdnUrl;
        try {
          const { buffer, contentType } = await downloadVideoBuffer(downloadTarget);
          const uploadResult = await uploadCreatorVideoToStorage({
            userId,
            fileName: `${platformVideoId}.mp4`,
            buffer,
            contentType
          });
          storedUrl = uploadResult.publicUrl;
        } catch (primaryError) {
          if (playUrl) {
            console.warn('[Creator Videos Import] Play URL download failed, retrying with RapidAPI URL:', primaryError);
            try {
              downloadTarget = await fetchTikTokVideoUrl(videoUrl);
              const { buffer, contentType } = await downloadVideoBuffer(downloadTarget);
              const uploadResult = await uploadCreatorVideoToStorage({
                userId,
                fileName: `${platformVideoId}.mp4`,
                buffer,
                contentType
              });
              storedUrl = uploadResult.publicUrl;
            } catch (fallbackError) {
              console.warn('[Creator Videos Import] Fallback download failed, skipping video:', fallbackError);
              return null;
            }
          } else {
            throw primaryError;
          }
        }
      } catch (error) {
        console.warn('[Creator Videos Import] Storage upload failed, skipping video:', error);
        return null;
      }

      if (!coverUrl && video.cover_url) {
        try {
          const coverFile = await downloadVideoBuffer(video.cover_url);
          const coverUpload = await uploadCreatorVideoCoverToStorage({
            userId,
            fileName: `${platformVideoId}.png`,
            buffer: coverFile.buffer,
            contentType: coverFile.contentType
          });
          coverUrl = coverUpload.publicUrl;
        } catch (coverError) {
          console.warn('[Creator Videos Import] Cover download failed:', coverError);
        }
      }

      return {
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        platform_video_id: platformVideoId,
        video_url: videoUrl,
        video_cdn_url: storedUrl,
        cover_url: coverUrl,
        description: video.description || null,
        duration_seconds: video.duration_seconds || null,
        analysis_status: 'pending',
        analysis_error: null
      };
    }));

    const filteredRows = videoRows.filter(Boolean);
    if (!filteredRows.length) {
      return NextResponse.json({ error: 'Failed to prepare videos for import' }, { status: 400 });
    }

    // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_status
    const { error: videoError } = await supabase
      .from('creator_source_videos')
      .upsert(filteredRows, { onConflict: 'source_id,platform,platform_video_id' });

    if (videoError) {
      console.error('[Creator Videos Import] Video upsert error:', videoError);
      return NextResponse.json({ error: 'Failed to import videos' }, { status: 500 });
    }

    const ids = filteredRows.map(row => row!.platform_video_id);
    const { data: storedVideos, error: fetchError } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('source_id', source.id)
      .in('platform_video_id', ids);

    if (fetchError) {
      console.error('[Creator Videos Import] Video fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch imported videos' }, { status: 500 });
    }

    for (const video of storedVideos || []) {
      const videoUrl = video.video_cdn_url || video.video_url;
      if (!videoUrl) {
        continue;
      }
      await analyzeCreatorVideoAndUpdate({
        supabase,
        videoId: video.id,
        videoUrl,
        sourceName: source.source_name,
        durationSeconds: video.duration_seconds
      });
    }

    const { data: analyzedVideos, error: analyzedError } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('source_id', source.id)
      .in('platform_video_id', ids);

    if (analyzedError) {
      console.error('[Creator Videos Import] Analysis fetch error:', analyzedError);
      return NextResponse.json({
        videos: (storedVideos || []).map(video => ({
          ...video,
          source_name: source.source_name
        }))
      });
    }

    return NextResponse.json({
      videos: (analyzedVideos || []).map(video => ({
        ...video,
        source_name: source.source_name
      }))
    });
  } catch (error) {
    console.error('[Creator Videos Import] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
