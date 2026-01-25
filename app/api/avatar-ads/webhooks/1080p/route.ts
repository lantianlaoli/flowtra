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

    // Schema verified via Supabase MCP (2026-01-25): avatar_ads_scenes columns include
    // id, project_id, scene_number, video_1080p_task_id, video_1080p_url, video_1080p_webhook_received_at.
    const { data: scene, error: sceneError } = await supabase
      .from('avatar_ads_scenes')
      .select('id, project_id, scene_number, video_1080p_url')
      .eq('video_1080p_task_id', taskId)
      .single();

    if (sceneError || !scene) {
      return NextResponse.json({ success: false, error: 'Scene not found' }, { status: 200 });
    }

    if (scene.video_1080p_url) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const { error: updateError } = await supabase
      .from('avatar_ads_scenes')
      .update({
        video_1080p_url: resultUrl,
        video_1080p_webhook_received_at: new Date().toISOString()
      })
      .eq('id', scene.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update scene' }, { status: 200 });
    }

    const { data: scenes } = await supabase
      .from('avatar_ads_scenes')
      .select('id, scene_number, video_1080p_url')
      .eq('project_id', scene.project_id)
      .order('scene_number', { ascending: true });

    const allReady = scenes?.every(item => item.video_1080p_url) ?? false;

    if (!allReady || !scenes || scenes.length === 0) {
      return NextResponse.json({ success: true, message: 'Waiting for remaining scenes' }, { status: 200 });
    }

    // Schema verified via Supabase MCP (2026-01-25): avatar_ads_projects columns include
    // id, video_aspect_ratio, merged_video_1080p_url, fal_merge_1080p_task_id.
    const { data: project } = await supabase
      .from('avatar_ads_projects')
      .select('id, video_aspect_ratio, merged_video_1080p_url, fal_merge_1080p_task_id')
      .eq('id', scene.project_id)
      .single();

    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 200 });
    }

    if (project.merged_video_1080p_url) {
      return NextResponse.json({ success: true, message: 'Merged already available' }, { status: 200 });
    }

    const videoUrls = scenes
      .map(item => item.video_1080p_url)
      .filter((url): url is string => Boolean(url));

    if (videoUrls.length === 1) {
      await supabase
        .from('avatar_ads_projects')
        .update({ merged_video_1080p_url: videoUrls[0] })
        .eq('id', scene.project_id);

      return NextResponse.json({ success: true, message: 'Single scene ready' }, { status: 200 });
    }

    if (project.fal_merge_1080p_task_id) {
      return NextResponse.json({ success: true, message: 'Merge already started' }, { status: 200 });
    }

    const { taskId: mergeTaskId } = await mergeVideosWithFal(
      videoUrls,
      project.video_aspect_ratio || '16:9',
      '/api/avatar-ads/webhooks/merge'
    );

    await supabase
      .from('avatar_ads_projects')
      .update({ fal_merge_1080p_task_id: mergeTaskId })
      .eq('id', scene.project_id);

    return NextResponse.json({ success: true, message: 'Merge started' }, { status: 200 });
  } catch (error) {
    console.error('[Avatar Ads 1080p Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 200 });
  }
}
