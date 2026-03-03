import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { analyzeCreatorVideoAndUpdate } from '@/lib/creator-video-analysis';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-03-03): creator_source_videos has id, user_id, source_id, video_url, video_cdn_url, duration_seconds, analysis_status.
    const { data: video, error: videoError } = await supabase
      .from('creator_source_videos')
      .select('id, user_id, source_id, video_url, video_cdn_url, duration_seconds, analysis_status, analysis_result, analysis_error, description')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (videoError || !video) {
      console.error('[Creator Videos Retry Analysis] Video fetch error:', videoError);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.analysis_status === 'analyzing') {
      return NextResponse.json({ error: 'Analysis is already running' }, { status: 409 });
    }

    // Schema verified via Supabase MCP (2026-03-03): creator_sources has id, user_id, source_name.
    const { data: source, error: sourceError } = await supabase
      .from('creator_sources')
      .select('id, source_name')
      .eq('id', video.source_id)
      .eq('user_id', userId)
      .single();

    if (sourceError || !source) {
      console.error('[Creator Videos Retry Analysis] Source fetch error:', sourceError);
      return NextResponse.json({ error: 'Video source not found' }, { status: 404 });
    }

    const videoUrl = video.video_cdn_url || video.video_url;
    if (!videoUrl) {
      return NextResponse.json({ error: 'Video URL is missing' }, { status: 400 });
    }

    const { data: updatedVideo, error: updateError } = await supabase
      .from('creator_source_videos')
      .update({
        analysis_status: 'analyzing',
        analysis_result: null,
        analysis_error: null,
        analyzed_at: null
      })
      .eq('id', video.id)
      .eq('user_id', userId)
      .select('id, user_id, source_id, video_url, video_cdn_url, duration_seconds, analysis_status, analysis_result, analysis_error, description')
      .single();

    if (updateError || !updatedVideo) {
      console.error('[Creator Videos Retry Analysis] Status update error:', updateError);
      return NextResponse.json({ error: 'Failed to restart analysis' }, { status: 500 });
    }

    after(async () => {
      try {
        await analyzeCreatorVideoAndUpdate({
          supabase: getSupabaseAdmin(),
          videoId: updatedVideo.id,
          videoUrl,
          sourceName: source.source_name,
          durationSeconds: updatedVideo.duration_seconds
        });
      } catch (error) {
        console.error('[Creator Videos Retry Analysis] Background retry failed:', error);
      }
    });

    return NextResponse.json({
      video: {
        ...updatedVideo,
        source_name: source.source_name
      }
    });
  } catch (error) {
    console.error('[Creator Videos Retry Analysis] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
