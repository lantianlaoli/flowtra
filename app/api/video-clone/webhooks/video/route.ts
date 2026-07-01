import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, type VideoCloneSegment, type SingleVideoProject } from '@/lib/supabase';
import {
  buildSegmentStatusPayload,
  getFailedSegmentErrorMessage,
  getTerminalFailedCloneRefundAmount,
  isProjectAgentSeedanceReferenceImageProject,
  shouldRetryCloneVideoFailure,
  startSegmentVideoTask,
  type SegmentPrompt
} from '@/lib/video-clone-workflow';
import { refundCredits } from '@/lib/credits';
import { isKlingPromptValidationError } from '@/lib/kling-prompt-budget';
import { mergeVideosWithFal } from '@/lib/video-merge';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function refreshProjectSegmentStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  projectId: string
) {
  const { data: allSegments } = await supabase
    .from('video_clone_segments')
    .select('*')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  if (!allSegments || allSegments.length === 0) return;

  const segmentStatus = buildSegmentStatusPayload(
    allSegments as VideoCloneSegment[],
    null
  );

  const failedSegmentError = getFailedSegmentErrorMessage(allSegments as VideoCloneSegment[]);

  let refundAmount = 0;
  if (failedSegmentError) {
    const { data: project } = await supabase
      .from('video_clone_projects')
      .select('id, user_id, status, generation_credits_used')
      .eq('id', projectId)
      .single();

    refundAmount = getTerminalFailedCloneRefundAmount(project || {});
    if (project && refundAmount > 0) {
      const refund = await refundCredits(
        project.user_id,
        refundAmount,
        'Video Clone - Auto-refund for terminal generation failure',
        project.id,
      );
      if (!refund.success) {
        console.error('[UGC Video Webhook] Failed to refund terminal failed project:', refund.error);
        refundAmount = 0;
      }
    }
  }

  // Schema verified via Supabase MCP (2025-03-08):
  // video_clone_projects has segment_status, last_processed_at, status, current_step, error_message.
  await supabase
    .from('video_clone_projects')
    .update({
      segment_status: segmentStatus,
      ...(failedSegmentError
        ? {
            status: 'failed',
            current_step: 'failed',
            error_message: failedSegmentError,
            ...(refundAmount > 0 ? { generation_credits_used: 0 } : {}),
          }
        : {}),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

/**
 * Unified Video Webhook Payload
 * Supports callback info format and generic jobs format.
 * Documentation: docs/kie/callback.md, docs/kie/seedance_2_doc.md
 */
interface KIEVideoWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;

    // Callback info format
    info?: {
      resultUrls?: string[];
      originUrls?: string[];
      resolution?: string;
    };
    fallbackFlag?: boolean;

    // Generic jobs format (same as frame webhook)
    state?: 'waiting' | 'success' | 'fail';
    resultJson?: string; // JSON string: {resultUrls: [...]}
    failCode?: string;
    failMsg?: string;
  };
}

function parseFallbackSegmentLocator(request: NextRequest): { projectId: string | null; segmentIndex: number | null } {
  const rawProjectId = request.nextUrl.searchParams.get('projectId');
  const rawSegmentIndex = request.nextUrl.searchParams.get('segmentIndex');
  const projectId = typeof rawProjectId === 'string' && rawProjectId.trim().length > 0
    ? rawProjectId.trim()
    : null;
  const parsedSegmentIndex = typeof rawSegmentIndex === 'string' && rawSegmentIndex.trim().length > 0
    ? Number(rawSegmentIndex)
    : NaN;
  const segmentIndex = Number.isFinite(parsedSegmentIndex) && parsedSegmentIndex >= 0
    ? parsedSegmentIndex
    : null;
  return { projectId, segmentIndex };
}

/**
 * POST /api/video-clone/webhooks/video
 *
 * Receives webhook callbacks from KIE API when video generation completes.
 * This endpoint is called by KIE after video generation (success or failure).
 *
 * Key responsibilities:
 * 1. Update segment with video URL
 * 2. Update closing_frame_url of previous segment
 * 3. Check if all videos ready → auto-start FAL merge for multi-segment projects
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses video_webhook_received_at timestamp to prevent duplicate processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: KIEVideoWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, info, fallbackFlag, resultJson, state, failCode, failMsg } = data;
    const normalizedTaskId = typeof taskId === 'string' ? taskId.trim() : '';
    const fallbackLocator = parseFallbackSegmentLocator(request);
    const webhookState = typeof state === 'string' ? state.toLowerCase() : '';

    console.log('[UGC Video Webhook] Received:', {
      taskId: normalizedTaskId || taskId,
      code,
      state: webhookState || 'unknown',
      fallbackProjectId: fallbackLocator.projectId,
      fallbackSegmentIndex: fallbackLocator.segmentIndex
    });

    // Security validation: Check if taskId exists in database (segment-level)
    const supabase = getSupabaseAdmin();
    let segment: {
      id: string;
      project_id: string;
      segment_index: number;
      status: string | null;
      video_webhook_received_at: string | null;
      first_frame_url: string | null;
      closing_frame_url: string | null;
      prompt: SegmentPrompt | null;
      retry_count: number | null;
      video_task_id?: string | null;
    } | null = null;

    const { data: segmentByTaskId, error: segmentError } = await supabase
      .from('video_clone_segments')
      .select('id, project_id, segment_index, status, video_webhook_received_at, first_frame_url, closing_frame_url, prompt, retry_count, video_task_id')
      .eq('video_task_id', normalizedTaskId)
      .single();
    segment = segmentByTaskId;

    if (segmentError || !segment) {
      if (fallbackLocator.projectId && fallbackLocator.segmentIndex !== null) {
        const { data: fallbackSegment, error: fallbackError } = await supabase
          .from('video_clone_segments')
          .select('id, project_id, segment_index, status, video_webhook_received_at, first_frame_url, closing_frame_url, prompt, retry_count, video_task_id')
          .eq('project_id', fallbackLocator.projectId)
          .eq('segment_index', fallbackLocator.segmentIndex)
          .single();

        if (!fallbackError && fallbackSegment) {
          if (fallbackSegment.video_task_id && fallbackSegment.video_task_id !== normalizedTaskId) {
            console.warn('[UGC Video Webhook] Stale task callback ignored:', {
              taskId: normalizedTaskId,
              expectedTaskId: fallbackSegment.video_task_id,
              projectId: fallbackLocator.projectId,
              segmentIndex: fallbackLocator.segmentIndex
            });
            return NextResponse.json({ success: true, message: 'Stale callback ignored' }, { status: 200 });
          }
          segment = fallbackSegment;
          console.log('[UGC Video Webhook] Resolved segment via fallback locator:', {
            projectId: fallbackSegment.project_id,
            segmentIndex: fallbackSegment.segment_index
          });
        }
      }
    }

    if (!segment) {
      console.warn('[UGC Video Webhook] Task not found:', {
        taskId: normalizedTaskId,
        fallbackProjectId: fallbackLocator.projectId,
        fallbackSegmentIndex: fallbackLocator.segmentIndex
      });
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

    // Format 1: info.resultUrls
    if (info?.resultUrls?.[0]) {
      videoUrl = info.resultUrls[0];
      console.log('[UGC Video Webhook] Extracted videoUrl from callback info format');
    }
    // Format 2: generic jobs resultJson
    else if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        videoUrl = parsed.resultUrls?.[0];
        console.log('[UGC Video Webhook] Extracted videoUrl from generic jobs resultJson');
      } catch (parseError) {
        console.error('[UGC Video Webhook] Failed to parse resultJson:', parseError);
      }
    }

    console.log('[UGC Video Webhook] Extracted videoUrl:', videoUrl ? 'Found' : 'Missing');

    // Update segment based on webhook status
    // Success: code 200 and video URL present (works for both formats)
    const isSuccess = code === 200 && webhookState !== 'fail' && Boolean(videoUrl);
    const shouldTreatAsFailure = webhookState === 'fail' || (
      webhookState !== 'waiting' && (
        code === 400 ||
        code === 422 ||
        code === 500 ||
        code === 501 ||
        code === 503 ||
        (code === 200 && !videoUrl)
      )
    );

    if (isSuccess) {
      // Success case: Update segment with video URL
      const { error: updateError } = await supabase
        .from('video_clone_segments')
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
      captureServerEvent(ANALYTICS_EVENTS.ugc_clone_video_generation_completed, {
        request,
        properties: {
          feature: 'ugc_clone',
          surface: 'ugc_video_webhook',
          project_id: segment.project_id,
          segment_index: segment.segment_index,
        }
      });

      // Update project last_processed_at to keep workflow active
      await supabase
        .from('video_clone_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', segment.project_id);

      // Update closing_frame_url of previous segment (if exists)
      if (segment.segment_index > 0 && segment.first_frame_url) {
        const prevSegmentIndex = segment.segment_index - 1;
        await supabase
          .from('video_clone_segments')
          .update({
            closing_frame_url: segment.first_frame_url
          })
          .eq('project_id', segment.project_id)
          .eq('segment_index', prevSegmentIndex);
      }

      // Get project info and all segments
      const { data: project } = await supabase
        .from('video_clone_projects')
        .select('id, segment_count, is_segmented, status, fal_merge_task_id, video_aspect_ratio, selected_inputs')
        .eq('id', segment.project_id)
        .single();

      if (project) {
        // Check if all segments have videos
        const { data: allSegments } = await supabase
          .from('video_clone_segments')
          .select('*')
          .eq('project_id', segment.project_id)
          .order('segment_index', { ascending: true });

        const allVideosReady = allSegments?.every(s => s.video_url);

        // CRITICAL: Update segment_status whenever segments change
        if (allSegments && allSegments.length > 0) {
          const segmentStatus = buildSegmentStatusPayload(
            allSegments as VideoCloneSegment[],
            null // mergedVideoUrl - not merged yet
          );

          await supabase
            .from('video_clone_projects')
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
              .from('video_clone_projects')
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
            const selectedInputs = (project.selected_inputs && typeof project.selected_inputs === 'object')
              ? project.selected_inputs as Record<string, unknown>
              : null;
            const workflowSource = typeof selectedInputs?.workflowSource === 'string' ? selectedInputs.workflowSource : '';
            const mergePolicy = typeof selectedInputs?.mergePolicy === 'string' ? selectedInputs.mergePolicy : '';
            const requireManualMerge = workflowSource === 'project_agent_clone' && mergePolicy === 'manual_confirm';

            if (requireManualMerge) {
              await supabase
                .from('video_clone_projects')
                .update({
                  status: 'awaiting_merge',
                  current_step: 'awaiting_merge',
                  progress_percentage: 90,
                  fal_merge_task_id: null,
                  last_processed_at: new Date().toISOString()
                })
                .eq('id', segment.project_id);

              console.log(`✅ [UGC Video Webhook] Project ${segment.project_id} is awaiting manual merge confirmation`);
              return NextResponse.json({ success: true, message: 'Awaiting manual merge confirmation' }, { status: 200 });
            }

            // Multiple segments: auto-start merge as soon as all segment videos are ready.
            if (project.fal_merge_task_id) {
              console.log(`ℹ️ [UGC Video Webhook] Merge already started for project ${segment.project_id}: ${project.fal_merge_task_id}`);
            } else {
              try {
                const segmentVideoUrls = (allSegments as VideoCloneSegment[])
                  .map(seg => seg.video_url)
                  .filter((url): url is string => typeof url === 'string' && url.length > 0);

                if (segmentVideoUrls.length !== allSegments.length) {
                  throw new Error('Cannot start merge: one or more segment video URLs are missing.');
                }

                const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
                const { taskId: mergeTaskId } = await mergeVideosWithFal(
                  segmentVideoUrls,
                  aspectRatio,
                  '/api/video-clone/webhooks/merge'
                );

                await supabase
                  .from('video_clone_projects')
                  .update({
                    status: 'processing',
                    current_step: 'merging_segments',
                    progress_percentage: 95,
                    fal_merge_task_id: mergeTaskId,
                    last_processed_at: new Date().toISOString()
                  })
                  .eq('id', segment.project_id);

                console.log(`✅ [UGC Video Webhook] Started merge for project ${segment.project_id}, taskId=${mergeTaskId}`);
              } catch (mergeError) {
                console.error(`❌ [UGC Video Webhook] Failed to auto-start merge for project ${segment.project_id}:`, mergeError);
                // Fallback to explicit awaiting-merge state so user/agent can trigger /merge manually.
                await supabase
                  .from('video_clone_projects')
                  .update({
                    status: 'awaiting_merge',
                    current_step: 'awaiting_merge',
                    progress_percentage: 90,
                    last_processed_at: new Date().toISOString()
                  })
                  .eq('id', segment.project_id);
              }
            }
          }
        }
      }

    } else if (shouldTreatAsFailure) {
      // Failure case
      const failureMessage = failMsg || msg || (code === 200 ? 'Video generation failed with empty result' : 'Video generation failed');
      const failureCode = failCode || String(code);
      captureServerEvent(ANALYTICS_EVENTS.ugc_clone_video_generation_failed, {
        request,
        properties: {
          feature: 'ugc_clone',
          surface: 'ugc_video_webhook',
          project_id: segment.project_id,
          segment_index: segment.segment_index,
          error_code: failureCode,
          error_message: failureMessage,
        }
      });
      console.error('[UGC Video Webhook] Video generation failed for segment', segment.segment_index, {
        code,
        state: webhookState || null,
        msg: failureMessage,
        failCode
      });

      // Determine if error is retryable (server errors only)
      const MAX_RETRIES = 3;
      const currentRetryCount = segment.retry_count || 0;
      const isRetryable = shouldRetryCloneVideoFailure({
        code,
        failCode,
        failMsg: failureMessage,
        retryCount: currentRetryCount,
        maxRetries: MAX_RETRIES,
      });

      // Schema verified via Supabase MCP (2025-03-08):
      // video_clone_segments has retry_count, status, error_message, video_task_id, video_webhook_received_at.
      if (isRetryable) {
        const nextRetryCount = currentRetryCount + 1;
        console.log(`🔄 [UGC Video Webhook] Retrying segment ${segment.segment_index} (attempt ${nextRetryCount}/${MAX_RETRIES})`);

        await supabase
          .from('video_clone_segments')
          .update({
            retry_count: nextRetryCount,
            status: 'generating_video',
            error_message: null,
            video_webhook_received_at: null
          })
          .eq('id', segment.id);

        try {
          const { data: project } = await supabase
            .from('video_clone_projects')
            .select('*')
            .eq('id', segment.project_id)
            .single();

          if (!project) {
            throw new Error('Project not found for retry');
          }

          const isSeedanceReferenceImageMode = isProjectAgentSeedanceReferenceImageProject(project as SingleVideoProject);

          if ((!isSeedanceReferenceImageMode && !segment.first_frame_url) || !segment.prompt) {
            throw new Error('Missing first frame or prompt for retry');
          }

          const segmentPrompt = segment.prompt as SegmentPrompt;
          const taskId = await startSegmentVideoTask(
            project as SingleVideoProject,
            segmentPrompt,
            isSeedanceReferenceImageMode ? null : segment.first_frame_url,
            isSeedanceReferenceImageMode ? null : segment.closing_frame_url,
            segment.segment_index,
            project.segment_count
          );

          await supabase
            .from('video_clone_segments')
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
            .from('video_clone_segments')
            .update({
              status: 'failed',
              error_message: isKlingPromptValidationError(retryError)
                ? (retryError instanceof Error ? retryError.message : 'Prompt validation failed during retry.')
                : `Retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`,
              video_webhook_received_at: new Date().toISOString()
            })
            .eq('id', segment.id);
        }
      } else {
        const errorMessage = failMsg
          ? failMsg
          : currentRetryCount >= MAX_RETRIES
          ? `Video generation failed after ${MAX_RETRIES} retries [provider_code=${failureCode}]: ${failureMessage}`
          : `Video generation failed (non-retryable) [provider_code=${failureCode}]: ${failureMessage}`;

        const { error: updateError } = await supabase
          .from('video_clone_segments')
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
        .from('video_clone_segments')
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
