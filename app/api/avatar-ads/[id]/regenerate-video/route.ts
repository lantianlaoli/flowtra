import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  getAvatarPlannedTotalDurationSeconds,
  processAvatarAdsProject
} from '@/lib/avatar-ads-workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const updatedPrompts = body?.updatedPrompts && typeof body.updatedPrompts === 'object'
      ? body.updatedPrompts as Record<string, unknown>
      : undefined;
    const totalDurationSeconds = typeof body?.totalDurationSeconds === 'number' && body.totalDurationSeconds > 0
      ? Math.round(body.totalDurationSeconds)
      : null;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: project, error: fetchError } = await supabase
      .from('avatar_ads_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const nextPrompts = updatedPrompts || project.generated_prompts;
    if (!nextPrompts) {
      return NextResponse.json({ error: 'Generated prompts are missing.' }, { status: 400 });
    }
    const nextTotalDurationSeconds = totalDurationSeconds ?? getAvatarPlannedTotalDurationSeconds(
      nextPrompts as Record<string, unknown> | null | undefined,
      project.video_model === 'kling_3' ? 'kling_3' : 'veo3_fast',
      project.video_duration_seconds
    );

    const nextScenes = Array.isArray(nextPrompts?.scenes)
      ? nextPrompts.scenes as Array<{ prompt?: Record<string, unknown> | null }>
      : [];

    const { error: resetScenesError } = await supabase
      .from('avatar_ads_scenes')
      .delete()
      .eq('project_id', projectId);

    if (resetScenesError) {
      console.error('Failed to reset avatar scene videos:', resetScenesError);
      return NextResponse.json({ error: 'Failed to reset scene videos' }, { status: 500 });
    }

    if (nextScenes.length > 0) {
      const { error: insertScenesError } = await supabase
        .from('avatar_ads_scenes')
        .insert(nextScenes.map((scene, index) => ({
          project_id: projectId,
          scene_number: index + 1,
          scene_prompt: scene.prompt ?? {},
          status: 'pending'
        })));

      if (insertScenesError) {
        console.error('Failed to recreate avatar scene videos:', insertScenesError);
        return NextResponse.json({ error: 'Failed to prepare scene videos' }, { status: 500 });
      }
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('avatar_ads_projects')
      .update({
        generated_prompts: nextPrompts,
        video_duration_seconds: nextTotalDurationSeconds,
        kie_video_task_ids: null,
        generated_video_urls: null,
        merged_video_url: null,
        fal_merge_task_id: null,
        status: 'generating_videos',
        current_step: 'generating_videos',
        progress_percentage: 60,
        error_message: null,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError || !updatedProject) {
      console.error('Failed to prepare avatar video regeneration:', updateError);
      return NextResponse.json({ error: 'Failed to prepare video regeneration' }, { status: 500 });
    }

    void processAvatarAdsProject(updatedProject, 'generate_videos').catch((workflowError) => {
      console.error(`Error triggering video regeneration for avatar project ${projectId}:`, workflowError);
    });

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Video regeneration started successfully'
    });
  } catch (error) {
    console.error('API Error in /api/avatar-ads/[id]/regenerate-video:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
