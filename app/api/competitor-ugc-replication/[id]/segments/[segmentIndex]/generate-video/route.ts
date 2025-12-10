import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import {
  buildSegmentStatusPayload,
  startSegmentVideoTask,
  hydrateSerializedSegmentPrompt,
  type SerializedSegmentPlanSegment
} from '@/lib/competitor-ugc-replication-workflow';
import { getSegmentDurationForModel, type VideoModel } from '@/lib/constants';

/**
 * POST /api/competitor-ugc-replication/[id]/segments/[segmentIndex]/generate-video
 *
 * Manually trigger video generation for a specific segment (semi-automatic workflow).
 * User must approve video generation after reviewing the segment's first frame.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; segmentIndex: string }> }) {
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
      .from('competitor_ugc_replication_projects')
      .select(
        'id,user_id,is_segmented,segment_count,segment_duration_seconds,video_model,video_aspect_ratio,video_duration,video_quality,language,video_prompts,segment_plan,merged_video_url'
      )
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden - you do not own this project' }, { status: 403 });
    }

    if (!project.is_segmented) {
      return NextResponse.json({ error: 'Manual video generation is only available for segmented projects' }, { status: 400 });
    }

    // 4. Fetch segment and validate state
    const { data: segment, error: segmentError } = await supabase
      .from('competitor_ugc_replication_segments')
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
      segmentDurationSeconds,
      segment.contains_brand,
      segment.contains_product
    );

    console.log(`[Manual Video Trigger] Segment ${index}: Prompt hydrated successfully`);

    // 8. Determine closing frame URL (use next segment's first frame as fallback)
    const { data: allSegments } = await supabase
      .from('competitor_ugc_replication_segments')
      .select('segment_index, first_frame_url, closing_frame_url')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    const nextSegment = allSegments?.find(s => s.segment_index === index + 1);
    const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;

    console.log(`[Manual Video Trigger] Segment ${index}: Using closing frame: ${closingFrameUrl ? 'available' : 'single-frame mode'}`);

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
      .from('competitor_ugc_replication_segments')
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
      .from('competitor_ugc_replication_segments')
      .select('*')
      .eq('project_id', projectId)
      .order('segment_index', { ascending: true });

    if (fetchError || !refreshedSegments) {
      console.warn('[Manual Video Trigger] Failed to refresh segments for status update');
      // Non-critical error - video generation already started
    }

    // 12. Update project status if needed
    const segmentStatus = refreshedSegments
      ? buildSegmentStatusPayload(refreshedSegments as CompetitorUgcReplicationSegment[], project.merged_video_url || null)
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
      .from('competitor_ugc_replication_projects')
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start video generation',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
