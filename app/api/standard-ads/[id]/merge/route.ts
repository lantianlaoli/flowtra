import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin, type StandardAdsSegment } from '@/lib/supabase';
import { mergeVideosWithFal } from '@/lib/video-merge';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error: projectError } = await supabase
      .from('standard_ads_projects')
      .select('id,user_id,is_segmented,segment_status,video_aspect_ratio,segment_count,fal_merge_task_id,current_step,video_url,merged_video_url')
      .eq('id', id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!project.is_segmented) {
      return NextResponse.json({ error: 'Manual merge only applies to segmented projects' }, { status: 400 });
    }

    if (project.merged_video_url || project.video_url) {
      return NextResponse.json({ error: 'Project already merged' }, { status: 400 });
    }

    if (project.fal_merge_task_id) {
      return NextResponse.json({ error: 'Merge already in progress' }, { status: 400 });
    }

    const status = (project.segment_status as { videosReady?: number; total?: number }) || {};
    if (!status || !status.total || status.videosReady !== status.total) {
      return NextResponse.json({ error: 'Segments are still rendering. Wait until all videos are ready.' }, { status: 400 });
    }

    const { data: segments, error: segmentError } = await supabase
      .from('standard_ads_segments')
      .select('*')
      .eq('project_id', id)
      .order('segment_index', { ascending: true });

    if (segmentError || !segments?.length) {
      return NextResponse.json({ error: 'Segments not found' }, { status: 404 });
    }

    if (!segments.every(seg => !!seg.video_url)) {
      return NextResponse.json({ error: 'Some segments are missing video URLs' }, { status: 400 });
    }

    const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
    const { taskId } = await mergeVideosWithFal((segments as StandardAdsSegment[]).map(seg => seg.video_url as string), aspectRatio);

    await supabase
      .from('standard_ads_projects')
      .update({
        fal_merge_task_id: taskId,
        current_step: 'merging_segments',
        progress_percentage: 95,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', id);

    return NextResponse.json({ success: true, mergeTaskId: taskId });
  } catch (error) {
    console.error('Manual merge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start merge' },
      { status: 500 }
    );
  }
}
