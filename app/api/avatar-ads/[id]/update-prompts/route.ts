import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PATCH /api/avatar-ads/[id]/update-prompts
 *
 * Updates the generated_prompts (image and video prompts) without triggering video generation.
 * This endpoint is used for auto-save functionality in the Inspector.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { updatedPrompts } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!updatedPrompts) {
      return NextResponse.json({ error: 'updatedPrompts is required' }, { status: 400 });
    }

    // Fetch the project to ensure user owns it
    const { data: project, error: fetchError } = await supabase
      .from('avatar_ads_projects')
      .select('id, user_id, status')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow updates when project is awaiting review
    if (project.status !== 'awaiting_review') {
      return NextResponse.json(
        { error: `Cannot update prompts. Project status: ${project.status}` },
        { status: 400 }
      );
    }

    // Update only the generated_prompts field (no status change)
    const nextImagePrompt = typeof updatedPrompts?.image_prompt === 'string'
      ? updatedPrompts.image_prompt
      : null;

    const { data: updatedProject, error: updateError } = await supabase
      .from('avatar_ads_projects')
      .update({
        generated_prompts: updatedPrompts,
        image_prompt: nextImagePrompt,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update prompts:', updateError);
      return NextResponse.json({ error: 'Failed to update prompts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      project: updatedProject
    });

  } catch (error) {
    console.error('API Error in /api/avatar-ads/[id]/update-prompts:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unexpected error occurred'
    }, { status: 500 });
  }
}
