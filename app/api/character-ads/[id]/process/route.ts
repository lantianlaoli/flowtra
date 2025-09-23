import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processCharacterAdsProject } from '@/lib/character-ads-workflow';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { step } = await request.json();
    const { id: projectId } = await params;

    if (!projectId || !step) {
      return NextResponse.json(
        { error: 'Missing project ID or step' },
        { status: 400 }
      );
    }

    // Get project from database
    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error || !project) {
      console.error('Project not found:', error);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Process the workflow step
    const result = await processCharacterAdsProject(project, step);

    return NextResponse.json({
      success: true,
      project: result.project,
      message: result.message,
      nextStep: result.nextStep
    });

  } catch (error) {
    console.error('Process character ads project error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}