import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Fetch all watermark removal projects for the user
    const { data: projects, error: fetchError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Failed to fetch watermark removal history:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    // Transform data for frontend
    const history = (projects || []).map((project) => ({
      id: project.id,
      videoUrl: project.input_video_url,
      resultVideoUrl: project.output_video_url,
      status: project.status,
      errorMessage: project.error_message,
      creditsCost: project.credits_used,
      downloaded: project.downloaded,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      adType: 'watermark-removal' as const, // For My Ads integration
    }));

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
