import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { removeStorageObjectWithFallback } from '@/lib/storage/ops';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-26): creator_source_videos has id and user_id columns.
    const { data, error } = await supabase
      .from('creator_source_videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      console.error('[Creator Videos GET] Error:', error);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({ video: data });
  } catch (error) {
    console.error('[Creator Videos GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-28): creator_source_videos has id and user_id columns.
    const { data: existingVideo, error: fetchError } = await supabase
      .from('creator_source_videos')
      .select('id, user_id, video_url, video_cdn_url, cover_url, storage_bucket, storage_path, cover_storage_bucket, cover_storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingVideo) {
      console.error('[Creator Videos DELETE] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('creator_source_videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Creator Videos DELETE] Error:', error);
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
    }

    const cleanupTargets = [
      {
        bucket: existingVideo.storage_bucket,
        path: existingVideo.storage_path,
        publicUrl: existingVideo.video_cdn_url || existingVideo.video_url
      },
      {
        bucket: existingVideo.cover_storage_bucket,
        path: existingVideo.cover_storage_path,
        publicUrl: existingVideo.cover_url
      }
    ];

    for (const target of cleanupTargets) {
      try {
        await removeStorageObjectWithFallback(supabase, target);
      } catch (storageError) {
        console.warn('[Creator Videos DELETE] Failed to remove storage object:', storageError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Creator Videos DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
