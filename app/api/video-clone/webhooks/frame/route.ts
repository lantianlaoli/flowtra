import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  createSmartSegmentFrame,
  hydrateSerializedSegmentPrompt,
  resolveCloneModeFromProject,
  serializeSegmentPrompt,
  type SegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/video-clone-workflow';
import type { VideoModel } from '@/lib/constants';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Generation Webhook Payload
 * Documentation: docs/kie/nano-banana-2.md
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

type ProjectPromptContainer = {
  segment_plan?: Record<string, unknown> | null;
  video_prompts?: Record<string, unknown> | null;
};

const normalizeStringArray = (value: unknown, max = 10): string[] => {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || output.includes(trimmed)) continue;
    output.push(trimmed);
    if (output.length >= max) break;
  }
  return output;
};

const readCloneReferenceAssets = (projectData: Record<string, unknown> | null | undefined) => {
  const videoPrompts = projectData?.video_prompts;
  if (!videoPrompts || typeof videoPrompts !== 'object') {
    return { avatarPhotoUrls: [] as string[], productImageUrls: [] as string[] };
  }
  const assets = (videoPrompts as Record<string, unknown>).clone_reference_assets;
  if (!assets || typeof assets !== 'object') {
    return { avatarPhotoUrls: [] as string[], productImageUrls: [] as string[] };
  }
  const parsed = assets as Record<string, unknown>;
  return {
    avatarPhotoUrls: normalizeStringArray(parsed.avatarPhotoUrls, 4),
    productImageUrls: normalizeStringArray(parsed.productImageUrls, 8)
  };
};

function readSegmentPlanEntry(container: Record<string, unknown> | null | undefined, segmentIndex: number): Record<string, unknown> | null {
  if (!container || typeof container !== 'object') {
    return null;
  }
  const segments = Array.isArray((container as { segments?: unknown[] }).segments)
    ? ((container as { segments?: unknown[] }).segments || [])
    : [];
  const candidate = segments[segmentIndex];
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate as Record<string, unknown>;
}

function resolveSegmentPromptForIndex(
  segmentPromptRaw: unknown,
  projectData: ProjectPromptContainer | null | undefined,
  segmentIndex: number
): SegmentPrompt | null {
  if (segmentPromptRaw && typeof segmentPromptRaw === 'object') {
    return hydrateSerializedSegmentPrompt(
      segmentPromptRaw as SerializedSegmentPlanSegment,
      segmentIndex
    );
  }

  const fromSegmentPlan = readSegmentPlanEntry(projectData?.segment_plan, segmentIndex);
  if (fromSegmentPlan) {
    return hydrateSerializedSegmentPrompt(
      fromSegmentPlan as SerializedSegmentPlanSegment,
      segmentIndex
    );
  }

  const fromVideoPrompts = readSegmentPlanEntry(projectData?.video_prompts, segmentIndex);
  if (fromVideoPrompts) {
    return hydrateSerializedSegmentPrompt(
      fromVideoPrompts as SerializedSegmentPlanSegment,
      segmentIndex
    );
  }

  return null;
}

/**
 * POST /api/video-clone/webhooks/frame
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
      .from('video_clone_segments')
      .select('id, project_id, segment_index, status, first_frame_webhook_received_at, retry_count')
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
        .from('video_clone_segments')
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
      captureServerEvent(ANALYTICS_EVENTS.ugc_clone_frame_generation_completed, {
        request,
        properties: {
          feature: 'ugc_clone',
          surface: 'ugc_frame_webhook',
          project_id: segment.project_id,
          segment_index: segment.segment_index,
        }
      });

      // CRITICAL: Update previous segment's closing_frame_url
      // This ensures smooth visual transitions between segments
      if (segment.segment_index > 0 && imageUrl) {
        const prevSegmentIndex = segment.segment_index - 1;
        const { error: closingFrameError } = await supabase
          .from('video_clone_segments')
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
        .from('video_clone_projects')
        .select('id, segment_count, is_segmented')
        .eq('id', segment.project_id)
        .single();

      if (project) {
        // Fetch all segments for this project
        const { data: allSegments } = await supabase
          .from('video_clone_segments')
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
              .from('video_clone_projects')
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
                  .from('video_clone_projects')
                  .select('*')
                  .eq('id', segment.project_id)
                  .single();

                if (!fullProject) {
                  throw new Error('Project not found for continuation');
                }

                // Fetch next segment's prompt
                const { data: nextSegmentData } = await supabase
                  .from('video_clone_segments')
                  .select('*')
                  .eq('id', nextSegment.id)
                  .single();
                if (!nextSegmentData) {
                  throw new Error('Next segment row not found');
                }

                const segmentPrompt = resolveSegmentPromptForIndex(
                  nextSegmentData.prompt,
                  fullProject as ProjectPromptContainer,
                  nextSegmentIndex
                );
                if (!segmentPrompt) {
                  throw new Error(`Next segment prompt not found (segment ${nextSegmentIndex})`);
                }
                const aspectRatio = (fullProject.video_aspect_ratio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';
                const cloneReferenceAssets = readCloneReferenceAssets(fullProject as Record<string, unknown>);
                const productImageUrls = normalizeStringArray(
                  (fullProject as { product_image_urls?: unknown }).product_image_urls,
                  8
                );
                const mergedProductImageUrls = normalizeStringArray([
                  ...productImageUrls,
                  ...cloneReferenceAssets.productImageUrls
                ], 8);
                const cloneMode = resolveCloneModeFromProject(fullProject as Record<string, unknown>);
                const videoModel = (fullProject.video_model || 'veo3_fast') as VideoModel;
                const workflowSource = (
                  fullProject.selected_inputs
                  && typeof fullProject.selected_inputs === 'object'
                  && (fullProject.selected_inputs as { workflowSource?: unknown }).workflowSource === 'project_agent_clone'
                )
                  ? 'project_agent_clone'
                  : 'default';
                console.log('[UGC Frame Webhook] Continuation routing:', {
                  segmentIndex: nextSegmentIndex,
                  frameType: 'first',
                  isCloneMode: cloneMode.isCloneMode,
                  referenceSourceType: cloneMode.sourceType,
                  usesContinuationReference: true,
                  imageInputCount: mergedProductImageUrls.length + cloneReferenceAssets.avatarPhotoUrls.length + 1
                });

                // ✅ Direct API call: Generate next segment's first frame
                const taskId = await createSmartSegmentFrame(
                  segmentPrompt,
                  nextSegmentIndex,
                  'first',
                  aspectRatio,
                  mergedProductImageUrls.length > 0 ? mergedProductImageUrls : null,
                  cloneMode.mediaType,
                  {
                    characterPhotoUrls: cloneReferenceAssets.avatarPhotoUrls.length > 0
                      ? cloneReferenceAssets.avatarPhotoUrls
                      : null,
                    workflowSourceOverride: workflowSource
                  },
                  imageUrl, // Use current segment's first frame as continuation reference
                  videoModel
                );

                // Save task submission atomically so the UI only shows "generating"
                // after a real KIE task id exists.
                await supabase
                  .from('video_clone_segments')
                  .update({
                    status: 'generating_first_frame',
                    // Backfill prompt to prevent future continuation failures on the same segment.
                    prompt: serializeSegmentPrompt(segmentPrompt),
                    first_frame_task_id: taskId
                  })
                  .eq('id', nextSegment.id);

                console.log(`✅ [UGC Frame Webhook] Continuation triggered for segment ${nextSegmentIndex}, taskId: ${taskId}`);
              } catch (error) {
                console.error(`❌ [UGC Frame Webhook] Failed to trigger continuation for segment ${nextSegmentIndex}:`, error);
                // Mark segment as failed
                await supabase
                  .from('video_clone_segments')
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
      // Failure case - Check if we should retry
      const MAX_RETRIES = 3;
      const currentRetryCount = segment.retry_count || 0;
      const normalizedFailMsg = (failMsg || msg || '').toLowerCase();
      const isInternalRetryableMessage =
        normalizedFailMsg.includes('internal error') &&
        normalizedFailMsg.includes('please try again later');
      const shouldRetry = currentRetryCount < MAX_RETRIES && (
        failCode === '422' || // Invalid parameters - might be transient
        failCode === '500' ||
        failCode === '501' ||
        failCode === '503' ||
        code === 500 ||
        code === 501 ||
        code === 503 ||
        isInternalRetryableMessage
      );

      console.error('[UGC Frame Webhook] Frame generation failed:', {
        failCode,
        failMsg,
        msg,
        retryCount: currentRetryCount,
        willRetry: shouldRetry
      });

      if (shouldRetry) {
        // Retry: Increment retry_count and trigger regeneration
        const newRetryCount = currentRetryCount + 1;
        console.log(`🔄 [UGC Frame Webhook] Retrying segment ${segment.segment_index} (attempt ${newRetryCount}/${MAX_RETRIES})`);

        await supabase
          .from('video_clone_segments')
          .update({
            retry_count: newRetryCount,
            status: 'generating_first_frame',
            error_message: null,
            first_frame_webhook_received_at: null
          })
          .eq('id', segment.id);

        // Fetch full project and segment data for retry
        try {
          const { data: fullProject } = await supabase
            .from('video_clone_projects')
            .select('*')
            .eq('id', segment.project_id)
            .single();

          const { data: segmentData } = await supabase
            .from('video_clone_segments')
            .select('*')
            .eq('id', segment.id)
            .single();
          if (!fullProject || !segmentData) {
            throw new Error('Project or segment not found for retry');
          }

          const segmentPrompt = resolveSegmentPromptForIndex(
            segmentData.prompt,
            fullProject as ProjectPromptContainer,
            segment.segment_index
          );
          if (!segmentPrompt) {
            throw new Error(`Segment prompt not found for retry (segment ${segment.segment_index})`);
          }

          const aspectRatio = (fullProject.video_aspect_ratio === '9:16' ? '9:16' : '16:9') as '16:9' | '9:16';
          const cloneReferenceAssets = readCloneReferenceAssets(fullProject as Record<string, unknown>);
          const productImageUrls = normalizeStringArray(
            (fullProject as { product_image_urls?: unknown }).product_image_urls,
            8
          );
          const mergedProductImageUrls = normalizeStringArray([
            ...productImageUrls,
            ...cloneReferenceAssets.productImageUrls
          ], 8);
          const cloneMode = resolveCloneModeFromProject(fullProject as Record<string, unknown>);
          const videoModel = (fullProject.video_model || 'veo3_fast') as VideoModel;
          const workflowSource = (
            fullProject.selected_inputs
            && typeof fullProject.selected_inputs === 'object'
            && (fullProject.selected_inputs as { workflowSource?: unknown }).workflowSource === 'project_agent_clone'
          )
            ? 'project_agent_clone'
            : 'default';
          console.log('[UGC Frame Webhook] Retry routing:', {
            segmentIndex: segment.segment_index,
            frameType: 'first',
            isCloneMode: cloneMode.isCloneMode,
            referenceSourceType: cloneMode.sourceType,
            usesContinuationReference: false,
            imageInputCount: mergedProductImageUrls.length + cloneReferenceAssets.avatarPhotoUrls.length
          });

          // Retry frame generation
          const taskId = await createSmartSegmentFrame(
            segmentPrompt,
            segment.segment_index,
            'first',
            aspectRatio,
            mergedProductImageUrls.length > 0 ? mergedProductImageUrls : null,
            cloneMode.mediaType,
            {
              characterPhotoUrls: cloneReferenceAssets.avatarPhotoUrls.length > 0
                ? cloneReferenceAssets.avatarPhotoUrls
                : null,
              workflowSourceOverride: workflowSource
            },
            undefined,
            videoModel
          );

          await supabase
            .from('video_clone_segments')
            .update({
              first_frame_task_id: taskId,
              first_frame_webhook_received_at: null,
              prompt: serializeSegmentPrompt(segmentPrompt)
            })
            .eq('id', segment.id);

          console.log(`✅ [UGC Frame Webhook] Retry triggered, new taskId: ${taskId}`);
        } catch (retryError) {
          console.error('[UGC Frame Webhook] Retry failed:', retryError);
          // Fall through to mark as failed
          await supabase
            .from('video_clone_segments')
            .update({
              status: 'failed',
              error_message: `Retry failed: ${retryError instanceof Error ? retryError.message : 'Unknown error'}`
            })
            .eq('id', segment.id);
        }
      } else {
        // Max retries reached or non-retryable error - mark as failed
        const errorMessage = currentRetryCount >= MAX_RETRIES
          ? `Frame generation failed after ${MAX_RETRIES} retries: ${failMsg || msg}`
          : `Frame generation failed (non-retryable): ${failMsg || msg}`;

        const { error: updateError } = await supabase
          .from('video_clone_segments')
          .update({
            status: 'failed',
            error_message: errorMessage,
            first_frame_webhook_received_at: new Date().toISOString()
          })
          .eq('id', segment.id);

        if (updateError) {
          console.error('[UGC Frame Webhook] Failed to update segment:', updateError);
        }

        // Also update project to failed if first segment fails
        if (segment.segment_index === 0) {
          await supabase
            .from('video_clone_projects')
            .update({
              status: 'failed',
              error_message: errorMessage
            })
            .eq('id', segment.project_id);
        }
      }
    } else {
      // Mark as received even if unexpected state to prevent retries
      if (code !== 200) {
        captureServerEvent(ANALYTICS_EVENTS.ugc_clone_frame_generation_failed, {
          request,
          properties: {
            feature: 'ugc_clone',
            surface: 'ugc_frame_webhook',
            project_id: segment.project_id,
            segment_index: segment.segment_index,
            error_code: failCode || String(code),
            error_message: failMsg || msg || 'Frame generation failed',
          }
        });
      }
      await supabase
        .from('video_clone_segments')
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
