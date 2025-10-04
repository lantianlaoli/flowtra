import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      console.error('Error fetching project:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get scenes for this project
    const { data: scenes } = await supabase
      .from('character_ads_scenes')
      .select('*')
      .eq('project_id', projectId)
      .order('scene_number');

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        video_model: project.video_model,
        image_model: project.image_model,
        video_aspect_ratio: project.video_aspect_ratio,
        accent: project.accent,
        kie_image_task_id: project.kie_image_task_id,
        kie_video_task_ids: project.kie_video_task_ids,
        generated_image_url: project.generated_image_url,
        generated_video_urls: project.generated_video_urls,
        merged_video_url: project.merged_video_url,
        error_message: project.error_message,
        created_at: project.created_at,
        updated_at: project.updated_at,
        last_processed_at: project.last_processed_at
      },
      scenes: scenes || []
    });

  } catch (error) {
    console.error('Error in project status check:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}