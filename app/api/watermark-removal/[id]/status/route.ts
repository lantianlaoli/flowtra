import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { queryWatermarkRemovalStatus, extractResultVideoUrl } from '@/lib/kie-watermark-removal';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = getSupabaseAdmin();

    // Get project from database
    const { data: project, error: fetchError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // If already completed or failed, return cached status
    if (project.status === 'completed' || project.status === 'failed') {
      return NextResponse.json({
        success: true,
        project: {
          id: project.id,
          status: project.status,
          videoUrl: project.input_video_url,
          resultVideoUrl: project.output_video_url,
          errorMessage: project.error_message,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
      });
    }

    // Query KIE API for current status
    if (!project.kie_task_id) {
      return NextResponse.json(
        { error: 'Task ID not found' },
        { status: 500 }
      );
    }

    const statusResponse = await queryWatermarkRemovalStatus(project.kie_task_id);

    // Update project based on KIE API response
    if (statusResponse.data.state === 'success') {
      const resultVideoUrl = extractResultVideoUrl(statusResponse.data.resultJson);

      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          status: 'completed',
          output_video_url: resultVideoUrl,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      return NextResponse.json({
        success: true,
        project: {
          id: project.id,
          status: 'completed',
          videoUrl: project.input_video_url,
          resultVideoUrl,
          createdAt: project.created_at,
          updatedAt: new Date().toISOString(),
        },
      });
    } else if (statusResponse.data.state === 'fail') {
      const errorMessage = statusResponse.data.failMsg || 'Watermark removal failed';

      await supabase
        .from('sora2_watermark_removal_tasks')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      return NextResponse.json({
        success: true,
        project: {
          id: project.id,
          status: 'failed',
          videoUrl: project.input_video_url,
          errorMessage,
          createdAt: project.created_at,
          updatedAt: new Date().toISOString(),
        },
      });
    }

    // Still processing
    return NextResponse.json({
      success: true,
      project: {
          id: project.id,
          status: 'processing',
          videoUrl: project.input_video_url,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
    });
  } catch (error) {
    console.error('Status query error:', error);
    return NextResponse.json(
      {
        error: 'Failed to query status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
