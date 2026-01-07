import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createSmartSegmentFrame, type SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Generation Webhook Payload
 * Documentation: docs/kie/nano_banana_pro.md
 */
interface KIEImageWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'waiting';
    resultJson?: string; // JSON string containing {resultUrls: [...]}
    failCode?: string;
    failMsg?: string;
  };
}

/**
 * POST /api/competitor-ugc-replication/webhooks/frame
 *
 * Receives webhook callbacks from KIE API when first frame generation completes.
 * This endpoint is called by KIE after frame generation (success or failure).
 *
 * Key responsibilities:
 * 1. Update segment with frame URL
 * 2. Trigger continuation dependency (next segment if waiting)
 * 3. Check if all frames ready → update project status
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses first_frame_webhook_received_at timestamp to prevent duplicate processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: KIEImageWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, state, resultJson, failCode, failMsg } = data;

    console.log('[UGC Frame Webhook] Received:', { taskId, code, state });

    // Security validation: Check if taskId exists in database
    const supabase = getSupabaseAdmin();
    const { data: segment, error: fetchError } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('id, project_id, segment_index, status, first_frame_webhook_received_at')
      .eq('first_frame_task_id', taskId)
      .single();

    if (fetchError || !segment) {
      console.warn('[UGC Frame Webhook] Task not found:', taskId);
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (segment.first_frame_webhook_received_at) {
      console.log('[UGC Frame Webhook] Already processed:', taskId);
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    // Parse result URL from resultJson
    let imageUrl: string | undefined;
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        imageUrl = parsed.resultUrls?.[0];
      } catch (parseError) {
        console.error('[UGC Frame Webhook] Failed to parse resultJson:', parseError);
      }
    }

    // Update segment based on webhook status
    if (code === 200 && state === 'success' && imageUrl) {
      // Success case: Update segment with frame URL
      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          first_frame_url: imageUrl,
          status: 'first_frame_ready',
          first_frame_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error('[UGC Frame Webhook] Failed to update segment:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      console.log(`✅ [UGC Frame Webhook] Segment ${segment.segment_index} frame ready`);

      // CRITICAL: Update previous segment's closing_frame_url
      // This ensures smooth visual transitions between segments
      if (segment.segment_index > 0 && imageUrl) {
        const prevSegmentIndex = segment.segment_index - 1;
        const { error: closingFrameError } = await supabase
          .from('competitor_ugc_replication_segments')
          .update({
            closing_frame_url: imageUrl
          })
          .eq('project_id', segment.project_id)
          .eq('segment_index', prevSegmentIndex);

        if (closingFrameError) {
          console.error(`[UGC Frame Webhook] Failed to update segment ${prevSegmentIndex} closing_frame_url:`, closingFrameError);
        } else {
          console.log(`✅ [UGC Frame Webhook] Updated segment ${prevSegmentIndex} closing_frame_url with segment ${segment.segment_index} first frame`);
        }
      }

      // Get project and all segments to check status
      const { data: project } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('id, segment_count, is_segmented')
        .eq('id', segment.project_id)
        .single();

      if (project) {
        // Fetch all segments for this project
        const { data: allSegments } = await supabase
          .from('competitor_ugc_replication_segments')
          .select('id, segment_index, status, first_frame_url')
          .eq('project_id', segment.project_id)
          .order('segment_index', { ascending: true });

        if (allSegments) {
          // Check if all segments have frames ready
          const allFramesReady = allSegments.every(s => s.first_frame_url);

          if (allFramesReady) {
            // All frames ready - update project status
            console.log(`✅ [UGC Frame Webhook] All ${allSegments.length} frames ready for project ${segment.project_id}`);

            await supabase
              .from('competitor_ugc_replication_projects')
              .update({
                status: 'segment_frames_ready',
                current_step: 'reviewing_segment_frames',
                progress_percentage: 70
              })
              .eq('id', segment.project_id);
          } else {
            // Not all ready yet - continue waiting
            console.log(`[UGC Frame Webhook] Waiting for remaining frames: ${allSegments.filter(s => !s.first_frame_url).length} pending`);
          }

          // ✅ Pure Event-Driven: Trigger next segment directly (no polling needed)
          // CRITICAL: Must await continuation before webhook returns to prevent Vercel from killing process
          if (project.is_segmented && segment.segment_index < (project.segment_count - 1)) {
            const nextSegmentIndex = segment.segment_index + 1;
            const nextSegment = allSegments.find(s => s.segment_index === nextSegmentIndex);

            if (nextSegment && nextSegment.status === 'awaiting_prev_first_frame') {
              console.log(`🔄 [UGC Frame Webhook] Triggering continuation for segment ${nextSegmentIndex}`);

              try {
                // Fetch full project details for frame generation
                const { data: fullProject } = await supabase
                  .from('competitor_ugc_replication_projects')
                  .select('*')
                  .eq('id', segment.project_id)
                  .single();

                if (!fullProject) {
                  throw new Error('Project not found for continuation');
                }

                // Fetch next segment's prompt
                const { data: nextSegmentData } = await supabase
                  .from('competitor_ugc_replication_segments')
                  .select('*')
                  .eq('id', nextSegment.id)
                  .single();

                if (!nextSegmentData || !nextSegmentData.prompt) {
                  throw new Error('Next segment prompt not found');
                }

                const segmentPrompt = nextSegmentData.prompt as SegmentPrompt;
                const aspectRatio = (fullProject.video_aspect_ratio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';
                const brandLogoUrl = fullProject.brand_logo_url as string | null;
                const productImageUrls = fullProject.product_image_urls as string[] | null;
                const competitorFileType = fullProject.competitor_file_type as 'video' | null;

                // Mark as generating
                await supabase
                  .from('competitor_ugc_replication_segments')
                  .update({
                    status: 'generating_first_frame'
                  })
                  .eq('id', nextSegment.id);

                // ✅ Direct API call: Generate next segment's first frame
                const taskId = await createSmartSegmentFrame(
                  segmentPrompt,
                  nextSegmentIndex,
                  'first',
                  aspectRatio,
                  brandLogoUrl,
                  productImageUrls,
                  undefined, // brandContext - not needed for continuation
                  competitorFileType,
                  undefined, // overrides
                  imageUrl // Use current segment's first frame as continuation reference
                );

                // Save task ID
                await supabase
                  .from('competitor_ugc_replication_segments')
                  .update({
                    first_frame_task_id: taskId
                  })
                  .eq('id', nextSegment.id);

                console.log(`✅ [UGC Frame Webhook] Continuation triggered for segment ${nextSegmentIndex}, taskId: ${taskId}`);
              } catch (error) {
                console.error(`❌ [UGC Frame Webhook] Failed to trigger continuation for segment ${nextSegmentIndex}:`, error);
                // Mark segment as failed
                await supabase
                  .from('competitor_ugc_replication_segments')
                  .update({
                    status: 'failed',
                    error_message: error instanceof Error ? error.message : 'Continuation trigger failed'
                  })
                  .eq('id', nextSegment.id);
              }
            }
          }
        }
      }

    } else if (state === 'fail' || code !== 200) {
      // Failure case
      console.error('[UGC Frame Webhook] Frame generation failed:', {
        failCode,
        failMsg,
        msg
      });

      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          status: 'failed',
          error_message: failMsg || msg || 'Frame generation failed',
          first_frame_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);

      if (updateError) {
        console.error('[UGC Frame Webhook] Failed to update segment:', updateError);
      }

      // Also update project to failed if first segment fails
      if (segment.segment_index === 0) {
        await supabase
          .from('competitor_ugc_replication_projects')
          .update({
            status: 'failed',
            error_message: failMsg || msg || 'Frame generation failed'
          })
          .eq('id', segment.project_id);
      }
    } else {
      // Mark as received even if unexpected state to prevent retries
      await supabase
        .from('competitor_ugc_replication_segments')
        .update({
          first_frame_webhook_received_at: new Date().toISOString()
        })
        .eq('id', segment.id);
    }

    // Always return 200 to acknowledge receipt (prevents KIE retries)
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[UGC Frame Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
