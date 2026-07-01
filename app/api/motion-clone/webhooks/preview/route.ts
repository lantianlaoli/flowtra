import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createMotionCloneVideoTask } from '@/lib/motion-clone-workflow';
import { refundCredits } from '@/lib/credits';
import { SEEDANCE_VIDEO_MODELS, normalizeMotionCloneQuality, type VideoModel } from '@/lib/constants';
import { replaceMentionsForPlainText } from '@/lib/video-clone-prompt-compiler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const normalizeMotionCloneVideoModel = (value: unknown): VideoModel => (
  typeof value === 'string' && SEEDANCE_VIDEO_MODELS.includes(value as VideoModel)
    ? value as VideoModel
    : 'seedance_2_mini'
);

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

    // Schema verified via Supabase MCP (2026-02-01): motion_clone_projects
    // Schema verified via Supabase MCP (2026-02-01): motion_clone_projects
    const { data: project, error } = await supabase
      .from('motion_clone_projects')
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
        console.error('[Motion Clone Preview Webhook] Failed to parse resultJson:', parseError);
      }
    }

    if (payload.code === 200 && state === 'success' && previewUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (!baseUrl) {
        return NextResponse.json({ success: false, error: 'Missing base URL' }, { status: 200 });
      }

      // Check if auto_generate_video is enabled
      const shouldAutoGenerateVideo = project.auto_generate_video === true;

      if (!shouldAutoGenerateVideo) {
        // Image-only mode: mark preview as ready and wait for user to manually trigger video generation
        await supabase
          .from('motion_clone_projects')
          .update({
            preview_image_url: previewUrl,
            preview_webhook_received_at: new Date().toISOString(),
            status: 'preview_ready',
            progress_percentage: 50
          })
          .eq('id', project.id);

        return NextResponse.json({ success: true }, { status: 200 });
      }

      // Auto-generate video mode: proceed with video generation
      await supabase
        .from('motion_clone_projects')
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
          .from('motion_clone_projects')
          .update({
            status: 'failed',
            error_message: 'Reference video URL is missing',
            preview_webhook_received_at: new Date().toISOString(),
            progress_percentage: 0
          })
          .eq('id', project.id);

        if (project.generation_credits_used > 0) {
          await refundCredits(project.user_id, project.generation_credits_used, 'Motion Clone reference video missing', project.id);
        }

        return NextResponse.json({ success: false }, { status: 200 });
      }

      try {
        const compiledVideoPrompt = project.video_prompt
          ? replaceMentionsForPlainText(project.video_prompt)
          : undefined;

        const callbackUrl = new URL('/api/motion-clone/webhooks/video', baseUrl).toString();
        const videoTaskId = await createMotionCloneVideoTask({
          previewImageUrl: previewUrl,
          referenceVideoUrl,
          referenceDurationSeconds: project.reference_duration_seconds,
          videoModel: normalizeMotionCloneVideoModel(project.video_model),
          mode: normalizeMotionCloneQuality(project.mode),
          prompt: compiledVideoPrompt,
          moderationExternalId: `user_${project.user_id}:motion_clone_${project.id}:video`,
        }, callbackUrl);

        await supabase
          .from('motion_clone_projects')
          .update({
            video_task_id: videoTaskId,
            progress_percentage: 75
          })
          .eq('id', project.id);

        return NextResponse.json({ success: true }, { status: 200 });
      } catch (taskError) {
        console.error('[Motion Clone Preview Webhook] Failed to start video task:', taskError);
        await supabase
          .from('motion_clone_projects')
          .update({
            status: 'failed',
            error_message: taskError instanceof Error ? taskError.message : 'Failed to start video task',
            preview_webhook_received_at: new Date().toISOString(),
            progress_percentage: 0
          })
          .eq('id', project.id);

        if (project.generation_credits_used > 0) {
          await refundCredits(project.user_id, project.generation_credits_used, 'Motion Clone video task failed', project.id);
        }

        return NextResponse.json({ success: false }, { status: 200 });
      }
    }

    await supabase
      .from('motion_clone_projects')
      .update({
        status: 'failed',
        error_message: failMsg || 'Preview generation failed',
        preview_webhook_received_at: new Date().toISOString(),
        progress_percentage: 0
      })
      .eq('id', project.id);

    if (project.generation_credits_used > 0) {
      await refundCredits(project.user_id, project.generation_credits_used, 'Motion Clone preview failed', project.id);
    }

    return NextResponse.json({ success: false }, { status: 200 });
  } catch (error) {
    console.error('[Motion Clone Preview Webhook] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 });
  }
}
