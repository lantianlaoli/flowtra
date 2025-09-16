import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { generateVideoDesignFromCover } from '@/lib/workflow-v2';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

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

// Remove custom SupabaseClient interface, use the actual type from lib

interface WorkflowInstance {
  id: string;
  user_id: string;
  elements_data?: Record<string, unknown>;
  product_description?: string;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  video_url?: string;
  instance_status: string;
  current_step: string;
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  video_model?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 KIE Webhook POST request received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const payload = await request.json();

    console.log('📄 KIE webhook payload received:', JSON.stringify(payload, null, 2));

    // Extract data from KIE webhook payload
    const { code, data } = payload;

    if (!data || !data.taskId) {
      console.error('❌ No taskId found in webhook payload');
      return NextResponse.json({ error: 'No taskId in webhook payload' }, { status: 400 });
    }

    const taskId = data.taskId;
    const supabase = getSupabase();

    console.log(`Processing KIE callback for taskId: ${taskId}`);

    if (code === 200) {
      // Success callback
      console.log('✅ KIE task completed successfully');
      await handleSuccessCallback(taskId, data, supabase);
    } else if (code === 501) {
      // Failure callback
      console.log('❌ KIE task failed');
      await handleFailureCallback(taskId, data, supabase);
    } else {
      console.log(`⚠️ Unknown callback code: ${code}`);
      return NextResponse.json({ error: 'Unknown callback code' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ KIE Webhook processing error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the workflow instance with this cover task ID
    const { data: instances, error: findError } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find workflow instance: ${findError.message}`);
    }

    if (!instances || instances.length === 0) {
      console.log(`⚠️ No workflow instance found for taskId: ${taskId}`);
      return;
    }

    const instance = instances[0];
    console.log(`Found workflow instance: ${instance.id}, status: ${instance.instance_status}`);

    // Handle cover task completion
    if (instance.cover_task_id === taskId) {
      await handleCoverCompletion(instance, data, supabase);
    } else {
      console.log(`⚠️ TaskId ${taskId} doesn't match cover task for instance ${instance.id}`);
    }

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function handleCoverCompletion(instance: WorkflowInstance, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Extract cover image URL from result
    const resultJson = JSON.parse(data.resultJson || '{}');
    const coverImageUrl = resultJson.resultUrls?.[0];

    if (!coverImageUrl) {
      throw new Error('No cover image URL in success callback');
    }

    console.log(`Cover completed for instance ${instance.id}: ${coverImageUrl}`);

    // Generate video design using OpenRouter with the cover image
    const videoPrompt = await generateVideoDesignFromCover(
      coverImageUrl,
      instance.elements_data,
      instance.product_description
    );

    // Start video generation with designed prompt
    const videoTaskId = await startVideoGeneration(instance, coverImageUrl, videoPrompt);

    // Update database with cover completion and video start
    await supabase
      .from('user_history_v2')
      .update({
        cover_image_url: coverImageUrl,
        video_task_id: videoTaskId,
        elements_data: {
          ...(instance.elements_data || {}),
          video_prompt: videoPrompt
        },
        instance_status: 'generating_video',
        current_step: 'generating_video',
        progress_percentage: 50,
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    console.log(`Started video generation for instance ${instance.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling cover completion for instance ${instance.id}:`, error);

    // Mark instance as failed
    await supabase
      .from('user_history_v2')
      .update({
        instance_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Cover completion processing failed',
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    throw error;
  }
}


async function handleFailureCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the workflow instance with this cover task ID
    const { data: instances, error: findError } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find workflow instance: ${findError.message}`);
    }

    if (!instances || instances.length === 0) {
      console.log(`⚠️ No workflow instance found for failed taskId: ${taskId}`);
      return;
    }

    const instance = instances[0];
    const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    console.log(`Task failed for instance ${instance.id}: ${failureMessage}`);

    // Mark instance as failed
    await supabase
      .from('user_history_v2')
      .update({
        instance_status: 'failed',
        error_message: failureMessage,
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', instance.id);

  } catch (error) {
    console.error(`Error handling failure callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function startVideoGeneration(
  instance: WorkflowInstance,
  coverImageUrl: string,
  videoPrompt: {
    description: string;
    setting: string;
    camera_type: string;
    camera_movement: string;
    action: string;
    lighting: string;
    other_details: string;
    dialogue: string;
    music: string;
    ending: string;
  }
): Promise<string> {
  const finalPrompt = `Create a short, cinematic product ad video based on the provided cover image. Maintain consistency with the cover's style, layout, and color palette.

Description: ${videoPrompt.description}
Setting: ${videoPrompt.setting}
Camera: ${videoPrompt.camera_type}
Camera Movement: ${videoPrompt.camera_movement}
Action: ${videoPrompt.action}
Lighting: ${videoPrompt.lighting}
Other Details: ${videoPrompt.other_details}
Dialogue: ${videoPrompt.dialogue}
Music: ${videoPrompt.music}
Ending: ${videoPrompt.ending}`;

  console.log('Generated video prompt:', finalPrompt);

  const requestBody: Record<string, unknown> = {
    prompt: finalPrompt,
    model: instance.video_model || 'veo3_fast',
    aspectRatio: "16:9",
    imageUrls: [coverImageUrl],
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: false,
    includeDialogue: false
  };

  // Note: Video generation uses polling mechanism, no callback URL needed

  console.log('VEO API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to generate video: ${response.status} ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate video');
  }

  return data.data.taskId;
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at KIE webhook endpoint');
  const url = new URL(request.url);
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({
    success: true,
    message: 'KIE webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}