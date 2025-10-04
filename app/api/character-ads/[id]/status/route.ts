import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching character ads project status:', error);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get scenes for this project to calculate additional fields
    const { data: scenes } = await supabase
      .from('character_ads_scenes')
      .select('*')
      .eq('project_id', id)
      .order('scene_number');

    // Calculate computed fields
    const has_analysis_result = !!project.image_analysis_result;
    const has_generated_prompts = !!project.generated_prompts;
    const generated_video_count = scenes?.filter(scene =>
      scene.scene_type === 'video' && scene.status === 'completed'
    ).length || 0;

    const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
    const resolvedVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;

    const response = {
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        video_duration_seconds: project.video_duration_seconds,
        image_model: project.image_model,
        video_model: resolvedVideoModel,
        credits_cost: project.credits_cost,
        person_image_urls: project.person_image_urls,
        product_image_urls: project.product_image_urls,
        image_analysis_result: project.image_analysis_result,
        generated_prompts: project.generated_prompts,
        generated_image_url: project.generated_image_url,
        generated_video_urls: project.generated_video_urls,
        merged_video_url: project.merged_video_url,
        error_message: project.error_message,
        last_processed_at: project.last_processed_at,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // Add computed fields that frontend expects
        has_analysis_result,
        has_generated_prompts,
        generated_video_count,
        kie_image_task_id: project.kie_image_task_id,
        kie_video_task_ids: project.kie_video_task_ids,
        fal_merge_task_id: project.fal_merge_task_id
      },
      stepMessages: {
        analyzing_images: 'Analyzing uploaded images with AI...',
        generating_prompts: 'Creating character presentation prompts...',
        generating_image: 'Generating character advertisement image...',
        generating_videos: 'Producing character presentation videos...',
        merging_videos: 'Combining videos into final presentation...'
      },
      isCompleted: project.status === 'completed',
      isFailed: project.status === 'failed',
      isProcessing: ['analyzing_images', 'generating_prompts', 'generating_image', 'generating_videos', 'merging_videos'].includes(project.status)
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Character ads project status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
