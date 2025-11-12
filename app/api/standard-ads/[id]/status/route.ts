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
      .from('standard_ads_projects')
      .select('*')
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: record, error } = await query.single();

    if (error) {
      console.error('Error fetching standard ads project status:', error);
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
        originalImageUrl: record.original_image_url,
        productDescription: record.product_description || null,
        creativePrompts: record.video_prompts || null,
        coverImageUrl: record.cover_image_url || null,
        videoUrl: record.video_url || null,
        coverTaskId: record.cover_task_id || null,
        videoTaskId: record.video_task_id || null,
        errorMessage: record.error_message || null,
        creditsUsed: record.credits_cost || 0,
        videoModel: record.video_model || 'veo3_fast',
        videoDuration: record.video_duration || null,
        videoQuality: record.video_quality || null,
        downloaded: record.downloaded || false,
        downloadCreditsUsed: record.download_credits_used || 0,
        retryCount: 0,
        lastProcessedAt: record.last_processed_at,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      },
      stepMessages: {
        describing: 'Analyzing your product image with AI...',
        generating_prompts: 'Creating creative advertisement concepts...',
        generating_cover: 'Designing your advertisement cover...',
        generating_video: 'Producing your professional video advertisement...'
      },
      isCompleted: record.status === 'completed',
      isFailed: record.status === 'failed',
      isProcessing: record.status === 'in_progress'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Standard ads project status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
