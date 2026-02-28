import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  buildSegmentStatusPayload,
  hydrateSerializedSegmentPrompt,
  startSegmentVideoTask,
  type SerializedSegmentPlanSegment
} from '@/lib/competitor-ugc-replication-workflow';
import { getSegmentDurationForModel, type VideoModel } from '@/lib/constants';
import { isKlingPromptValidationError } from '@/lib/kling-prompt-budget';
import { getKlingPromptValidationResponse } from '@/lib/kling-prompt-api-error';
import {
  getSupabaseAdmin,
  type CompetitorUgcReplicationSegment,
  type SingleVideoProject
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isInternalRequest = request.headers.get('x-project-agent-internal') === '1';
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const { userId: clerkUserId } = isInternalRequest ? { userId: null } : await auth();
    const userId = internalUserId || clerkUserId;
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        {
          error: 'Project not found',
          details: isInternalRequest ? (error?.message || null) : undefined
        },
        { status: 404 }
      );
    }

    if (!isInternalRequest && project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let segments: Array<CompetitorUgcReplicationSegment> = [];
    let framesReady = 0;
    let videosReady = 0;

    if (project.is_segmented) {
      // Prefer real-time segment rows over project.segment_status because the aggregate
      // field can lag briefly and block valid "start video" requests.
      const { data: segmentRows, error: segmentsError } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('*')
        .eq('project_id', id)
        .order('segment_index', { ascending: true });

      if (segmentsError) {
        return NextResponse.json({ error: 'Failed to verify segment readiness.' }, { status: 500 });
      }

      segments = Array.isArray(segmentRows)
        ? (segmentRows as CompetitorUgcReplicationSegment[])
        : [];
      const total = segments.length;
      framesReady = segments.filter((segment) => Boolean(segment.first_frame_url)).length;
      videosReady = segments.filter((segment) => Boolean(segment.video_url)).length;

      // Best-effort: refresh aggregate segment_status so other readers stay consistent.
      if (total > 0) {
        await supabase
          .from('competitor_ugc_replication_projects')
          .update({
            segment_status: {
              total,
              framesReady,
              videosReady,
              segments: segments.map((segment) => ({
                index: segment.segment_index ?? 0,
                status: segment.status,
                firstFrameUrl: segment.first_frame_url,
                closingFrameUrl: segment.closing_frame_url,
                videoUrl: segment.video_url,
                prompt: segment.prompt || null,
                errorMessage: segment.error_message || null
              })),
              mergedVideoUrl: null
            }
          })
          .eq('id', id);
      }

      if (!total || framesReady < total) {
        return NextResponse.json({ error: 'Frames are not ready yet. Please wait a moment and try again.' }, { status: 409 });
      }
    }

    // Idempotency path: if already fully done, return immediately.
    if (project.is_segmented && segments.length > 0 && videosReady === segments.length) {
      return NextResponse.json({ success: true, message: 'All segment videos are already ready.' });
    }

    const now = new Date().toISOString();
    let startedCount = 0;
    let inProgressCount = 0;
    let readyCount = 0;
    const startErrors: string[] = [];
    let promptValidationFailure = false;

    if (project.is_segmented && segments.length > 0) {
      const projectModel = (project.video_model ?? null) as VideoModel | null;
      const segmentDurationSeconds = project.segment_duration_seconds || getSegmentDurationForModel(projectModel);
      const normalizedProject = {
        ...(project as SingleVideoProject),
        video_prompts: project.video_prompts
      } as SingleVideoProject;

      for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        const segmentIndex = segment.segment_index ?? i;

        if (segment.video_url) {
          readyCount += 1;
          continue;
        }

        if (segment.video_task_id) {
          inProgressCount += 1;
          continue;
        }

        if (!segment.first_frame_url) {
          startErrors.push(`Segment ${segmentIndex + 1}: first frame is missing.`);
          continue;
        }

        if (!segment.prompt) {
          startErrors.push(`Segment ${segmentIndex + 1}: prompt is missing.`);
          continue;
        }

        const nextSegment = segments[i + 1];
        const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;

        try {
          const segmentPrompt = hydrateSerializedSegmentPrompt(
            segment.prompt as SerializedSegmentPlanSegment,
            segmentIndex,
            segmentDurationSeconds
          );

          const videoTaskId = await startSegmentVideoTask(
            normalizedProject,
            segmentPrompt,
            segment.first_frame_url,
            closingFrameUrl,
            segmentIndex,
            project.segment_count || segments.length
          );

          const { error: segmentUpdateError } = await supabase
            .from('competitor_ugc_replication_segments')
            .update({
              video_task_id: videoTaskId,
              status: 'generating_video',
              video_generation_approved: true,
              error_message: null,
              retry_count: 0,
              video_webhook_received_at: null,
              updated_at: now
            })
            .eq('id', segment.id);

          if (segmentUpdateError) {
            startErrors.push(`Segment ${segmentIndex + 1}: failed to update status.`);
            continue;
          }

          startedCount += 1;
        } catch (segmentStartError) {
          const message = segmentStartError instanceof Error
            ? segmentStartError.message
            : 'Unknown task start error';
          if (isKlingPromptValidationError(segmentStartError)) {
            promptValidationFailure = true;
            await supabase
              .from('competitor_ugc_replication_segments')
              .update({
                status: 'failed',
                error_message: message,
                video_webhook_received_at: now,
                updated_at: now
              })
              .eq('id', segment.id);
          }
          startErrors.push(`Segment ${segmentIndex + 1}: ${message}`);
        }
      }

      const { data: refreshedSegments } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('*')
        .eq('project_id', id)
        .order('segment_index', { ascending: true });

      if (Array.isArray(refreshedSegments) && refreshedSegments.length > 0) {
        segments = refreshedSegments as CompetitorUgcReplicationSegment[];
      }
    }

    const segmentStatus = project.is_segmented && segments.length > 0
      ? buildSegmentStatusPayload(segments, project.merged_video_url || null)
      : null;
    const hasActiveVideoTasks = Boolean(
      segments.some((segment) => (
        Boolean(segment.video_task_id) ||
        segment.status === 'generating_video' ||
        Boolean(segment.video_url)
      ))
    );

    const { error: updateError } = await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        video_generation_requested: true,
        current_step: hasActiveVideoTasks ? 'generating_segment_videos' : 'ready_for_video',
        status: 'processing',
        progress_percentage: hasActiveVideoTasks ? 70 : 60,
        segment_status: segmentStatus,
        last_processed_at: now
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update video_generation_requested flag:', updateError);
      return NextResponse.json({ error: 'Failed to enqueue video generation' }, { status: 500 });
    }

    if (project.is_segmented && startedCount === 0 && inProgressCount === 0 && readyCount === 0 && startErrors.length > 0) {
      return NextResponse.json(
        { error: `Failed to start segment video tasks: ${startErrors[0]}` },
        { status: promptValidationFailure ? 422 : 500 }
      );
    }

    console.log(`✅ [Start Video] Video generation queued for project ${id}`, {
      startedCount,
      inProgressCount,
      readyCount,
      startErrors: startErrors.length
    });

    return NextResponse.json({
      success: true,
      startedCount,
      inProgressCount,
      readyCount,
      warnings: startErrors
    });
  } catch (error) {
    console.error('start-video API error:', error);
    const klingResponse = getKlingPromptValidationResponse(error);
    if (klingResponse) {
      return NextResponse.json({ error: klingResponse.error }, { status: klingResponse.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
