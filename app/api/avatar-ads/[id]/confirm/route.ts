import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processAvatarAdsProject } from '@/lib/avatar-ads-workflow';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { updatedPrompts, totalDurationSeconds } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch the project to ensure it's in the correct state
    const { data: project, error: fetchError } = await supabase
      .from('avatar_ads_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'awaiting_review') {
      return NextResponse.json({ error: `Project is not in 'awaiting_review' state. Current status: ${project.status}` }, { status: 400 });
    }

    const nextPrompts = updatedPrompts || project.generated_prompts;
    const nextScenes = Array.isArray(nextPrompts?.scenes)
      ? nextPrompts.scenes as Array<{ prompt?: Record<string, unknown> | null }>
      : [];

    const { error: deleteScenesError } = await supabase
      .from('avatar_ads_scenes')
      .delete()
      .eq('project_id', projectId);

    if (deleteScenesError) {
      console.error('Failed to clear avatar scenes before confirm:', deleteScenesError);
      return NextResponse.json({ error: 'Failed to prepare video scenes' }, { status: 500 });
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
        console.error('Failed to recreate avatar scenes before confirm:', insertScenesError);
        return NextResponse.json({ error: 'Failed to prepare video scenes' }, { status: 500 });
      }
    }

    // Update the generated prompts and transition to video generation
    const { data: updatedProject, error: updateError } = await supabase
      .from('avatar_ads_projects')
      .update({
        generated_prompts: nextPrompts,
        video_duration_seconds: typeof totalDurationSeconds === 'number' && totalDurationSeconds > 0
          ? Math.round(totalDurationSeconds)
          : project.video_duration_seconds,
        status: 'generating_videos',
        current_step: 'generating_videos',
        progress_percentage: 60,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update project and start video generation:', updateError);
      return NextResponse.json({ error: 'Failed to start video generation' }, { status: 500 });
    }

    // Trigger the workflow to continue with video generation
    // This will directly call the workflow function without waiting for the monitor-tasks cron
    // and will update its state immediately.
    void processAvatarAdsProject(updatedProject, 'generate_videos')
      .then(() => {
        console.log(`Successfully triggered video generation for project ${projectId}`);
      })
      .catch((workflowError) => {
        console.error(`Error triggering processAvatarAdsProject for ${projectId}:`, workflowError);
        // Even if triggering fails, the project status is updated, so cron will pick it up.
        // We don't want to block the user experience, so just log the error.
      });

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Video generation started successfully'
    });

  } catch (error) {
    console.error('API Error in /api/avatar-ads/[id]/confirm:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
