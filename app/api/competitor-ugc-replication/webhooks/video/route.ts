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
 * POST /api/competitor-ugc-replication/webhooks/video
 *
 * Receives webhook callbacks from KIE API when video generation completes.
 * This endpoint is called by KIE after video generation (success or failure).
 *
 * Key responsibilities:
 * 1. Update segment with video URL
 * 2. Update closing_frame_url of previous segment
 * 3. Check if all videos ready → update project status to 'awaiting_merge'
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses video_webhook_received_at timestamp to prevent duplicate processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: KIEVideoWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, info, fallbackFlag } = data;

    console.log('[UGC Video Webhook] Received:', { taskId, code });

    // Security validation: Check if taskId exists in database (segment-level)
    const supabase = getSupabaseAdmin();
    const { data: segment, error: segmentError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('id, project_id, segment_index, status, video_webhook_received_at, first_frame_url')
      .eq('video_task_id', taskId)
      .single();

    if (segmentError || !segment) {
      console.warn('[UGC Video Webhook] Task not found:', taskId);
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (segment.video_webhook_received_at) {
      console.log('[UGC Video Webhook] Already processed:', taskId);
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const videoUrl = info?.resultUrls?.[0];

    // Update segment based on webhook status
    if (code === 200 && videoUrl) {
      // Success case: Update segment with video URL
      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          video_url: videoUrl,
          status: 'video_ready',
          video_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error('[UGC Video Webhook] Failed to update segment:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      console.log(`✅ [UGC Video Webhook] Segment ${segment.segment_index} video ready`);

      // Update project last_processed_at to keep workflow active
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', segment.project_id);

      // Update closing_frame_url of previous segment (if exists)
      if (segment.segment_index > 0 && segment.first_frame_url) {
        const prevSegmentIndex = segment.segment_index - 1;
        await supabase
          .from('competitor_ugc_replication_segments')
          .update({
            closing_frame_url: segment.first_frame_url
          })
          .eq('project_id', segment.project_id)
          .eq('segment_index', prevSegmentIndex);
      }

      // Get project info and all segments
      const { data: project } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id, segment_count, is_segmented, status')
        .eq('id', segment.project_id)
        .single();

      if (project) {
        // Check if all segments have videos
        const { data: allSegments } = await supabase
          .from('competitor_ugc_replication_segments')
          .select('id, segment_index, status, video_url')
          .eq('project_id', segment.project_id)
          .order('segment_index', { ascending: true });

        const allVideosReady = allSegments?.every(s => s.video_url);

        if (allVideosReady && allSegments && allSegments.length > 0) {
          console.log(`✅ [UGC Video Webhook] All ${allSegments.length} videos ready for project ${segment.project_id}`);

          // Single segment: No merge needed, directly mark as completed
          if (allSegments.length === 1) {
            await supabase
              .from('competitor_ugc_replication_projects')
              .update({
                video_url: videoUrl,
                merged_video_url: videoUrl, // Use same URL for consistency
                status: 'completed',
                current_step: 'completed',
                progress_percentage: 100,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', segment.project_id);

            console.log(`✅ [UGC Video Webhook] Single segment project ${segment.project_id} completed without merge`);
          } else {
            // Multiple segments: Set status to awaiting_merge (user must trigger merge)
            await supabase
              .from('competitor_ugc_replication_projects')
              .update({
                status: 'awaiting_merge',
                current_step: 'merging_segments',
                progress_percentage: 90,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', segment.project_id);

            console.log(`✅ [UGC Video Webhook] Project ${segment.project_id} awaiting merge`);
          }
        }
      }

    } else if (code === 400 || code === 422 || code === 500 || code === 501) {
      // Failure case
      console.error('[UGC Video Webhook] Video generation failed for segment', segment.segment_index, {
        code,
        msg
      });

      // Determine if error is retryable (server errors only)
      const isRetryable = code === 500;

      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: isRetryable ? 'generating_video' : 'failed', // Keep generating if retryable
          error_message: msg,
          video_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error('[UGC Video Webhook] Failed to update segment:', updateError);
      }

      // Update project last_processed_at
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', segment.project_id);

    } else {
      // Mark as received even if unexpected code to prevent retries
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          video_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);
    }

    // Always return 200 to acknowledge receipt (prevents KIE retries)
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[UGC Video Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
