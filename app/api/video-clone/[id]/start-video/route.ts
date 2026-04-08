import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  buildSegmentStatusPayload,
  hydrateSerializedSegmentPrompt,
  startSegmentVideoTask,
  type SerializedSegmentPlanSegment
} from '@/lib/video-clone-workflow';
import { getGenerationCost, getSegmentDurationForModel, type PersistedVideoQuality, type VideoModel } from '@/lib/constants';
import { isKlingPromptValidationError } from '@/lib/kling-prompt-budget';
import { getKlingPromptValidationResponse } from '@/lib/kling-prompt-api-error';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { getSegmentPromptVideoGenerationCost } from '@/lib/video-clone-segment-billing';
import {
  getSupabaseAdmin,
  type VideoCloneSegment,
  type SingleVideoProject
} from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let chargedCredits = 0;
  let chargeDescription: string | null = null;
  let chargedProjectId: string | null = null;
  let chargedUserId: string | null = null;
  let startedAnyTask = false;
  let projectGenerationCreditsUsed = 0;
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
      .from('video_clone_projects')
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
    projectGenerationCreditsUsed = Number(project.generation_credits_used || 0);

    let segments: Array<VideoCloneSegment> = [];
    let framesReady = 0;
    let videosReady = 0;

    if (project.is_segmented) {
      // Prefer real-time segment rows over project.segment_status because the aggregate
      // field can lag briefly and block valid "start video" requests.
      const { data: segmentRows, error: segmentsError } = await supabase
        .from('video_clone_segments')
        .select('*')
        .eq('project_id', id)
        .order('segment_index', { ascending: true });

      if (segmentsError) {
        return NextResponse.json({ error: 'Failed to verify segment readiness.' }, { status: 500 });
      }

      segments = Array.isArray(segmentRows)
        ? (segmentRows as VideoCloneSegment[])
        : [];
      const total = segments.length;
      framesReady = segments.filter((segment) => Boolean(segment.first_frame_url)).length;
      videosReady = segments.filter((segment) => Boolean(segment.video_url)).length;

      // Best-effort: refresh aggregate segment_status so other readers stay consistent.
      if (total > 0) {
        await supabase
          .from('video_clone_projects')
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
    const projectModel = (project.video_model ?? null) as VideoModel | null;
    const segmentDurationSeconds = project.segment_duration_seconds || getSegmentDurationForModel(projectModel);
    const normalizedProject = {
      ...(project as SingleVideoProject),
      video_prompts: project.video_prompts
    } as SingleVideoProject;
    const segmentsToStart: Array<{
      segment: VideoCloneSegment;
      segmentIndex: number;
      segmentPrompt: ReturnType<typeof hydrateSerializedSegmentPrompt>;
      closingFrameUrl: string | null;
      segmentCost: number;
    }> = [];

    if (project.is_segmented && segments.length > 0) {
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
        const segmentPrompt = hydrateSerializedSegmentPrompt(
          segment.prompt as SerializedSegmentPlanSegment,
          segmentIndex,
          segmentDurationSeconds
        );
        const segmentCost = getSegmentPromptVideoGenerationCost(
          projectModel || 'veo3_fast',
          segmentPrompt.shots,
          segmentDurationSeconds,
          (project.video_quality as PersistedVideoQuality | null | undefined) || undefined
        );

        segmentsToStart.push({
          segment,
          segmentIndex,
          segmentPrompt,
          closingFrameUrl,
          segmentCost
        });
      }
    }

    const generationCost = project.is_segmented
      ? segmentsToStart.reduce((sum, entry) => sum + entry.segmentCost, 0)
      : getGenerationCost(
          project.video_model as VideoModel,
          project.video_duration || '8',
          (project.video_quality as PersistedVideoQuality | null | undefined) || undefined
        );

    const hasPendingVideoWork = project.is_segmented
      ? segmentsToStart.length > 0
      : !project.video_url;

    if (hasPendingVideoWork && generationCost > 0) {
      const creditCheck = await checkCredits(userId, generationCost);
      if (!creditCheck.success) {
        return NextResponse.json({ error: creditCheck.error || 'Failed to check credits' }, { status: 500 });
      }
      if (!creditCheck.hasEnoughCredits) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            requiredCredits: generationCost,
            currentCredits: creditCheck.currentCredits || 0,
            details: `Need ${generationCost} credits, have ${creditCheck.currentCredits || 0}`
          },
          { status: 402 }
        );
      }

      const deduction = await deductCredits(userId, generationCost);
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
      }

      chargeDescription = project.is_segmented
        ? `Video Clone - Remaining segment video generation (${String(project.video_model || 'veo3_fast').toUpperCase()})`
        : `Video Clone - Video generation (${String(project.video_model || 'veo3_fast').toUpperCase()})`;
      const transaction = await recordCreditTransaction(
        userId,
        'usage',
        generationCost,
        chargeDescription,
        project.id,
        true
      );
      if (!transaction.success) {
        await deductCredits(userId, -generationCost);
        return NextResponse.json({ error: transaction.error || 'Failed to record transaction' }, { status: 500 });
      }

      chargedCredits = generationCost;
      chargedProjectId = project.id;
      chargedUserId = userId;
      projectGenerationCreditsUsed += generationCost;

      const { error: chargeUpdateError } = await supabase
        .from('video_clone_projects')
        .update({
          generation_credits_used: projectGenerationCreditsUsed,
          last_processed_at: now
        })
        .eq('id', id);

      if (chargeUpdateError) {
        await deductCredits(userId, -generationCost);
        await recordCreditTransaction(
          userId,
          'refund',
          generationCost,
          `${chargeDescription} refund`,
          project.id,
          true
        );
        return NextResponse.json({ error: 'Failed to persist generation charge' }, { status: 500 });
      }
    }

    if (project.is_segmented && segments.length > 0) {
      for (const entry of segmentsToStart) {
        try {
          const videoTaskId = await startSegmentVideoTask(
            normalizedProject,
            entry.segmentPrompt,
            entry.segment.first_frame_url as string,
            entry.closingFrameUrl,
            entry.segmentIndex,
            project.segment_count || segments.length
          );

          const { error: segmentUpdateError } = await supabase
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
            .eq('id', entry.segment.id);

          if (segmentUpdateError) {
            startErrors.push(`Segment ${entry.segmentIndex + 1}: failed to update status.`);
            continue;
          }

          startedCount += 1;
          startedAnyTask = true;
        } catch (segmentStartError) {
          const message = segmentStartError instanceof Error
            ? segmentStartError.message
            : 'Unknown task start error';
          if (isKlingPromptValidationError(segmentStartError)) {
            promptValidationFailure = true;
            await supabase
              .from('video_clone_segments')
              .update({
                status: 'failed',
                error_message: message,
                video_webhook_received_at: now,
                updated_at: now
              })
              .eq('id', entry.segment.id);
          }
          startErrors.push(`Segment ${entry.segmentIndex + 1}: ${message}`);
        }
      }

      const { data: refreshedSegments } = await supabase
        .from('video_clone_segments')
        .select('*')
        .eq('project_id', id)
        .order('segment_index', { ascending: true });

      if (Array.isArray(refreshedSegments) && refreshedSegments.length > 0) {
        segments = refreshedSegments as VideoCloneSegment[];
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
      .from('video_clone_projects')
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
      if (chargedCredits > 0) {
        await deductCredits(userId, -chargedCredits);
        await recordCreditTransaction(
          userId,
          'refund',
          chargedCredits,
          `${chargeDescription || 'Video Clone - Video generation'} refund`,
          project.id,
          true
        );
        await supabase
          .from('video_clone_projects')
          .update({
            generation_credits_used: Math.max(0, projectGenerationCreditsUsed - chargedCredits),
            video_generation_requested: false,
            current_step: 'ready_for_video',
            progress_percentage: 60,
            last_processed_at: now
          })
          .eq('id', id);
      }
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
      generationCost,
      startedCount,
      inProgressCount,
      readyCount,
      warnings: startErrors
    });
  } catch (error) {
    console.error('start-video API error:', error);
    if (chargedCredits > 0 && !startedAnyTask) {
      try {
        if (chargedUserId) {
          await deductCredits(chargedUserId, -chargedCredits);
          await recordCreditTransaction(
            chargedUserId,
            'refund',
            chargedCredits,
            `${chargeDescription || 'Video Clone - Video generation'} refund`,
            chargedProjectId || undefined,
            true
          );
          if (chargedProjectId) {
            await getSupabaseAdmin()
              .from('video_clone_projects')
              .update({
                generation_credits_used: Math.max(0, projectGenerationCreditsUsed - chargedCredits),
                video_generation_requested: false,
                current_step: 'ready_for_video',
                progress_percentage: 60
              })
              .eq('id', chargedProjectId);
          }
        }
      } catch (refundError) {
        console.error('Failed to refund credits after start-video error:', refundError);
      }
    }
    const klingResponse = getKlingPromptValidationResponse(error);
    if (klingResponse) {
      return NextResponse.json({ error: klingResponse.error }, { status: klingResponse.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
