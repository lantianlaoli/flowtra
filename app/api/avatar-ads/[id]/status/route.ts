import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // DEBUG LOGGING
    console.log(`[Status API] Fetching status for project: ${id}`);

    const supabase = getSupabaseAdmin();
    // Schema verified via Supabase MCP (2026-03-17):
    // avatar_ads_projects includes id, status, current_step, progress_percentage,
    // image_prompt, generated_image_url, generated_video_urls, merged_video_url, error_message.
    const { data: project, error } = await supabase
      .from('avatar_ads_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`[Status API] Error fetching project ${id}:`, error);
      return NextResponse.json(
        { error: 'Project not found', details: error },
        { status: 404 }
      );
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get scenes for this project to calculate additional fields
    const { data: scenes } = await supabase
      .from('avatar_ads_scenes')
      .select('*')
      .eq('project_id', id)
      .order('scene_number');

    // Calculate computed fields
    const has_analysis_result = !!project.image_analysis_result;
    const has_generated_prompts = !!project.generated_prompts;
    const generatedPrompts = project.generated_prompts && typeof project.generated_prompts === 'object'
      ? project.generated_prompts as Record<string, unknown>
      : null;
    const plannedSceneDurationSeconds = Array.isArray(generatedPrompts?.planned_scene_duration_seconds)
      ? generatedPrompts.planned_scene_duration_seconds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
      : [];
    const plannedTotalDurationSeconds = typeof generatedPrompts?.planned_total_duration_seconds === 'number'
      ? generatedPrompts.planned_total_duration_seconds
      : project.video_duration_seconds;
    const resolvedSpokenLanguage = typeof generatedPrompts?.resolved_spoken_language === 'string'
      ? generatedPrompts.resolved_spoken_language
      : project.language;
    const generated_video_count = scenes?.filter(scene =>
      scene.scene_number > 0 && scene.status === 'completed'  // All scenes are videos now (scene_type removed)
    ).length || 0;

    const response = {
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        video_duration_seconds: project.video_duration_seconds,
        planned_total_duration_seconds: plannedTotalDurationSeconds,
        planned_scene_duration_seconds: plannedSceneDurationSeconds,
        video_model: project.video_model || 'seedance_2_fast',
        credits_cost: project.credits_cost,
        resolved_spoken_language: resolvedSpokenLanguage,
        person_image_urls: project.person_image_urls,
        product_image_urls: project.product_image_urls,
        image_analysis_result: project.image_analysis_result,
        generated_prompts: project.generated_prompts,
        image_prompt: project.image_prompt, // Include image_prompt
        generated_image_url: project.generated_image_url,
        generated_video_urls: project.generated_video_urls,
        merged_video_url: project.merged_video_url,
        error_message: project.error_message,
        last_processed_at: project.last_processed_at,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // Add computed fields that frontend expects
        has_analysis_result,
        has_generated_prompts,
        generated_video_count,
        kie_image_task_id: project.kie_image_task_id,
        kie_video_task_ids: project.kie_video_task_ids,
        fal_merge_task_id: project.fal_merge_task_id
      },
      scenes: (scenes || []).map((scene) => ({
        id: scene.id,
        scene_number: scene.scene_number,
        status: scene.status,
        scene_prompt: scene.scene_prompt,
        video_url: scene.video_url,
        error_message: scene.error_message
      })),
      stepMessages: {
        generating_prompts: '🎭 Scripting the perfect character narrative for your product…',
        generating_image: '✨ Bringing your avatar to life – creating the perfect shot…',
        generating_videos: '🎬 Making your character magnetic on screen… engagement guaranteed!',
        merging_videos: '🎞️ Assembling the character presentation masterpiece…'
      },
      isCompleted: project.status === 'completed',
      isFailed: project.status === 'failed',
      isProcessing: ['generating_prompts', 'generating_image', 'generating_videos', 'merging_videos'].includes(project.status)
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Character ads project status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
