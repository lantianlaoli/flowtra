import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { CHARACTER_ADS_SIMULATION_SEQUENCE } from '@/lib/character-ads-tracking';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Events have been removed; pagination constants omitted

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  let userId: string | null = null;
  const projectId = resolvedParams?.id ?? null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
    const id = projectId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: project, error: projectError } = await supabase
      .from('character_ads_projects')
      .select('id, user_id, status, current_step, progress_percentage, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    // Events table removed: no simulation or latest event lookups
    const latestEvent = null;

    // Pagination params retained for compatibility, but unused since events are removed

    const cursorParam = searchParams.get('cursor');
    let cursorFilter: string | null = null;
    if (cursorParam) {
      const cursorDate = new Date(cursorParam);
      if (!Number.isNaN(cursorDate.getTime())) {
        cursorFilter = cursorDate.toISOString();
      }
    }

    // Events table removed: return empty events and derived defaults
    const events: unknown[] = [];
    const totalEvents = 0;
    const simulatedEvents = 0;
    const realEvents = 0;
    const firstEventAt = null;
    const lastEventAt = null;
    const totalDurationSeconds = null;
    const sinceProjectCreatedSeconds = null;
    const averageIntervalSeconds = null;
    const latestCursor = cursorFilter;
    const hasMore = false;

    const progressReferenceStatus = project.status;
    const latestStepIndex = CHARACTER_ADS_SIMULATION_SEQUENCE.findIndex(
      (entry) => entry.status === progressReferenceStatus
    );

    const stageSnapshot = CHARACTER_ADS_SIMULATION_SEQUENCE.map((entry, index) => ({
      status: entry.status,
      current_step: entry.step,
      target_progress: entry.progress,
      completed: latestStepIndex >= 0 ? index <= latestStepIndex : entry.status === project.status
    }));

    const responsePayload = {
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        created_at: project.created_at,
        updated_at: project.updated_at
      },
      events,
      latest_event: latestEvent,
      cursor: latestCursor,
      has_more: hasMore,
      metrics: {
        total_events: totalEvents,
        simulated_events: simulatedEvents,
        real_events: realEvents,
        first_event_at: firstEventAt,
        last_event_at: lastEventAt,
        total_duration_seconds: totalDurationSeconds,
        average_interval_seconds: averageIntervalSeconds,
        since_project_created_seconds: sinceProjectCreatedSeconds
      },
      stage_snapshot: stageSnapshot
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Character ads progress polling error:', error);

    // No event recording

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
