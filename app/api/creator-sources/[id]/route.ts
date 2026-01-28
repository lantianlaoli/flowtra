import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const sourceName = typeof body.source_name === 'string' ? body.source_name.trim() : '';

    if (!sourceName) {
      return NextResponse.json({ error: 'Source name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-28): creator_sources
    const { data: source, error } = await supabase
      .from('creator_sources')
      .update({ source_name: sourceName })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !source) {
      console.error('[Creator Sources PUT] Error:', error);
      return NextResponse.json({ error: 'Failed to update creator source' }, { status: 500 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    console.error('[Creator Sources PUT] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-01-28): creator_sources
    const { error } = await supabase
      .from('creator_sources')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[Creator Sources DELETE] Error:', error);
      return NextResponse.json({ error: 'Failed to delete creator source' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Creator Sources DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
