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
    const payload: KIEVideoWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, info, fallbackFlag } = data;

    // Security validation: Check if taskId exists in database (scene-level)
    const supabase = getSupabaseAdmin();
    const { data: scene, error: sceneError } = await supabase
      .from('avatar_ads_scenes')
      .select('id, project_id, scene_number, status, webhook_received_at')
      .eq('kie_video_task_id', taskId)
      .single();

    if (sceneError || !scene) {
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (scene.webhook_received_at) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const videoUrl = info?.resultUrls?.[0];

    // Update scene based on webhook status
    if (code === 200 && videoUrl) {
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

      // ✅ Event-Driven: Check if all scenes completed, finalize project immediately
      const { data: allScenes } = await supabase
        .from('avatar_ads_scenes')
        .select('status, video_url')
        .eq('project_id', scene.project_id)
        .order('scene_number', { ascending: true });

      const allCompleted = allScenes?.every(s => s.status === 'completed');

      if (allCompleted && allScenes && allScenes.length > 0) {
        // Get full project data
        const { data: project } = await supabase
          .from('avatar_ads_projects')
          .select('*')
          .eq('id', scene.project_id)
          .single();

        if (project && project.status === 'generating_videos') {
          // Single scene: No merge needed, directly use the video URL
          if (allScenes.length === 1) {
            const singleVideoUrl = allScenes[0].video_url;

            await supabase
              .from('avatar_ads_projects')
              .update({
                merged_video_url: singleVideoUrl,
                status: 'completed',
                progress_percentage: 100,
                current_step: 'completed',
                last_processed_at: new Date().toISOString()
              })
              .eq('id', scene.project_id);

            console.log(`✅ [Avatar Ads Video Webhook] Single scene project ${scene.project_id} completed without merge`);
          } else {
            // Multiple scenes: Trigger merge step (non-blocking)
            (async () => {
              try {
                const { processAvatarAdsProject } = await import('@/lib/avatar-ads-workflow');
                await processAvatarAdsProject(project, 'merge_videos');
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
