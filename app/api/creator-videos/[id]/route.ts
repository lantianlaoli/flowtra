import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    const { error } = await supabase
      .from('creator_source_videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Creator Videos DELETE] Error:', error);
      return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Creator Videos DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
