import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { getSupabaseAdmin } from '@/lib/supabase';
import {
  CHARACTER_ADS_SIMULATION_SEQUENCE,
  createSimulatedCharacterAdsEvent,
  recordCharacterAdsEvent,
} from '@/lib/character-ads-tracking';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_LIMIT = 50;

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
    const simulateParam = searchParams.get('simulate');
    const shouldSimulate = simulateParam === 'true' || simulateParam === '1';

    const { data: latestEventRecords, error: latestEventError } = await supabase
      .from('character_ads_project_events')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestEventError) {
      console.error('Failed to fetch latest character ads event:', latestEventError);
    }

    let latestEvent = latestEventRecords?.[0] ?? null;

    if (shouldSimulate) {
      const simulatedEvent = await createSimulatedCharacterAdsEvent({
        projectId: id,
        userId,
        latestStatus: latestEvent?.status ?? project.status,
        additionalMetadata: {
          trigger: 'progress_poll',
          request_id: request.headers.get('x-request-id') ?? undefined
        }
      });

      if (simulatedEvent) {
        latestEvent = simulatedEvent;
      }
    }

    const limitParam = searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10;
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : 10;

    const cursorParam = searchParams.get('cursor');
    let cursorFilter: string | null = null;
    if (cursorParam) {
      const cursorDate = new Date(cursorParam);
      if (!Number.isNaN(cursorDate.getTime())) {
        cursorFilter = cursorDate.toISOString();
      }
    }

    let eventsQuery = supabase
      .from('character_ads_project_events')
      .select('*')
      .eq('project_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (cursorFilter) {
      eventsQuery = eventsQuery.gt('created_at', cursorFilter);
    }

    const eventsPromise = eventsQuery;
    const totalCountPromise = supabase
      .from('character_ads_project_events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)
      .eq('user_id', userId);
    const simulatedCountPromise = supabase
      .from('character_ads_project_events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)
      .eq('user_id', userId)
      .eq('is_simulated', true);
    const firstEventPromise = supabase
      .from('character_ads_project_events')
      .select('created_at')
      .eq('project_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    const lastEventPromise = supabase
      .from('character_ads_project_events')
      .select('created_at, status, progress_percentage, is_simulated')
      .eq('project_id', id)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    const [eventsResult, totalCountResult, simulatedCountResult, firstEventResult, lastEventResult] = await Promise.all([
      eventsPromise,
      totalCountPromise,
      simulatedCountPromise,
      firstEventPromise,
      lastEventPromise
    ]);

    if (eventsResult.error) {
      console.error('Failed to fetch character ads events:', eventsResult.error);
      return NextResponse.json(
        { error: 'Failed to load project events' },
        { status: 500 }
      );
    }

    const events = eventsResult.data ?? [];
    const totalEvents = totalCountResult.count ?? 0;
    const simulatedEvents = simulatedCountResult.count ?? 0;
    const realEvents = totalEvents - simulatedEvents;

    const firstEventAt = firstEventResult.data?.[0]?.created_at ?? null;
    const lastEventAt = lastEventResult.data?.[0]?.created_at ?? latestEvent?.created_at ?? null;

    const totalDurationSeconds = firstEventAt && lastEventAt
      ? Math.max(
          0,
          Math.round((new Date(lastEventAt).getTime() - new Date(firstEventAt).getTime()) / 1000)
        )
      : null;

    const sinceProjectCreatedSeconds = lastEventAt
      ? Math.max(
          0,
          Math.round((new Date(lastEventAt).getTime() - new Date(project.created_at).getTime()) / 1000)
        )
      : null;

    const averageIntervalSeconds = totalEvents > 1 && totalDurationSeconds !== null
      ? Math.round(totalDurationSeconds / (totalEvents - 1))
      : null;

    const latestCursor = events.length ? events[events.length - 1].created_at : cursorFilter;
    const hasMore = events.length === limit;

    const progressReferenceStatus = latestEvent?.status ?? project.status;
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

    // Capture the failure in the events table for observability when possible
    if (userId && projectId) {
      try {
        await recordCharacterAdsEvent({
          projectId,
          userId,
          status: 'failed',
          currentStep: null,
          progressPercentage: null,
          message: error instanceof Error ? error.message : 'Unknown polling error',
          metadata: {
            source: 'progress_poll',
            event: 'error'
          },
          isSimulated: true
        });
      } catch (trackingError) {
        console.error('Failed to record polling error event:', trackingError);
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
