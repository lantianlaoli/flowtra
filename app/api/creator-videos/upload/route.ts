import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Buffer } from 'buffer';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadCreatorVideoToStorage } from '@/lib/creator-videos-storage';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;
export const experimental_bodySizeLimit = 500 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: 'Only video files are supported' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const arrayBuffer = await file.arrayBuffer();
    const uploadResult = await uploadCreatorVideoToStorage({
      userId,
      fileName: file.name,
      buffer: Buffer.from(arrayBuffer),
      contentType: file.type
    });

    const coverUrl: string | null = null;

    const sourceName = 'Uploaded';

    // Schema verified via Supabase MCP (2026-01-28): creator_sources
    const { data: existingSources, error: sourceError } = await supabase
      .from('creator_sources')
      .select('*')
      .eq('user_id', userId)
      .eq('source_name', sourceName);

    if (sourceError) {
      console.error('[Creator Videos Upload] Source fetch error:', sourceError);
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
        console.error('[Creator Videos Upload] Source create error:', createError);
        return NextResponse.json({ error: 'Failed to create upload source' }, { status: 500 });
      }
      source = createdSource;
    }

    const platformVideoId = crypto.randomUUID();

    // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_status
    const { data: storedVideo, error: videoError } = await supabase
      .from('creator_source_videos')
      .insert({
        user_id: userId,
        source_id: source.id,
        platform: 'tiktok',
        platform_video_id: platformVideoId,
        video_url: uploadResult.publicUrl,
        video_cdn_url: uploadResult.publicUrl,
        cover_url: coverUrl,
        analysis_status: 'pending',
        analysis_error: null
      })
      .select()
      .single();

    if (videoError || !storedVideo) {
      console.error('[Creator Videos Upload] Video insert error:', videoError);
      return NextResponse.json({ error: 'Failed to save uploaded video' }, { status: 500 });
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
      console.error('[Creator Videos Upload] Analysis fetch error:', analyzedError);
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
    console.error('[Creator Videos Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
