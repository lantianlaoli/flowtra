import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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
      .eq('video_task_id', taskId)
      .single();

    if (error || !project) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 200 });
    }

    if (project.video_webhook_received_at) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    let videoUrl: string | undefined;
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        videoUrl = parsed.resultUrls?.[0];
      } catch (parseError) {
        console.error('[Motion Swap Video Webhook] Failed to parse resultJson:', parseError);
      }
    }

    if (payload.code === 200 && state === 'success' && videoUrl) {
      await supabase
        .from('motion_swap_projects')
        .update({
          output_video_url: videoUrl,
          status: 'completed',
          progress_percentage: 100,
          video_webhook_received_at: new Date().toISOString()
        })
        .eq('id', project.id);

      return NextResponse.json({ success: true }, { status: 200 });
    }

    await supabase
      .from('motion_swap_projects')
      .update({
        status: 'failed',
        error_message: failMsg || 'Video generation failed',
        video_webhook_received_at: new Date().toISOString(),
        progress_percentage: 0
      })
      .eq('id', project.id);

    if (project.generation_credits_used > 0) {
      await refundCredits(project.user_id, project.generation_credits_used, 'Motion Swap video failed', project.id);
    }

    return NextResponse.json({ success: false }, { status: 200 });
  } catch (error) {
    console.error('[Motion Swap Video Webhook] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
  }
}
