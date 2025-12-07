import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('id,user_id,photo_only,video_generation_requested,cover_image_url')
      .eq('id', id)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (project.photo_only) {
      return NextResponse.json({ error: 'Replica photo projects cannot generate video.' }, { status: 400 });
    }

    if (!project.cover_image_url) {
      return NextResponse.json({ error: 'Cover image not ready yet. Please wait a moment and try again.' }, { status: 409 });
    }

    if (project.video_generation_requested) {
      return NextResponse.json({ success: true, message: 'Video generation already requested.' });
    }

    const { error: updateError } = await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        video_generation_requested: true,
        current_step: 'ready_for_video',
        status: 'processing',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update video_generation_requested flag:', updateError);
      return NextResponse.json({ error: 'Failed to enqueue video generation' }, { status: 500 });
    }

    // Trigger monitor to process this project immediately (best-effort)
    try {
      const monitorUrl = new URL('/api/competitor-ugc-replication/monitor-tasks', request.nextUrl.origin);
      await fetch(monitorUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id })
      });
    } catch (monitorError) {
      console.warn('Failed to trigger monitor after start-video:', monitorError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('start-video API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
