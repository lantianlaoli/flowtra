import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    // Fetch user's history from Supabase
    const supabase = getSupabase();
    const { data: history, error } = await supabase
      .from('user_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch history:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch history' 
      }, { status: 500 });
    }

    // Map workflow status to frontend status
    const mapWorkflowStatus = (workflowStatus: string): 'processing' | 'completed' | 'failed' => {
      switch (workflowStatus) {
        case 'completed':
          return 'completed';
        case 'failed':
          return 'failed';
        case 'started':
        case 'in_progress':
        default:
          return 'processing';
      }
    };

    // Transform data to match frontend interface
    const transformedHistory = (history || []).map(item => ({
      id: item.id,
      originalImageUrl: item.original_image_url,
      coverImageUrl: item.cover_image_url,
      videoUrl: item.video_url,
      productDescription: item.product_description,
      videoModel: item.video_model,
      creditsUsed: item.credits_used,
      status: mapWorkflowStatus(item.workflow_status || item.status),
      createdAt: item.created_at
    }));

    return NextResponse.json({
      success: true,
      history: transformedHistory
    });

  } catch (error) {
    console.error('History API error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}