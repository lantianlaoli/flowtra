import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import { buildSegmentStatusPayload, startSegmentVideoTask, type SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function refreshProjectSegmentStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectId: string
) {
  const { data: allSegments } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  if (!allSegments || allSegments.length === 0) return;

  const segmentStatus = buildSegmentStatusPayload(
    allSegments as CompetitorUgcReplicationSegment[],
    null
  );

  // Schema verified via Supabase MCP (2025-03-08):
  // competitor_ugc_replication_projects has segment_status, last_processed_at.
  await supabase
    .from('competitor_ugc_replication_projects')
    .update({
      segment_status: segmentStatus,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

/**
 * Unified Video Webhook Payload
 * Supports both Veo3 format and Seedance format (generic jobs API)
 * Documentation: docs/kie/callback.md (Veo3), docs/kie/seedance1.5pro.md (Seedance)
 */
interface KIEVideoWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;

    // Veo3 format
    info?: {
      resultUrls?: string[];
      originUrls?: string[];
      resolution?: string;
    };
    fallbackFlag?: boolean;

    // Seedance/Generic jobs format (same as frame webhook)
    state?: 'waiting' | 'success' | 'fail';
    resultJson?: string; // JSON string: {resultUrls: [...]}
    failCode?: string;
    failMsg?: string;
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
    const { taskId, info, fallbackFlag, resultJson } = data;

    console.log('[UGC Video Webhook] Received:', { taskId, code });

    // Security validation: Check if taskId exists in database (segment-level)
    const supabase = getSupabaseAdmin();
    const { data: segment, error: segmentError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('id, project_id, segment_index, status, video_webhook_received_at, first_frame_url, closing_frame_url, prompt, retry_count')
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

    // Extract video URL from either format
    let videoUrl: string | undefined;

    // Format 1: Veo3 format (info.resultUrls)
    if (info?.resultUrls?.[0]) {
      videoUrl = info.resultUrls[0];
      console.log('[UGC Video Webhook] Extracted videoUrl from Veo3 format');
    }
    // Format 2: Seedance format (resultJson)
    else if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        videoUrl = parsed.resultUrls?.[0];
        console.log('[UGC Video Webhook] Extracted videoUrl from Seedance format');
      } catch (parseError) {
        console.error('[UGC Video Webhook] Failed to parse resultJson:', parseError);
      }
    }

    console.log('[UGC Video Webhook] Extracted videoUrl:', videoUrl ? 'Found' : 'Missing');

    // Update segment based on webhook status
    // Success: code 200 and video URL present (works for both formats)
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
          .select('*')
          .eq('project_id', segment.project_id)
          .order('segment_index', { ascending: true });

        const allVideosReady = allSegments?.every(s => s.video_url);

        // CRITICAL: Update segment_status whenever segments change
        if (allSegments && allSegments.length > 0) {
          const segmentStatus = buildSegmentStatusPayload(
            allSegments as CompetitorUgcReplicationSegment[],
            null // mergedVideoUrl - not merged yet
          );

          await supabase
            .from('competitor_ugc_replication_projects')
            .update({
              segment_status: segmentStatus,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', segment.project_id);

          console.log(`✅ [UGC Video Webhook] Updated segment_status for project ${segment.project_id}:`, {
            videosReady: segmentStatus.videosReady,
            total: segmentStatus.total
          });
        }

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

    } else if (code === 400 || code === 422 || code === 500 || code === 501 || code === 503) {
      // Failure case
      console.error('[UGC Video Webhook] Video generation failed for segment', segment.segment_index, {
        code,
        msg
      });

      // Determine if error is retryable (server errors only)
      const MAX_RETRIES = 3;
      const currentRetryCount = segment.retry_count || 0;
      const isRetryable = code >= 500 && currentRetryCount < MAX_RETRIES;

      // Schema verified via Supabase MCP (2025-03-08):
      // competitor_ugc_replication_segments has retry_count, status, error_message, video_task_id, video_webhook_received_at.
      if (isRetryable) {
        const nextRetryCount = currentRetryCount + 1;
        console.log(`🔄 [UGC Video Webhook] Retrying segment ${segment.segment_index} (attempt ${nextRetryCount}/${MAX_RETRIES})`);

        await supabase
          .from('competitor_ugc_replication_segments')
          .update({
            retry_count: nextRetryCount,
            status: 'generating_video',
            error_message: null,
            video_webhook_received_at: null
          })
          .eq('id', segment.id);

        try {
          const { data: project } = await supabase
            .from('competitor_ugc_replication_projects')
            .select('*')
            .eq('id', segment.project_id)
            .single();

          if (!project) {
            throw new Error('Project not found for retry');
          }

          if (!segment.first_frame_url || !segment.prompt) {
            throw new Error('Missing first frame or prompt for retry');
          }

          const segmentPrompt = segment.prompt as SegmentPrompt;
          const taskId = await startSegmentVideoTask(
            project as SingleVideoProject,
            segmentPrompt,
            segment.first_frame_url,
            segment.closing_frame_url,
            segment.segment_index,
            project.segment_count
          );

          await supabase
            .from('competitor_ugc_replication_segments')
            .update({
              video_task_id: taskId,
              video_webhook_received_at: null,
              error_message: null,
              status: 'generating_video'
            })
            .eq('id', segment.id);

          console.log(`✅ [UGC Video Webhook] Retry triggered, new taskId: ${taskId}`);
        } catch (retryError) {
          console.error('[UGC Video Webhook] Retry failed:', retryError);
          await supabase
            .from('competitor_ugc_replication_segments')
            .update({
              status: 'failed',
              error_message: `Retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
              video_webhook_received_at: new Date().toISOString()
            })
            .eq('id', segment.id);
        }
      } else {
        const errorMessage = currentRetryCount >= MAX_RETRIES
          ? `Video generation failed after ${MAX_RETRIES} retries: ${msg}`
          : `Video generation failed (non-retryable): ${msg}`;

        const { error: updateError } = await supabase
          .from('competitor_ugc_replication_segments')
          .update({
            status: 'failed',
            error_message: errorMessage,
            video_webhook_received_at: new Date().toISOString()
          })
          .eq('id', segment.id);

        if (updateError) {
          console.error('[UGC Video Webhook] Failed to update segment:', updateError);
        }
      }

      await refreshProjectSegmentStatus(supabase, segment.project_id);

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
