import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  buildSegmentStatusPayload,
  createSmartSegmentFrame,
  hydrateSerializedSegmentPrompt,
  isSeedanceStoryboardReferenceProject,
  resolveCloneModeFromProject,
  serializeSegmentPrompt,
  startSegmentVideoTask,
  type SegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/video-clone-workflow';
import type { VideoModel } from '@/lib/constants';
import type { SingleVideoProject, VideoCloneSegment } from '@/lib/supabase';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Generation Webhook Payload
 * Documentation: docs/kie/gpt_2_img.md and docs/kie/gpt_2_img_api.md
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
    return { avatarPhotoUrls: [] as string[], productImageUrls: [] as string[], petPhotoUrls: [] as string[] };
  }
  const assets = (videoPrompts as Record<string, unknown>).clone_reference_assets;
  if (!assets || typeof assets !== 'object') {
    return { avatarPhotoUrls: [] as string[], productImageUrls: [] as string[], petPhotoUrls: [] as string[] };
  }
  const parsed = assets as Record<string, unknown>;
  return {
    avatarPhotoUrls: normalizeStringArray(parsed.avatarPhotoUrls, 4),
    productImageUrls: normalizeStringArray(parsed.productImageUrls, 8),
    petPhotoUrls: normalizeStringArray(parsed.petPhotoUrls, 4)
  };
};

const parseImageResultUrl = (resultJson?: string): string | undefined => {
  if (!resultJson) return undefined;
  try {
    const parsed = JSON.parse(resultJson);
    return parsed.resultUrls?.[0];
  } catch (parseError) {
    console.error('[UGC Frame Webhook] Failed to parse resultJson:', parseError);
    return undefined;
  }
};

const isProjectAgentAutoCloneProject = (projectData: Record<string, unknown> | null | undefined): boolean => {
  const selectedInputs = projectData?.selected_inputs;
  return Boolean(
    selectedInputs &&
    typeof selectedInputs === 'object' &&
    (selectedInputs as { workflowSource?: unknown }).workflowSource === 'project_agent_clone' &&
    (selectedInputs as { mergePolicy?: unknown }).mergePolicy === 'auto'
  );
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

async function handleStoryboardImageWebhook(input: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  request: NextRequest;
  taskId: string;
  code: number;
  state: KIEImageWebhookPayload['data']['state'];
  msg: string;
  failMsg?: string;
  resultJson?: string;
}) {
  const { supabase, taskId, code, state, msg, failMsg, resultJson } = input;
  const { data: project, error: projectError } = await supabase
    .from('video_clone_projects')
    .select('*')
    .filter('video_prompts->storyboard_mode->>storyboard_task_id', 'eq', taskId)
    .limit(1)
    .maybeSingle();

  if (projectError || !project) {
    if (projectError) {
      console.warn('[UGC Frame Webhook] Storyboard task lookup failed:', projectError.message);
    }
    return null;
  }

  const projectRecord = project as SingleVideoProject;
  if (!isSeedanceStoryboardReferenceProject(projectRecord)) {
    return NextResponse.json({ success: false, error: 'Storyboard mode mismatch' }, { status: 200 });
  }

  const now = new Date().toISOString();
  const imageUrl = parseImageResultUrl(resultJson);
  if (code === 200 && state === 'success' && imageUrl) {
    const prompts = projectRecord.video_prompts && typeof projectRecord.video_prompts === 'object'
      ? projectRecord.video_prompts as Record<string, unknown>
      : {};
    const storyboardMode = prompts.storyboard_mode && typeof prompts.storyboard_mode === 'object'
      ? prompts.storyboard_mode as Record<string, unknown>
      : {};
    const updatedPrompts = {
      ...prompts,
      storyboard_mode: {
        ...storyboardMode,
        storyboard_image_url: imageUrl
      }
    };

    await supabase
      .from('video_clone_projects')
      .update({
        video_prompts: updatedPrompts,
        current_step: 'generating_segment_videos',
        progress_percentage: 70,
        video_generation_requested: true,
        last_processed_at: now
      })
      .eq('id', projectRecord.id);

    const { data: segmentRows } = await supabase
      .from('video_clone_segments')
      .select('*')
      .eq('project_id', projectRecord.id)
      .order('segment_index', { ascending: true });
    const segments = Array.isArray(segmentRows) ? segmentRows as VideoCloneSegment[] : [];
    let started = 0;
    const startErrors: string[] = [];
    const normalizedProject = {
      ...projectRecord,
      video_prompts: updatedPrompts,
      current_step: 'generating_segment_videos',
      progress_percentage: 70,
      video_generation_requested: true
    } as SingleVideoProject;

    for (const segment of segments) {
      if (segment.video_task_id || segment.video_url) continue;
      const segmentPrompt = resolveSegmentPromptForIndex(
        segment.prompt,
        { ...projectRecord, video_prompts: updatedPrompts } as ProjectPromptContainer,
        segment.segment_index
      );
      if (!segmentPrompt) {
        await supabase
          .from('video_clone_segments')
          .update({
            status: 'failed',
            error_message: `Segment ${segment.segment_index + 1} prompt is missing.`,
            updated_at: now
          })
          .eq('id', segment.id);
        continue;
      }

      try {
        const videoTaskId = await startSegmentVideoTask(
          normalizedProject,
          segmentPrompt,
          null,
          null,
          segment.segment_index,
          projectRecord.segment_count || segments.length
        );
        await supabase
          .from('video_clone_segments')
          .update({
            video_task_id: videoTaskId,
            video_webhook_received_at: null,
            video_generation_approved: true,
            status: 'generating_video',
            error_message: null,
            retry_count: 0,
            updated_at: now
          })
          .eq('id', segment.id);
        started += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Storyboard video task failed';
        startErrors.push(`Segment ${segment.segment_index + 1}: ${message}`);
        await supabase
          .from('video_clone_segments')
          .update({
            status: 'failed',
            error_message: message,
            updated_at: now
          })
          .eq('id', segment.id);
      }
    }

    const { data: refreshedSegments } = await supabase
      .from('video_clone_segments')
      .select('*')
      .eq('project_id', projectRecord.id)
      .order('segment_index', { ascending: true });
    await supabase
      .from('video_clone_projects')
      .update({
        ...(started === 0 && startErrors.length > 0
          ? {
              status: 'failed',
              current_step: 'failed',
              error_message: startErrors[0],
              progress_percentage: 70
            }
          : {
              status: 'processing',
              current_step: 'generating_segment_videos',
              progress_percentage: 70,
              video_generation_requested: true
            }),
        segment_status: buildSegmentStatusPayload((refreshedSegments || segments) as VideoCloneSegment[]),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectRecord.id);

    captureServerEvent(ANALYTICS_EVENTS.ugc_clone_frame_generation_completed, {
      request: input.request,
      properties: {
        feature: 'ugc_clone',
        surface: 'ugc_storyboard_webhook',
        project_id: projectRecord.id,
        started_segment_videos: started
      }
    });

    return NextResponse.json({ success: true, message: 'Storyboard image processed', startedVideoTasks: started }, { status: 200 });
  }

  if (state === 'fail' || code !== 200) {
    const message = failMsg || msg || 'Storyboard image generation failed';
    await supabase
      .from('video_clone_projects')
      .update({
        status: 'failed',
        current_step: 'failed',
        error_message: message,
        last_processed_at: now
      })
      .eq('id', projectRecord.id);
    return NextResponse.json({ success: false, error: message }, { status: 200 });
  }

  return NextResponse.json({ success: true, message: 'Storyboard task still processing' }, { status: 200 });
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
      const storyboardResponse = await handleStoryboardImageWebhook({
        supabase,
        request,
        taskId,
        code,
        state,
        msg,
        failMsg,
        resultJson
      });
      if (storyboardResponse) {
        return storyboardResponse;
      }
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
    const imageUrl = parseImageResultUrl(resultJson);

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

            const { data: fullProjectForAutoStart } = await supabase
              .from('video_clone_projects')
              .select('*')
              .eq('id', segment.project_id)
              .single();

            if (isProjectAgentAutoCloneProject(fullProjectForAutoStart as Record<string, unknown> | null)) {
              const now = new Date().toISOString();
              const { data: fullSegments } = await supabase
                .from('video_clone_segments')
                .select('*')
                .eq('project_id', segment.project_id)
                .order('segment_index', { ascending: true });
              const videoSegments = Array.isArray(fullSegments)
                ? fullSegments as VideoCloneSegment[]
                : [];
              const segmentDurationSeconds = Number(fullProjectForAutoStart?.segment_duration_seconds || 0) || undefined;
              const normalizedProject = fullProjectForAutoStart as SingleVideoProject;
              let startedVideoTasks = 0;
              const startErrors: string[] = [];

              // Schema verified via Supabase MCP (2026-06-12): video_clone_segments has
              // video_task_id, video_generation_approved, video_webhook_received_at, and updated_at.
              for (let index = 0; index < videoSegments.length; index += 1) {
                const segmentRow = videoSegments[index];
                const segmentIndex = segmentRow.segment_index ?? index;
                if (segmentRow.video_url || segmentRow.video_task_id) {
                  continue;
                }
                if (!segmentRow.first_frame_url) {
                  startErrors.push(`Segment ${segmentIndex + 1}: first frame is missing.`);
                  continue;
                }
                const segmentPrompt = resolveSegmentPromptForIndex(
                  segmentRow.prompt,
                  fullProjectForAutoStart as ProjectPromptContainer,
                  segmentIndex
                );
                if (!segmentPrompt) {
                  startErrors.push(`Segment ${segmentIndex + 1}: prompt is missing.`);
                  continue;
                }

                try {
                  const nextSegment = videoSegments[index + 1];
                  const videoTaskId = await startSegmentVideoTask(
                    normalizedProject,
                    hydrateSerializedSegmentPrompt(
                      serializeSegmentPrompt(segmentPrompt) as SerializedSegmentPlanSegment,
                      segmentIndex,
                      segmentDurationSeconds
                    ),
                    segmentRow.first_frame_url,
                    segmentRow.closing_frame_url || nextSegment?.first_frame_url || null,
                    segmentIndex,
                    fullProjectForAutoStart?.segment_count || videoSegments.length
                  );
                  await supabase
                    .from('video_clone_segments')
                    .update({
                      video_task_id: videoTaskId,
                      status: 'generating_video',
                      video_generation_approved: true,
                      error_message: null,
                      retry_count: 0,
                      video_webhook_received_at: null,
                      updated_at: now
                    })
                    .eq('id', segmentRow.id);
                  startedVideoTasks += 1;
                } catch (startError) {
                  const message = startError instanceof Error ? startError.message : 'Unknown video task start error';
                  startErrors.push(`Segment ${segmentIndex + 1}: ${message}`);
                  await supabase
                    .from('video_clone_segments')
                    .update({
                      status: 'failed',
                      error_message: message,
                      updated_at: now
                    })
                    .eq('id', segmentRow.id);
                }
              }

              const { data: refreshedSegments } = await supabase
                .from('video_clone_segments')
                .select('*')
                .eq('project_id', segment.project_id)
                .order('segment_index', { ascending: true });
              const latestSegments = Array.isArray(refreshedSegments)
                ? refreshedSegments as VideoCloneSegment[]
                : videoSegments;

              if (startedVideoTasks === 0 && startErrors.length > 0) {
                await supabase
                  .from('video_clone_projects')
                  .update({
                    status: 'failed',
                    current_step: 'failed',
                    error_message: startErrors[0],
                    segment_status: buildSegmentStatusPayload(latestSegments),
                    last_processed_at: now
                  })
                  .eq('id', segment.project_id);
              } else {
                await supabase
                  .from('video_clone_projects')
                  .update({
                    status: 'processing',
                    current_step: 'generating_segment_videos',
                    progress_percentage: 70,
                    video_generation_requested: true,
                    segment_status: buildSegmentStatusPayload(latestSegments),
                    last_processed_at: now
                  })
                  .eq('id', segment.project_id);
              }
            } else {
              await supabase
                .from('video_clone_projects')
                .update({
                  status: 'segment_frames_ready',
                  current_step: 'reviewing_segment_frames',
                  progress_percentage: 70
                })
                .eq('id', segment.project_id);
            }
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
                const videoModel = (fullProject.video_model || 'seedance_2_fast') as VideoModel;
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
                    workflowSourceOverride: workflowSource,
                    moderationExternalId: `user_${fullProject.user_id}:video_clone_${fullProject.id}:segment_${nextSegmentIndex}:frame_continuation`
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
          const videoModel = (fullProject.video_model || 'seedance_2_fast') as VideoModel;
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
              workflowSourceOverride: workflowSource,
              moderationExternalId: `user_${fullProject.user_id}:video_clone_${fullProject.id}:segment_${segment.segment_index}:frame_retry`
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
