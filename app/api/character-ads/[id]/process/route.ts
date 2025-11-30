import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processCharacterAdsProject } from '@/lib/character-ads-workflow';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { step, customDialogue } = await request.json();
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
    const result = await processCharacterAdsProject(project, step, { customDialogue });

    return NextResponse.json({
      success: true,
      project: result.project,
      message: result.message,
      nextStep: result.nextStep
    });

  } catch (error) {
    console.error('❌ Process character ads project error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);

    // Try to extract as much detail as possible
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    console.error('Error message:', errorMessage);
    if (errorStack) {
      console.error('Error stack:', errorStack);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
