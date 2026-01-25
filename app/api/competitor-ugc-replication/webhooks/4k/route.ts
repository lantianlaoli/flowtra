import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { mergeVideosWithFal } from '@/lib/video-merge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KieCallbackPayload {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    task_id?: string;
    info?: {
      resultUrls?: string[];
    };
    resultUrls?: string[];
    resultUrl?: string;
  };
}

const getResultUrl = (payload: KieCallbackPayload): string | null => {
  const resultUrl = payload.data?.resultUrl;
  if (resultUrl) return resultUrl;
  const resultUrls = payload.data?.info?.resultUrls || payload.data?.resultUrls;
  if (Array.isArray(resultUrls) && resultUrls.length > 0) return resultUrls[0];
  return null;
};

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as KieCallbackPayload;
    const taskId = payload.data?.taskId || payload.data?.task_id;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 200 });
    }

    const resultUrl = getResultUrl(payload);
    if (!resultUrl) {
      return NextResponse.json({ success: false, error: 'Missing result URL' }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_segments columns include
    // id, project_id, segment_index, video_4k_task_id, video_4k_url, video_4k_webhook_received_at.
    const { data: segment, error: segmentError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('id, project_id, segment_index, video_4k_url')
      .eq('video_4k_task_id', taskId)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json({ success: false, error: 'Segment not found' }, { status: 200 });
    }

    if (segment.video_4k_url) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const { error: updateError } = await supabase
      .from('competitor_ugc_replication_segments')
      .update({
        video_4k_url: resultUrl,
        video_4k_webhook_received_at: new Date().toISOString()
      })
      .eq('id', segment.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update segment' }, { status: 200 });
    }

    const { data: segments } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('id, segment_index, video_4k_url')
      .eq('project_id', segment.project_id)
      .order('segment_index', { ascending: true });

    const allReady = segments?.every(item => item.video_4k_url) ?? false;

    if (!allReady || !segments || segments.length === 0) {
      return NextResponse.json({ success: true, message: 'Waiting for remaining segments' }, { status: 200 });
    }

    // Schema verified via Supabase MCP (2026-01-25): competitor_ugc_replication_projects columns include
    // id, video_aspect_ratio, merged_video_4k_url, fal_merge_4k_task_id.
    const { data: project } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('id, video_aspect_ratio, merged_video_4k_url, fal_merge_4k_task_id')
      .eq('id', segment.project_id)
      .single();

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 200 });
    }

    if (project.merged_video_4k_url) {
      return NextResponse.json({ success: true, message: 'Merged already available' }, { status: 200 });
    }

    const videoUrls = segments
      .map(item => item.video_4k_url)
      .filter((url): url is string => Boolean(url));

    if (videoUrls.length === 1) {
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({ merged_video_4k_url: videoUrls[0] })
        .eq('id', segment.project_id);

      return NextResponse.json({ success: true, message: 'Single segment ready' }, { status: 200 });
    }

    if (project.fal_merge_4k_task_id) {
      return NextResponse.json({ success: true, message: 'Merge already started' }, { status: 200 });
    }

    const { taskId: mergeTaskId } = await mergeVideosWithFal(
      videoUrls,
      project.video_aspect_ratio || '16:9',
      '/api/competitor-ugc-replication/webhooks/merge'
    );

    await supabase
      .from('competitor_ugc_replication_projects')
      .update({ fal_merge_4k_task_id: mergeTaskId })
      .eq('id', segment.project_id);

    return NextResponse.json({ success: true, message: 'Merge started' }, { status: 200 });
  } catch (error) {
    console.error('[UGC 4K Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 200 });
  }
}
