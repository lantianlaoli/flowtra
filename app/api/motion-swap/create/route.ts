import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { MOTION_SWAP_MODE } from '@/lib/motion-swap-workflow';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): motion_swap_projects
    const { data: project, error: projectError } = await supabase
      .from('motion_swap_projects')
      .insert({
        user_id: userId,
    status: 'pending',
    progress_percentage: 10,
        credits_cost: 0,
        generation_credits_used: 0,
        mode: MOTION_SWAP_MODE
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('[Motion Swap Create] Project insert error:', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Motion Swap Create] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
