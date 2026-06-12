import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { createServerUserSupabaseClient } from '@/lib/supabase/server-user';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hydrateSerializedSegmentPrompt, type SerializedSegmentPlanSegment } from '@/lib/video-clone-workflow';
import { hydrateSegmentPlan, type SerializedSegmentPlan } from '@/lib/video-clone-workflow';
import { getSegmentDurationForModel, type VideoModel } from '@/lib/constants';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const internalTimestamp = request.headers.get('x-project-agent-timestamp');
    const internalSignature = request.headers.get('x-project-agent-signature');
    const hasValidInternalSignature = verifyInternalUserRequest({
      userId: internalUserId,
      timestamp: internalTimestamp,
      signature: internalSignature,
    });

    const { userId } = hasValidInternalSignature
      ? { userId: internalUserId }
      : await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = hasValidInternalSignature
      ? getSupabaseAdmin()
      : await createServerUserSupabaseClient();
    const query = supabase
      .from('video_clone_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId);

    let { data: record, error } = await query.single();

    if (error) {
      console.error('Error fetching Video Clone project status:', error);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    let segments: Array<{
      index: number;
      status: string;
      firstFrameTaskId: string | null;
      firstFrameUrl: string | null;
      closingFrameUrl: string | null;
      videoUrl: string | null;
      videoTaskId: string | null;
      errorMessage?: string | null;
      prompt: Record<string, unknown> | null;
      updatedAt: string | null;
    }> | null = null;

    const recordModel = (record.video_model ?? null) as VideoModel | null;
    const perSegmentDuration = record.segment_duration_seconds || getSegmentDurationForModel(recordModel);
    const shouldUseSegmentRows = Boolean(record.is_segmented) || Number(record.segment_count || 0) > 0;

    if (shouldUseSegmentRows) {
      // Schema verified via Supabase MCP (2026-05-03): video_clone_segments columns include
      // segment_index, status, first_frame_task_id, first_frame_url, closing_frame_url,
      // video_url, video_task_id, prompt, updated_at, error_message.
      const { data: segmentRows, error: segmentError } = await supabase
        .from('video_clone_segments')
        .select('segment_index,status,first_frame_task_id,first_frame_url,closing_frame_url,video_url,video_task_id,prompt,updated_at,error_message')
        .eq('project_id', record.id)
        .order('segment_index', { ascending: true });

      if (segmentError) {
        console.error('Error fetching project segments:', segmentError);
      } else if (Array.isArray(segmentRows)) {
        segments = segmentRows.map(row => ({
          index: row.segment_index,
          status: row.status,
          firstFrameTaskId: row.first_frame_task_id,
          firstFrameUrl: row.first_frame_url,
          closingFrameUrl: row.closing_frame_url,
          videoUrl: row.video_url,
          videoTaskId: row.video_task_id,
          errorMessage: row.error_message,
          prompt: hydrateSerializedSegmentPrompt(
            row.prompt as SerializedSegmentPlanSegment,
            row.segment_index,
            perSegmentDuration
          ),
          updatedAt: row.updated_at
        }));
      }
    }

    const recovered = await recoverCompletedKieVideoTaskIfNeeded(record, segments);
    if (recovered) {
      record = recovered.record;
      segments = recovered.segments;
    }

    const selectedInputs = record.selected_inputs && typeof record.selected_inputs === 'object'
      ? record.selected_inputs as Record<string, unknown>
      : null;
    const executionMode = typeof selectedInputs?.executionMode === 'string'
      ? selectedInputs.executionMode
      : null;
    const mergePolicy = typeof selectedInputs?.mergePolicy === 'string'
      ? selectedInputs.mergePolicy
      : null;
    const referenceSourceVideoUrl = typeof selectedInputs?.referenceSourceVideoUrl === 'string'
      ? selectedInputs.referenceSourceVideoUrl
      : null;
    const isProjectAgentSeedanceDirectMode = executionMode === 'clone_direct_reference';
    const storedMergeUrl =
      record.merged_video_url ||
      (record.segment_status as { mergedVideoUrl?: string | null } | null)?.mergedVideoUrl ||
      null;
    const segmentStatus = shouldUseSegmentRows
      ? buildSegmentStatusFallback(segments, storedMergeUrl, { skipFrameGeneration: isProjectAgentSeedanceDirectMode })
      : null;
    if (isProjectAgentSeedanceDirectMode && segmentStatus) {
      const storedSegmentStatus = record.segment_status as {
        framesReady?: number | null;
        videosReady?: number | null;
        mergedVideoUrl?: string | null;
      } | null;
      if (
        storedSegmentStatus?.framesReady !== segmentStatus.framesReady ||
        storedSegmentStatus?.videosReady !== segmentStatus.videosReady ||
        (storedSegmentStatus?.mergedVideoUrl || null) !== (segmentStatus.mergedVideoUrl || null)
      ) {
        // Schema verified via Supabase MCP (2026-06-12): video_clone_projects has segment_status.
        await getSupabaseAdmin()
          .from('video_clone_projects')
          .update({ segment_status: segmentStatus })
          .eq('id', record.id);
        record = {
          ...record,
          segment_status: segmentStatus,
        };
      }
    }

    const normalizedPlanSegments = hydrateSegmentPlan(
      record.segment_plan as SerializedSegmentPlan | Record<string, unknown> | null,
      record.segment_count || 0,
      record.segment_duration_seconds || undefined
    );
    const segmentPlanPayload = normalizedPlanSegments.length > 0
      ? { segments: normalizedPlanSegments }
      : null;
    const hasReadySegmentWithoutVideoTask = Boolean(
      isProjectAgentSeedanceDirectMode &&
      segments?.length &&
      segments.every((segment) => (
        segment.status === 'ready_for_video' &&
        !segment.videoTaskId &&
        !segment.videoUrl
      ))
    );
    const effectiveCurrentStep = hasReadySegmentWithoutVideoTask
      ? 'ready_for_video'
      : record.current_step;
    const effectiveProgress = hasReadySegmentWithoutVideoTask
      ? Math.max(record.progress_percentage || 0, 60)
      : (record.progress_percentage || 0);

    const response = {
      success: true,
      projectId: record.id,
      workflowStatus: record.status,
      currentStep: effectiveCurrentStep,
      progress: effectiveProgress,
      status: record.status,
      current_step: effectiveCurrentStep,
      progress_percentage: effectiveProgress,
      language: record.language || null,
      video_prompts: record.video_prompts || null,
      data: {
        projectId: record.id,
        creativePrompts: record.video_prompts || null,
        coverImageUrl: segmentStatus?.segments?.[0]?.firstFrameUrl || null,
        videoUrl: record.video_url || null,
        coverTaskId: record.cover_task_id || null,
        videoTaskId: record.video_task_id || null,
        errorMessage: record.error_message || null,
        creditsUsed: record.generation_credits_used || 0,
        videoModel: record.video_model || 'seedance_2_fast',
        workflowSource: typeof selectedInputs?.workflowSource === 'string' ? selectedInputs.workflowSource : null,
        executionMode,
        mergePolicy,
        referenceSourceVideoUrl,
        videoDuration: record.video_duration || null,
        segmentCount: record.segment_count || null,
        segmentDurationSeconds: record.segment_duration_seconds || null,
        isSegmented: shouldUseSegmentRows,
        videoAspectRatio: record.video_aspect_ratio || null,
        segmentStatus,
        segmentPlan: segmentPlanPayload,
        segments,
        awaitingMerge: record.current_step === 'awaiting_merge' || record.status === 'awaiting_merge',
        mergeTaskId: record.fal_merge_task_id || null,
        videoQuality: record.video_quality || null,
        photoOnly: record.photo_only || false,
        videoGenerationRequested: record.video_generation_requested || false,
        downloaded: record.downloaded || false,
        downloadCreditsUsed: record.download_credits_used || 0,
        retryCount: 0,
        lastProcessedAt: record.last_processed_at,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      },
      stepMessages: {
        describing: '🔍 Breaking down the reference video structure…',
        generating_prompts: '💡 Adapting the winning structure to your product…',
        generating_cover: '✨ Creating the hook that stops the scroll for your product…',
        ready_for_video: '📝 Clone prompts loaded. Edit each scene before generating frames or videos.',
        generating_video: '🚀 Building your video clone… the winning formula is almost live!'
      },
      isCompleted: record.status === 'completed',
      isFailed: record.status === 'failed',
      isProcessing: record.status === 'in_progress'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Video Clone project status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function recoverCompletedKieVideoTaskIfNeeded(
  record: Record<string, any>,
  segments: Array<{
    index: number;
    status: string;
    firstFrameTaskId: string | null;
    firstFrameUrl: string | null;
    closingFrameUrl: string | null;
    videoUrl: string | null;
    videoTaskId: string | null;
    errorMessage?: string | null;
    prompt: Record<string, unknown> | null;
    updatedAt: string | null;
  }> | null
) {
  const selectedInputs = record.selected_inputs && typeof record.selected_inputs === 'object'
    ? record.selected_inputs as Record<string, unknown>
    : null;
  const executionMode = typeof selectedInputs?.executionMode === 'string'
    ? selectedInputs.executionMode
    : null;
  const segment = segments?.find((candidate) => (
    candidate.videoTaskId &&
    !candidate.videoUrl &&
    candidate.status === 'generating_video'
  ));

  if (
    !segment ||
    !segment.videoTaskId ||
    !process.env.KIE_API_KEY ||
    record.status === 'completed' ||
    record.status === 'failed' ||
    executionMode !== 'clone_direct_reference'
  ) {
    return null;
  }
  const videoTaskId = segment.videoTaskId;

  try {
    const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(videoTaskId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json() as {
      code?: number;
      data?: {
        state?: string;
        resultJson?: string | null;
        failMsg?: string | null;
      } | null;
    };
    const taskData = payload.data;
    if (payload.code !== 200 || !taskData || taskData.state !== 'success') {
      return null;
    }

    let videoUrl: string | null = null;
    if (typeof taskData.resultJson === 'string') {
      try {
        const parsed = JSON.parse(taskData.resultJson) as { resultUrls?: unknown };
        if (Array.isArray(parsed.resultUrls) && typeof parsed.resultUrls[0] === 'string') {
          videoUrl = parsed.resultUrls[0];
        }
      } catch {
        videoUrl = null;
      }
    }
    if (!videoUrl) return null;

    const now = new Date().toISOString();
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-06-12): video_clone_segments has
    // video_url, status, video_webhook_received_at, error_message, and updated_at.
    await supabase
      .from('video_clone_segments')
      .update({
        video_url: videoUrl,
        status: 'video_ready',
        video_webhook_received_at: now,
        error_message: null,
        updated_at: now,
      })
      .eq('project_id', record.id)
      .eq('segment_index', segment.index);

    const segmentStatus = {
      total: segments?.length || 1,
      framesReady: segments?.length || 1,
      videosReady: 1,
      segments: (segments || [segment]).map((candidate) => (
        candidate.index === segment.index
          ? {
              index: candidate.index,
              status: 'video_ready',
              firstFrameTaskId: candidate.firstFrameTaskId,
              firstFrameUrl: candidate.firstFrameUrl,
              closingFrameUrl: candidate.closingFrameUrl,
              videoUrl,
              prompt: candidate.prompt || null,
              errorMessage: null,
            }
          : {
              index: candidate.index,
              status: candidate.status,
              firstFrameTaskId: candidate.firstFrameTaskId,
              firstFrameUrl: candidate.firstFrameUrl,
              closingFrameUrl: candidate.closingFrameUrl,
              videoUrl: candidate.videoUrl,
              prompt: candidate.prompt || null,
              errorMessage: candidate.errorMessage || null,
            }
      )),
      mergedVideoUrl: videoUrl,
    };

    // Schema verified via Supabase MCP (2026-06-12): video_clone_projects has
    // video_url, merged_video_url, status, current_step, progress_percentage,
    // segment_status, and last_processed_at.
    await supabase
      .from('video_clone_projects')
      .update({
        video_url: videoUrl,
        merged_video_url: videoUrl,
        status: 'completed',
        current_step: 'completed',
        progress_percentage: 100,
        segment_status: segmentStatus,
        last_processed_at: now,
      })
      .eq('id', record.id);

    return {
      record: {
        ...record,
        video_url: videoUrl,
        merged_video_url: videoUrl,
        status: 'completed',
        current_step: 'completed',
        progress_percentage: 100,
        segment_status: segmentStatus,
        last_processed_at: now,
      },
      segments: (segments || [segment]).map((candidate) => (
        candidate.index === segment.index
          ? {
              ...candidate,
              status: 'video_ready',
              videoUrl,
              errorMessage: null,
              updatedAt: now,
            }
          : candidate
      )),
    };
  } catch (error) {
    console.warn('[Video Clone Status] Failed to recover completed KIE task:', error);
    return null;
  }
}

function buildSegmentStatusFallback(
  segments: Array<{
    index: number;
    status: string;
    firstFrameTaskId: string | null;
    firstFrameUrl: string | null;
    closingFrameUrl: string | null;
    videoUrl: string | null;
    prompt?: Record<string, unknown> | null;
  }> | null,
  mergedVideoUrl: string | null = null,
  options?: { skipFrameGeneration?: boolean }
) {
  if (!segments?.length) return null;
  const total = segments.length;
  const framesReady = options?.skipFrameGeneration
    ? total
    : segments.filter(seg => !!seg.firstFrameUrl).length;
  const videosReady = segments.filter(seg => !!seg.videoUrl).length;

  return {
    total,
    framesReady,
    videosReady,
    segments: segments.map(seg => ({
      index: seg.index,
      status: seg.status,
      firstFrameTaskId: seg.firstFrameTaskId,
      firstFrameUrl: seg.firstFrameUrl,
      closingFrameUrl: seg.closingFrameUrl,
      videoUrl: seg.videoUrl,
      prompt: seg.prompt || null,
      errorMessage: (seg as { errorMessage?: string | null }).errorMessage || null
    })),
    mergedVideoUrl
  };
}
