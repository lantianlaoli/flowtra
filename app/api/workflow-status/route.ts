import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    const historyId = searchParams.get('historyId');

    if (!historyId) {
      return NextResponse.json({ error: 'History ID is required' }, { status: 400 });
    }

    // For authenticated users, check ownership
    let query = supabase
      .from('user_history')
      .select('*')
      .eq('id', historyId);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: record, error } = await query.single();

    if (error) {
      console.error('Error fetching workflow status:', error);
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    if (!record) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    const response = {
      success: true,
      workflowStatus: record.workflow_status,
      currentStep: record.current_step,
      progress: record.progress_percentage || 0,
      data: {
        originalImageUrl: record.original_image_url,
        productDescription: record.product_description || null,
        creativePrompts: record.creative_prompts || null,
        coverImageUrl: record.cover_image_url || null,
        videoUrl: record.video_url || null,
        coverTaskId: record.cover_task_id || null,
        videoTaskId: record.video_task_id || null,
        errorMessage: record.error_message || null,
        creditsUsed: record.credits_used || 0,
        videoModel: record.video_model || 'veo3_fast',
        retryCount: record.retry_count || 0,
        lastProcessedAt: record.last_processed_at,
        createdAt: record.created_at,
        updatedAt: record.updated_at
      },
      stepMessages: {
        describing: 'Analyzing your product image with AI...',
        generating_prompts: 'Creating creative advertisement concepts...',
        generating_cover: 'Designing your advertisement cover...',
        generating_video: 'Producing your video advertisement...'
      },
      isCompleted: record.workflow_status === 'completed',
      isFailed: record.workflow_status === 'failed',
      isProcessing: record.workflow_status === 'in_progress'
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Workflow status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}