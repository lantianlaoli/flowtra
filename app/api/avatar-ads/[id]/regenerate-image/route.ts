import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processAvatarAdsProject } from '@/lib/avatar-ads-workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const body = await request.json();
    const { imagePrompt } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the project to ensure it exists
    const { data: project, error: fetchError } = await supabase
      .from('avatar_ads_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Preserve review state during image regeneration - only clear webhook flag.
    // Note: current_step must satisfy DB check constraint; use existing enum value.
    const updateData: any = {
      // Keep generated_image_url to preserve preview button visibility
      kie_image_task_id: null,
      webhook_received_at: null,
      // Keep status as 'awaiting_review' to maintain UI state
      current_step: 'generating_image',
      // Ensure progress stays at 60% (never regress)
      progress_percentage: 60,
      last_processed_at: new Date().toISOString()
    };

    if (imagePrompt) {
      updateData.image_prompt = imagePrompt;
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('avatar_ads_projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update project for image regeneration:', updateError);
      return NextResponse.json({ error: 'Failed to start image regeneration' }, { status: 500 });
    }

    // Trigger the workflow
    try {
      await processAvatarAdsProject(updatedProject, 'generate_image');
      console.log(`Successfully triggered image regeneration for project ${projectId}`);
    } catch (workflowError) {
      console.error(`Error triggering processAvatarAdsProject for ${projectId}:`, workflowError);
      // Workflow error is logged but we return success as the state is updated and cron will pick it up if immediate fail
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Image regeneration started'
    });

  } catch (error) {
    console.error('API Error in /api/avatar-ads/[id]/regenerate-image:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
