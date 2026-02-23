import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import { hydrateSerializedSegmentPrompt, type SerializedSegmentPlanSegment } from '@/lib/competitor-ugc-replication-workflow';
import { hydrateSegmentPlan, type SerializedSegmentPlan } from '@/lib/competitor-ugc-replication-workflow';
import { getSegmentDurationForModel, type VideoModel } from '@/lib/constants';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase
      .from('competitor_ugc_replication_projects')
      .select('*')
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: record, error } = await query.single();

    if (error) {
      console.error('Error fetching Competitor UGC Replication project status:', error);
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
      firstFrameUrl: string | null;
      closingFrameUrl: string | null;
      videoUrl: string | null;
      errorMessage?: string | null;
      prompt: Record<string, unknown> | null;
      updatedAt: string | null;
    }> | null = null;

    const recordModel = (record.video_model ?? null) as VideoModel | null;
    const perSegmentDuration = record.segment_duration_seconds || getSegmentDurationForModel(recordModel);

    if (record.is_segmented) {
      // Schema verified via Supabase MCP (2026-01-29): competitor_ugc_replication_segments columns include
      // segment_index, status, first_frame_url, closing_frame_url, video_url, prompt, updated_at, error_message.
      const { data: segmentRows, error: segmentError } = await supabase
        .from('competitor_ugc_replication_segments')
        .select('segment_index,status,first_frame_url,closing_frame_url,video_url,video_task_id,prompt,updated_at,error_message')
        .eq('project_id', record.id)
        .order('segment_index', { ascending: true });

      if (segmentError) {
        console.error('Error fetching project segments:', segmentError);
      } else if (Array.isArray(segmentRows)) {
        segments = segmentRows.map(row => ({
          index: row.segment_index,
          status: row.status,
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

    const storedMergeUrl =
      (record.segment_status as { mergedVideoUrl?: string | null } | null)?.mergedVideoUrl || null;
    const segmentStatus = record.is_segmented
      ? buildSegmentStatusFallback(segments, storedMergeUrl)
      : null;

    const normalizedPlanSegments = hydrateSegmentPlan(
      record.segment_plan as SerializedSegmentPlan | Record<string, unknown> | null,
      record.segment_count || 0,
      record.segment_duration_seconds || undefined
    );
    const segmentPlanPayload = normalizedPlanSegments.length > 0
      ? { segments: normalizedPlanSegments }
      : null;

    const response = {
      success: true,
      workflowStatus: record.status,
      currentStep: record.current_step,
      progress: record.progress_percentage || 0,
      status: record.status,
      current_step: record.current_step,
      progress_percentage: record.progress_percentage || 0,
      language: record.language || null,
      video_prompts: record.video_prompts || null,
      data: {
        creativePrompts: record.video_prompts || null,
        coverImageUrl: segmentStatus?.segments?.[0]?.firstFrameUrl || null,
        videoUrl: record.video_url || null,
        coverTaskId: record.cover_task_id || null,
        videoTaskId: record.video_task_id || null,
        errorMessage: record.error_message || null,
        creditsUsed: record.credits_cost || 0,
        videoModel: record.video_model || 'veo3_fast',
        videoDuration: record.video_duration || null,
        segmentCount: record.segment_count || null,
        segmentDurationSeconds: record.segment_duration_seconds || null,
        isSegmented: record.is_segmented || false,
        videoAspectRatio: record.video_aspect_ratio || null,
        segmentStatus,
        segmentPlan: segmentPlanPayload,
        segments,
        awaitingMerge: record.current_step === 'awaiting_merge',
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
        describing: '🔍 Reverse-engineering your competitor\'s viral formula…',
        generating_prompts: '💡 Adapting winning strategies to your product – stealing their thunder!',
        generating_cover: '✨ Creating the hook that stops the scroll – your competitor\'s edge with your product',
        ready_for_video: '🎯 Competitor strategy decoded! Ready to generate your viral rival video',
        generating_video: '🚀 Building your video clone… the winning formula is almost live!'
      },
      isCompleted: record.status === 'completed',
      isFailed: record.status === 'failed',
      isProcessing: record.status === 'in_progress'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Competitor UGC Replication project status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildSegmentStatusFallback(
  segments: Array<{
    index: number;
    status: string;
    firstFrameUrl: string | null;
    closingFrameUrl: string | null;
    videoUrl: string | null;
    prompt?: Record<string, unknown> | null;
  }> | null,
  mergedVideoUrl: string | null = null
) {
  if (!segments?.length) return null;
  const total = segments.length;
  const framesReady = segments.filter(seg => !!seg.firstFrameUrl).length;
  const videosReady = segments.filter(seg => !!seg.videoUrl).length;

  return {
    total,
    framesReady,
    videosReady,
    segments: segments.map(seg => ({
      index: seg.index,
      status: seg.status,
      firstFrameUrl: seg.firstFrameUrl,
      closingFrameUrl: seg.closingFrameUrl,
      videoUrl: seg.videoUrl,
      prompt: seg.prompt || null,
      errorMessage: (seg as { errorMessage?: string | null }).errorMessage || null
    })),
    mergedVideoUrl
  };
}
