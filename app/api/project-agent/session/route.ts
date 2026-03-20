import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { runSupabaseQueryWithRetry } from '@/lib/supabase-retry';
import { normalizeProjectAgentVideoModel, type ProjectAgentIntent } from '@/lib/project-agent/video-model';
import { buildMotionClonePromptDrafts } from '@/lib/project-agent/motion-clone-execution';
import { MENTION_TOKEN_REGEX, parseMentionToken } from '@/lib/prompt-mention-tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LEGACY_MOTION_CLONE_PROMPT_REGEX = /appears in place of|match the original creator-video structure|preserve the same shot logic and beats|preserve the exact motion,\s*pacing,\s*rhythm,\s*and camera movement from the reference video/i;

const inferMotionCloneSelectionNamesFromPrompts = (...prompts: Array<string | null | undefined>) => {
  const labels: string[] = [];

  prompts.forEach((prompt) => {
    if (!prompt) return;
    for (const match of prompt.matchAll(MENTION_TOKEN_REGEX)) {
      const label = parseMentionToken(match[0])?.label?.trim();
      if (!label || labels.includes(label)) continue;
      labels.push(label);
    }
  });

  return {
    avatarName: labels[0] || '',
    productName: labels[1] || ''
  };
};

const normalizeSessionPatchState = (state: Record<string, unknown>) => {
  const intent = typeof state.intent === 'string'
    ? state.intent as ProjectAgentIntent
    : undefined;

  const motionClone = state.motionClone && typeof state.motionClone === 'object'
    ? { ...(state.motionClone as Record<string, unknown>) }
    : null;

  if (motionClone) {
    const photoPrompt = typeof motionClone.photoPrompt === 'string' ? motionClone.photoPrompt : '';
    const videoPrompt = typeof motionClone.videoPrompt === 'string' ? motionClone.videoPrompt : '';
    const inferredSelections = inferMotionCloneSelectionNamesFromPrompts(photoPrompt, videoPrompt);
    const selectedAvatar = motionClone.selectedAvatar && typeof motionClone.selectedAvatar === 'object'
      ? motionClone.selectedAvatar as Record<string, unknown>
      : null;
    const selectedProduct = motionClone.selectedProduct && typeof motionClone.selectedProduct === 'object'
      ? motionClone.selectedProduct as Record<string, unknown>
      : null;
    const avatarName = (typeof selectedAvatar?.name === 'string' ? selectedAvatar.name : inferredSelections.avatarName).trim();
    const productName = (typeof selectedProduct?.name === 'string' ? selectedProduct.name : inferredSelections.productName).trim();
    const needsLegacyRewrite = (
      LEGACY_MOTION_CLONE_PROMPT_REGEX.test(photoPrompt) ||
      LEGACY_MOTION_CLONE_PROMPT_REGEX.test(videoPrompt)
    );

    if (avatarName && (needsLegacyRewrite || !photoPrompt || !videoPrompt)) {
      const drafts = buildMotionClonePromptDrafts({
        avatarName,
        productName,
        referenceVideo: (motionClone.referenceVideo ?? null) as NonNullable<Parameters<typeof buildMotionClonePromptDrafts>[0]>['referenceVideo'],
      });

      motionClone.photoPrompt = drafts.photoPrompt;
      motionClone.videoPrompt = drafts.videoPrompt;
      motionClone.promptsInitialized = true;
    }
  }

  return {
    ...state,
    motionClone,
    videoModel: normalizeProjectAgentVideoModel(state.videoModel, 'kling_3', intent)
  };
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
    // Schema verified via Supabase MCP (2026-01-13):
    // project_agent_sessions columns: id, user_id, project_id, intent, status, state, messages, created_at, updated_at
    const { data: session, error } = await runSupabaseQueryWithRetry(
      () => supabase
        .from('project_agent_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
      { label: 'project-agent session GET' }
    );

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

    return NextResponse.json({
      session: {
        ...session,
        state: session.state && typeof session.state === 'object'
          ? normalizeSessionPatchState(session.state as Record<string, unknown>)
          : session.state
      }
    });
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
    // Schema verified via Supabase MCP (2026-03-09):
    // project_agent_sessions columns: id, user_id, project_id, intent, status, state, messages, created_at, updated_at
    const { data: session, error: fetchError } = await runSupabaseQueryWithRetry(
      () => supabase
        .from('project_agent_sessions')
        .select('state')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .maybeSingle(),
      { label: 'project-agent session PATCH load' }
    );

    if (fetchError) {
      console.error('[Project Agent] Failed to load session for patch:', fetchError);
      return NextResponse.json(
        { error: 'Failed to load session', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!session) {
      const nextState = normalizeSessionPatchState({ ...(statePatch || {}) });
      const insertPayload: Record<string, unknown> = {
        id: sessionId,
        user_id: userId,
        state: nextState,
        updated_at: new Date().toISOString()
      };

      if (Array.isArray(messages)) {
        insertPayload.messages = messages;
      }

      if (projectId !== undefined) {
        insertPayload.project_id = projectId;
      }

      const { error: insertError } = await runSupabaseQueryWithRetry(
        () => supabase
          .from('project_agent_sessions')
          .insert(insertPayload),
        { label: 'project-agent session PATCH insert' }
      );

      if (insertError) {
        if (insertError.code !== '23505') {
          console.error('[Project Agent] Failed to create session on patch:', insertError);
          return NextResponse.json(
            { error: 'Failed to create session', details: insertError.message },
            { status: 500 }
          );
        }

        const { data: racedSession, error: raceError } = await runSupabaseQueryWithRetry(
          () => supabase
            .from('project_agent_sessions')
            .select('user_id')
            .eq('id', sessionId)
            .maybeSingle(),
          { label: 'project-agent session PATCH race lookup' }
        );

        if (raceError) {
          console.error('[Project Agent] Failed to resolve duplicate session race on patch:', raceError);
          return NextResponse.json(
            { error: 'Failed to create session', details: raceError.message },
            { status: 500 }
          );
        }

        if (!racedSession || racedSession.user_id !== userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const nextStateForRace = normalizeSessionPatchState({
          ...(statePatch || {})
        });

        const { error: updateAfterRaceError } = await runSupabaseQueryWithRetry(
          () => supabase
            .from('project_agent_sessions')
            .update({
              state: nextStateForRace,
              messages: messages ?? undefined,
              project_id: projectId ?? undefined,
              updated_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .eq('user_id', userId),
          { label: 'project-agent session PATCH race update' }
        );

        if (updateAfterRaceError) {
          console.error('[Project Agent] Failed to update raced session on patch:', updateAfterRaceError);
          return NextResponse.json(
            { error: 'Failed to update session', details: updateAfterRaceError.message },
            { status: 500 }
          );
        }
      }
    } else {
      const nextState = normalizeSessionPatchState({
        ...(session.state as Record<string, unknown> | undefined),
        ...(statePatch || {})
      });

      const { error: updateError } = await runSupabaseQueryWithRetry(
        () => supabase
          .from('project_agent_sessions')
          .update({
            state: nextState,
            messages: messages ?? undefined,
            project_id: projectId ?? undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionId)
          .eq('user_id', userId),
        { label: 'project-agent session PATCH update' }
      );

      if (updateError) {
        console.error('[Project Agent] Failed to update session:', updateError);
        return NextResponse.json(
          { error: 'Failed to update session', details: updateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Project Agent] Session PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
