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
  cover_image_size?: string | null;
  video_url?: string;
  status: string;
  current_step: string;
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  video_model?: string;
}

interface V1WorkflowRecord {
  id: string;
  user_id: string;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  video_url?: string;
  status: string;
  current_step: string;
  video_prompts?: Record<string, unknown>;
  video_model?: string;
  last_processed_at: string;
}

type VideoPrompt = {
  description: string;
  setting: string;
  camera_type: string;
  camera_movement: string;
  action: string;
  lighting: string;
  dialogue: string;
  music: string;
  ending: string;
  other_details: string;
};

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

function deriveCoverImageSize(
  resultJson: Record<string, unknown>,
  payload: KieCallbackData,
  instance: WorkflowInstance
): string | null {
  const candidates: Array<string | null> = [];

  candidates.push(normalizeImageSizeInput(resultJson['imageSize']));
  candidates.push(normalizeImageSizeInput(resultJson['image_size']));
  candidates.push(normalizeImageSizeInput(resultJson['size']));
  candidates.push(normalizeImageSizeInput(resultJson['meta']));
  candidates.push(normalizeImageSizeInput(resultJson['metadata']));

  const jobParam = resultJson['jobParam'] as Record<string, unknown> | undefined;
  candidates.push(normalizeImageSizeInput(jobParam ? jobParam['image_size'] : undefined));
  candidates.push(normalizeImageSizeInput(jobParam ? jobParam['imageSize'] : undefined));

  candidates.push(normalizeImageSizeInput(resultJson['input']));
  candidates.push(normalizeImageSizeInput(payload.response));

  const elementsImageSize = instance.elements_data && (instance.elements_data as Record<string, unknown>).image_size;
  candidates.push(normalizeImageSizeInput(elementsImageSize));
  candidates.push(normalizeImageSizeInput(instance.cover_image_size));

  for (const value of candidates) {
    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeImageSizeInput(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number') {
    return value > 0 ? `${Math.round(value)}` : null;
  }

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [width, height] = value;
      const normalizedWidth = normalizeDimension(width);
      const normalizedHeight = normalizeDimension(height);
      if (normalizedWidth && normalizedHeight) {
        return `${normalizedWidth}x${normalizedHeight}`;
      }
    }
    return null;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    const nestedKeys = ['imageSize', 'image_size', 'size', 'outputSize', 'output_size'];
    for (const key of nestedKeys) {
      const nested = normalizeImageSizeInput(obj[key]);
      if (nested) {
        return nested;
      }
    }

    const widthKeys = ['width', 'Width', 'w', 'imageWidth'];
    const heightKeys = ['height', 'Height', 'h', 'imageHeight'];

    let widthCandidate: string | null = null;
    let heightCandidate: string | null = null;

    for (const key of widthKeys) {
      const valueAtKey = obj[key];
      const normalized = normalizeDimension(valueAtKey);
      if (normalized) {
        widthCandidate = normalized;
        break;
      }
    }

    for (const key of heightKeys) {
      const valueAtKey = obj[key];
      const normalized = normalizeDimension(valueAtKey);
      if (normalized) {
        heightCandidate = normalized;
        break;
      }
    }

    if (widthCandidate && heightCandidate) {
      return `${widthCandidate}x${heightCandidate}`;
    }
  }

  return null;
}

function normalizeDimension(value: unknown): string | null {
  if (typeof value === 'number') {
    return value > 0 ? `${Math.round(value)}` : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

async function handleSuccessCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Try to find the workflow instance in V2 table first
    const { data: v2Instances, error: v2FindError } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('cover_task_id', taskId);

    if (v2FindError) {
      throw new Error(`Failed to find V2 workflow instance: ${v2FindError.message}`);
    }

    // If found in V2, handle as V2 workflow
    if (v2Instances && v2Instances.length > 0) {
      const instance = v2Instances[0];
      console.log(`Found V2 workflow instance: ${instance.id}, status: ${instance.status}`);

      if (instance.cover_task_id === taskId) {
        await handleV2CoverCompletion(instance, data, supabase);
      } else {
        console.log(`⚠️ TaskId ${taskId} doesn't match cover task for V2 instance ${instance.id}`);
      }
      return;
    }

    // If not found in V2, try V1 table
    const { data: v1Records, error: v1FindError } = await supabase
      .from('user_history')
      .select('*')
      .eq('cover_task_id', taskId);

    if (v1FindError) {
      throw new Error(`Failed to find V1 workflow record: ${v1FindError.message}`);
    }

    if (v1Records && v1Records.length > 0) {
      const record = v1Records[0];
      console.log(`Found V1 workflow record: ${record.id}, status: ${record.status}`);

      if (record.cover_task_id === taskId) {
        await handleV1CoverCompletion(record, data, supabase);
      } else {
        console.log(`⚠️ TaskId ${taskId} doesn't match cover task for V1 record ${record.id}`);
      }
      return;
    }

    console.log(`⚠️ No workflow instance found in V1 or V2 for taskId: ${taskId}`);

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function handleV2CoverCompletion(instance: WorkflowInstance, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Extract cover image URL from result
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const resultUrls = resultJson['resultUrls'];
    const coverImageUrl = Array.isArray(resultUrls) ? resultUrls[0] : undefined;

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
    const updatePayload: Record<string, unknown> = {
      cover_image_url: coverImageUrl,
      video_task_id: videoTaskId,
      elements_data: {
        ...(instance.elements_data || {}),
        video_prompt: videoPrompt
      },
      status: 'generating_video',
      current_step: 'generating_video',
      progress_percentage: 50,
      updated_at: new Date().toISOString(),
      last_processed_at: new Date().toISOString()
    };

    const derivedSize = deriveCoverImageSize(resultJson, data, instance);
    if (derivedSize) {
      updatePayload.cover_image_size = derivedSize;
    }

    await supabase
      .from('user_history_v2')
      .update(updatePayload)
      .eq('id', instance.id);

    console.log(`Started video generation for instance ${instance.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling cover completion for instance ${instance.id}:`, error);

    // Mark instance as failed
    await supabase
      .from('user_history_v2')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Cover completion processing failed',
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', instance.id);

    throw error;
  }
}

async function handleV1CoverCompletion(record: V1WorkflowRecord, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Extract cover image URL from result
    const resultJson = JSON.parse(data.resultJson || '{}');
    const coverImageUrl = resultJson.resultUrls?.[0];

    if (!coverImageUrl) {
      throw new Error('No cover image URL in success callback for V1');
    }

    console.log(`V1 Cover completed for record ${record.id}: ${coverImageUrl}`);

    // For V1, start video generation directly without complex video design
    const videoTaskId = await startV1VideoGeneration(record, coverImageUrl);

    // Update V1 database with cover completion and video start
    await supabase
      .from('user_history')
      .update({
        cover_image_url: coverImageUrl,
        video_task_id: videoTaskId,
        current_step: 'generating_video',
        progress_percentage: 85,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    console.log(`Started V1 video generation for record ${record.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling V1 cover completion for record ${record.id}:`, error);

    // Mark V1 record as failed
    await supabase
      .from('user_history')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'V1 cover completion processing failed',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    throw error;
  }
}

async function startV1VideoGeneration(record: V1WorkflowRecord, coverImageUrl: string): Promise<string> {
  if (!record.video_prompts) {
    throw new Error('No creative prompts available for V1 video generation');
  }

  const videoPrompt = record.video_prompts as VideoPrompt;
  const fullPrompt = `${videoPrompt.description}

Setting: ${videoPrompt.setting}
Camera: ${videoPrompt.camera_type} with ${videoPrompt.camera_movement}
Action: ${videoPrompt.action}
Lighting: ${videoPrompt.lighting}
Dialogue: ${videoPrompt.dialogue}
Music: ${videoPrompt.music}
Ending: ${videoPrompt.ending}
Other details: ${videoPrompt.other_details}`;

  console.log('Generated V1 video prompt:', fullPrompt);

  const requestBody = {
    prompt: fullPrompt,
    model: record.video_model || 'veo3_fast',
    aspectRatio: "16:9",
    imageUrls: [coverImageUrl],
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: true,
    includeDialogue: true
  };

  console.log('V1 VEO API request body:', JSON.stringify(requestBody, null, 2));

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
    throw new Error(`Failed to generate V1 video: ${response.status} ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate V1 video');
  }

  return data.data.taskId;
}


async function handleFailureCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Try to find the workflow instance in V2 table first
    const { data: v2Instances, error: v2FindError } = await supabase
      .from('user_history_v2')
      .select('*')
      .eq('cover_task_id', taskId);

    if (v2FindError) {
      throw new Error(`Failed to find V2 workflow instance: ${v2FindError.message}`);
    }

    // If found in V2, handle as V2 workflow failure
    if (v2Instances && v2Instances.length > 0) {
      const instance = v2Instances[0];
      const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

      console.log(`V2 task failed for instance ${instance.id}: ${failureMessage}`);

      // Mark V2 instance as failed
      await supabase
        .from('user_history_v2')
        .update({
          status: 'failed',
          error_message: failureMessage,
          updated_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString()
        })
        .eq('id', instance.id);
      return;
    }

    // If not found in V2, try V1 table
    const { data: v1Records, error: v1FindError } = await supabase
      .from('user_history')
      .select('*')
      .eq('cover_task_id', taskId);

    if (v1FindError) {
      throw new Error(`Failed to find V1 workflow record: ${v1FindError.message}`);
    }

    if (v1Records && v1Records.length > 0) {
      const record = v1Records[0];
      const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

      console.log(`V1 task failed for record ${record.id}: ${failureMessage}`);

      // Mark V1 record as failed
      await supabase
        .from('user_history')
        .update({
          status: 'failed',
          error_message: failureMessage,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      return;
    }

    console.log(`⚠️ No workflow instance found in V1 or V2 for failed taskId: ${taskId}`);

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
