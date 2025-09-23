import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface KieCallbackData {
  taskId: string;
  resultJson?: string;
  failMsg?: string;
  errorMessage?: string;
  response?: {
    resultUrls?: string[];
  };
  resultUrls?: string[];
}

interface CharacterAdsProject {
  id: string;
  user_id: string;
  kie_image_task_id: string;
  status: string;
  current_step: string;
  generated_prompts?: Record<string, unknown>;
  video_model: string;
  generated_image_url?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Character Ads Webhook POST request received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const payload = await request.json();
    console.log('📄 Character ads webhook payload received:', JSON.stringify(payload, null, 2));

    // Extract data from KIE webhook payload
    const { code, data } = payload;

    if (!data || !data.taskId) {
      console.error('❌ No taskId found in webhook payload');
      return NextResponse.json({ error: 'No taskId in webhook payload' }, { status: 400 });
    }

    const taskId = data.taskId;
    const supabase = getSupabaseAdmin();

    console.log(`Processing Character Ads callback for taskId: ${taskId}`);

    if (code === 200) {
      // Success callback
      console.log('✅ KIE image task completed successfully');
      await handleSuccessCallback(taskId, data, supabase);
    } else if (code === 501) {
      // Failure callback
      console.log('❌ KIE image task failed');
      await handleFailureCallback(taskId, data, supabase);
    } else {
      console.log(`⚠️ Unknown callback code: ${code}`);
      return NextResponse.json({ error: 'Unknown callback code' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Character ads webhook processed successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ Character Ads Webhook processing error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabaseAdmin>) {
  try {
    // Find the character ads project by image task ID
    const { data: projects, error: findError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('kie_image_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find character ads project: ${findError.message}`);
    }

    if (!projects || projects.length === 0) {
      console.log(`⚠️ No character ads project found for image taskId: ${taskId}`);
      return;
    }

    const project = projects[0] as CharacterAdsProject;
    console.log(`Found character ads project: ${project.id}, status: ${project.status}`);

    // Extract image URL from result
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    const imageUrl = (directUrls || responseUrls || flatUrls)?.[0];

    if (!imageUrl) {
      throw new Error('No image URL in success callback');
    }

    console.log(`Image generated for project ${project.id}: ${imageUrl}`);

    // Update project with image completion
    const { error: updateError } = await supabase
      .from('character_ads_projects')
      .update({
        generated_image_url: imageUrl,
        status: 'generating_videos',
        current_step: 'generating_videos',
        progress_percentage: 60,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update project: ${updateError.message}`);
    }

    // Update Scene 0 (image scene)
    await supabase
      .from('character_ads_scenes')
      .update({
        generated_url: imageUrl,
        status: 'completed'
      })
      .eq('project_id', project.id)
      .eq('scene_number', 0);

    console.log(`Updated project ${project.id} with generated image`);

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

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function handleFailureCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabaseAdmin>) {
  try {
    // Find the character ads project by image task ID
    const { data: projects, error: findError } = await supabase
      .from('character_ads_projects')
      .select('*')
      .eq('kie_image_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find character ads project: ${findError.message}`);
    }

    if (!projects || projects.length === 0) {
      console.log(`⚠️ No character ads project found for failed image taskId: ${taskId}`);
      return;
    }

    const project = projects[0] as CharacterAdsProject;
    const failureMessage = data.failMsg || data.errorMessage || 'KIE image task failed';

    console.log(`Character ads image task failed for project ${project.id}: ${failureMessage}`);

    // Mark project as failed
    await supabase
      .from('character_ads_projects')
      .update({
        status: 'failed',
        error_message: failureMessage,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id);

    // Mark Scene 0 as failed
    await supabase
      .from('character_ads_scenes')
      .update({
        status: 'failed',
        error_message: failureMessage
      })
      .eq('project_id', project.id)
      .eq('scene_number', 0);

    console.log(`Marked project ${project.id} as failed due to image generation failure`);

  } catch (error) {
    console.error(`Error handling failure callback for taskId ${taskId}:`, error);
    throw error;
  }
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at Character Ads webhook endpoint');
  const url = new URL(request.url);
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({
    success: true,
    message: 'Character Ads webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}