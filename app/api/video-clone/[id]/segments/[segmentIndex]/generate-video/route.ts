import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, type VideoCloneSegment, type SingleVideoProject } from '@/lib/supabase';
import {
  buildSegmentStatusPayload,
  startSegmentVideoTask,
  hydrateSerializedSegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/video-clone-workflow';
import { getSegmentDurationForModel, type PersistedVideoQuality, type VideoModel } from '@/lib/constants';
import { getKlingPromptValidationResponse } from '@/lib/kling-prompt-api-error';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import {
  getEffectiveSegmentDurationSeconds,
  getSegmentPromptVideoGenerationCost
} from '@/lib/video-clone-segment-billing';

/**
 * POST /api/video-clone/[id]/segments/[segmentIndex]/generate-video
 *
 * Manually trigger video generation for a specific segment (semi-automatic workflow).
 * User must approve video generation after reviewing the segment's first frame.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; segmentIndex: string }> }) {
  let chargedCredits = 0;
  let chargedUserId: string | null = null;
  let chargedProjectId: string | null = null;
  let chargeDescription: string | null = null;
  let projectGenerationCreditsUsed = 0;
  try {
    // 1. Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Extract and validate route parameters
    const { id: projectId, segmentIndex } = await params;
    const index = Number(segmentIndex);
    if (!projectId || Number.isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 3. Fetch project and verify ownership
    const { data: project, error: projectError } = await supabase
      .from('video_clone_projects')
      .select(
        'id,user_id,is_segmented,segment_count,segment_duration_seconds,video_model,video_aspect_ratio,video_duration,video_quality,language,video_prompts,segment_plan,merged_video_url,generation_credits_used'
      )
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    projectGenerationCreditsUsed = Number(project.generation_credits_used || 0);

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden - you do not own this project' }, { status: 403 });
    }

    if (!project.is_segmented) {
      return NextResponse.json({ error: 'Manual video generation is only available for segmented projects' }, { status: 400 });
    }

    // 4. Fetch segment and validate state
    const { data: segment, error: segmentError } = await supabase
      .from('video_clone_segments')
      .select('*')
      .eq('project_id', projectId)
      .eq('segment_index', index)
      .single();

    if (segmentError || !segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // 5. Validate segment has first_frame_url
    if (!segment.first_frame_url) {
      return NextResponse.json(
        { error: 'First frame not ready. Please wait for frame generation to complete.' },
        { status: 400 }
      );
    }

    // 6. Check if video already generating or exists
    if (segment.video_task_id && !segment.video_url) {
      return NextResponse.json(
        { error: 'Video generation already in progress for this segment.' },
        { status: 409 }
      );
    }

    if (segment.video_url) {
      return NextResponse.json(
        { error: 'Video already generated for this segment. Use regenerate if you want to create a new video.' },
        { status: 409 }
      );
    }

    // 7. Hydrate segment prompt from stored data
    const projectModel = (project.video_model ?? null) as VideoModel | null;
    const segmentDurationSeconds = project.segment_duration_seconds || getSegmentDurationForModel(projectModel);

    const segmentPrompt = hydrateSerializedSegmentPrompt(
      segment.prompt as SerializedSegmentPlanSegment,
      index,
      segmentDurationSeconds
    );
    const segmentCost = getSegmentPromptVideoGenerationCost(
      projectModel || 'seedance_2_fast',
      segmentPrompt.shots,
      segmentDurationSeconds,
      (project.video_quality as PersistedVideoQuality | null | undefined) || undefined
    );
    const effectiveSegmentDurationSeconds = getEffectiveSegmentDurationSeconds(
      segmentPrompt.shots,
      segmentDurationSeconds
    );

    console.log(`[Manual Video Trigger] Segment ${index}: Prompt hydrated successfully`);

    // 8. Determine closing frame URL (use next segment's first frame as fallback)
    const { data: allSegments } = await supabase
      .from('video_clone_segments')
      .select('segment_index, first_frame_url, closing_frame_url')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    const nextSegment = allSegments?.find(s => s.segment_index === index + 1);
    const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;

    console.log(`[Manual Video Trigger] Segment ${index}: Using closing frame: ${closingFrameUrl ? 'available' : 'single-frame mode'}`);

    if (segmentCost > 0) {
      const creditCheck = await checkCredits(userId, segmentCost);
      if (!creditCheck.success) {
        return NextResponse.json({ error: creditCheck.error || 'Failed to check credits' }, { status: 500 });
      }
      if (!creditCheck.hasEnoughCredits) {
        return NextResponse.json(
          { error: `Insufficient credits: need ${segmentCost}, have ${creditCheck.currentCredits || 0}` },
          { status: 402 }
        );
      }

      const deduction = await deductCredits(userId, segmentCost);
      if (!deduction.success) {
        return NextResponse.json({ error: deduction.error || 'Failed to deduct credits' }, { status: 500 });
      }

      chargeDescription = projectModel === 'kling_3'
        ? `Video Clone - Segment ${index + 1} video generation (KLING_3, ${effectiveSegmentDurationSeconds}s)`
        : `Video Clone - Segment ${index + 1} video generation (${String(project.video_model || 'seedance_2_fast').toUpperCase()})`;

      const transaction = await recordCreditTransaction(
        userId,
        'usage',
        segmentCost,
        chargeDescription,
        project.id,
        true
      );

      if (!transaction.success) {
        await deductCredits(userId, -segmentCost);
        return NextResponse.json({ error: transaction.error || 'Failed to record transaction' }, { status: 500 });
      }

      const updatedGenerationCreditsUsed = projectGenerationCreditsUsed + segmentCost;
      const { error: creditsUpdateError } = await supabase
        .from('video_clone_projects')
        .update({
          generation_credits_used: updatedGenerationCreditsUsed,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (creditsUpdateError) {
        await deductCredits(userId, -segmentCost);
        await recordCreditTransaction(
          userId,
          'refund',
          segmentCost,
          `${chargeDescription} refund`,
          project.id,
          true
        );
        return NextResponse.json({ error: 'Failed to persist generation charge' }, { status: 500 });
      }

      chargedCredits = segmentCost;
      chargedUserId = userId;
      chargedProjectId = projectId;
      projectGenerationCreditsUsed = updatedGenerationCreditsUsed;
    }

    // 9. Start video generation task
    const videoTaskId = await startSegmentVideoTask(
      {
        ...(project as SingleVideoProject),
        video_prompts: project.video_prompts
      } as SingleVideoProject,
      segmentPrompt,
      segment.first_frame_url,
      closingFrameUrl,
      index,
      project.segment_count || 1
    );

    console.log(`[Manual Video Trigger] Segment ${index}: Video task created with ID: ${videoTaskId}`);

    // 10. Update segment status with approval=true
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('video_clone_segments')
      .update({
        video_task_id: videoTaskId,
        status: 'generating_video',
        video_generation_approved: true,  // Mark as approved
        error_message: null,
        updated_at: now
      })
      .eq('id', segment.id);

    if (updateError) {
      console.error('[Manual Video Trigger] Failed to update segment:', updateError);
      return NextResponse.json({ error: 'Failed to update segment status' }, { status: 500 });
    }

    // 11. Refresh all segments to build status payload
    const { data: refreshedSegments, error: fetchError } = await supabase
      .from('video_clone_segments')
      .select('*')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    if (fetchError || !refreshedSegments) {
      console.warn('[Manual Video Trigger] Failed to refresh segments for status update');
      // Non-critical error - video generation already started
    }

    // 12. Update project status if needed
    const segmentStatus = refreshedSegments
      ? buildSegmentStatusPayload(refreshedSegments as VideoCloneSegment[], project.merged_video_url || null)
      : undefined;

    // Check if all segments are now generating or have videos
    const allVideoTasksStarted = refreshedSegments?.every(seg =>
      seg.video_task_id || seg.video_url
    );

    const projectUpdates: Record<string, unknown> = {
      last_processed_at: now
    };

    if (segmentStatus) {
      projectUpdates.segment_status = segmentStatus;
    }

    // If all videos started, update project step
    if (allVideoTasksStarted) {
      projectUpdates.current_step = 'generating_segment_videos';
      projectUpdates.progress_percentage = 70;
      console.log(`[Manual Video Trigger] All segment videos started for project ${projectId}`);
    }

    await supabase
      .from('video_clone_projects')
      .update(projectUpdates)
      .eq('id', projectId);

    // 13. Return success response
    return NextResponse.json({
      success: true,
      message: `Video generation started for segment ${index}`,
      videoTaskId,
      segmentIndex: index,
      segmentStatus
    });

  } catch (error) {
    console.error('[Manual Video Trigger] Error:', error);
    if (chargedCredits > 0 && chargedUserId && chargedProjectId) {
      try {
        await deductCredits(chargedUserId, -chargedCredits);
        await recordCreditTransaction(
          chargedUserId,
          'refund',
          chargedCredits,
          `${chargeDescription || 'Video Clone - Segment video generation'} refund`,
          chargedProjectId,
          true
        );
        await getSupabaseAdmin()
          .from('video_clone_projects')
          .update({
            generation_credits_used: Math.max(0, projectGenerationCreditsUsed - chargedCredits)
          })
          .eq('id', chargedProjectId);
      } catch (refundError) {
        console.error('[Manual Video Trigger] Failed to refund credits after error:', refundError);
      }
    }
    const klingResponse = getKlingPromptValidationResponse(error);
    if (klingResponse) {
      return NextResponse.json(
        { error: klingResponse.error },
        { status: klingResponse.status }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start video generation',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
