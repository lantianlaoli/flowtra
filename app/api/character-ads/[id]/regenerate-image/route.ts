import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processCharacterAdsProject } from '@/lib/character-ads-workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imagePrompt } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the project to ensure it exists and belongs to user
    const { data: project, error: fetchError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Reset image generation state
    const updateData: any = {
      generated_image_url: null,
      kie_image_task_id: null,
      status: 'generating_image',
      current_step: 'generating_image',
      progress_percentage: 40,
      last_processed_at: new Date().toISOString()
    };

    if (imagePrompt) {
      updateData.image_prompt = imagePrompt;
    }

    const { data: updatedProject, error: updateError } = await supabase
      .from('character_ads_projects')
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
      await processCharacterAdsProject(updatedProject, 'generate_image');
      console.log(`Successfully triggered image regeneration for project ${projectId}`);
    } catch (workflowError) {
      console.error(`Error triggering processCharacterAdsProject for ${projectId}:`, workflowError);
      // Workflow error is logged but we return success as the state is updated and cron will pick it up if immediate fail
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
      message: 'Image regeneration started'
    });

  } catch (error) {
    console.error('API Error in /api/character-ads/[id]/regenerate-image:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
