import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Video Generation Webhook Payload (Veo3)
 * Documentation: docs/kie/callback.md
 */
interface KIEVideoWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    info?: {
      resultUrls?: string[];
      originUrls?: string[];
      resolution?: string;
    };
    fallbackFlag?: boolean;
  };
}

/**
 * POST /api/avatar-ads/webhooks/video
 *
 * Receives webhook callbacks from KIE API when video generation completes.
 * This endpoint is called by KIE after video generation (success or failure).
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses webhook_received_at timestamp to prevent duplicate processing.
 * Scene-based: Updates individual scene records, not project-level.
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Avatar Ads Video Webhook] Received callback');

    const payload: KIEVideoWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, info, fallbackFlag } = data;

    console.log('[Avatar Ads Video Webhook] Payload:', {
      taskId,
      code,
      msg,
      hasResultUrls: !!info?.resultUrls,
      fallbackFlag
    });

    // Security validation: Check if taskId exists in database (scene-level)
    const supabase = getSupabaseAdmin();
    const { data: scene, error: sceneError } = await supabase
      .from('avatar_ads_scenes')
      .select('id, project_id, scene_number, status, webhook_received_at')
      .eq('kie_video_task_id', taskId)
      .single();

    if (sceneError || !scene) {
      console.warn('[Avatar Ads Video Webhook] Task ID not found in scenes table:', taskId);
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (scene.webhook_received_at) {
      console.log('[Avatar Ads Video Webhook] Already processed, ignoring duplicate');
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const videoUrl = info?.resultUrls?.[0];

    // Update scene based on webhook status
    if (code === 200 && videoUrl) {
      console.log('[Avatar Ads Video Webhook] Video generation succeeded for scene', scene.scene_number);

      const { error: updateError } = await supabase
        .from('avatar_ads_scenes')
        .update({
          video_url: videoUrl,
          status: 'completed',
          error_code: null,
          error_message: null,
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', scene.id);

      if (updateError) {
        console.error('[Avatar Ads Video Webhook] Failed to update scene:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      // Update project last_processed_at to keep workflow active
      await supabase
        .from('avatar_ads_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', scene.project_id);

      console.log('[Avatar Ads Video Webhook] Scene updated successfully');

      // ✅ Event-Driven: Check if all scenes completed, trigger merge immediately
      const { data: allScenes } = await supabase
        .from('avatar_ads_scenes')
        .select('status')
        .eq('project_id', scene.project_id);

      const allCompleted = allScenes?.every(s => s.status === 'completed');

      if (allCompleted) {
        console.log('[Avatar Ads Video Webhook] All scenes completed, triggering merge immediately');

        // Get full project data
        const { data: project } = await supabase
          .from('avatar_ads_projects')
          .select('*')
          .eq('id', scene.project_id)
          .single();

        if (project && project.status === 'generating_videos') {
          // Trigger merge step immediately (non-blocking)
          (async () => {
            try {
              const { processAvatarAdsProject } = await import('@/lib/avatar-ads-workflow');
              await processAvatarAdsProject(project, 'merge_videos');
              console.log(`✅ merge_videos completed for project ${scene.project_id}`);
            } catch (error) {
              console.error(`❌ merge_videos failed for project ${scene.project_id}:`, error);
              // Mark as failed so frontend gets update via Realtime
              await supabase
                .from('avatar_ads_projects')
                .update({
                  status: 'failed',
                  error_message: error instanceof Error ? error.message : 'Merge failed'
                })
                .eq('id', scene.project_id);
            }
          })();
        }
      }

    } else if (code === 400 || code === 422 || code === 500 || code === 501) {
      console.error('[Avatar Ads Video Webhook] Video generation failed for scene', scene.scene_number, {
        code,
        msg
      });

      // Determine if error is retryable (server errors only)
      const isRetryable = code === 500;

      const { error: updateError } = await supabase
        .from('avatar_ads_scenes')
        .update({
          status: isRetryable ? 'generating' : 'failed', // Keep generating if retryable
          error_code: String(code),
          error_message: msg,
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', scene.id);

      if (updateError) {
        console.error('[Avatar Ads Video Webhook] Failed to update scene:', updateError);
      }

      // Update project last_processed_at
      await supabase
        .from('avatar_ads_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', scene.project_id);

    } else {
      console.warn('[Avatar Ads Video Webhook] Unexpected webhook code:', { code, msg });
      // Mark as received even if unexpected code to prevent retries
      await supabase
        .from('avatar_ads_scenes')
        .update({
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', scene.id);
    }

    // Always return 200 to acknowledge receipt (prevents KIE retries)
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[Avatar Ads Video Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
