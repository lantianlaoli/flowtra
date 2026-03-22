import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const internalTimestamp = request.headers.get('x-project-agent-timestamp');
    const internalSignature = request.headers.get('x-project-agent-signature');
    const hasValidInternalSignature = verifyInternalUserRequest({
      userId: internalUserId,
      timestamp: internalTimestamp,
      signature: internalSignature,
    });

    const { userId } = hasValidInternalSignature
      ? { userId: internalUserId }
      : await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): motion_clone_projects
    const { data: project, error } = await supabase
      .from('motion_clone_projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Motion Clone Status] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
