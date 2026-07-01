import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { MOTION_CLONE_DEFAULT_VIDEO_MODEL, MOTION_CLONE_MODE } from '@/lib/motion-clone-workflow';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
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

    const supabase = getSupabaseAdmin();

    // Schema verified via Supabase MCP (2026-02-01): motion_clone_projects
    const { data: project, error: projectError } = await supabase
      .from('motion_clone_projects')
      .insert({
        user_id: userId,
    status: 'pending',
    progress_percentage: 10,
        credits_cost: 0,
        generation_credits_used: 0,
        mode: MOTION_CLONE_MODE,
        video_model: MOTION_CLONE_DEFAULT_VIDEO_MODEL
      })
      .select()
      .single();

    if (projectError || !project) {
      console.error('[Motion Clone Create] Project insert error:', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    captureServerEvent(ANALYTICS_EVENTS.motion_clone_project_created, {
      distinctId: userId,
      request,
      properties: {
        feature: 'motion_clone',
        surface: 'motion_clone_create_api',
        project_id: project.id,
        workflow: MOTION_CLONE_MODE,
        video_model: project.video_model,
        credits_cost: project.credits_cost,
      }
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('[Motion Clone Create] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
