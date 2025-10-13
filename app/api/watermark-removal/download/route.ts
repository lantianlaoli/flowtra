import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { projectId, userId } = await request.json();

    if (!projectId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId and userId' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get project
    const { data: project, error: fetchError } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Check if completed
    if (project.status !== 'completed' || !project.output_video_url) {
      return NextResponse.json(
        { error: 'Video not ready for download' },
        { status: 400 }
      );
    }

    // Fetch video from result URL
    const videoResponse = await fetch(project.output_video_url);
    if (!videoResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch video from storage' },
        { status: 500 }
      );
    }

    const videoBlob = await videoResponse.blob();
    const buffer = Buffer.from(await videoBlob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="flowtra-watermark-removed-${projectId}.mp4"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      {
        error: 'Failed to download video',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
