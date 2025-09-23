import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabase();
    let query = supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: project, error } = await query.single();

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

    const response = {
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        video_duration_seconds: project.video_duration_seconds,
        image_model: project.image_model,
        video_model: project.video_model,
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
        updated_at: project.updated_at
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