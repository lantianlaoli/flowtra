import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createMotionSwapVideoTask, MOTION_SWAP_MODE } from '@/lib/motion-swap-workflow';
import { refundCredits } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface KieWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'waiting';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: KieWebhookPayload = await request.json();
    const { data } = payload;
    const { taskId, state, resultJson, failMsg } = data;

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): motion_swap_projects
    // Schema verified via Supabase MCP (2026-02-01): motion_swap_projects
    const { data: project, error } = await supabase
      .from('motion_swap_projects')
      .select('*')
      .eq('preview_task_id', taskId)
      .single();

    if (error || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 200 });
    }

    if (project.preview_webhook_received_at) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    let previewUrl: string | undefined;
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        previewUrl = parsed.resultUrls?.[0];
      } catch (parseError) {
        console.error('[Motion Swap Preview Webhook] Failed to parse resultJson:', parseError);
      }
    }

    if (payload.code === 200 && state === 'success' && previewUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!baseUrl) {
        return NextResponse.json({ success: false, error: 'Missing base URL' }, { status: 200 });
      }

      await supabase
        .from('motion_swap_projects')
        .update({
          preview_image_url: previewUrl,
          preview_webhook_received_at: new Date().toISOString(),
          status: 'generating_video',
          progress_percentage: 60
        })
        .eq('id', project.id);

      const referenceVideoUrl = project.reference_video_cdn_url || project.reference_video_url;
      if (!referenceVideoUrl) {
        await supabase
          .from('motion_swap_projects')
          .update({
            status: 'failed',
            error_message: 'Reference video URL is missing',
            preview_webhook_received_at: new Date().toISOString(),
            progress_percentage: 0
          })
          .eq('id', project.id);

        if (project.generation_credits_used > 0) {
          await refundCredits(project.user_id, project.generation_credits_used, 'Motion Swap reference video missing', project.id);
        }

        return NextResponse.json({ success: false }, { status: 200 });
      }

      try {
        const callbackUrl = new URL('/api/motion-swap/webhooks/video', baseUrl).toString();
        const videoTaskId = await createMotionSwapVideoTask({
          previewImageUrl: previewUrl,
          referenceVideoUrl,
          mode: MOTION_SWAP_MODE,
          prompt: project.video_prompt || undefined
        }, callbackUrl);

        await supabase
          .from('motion_swap_projects')
          .update({
            video_task_id: videoTaskId,
            progress_percentage: 75
          })
          .eq('id', project.id);

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (taskError) {
        console.error('[Motion Swap Preview Webhook] Failed to start video task:', taskError);
        await supabase
          .from('motion_swap_projects')
          .update({
            status: 'failed',
            error_message: taskError instanceof Error ? taskError.message : 'Failed to start video task',
            preview_webhook_received_at: new Date().toISOString(),
            progress_percentage: 0
          })
          .eq('id', project.id);

        if (project.generation_credits_used > 0) {
          await refundCredits(project.user_id, project.generation_credits_used, 'Motion Swap video task failed', project.id);
        }

        return NextResponse.json({ success: false }, { status: 200 });
      }
    }

    await supabase
      .from('motion_swap_projects')
      .update({
        status: 'failed',
        error_message: failMsg || 'Preview generation failed',
        preview_webhook_received_at: new Date().toISOString(),
        progress_percentage: 0
      })
      .eq('id', project.id);

    if (project.generation_credits_used > 0) {
      await refundCredits(project.user_id, project.generation_credits_used, 'Motion Swap preview failed', project.id);
    }

    return NextResponse.json({ success: false }, { status: 200 });
  } catch (error) {
    console.error('[Motion Swap Preview Webhook] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
  }
}
