import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { processCharacterAdsProject } from '@/lib/character-ads-workflow';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export async function POST() {
  try {
    console.log('Starting character ads task monitoring...');

    // Find projects that need monitoring
    const supabase = getSupabaseAdmin();
    const { data: projects, error } = await supabase
      .from('character_ads_projects')
      .select('*')
      .in('status', [
        'analyzing_images',
        'generating_prompts',
        'generating_image',
        'generating_videos',
        'merging_videos'
      ])
      .order('last_processed_at', { ascending: true, nullsFirst: true })
      .limit(20); // Process max 20 projects per run

    if (error) {
      console.error('Error fetching character ads projects:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    console.log(`Found ${projects?.length || 0} character ads projects to monitor`);
    console.log('Projects details:', projects?.map(p => ({
      id: p.id,
      status: p.status,
      current_step: p.current_step,
      fal_merge_task_id: p.fal_merge_task_id,
      merged_video_url: p.merged_video_url,
      last_processed_at: p.last_processed_at
    })));

    let processed = 0;
    let completed = 0;
    let failed = 0;

    if (Array.isArray(projects) && projects.length > 0) {
      for (const project of projects) {
        console.log(`Processing project ${project.id} (status: ${project.status}, step: ${project.current_step})`);

        try {
          console.log(`About to call processCharacterAdsProjectStep for project ${project.id}`);
          await processCharacterAdsProjectStep(project);
          console.log(`Successfully processed project ${project.id}`);
          processed++;
        } catch (error) {
          console.error(`Error processing project ${project.id}:`, error);

          // Mark project as failed
          await supabase
            .from('character_ads_projects')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Processing error',
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);
          failed++;
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Count completed projects from this run
      const { count: completedCount } = await supabase
        .from('character_ads_projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Updated in last minute

      completed = completedCount || 0;
    }

    console.log(`Character ads task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalProjects: projects?.length || 0,
      message: 'Character ads task monitoring completed'
    });

  } catch (error) {
    console.error('Character ads task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

interface CharacterAdsProject {
  id: string;
  user_id: string;
  person_image_urls: string[];
  product_image_urls: string[];
  video_duration_seconds: number;
  image_model: string;
  video_model: string;
  status: string;
  current_step: string;
  progress_percentage: number;
  image_analysis_result?: Record<string, unknown>;
  generated_prompts?: Record<string, unknown>;
  generated_image_url?: string;
  generated_video_urls?: string[];
  merged_video_url?: string;
  kie_image_task_id?: string;
  kie_video_task_ids?: string[];
  fal_merge_task_id?: string;
  error_message?: string;
  last_processed_at?: string;
  created_at: string;
  updated_at: string;
}

async function processCharacterAdsProjectStep(project: CharacterAdsProject) {
  const supabase = getSupabaseAdmin();
  console.log(`Processing project ${project.id}, step: ${project.current_step}, status: ${project.status}`);

  // Check if callback URL is empty - if so, actively poll for image progress
  const hasCallback = !!process.env.KIE_CHARACTER_ADS_CALLBACK_URL;

  // Handle timeout checks first
  if (project.last_processed_at) {
    const lastProcessed = new Date(project.last_processed_at).getTime();
    const now = Date.now();
    let timeoutMinutes = 15; // Default timeout

    // Different timeouts for different steps
    switch (project.current_step) {
      case 'generating_videos':
      case 'merging_videos':
        timeoutMinutes = 30;
        break;
      case 'generating_image':
        timeoutMinutes = 20;
        break;
      default:
        timeoutMinutes = 15;
    }

    if (now - lastProcessed > timeoutMinutes * 60 * 1000) {
      throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
    }
  }

  // Handle image generation monitoring specifically
  if (project.status === 'generating_image' && project.kie_image_task_id && !project.generated_image_url) {
    // Only check status if no callback URL is configured
    if (!hasCallback) {
      const imageResult = await checkKieImageStatus(project.kie_image_task_id);

      if (imageResult.status === 'SUCCESS' && imageResult.imageUrl) {
        console.log(`Image completed for project ${project.id}`);

        // Update project with image completion
        await supabase
          .from('character_ads_projects')
          .update({
            generated_image_url: imageResult.imageUrl,
            status: 'generating_videos',
            current_step: 'generating_videos',
            progress_percentage: 60,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id);

        // Update Scene 0 (image scene)
        await supabase
          .from('character_ads_scenes')
          .update({
            generated_url: imageResult.imageUrl,
            status: 'completed'
          })
          .eq('project_id', project.id)
          .eq('scene_number', 0);

        // Trigger next step - video generation
        try {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
          await fetch(`${baseUrl}/api/character-ads/${project.id}/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 'generate_videos' })
          });
          console.log(`Triggered video generation for project ${project.id}`);
        } catch (triggerError) {
          console.error(`Failed to trigger video generation for project ${project.id}:`, triggerError);
          // Don't fail the webhook - the video generation can be triggered by polling
        }

      } else if (imageResult.status === 'FAILED') {
        throw new Error('Image generation failed');
      }
      // If still generating, update progress
      else if (imageResult.status === 'GENERATING') {
        await supabase
          .from('character_ads_projects')
          .update({
            progress_percentage: 40,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id);
      }
    }
    // If callback URL exists, just update last_processed_at
    else {
      await supabase
        .from('character_ads_projects')
        .update({ last_processed_at: new Date().toISOString() })
        .eq('id', project.id);
    }
    return;
  }

  // Determine the next step to trigger based on current state
  let nextStep: string | null = null;

  switch (project.status) {
    case 'analyzing_images':
      if (project.current_step === 'analyzing_images' && !project.image_analysis_result) {
        nextStep = 'analyze_images';
      } else if (project.image_analysis_result && !project.generated_prompts) {
        nextStep = 'generate_prompts';
      }
      break;

    case 'generating_prompts':
      if (!project.generated_prompts) {
        nextStep = 'generate_prompts';
      } else if (project.generated_prompts && !project.kie_image_task_id) {
        nextStep = 'generate_image';
      }
      break;

    case 'generating_image':
      if (!project.kie_image_task_id) {
        nextStep = 'generate_image';
      } else if (project.kie_image_task_id && !project.generated_image_url) {
        // This case is handled above with active polling
        nextStep = null;
      } else if (project.generated_image_url && !project.kie_video_task_ids?.length) {
        nextStep = 'generate_videos';
      }
      break;

    case 'generating_videos':
      if (project.generated_image_url && !project.kie_video_task_ids?.length) {
        nextStep = 'generate_videos';
      } else if (project.kie_video_task_ids?.length && !project.generated_video_urls?.length) {
        nextStep = 'check_videos_status';
      } else if (project.generated_video_urls?.length && !project.fal_merge_task_id) {
        nextStep = 'merge_videos';
      }
      break;

    case 'merging_videos':
      if (!project.fal_merge_task_id) {
        nextStep = 'merge_videos';
      } else if (project.fal_merge_task_id && !project.merged_video_url) {
        nextStep = 'check_merge_status';
      }
      break;
  }

  // If we determined a next step, process it
  if (nextStep) {
    console.log(`Triggering step '${nextStep}' for project ${project.id}`);
    console.log(`Project details before processing:`, {
      status: project.status,
      current_step: project.current_step,
      fal_merge_task_id: project.fal_merge_task_id,
      merged_video_url: project.merged_video_url
    });

    const result = await processCharacterAdsProject(project, nextStep);

    console.log(`Step '${nextStep}' completed for project ${project.id}:`, result.message);
    console.log(`Result details:`, {
      project_status: result.project?.status,
      project_current_step: result.project?.current_step,
      project_merged_video_url: result.project?.merged_video_url,
      nextStep: result.nextStep
    });

    // If the step completed successfully and there's a next step, we'll catch it in the next monitoring cycle
    if (result.nextStep) {
      console.log(`Next step for project ${project.id}: ${result.nextStep}`);
    }
  } else {
    // No step needed, just update last_processed_at to show we checked
    await supabase
      .from('character_ads_projects')
      .update({
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id);

    console.log(`No action needed for project ${project.id} (status: ${project.status}, step: ${project.current_step})`);
  }
}

async function checkKieImageStatus(taskId: string): Promise<{status: string, imageUrl?: string}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 3, 15000);

  if (!response.ok) {
    throw new Error(`Failed to check KIE image status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.code !== 200) {
    throw new Error(data?.message || 'Failed to get KIE image status');
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'GENERATING' };
  }

  // Normalize state flags and extract URL robustly
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

  let resultJson: Record<string, unknown> = {};
  try {
    resultJson = JSON.parse(taskData.resultJson || '{}');
  } catch {
    resultJson = {};
  }

  const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
    ? (resultJson as { resultUrls?: string[] }).resultUrls
    : undefined;
  const responseUrls = Array.isArray(taskData.response?.resultUrls)
    ? (taskData.response.resultUrls as string[])
    : undefined;
  const flatUrls = Array.isArray(taskData.resultUrls)
    ? (taskData.resultUrls as string[])
    : undefined;
  const imageUrl = (directUrls || responseUrls || flatUrls)?.[0];

  const isSuccess = (state && state.toLowerCase() === 'success') || successFlag === 1 || (!!imageUrl && (state === undefined));
  const isFailed = (state && state.toLowerCase() === 'failed') || successFlag === 2 || successFlag === 3;

  if (isSuccess) {
    return { status: 'SUCCESS', imageUrl };
  }
  if (isFailed) {
    return { status: 'FAILED' };
  }
  return { status: 'GENERATING' };
}