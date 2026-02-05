import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const resolveSessionTable = async (supabase: ReturnType<typeof getSupabaseAdmin>) => {
  const { error } = await supabase.from('project_agent_sessions').select('id').limit(1);
  if (!error) return 'project_agent_sessions';
  if (error.code === 'PGRST205') return 'avatar_ads_agent_sessions';
  throw error;
};

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sessionTable = await resolveSessionTable(supabase);

    // Schema verified via Supabase MCP (2026-01-13):
    // project_agent_sessions columns: id, user_id, project_id, intent, status, state, messages, created_at, updated_at
    const { data: session, error } = await supabase
      .from(sessionTable)
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Project Agent] Failed to fetch session:', error);
      return NextResponse.json(
        { error: 'Failed to fetch session', details: error.message },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('[Project Agent] Session GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, statePatch, messages, projectId } = body as {
      sessionId?: string;
      statePatch?: Record<string, unknown>;
      messages?: Array<{ role: string; content: string }>;
      projectId?: string | null;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sessionTable = await resolveSessionTable(supabase);

    const { data: session, error: fetchError } = await supabase
      .from(sessionTable)
      .select('state')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[Project Agent] Failed to load session for patch:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load session', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const nextState = {
      ...(session.state as Record<string, unknown> | undefined),
      ...(statePatch || {})
    };

    const { error: updateError } = await supabase
      .from(sessionTable)
      .update({
        state: nextState,
        messages: messages ?? undefined,
        project_id: projectId ?? undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Project Agent] Failed to update session:', updateError);
      return NextResponse.json(
        { error: 'Failed to update session', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Project Agent] Session PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
