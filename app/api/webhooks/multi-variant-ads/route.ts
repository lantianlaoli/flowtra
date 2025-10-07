import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { generateVideoDesignFromCover } from '@/lib/multi-variant-ads-workflow';
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

interface MultiVariantInstance {
  id: string;
  user_id: string;
  elements_data?: Record<string, unknown>;
  product_description?: string | Record<string, unknown>;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  cover_image_size?: string | null;
  video_url?: string;
  photo_only?: boolean | null;
  status: string;
  current_step: string;
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  video_model?: string;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 Multi-Variant Ads Webhook POST request received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const payload = await request.json();
    console.log('📄 Multi-variant ads webhook payload received:', JSON.stringify(payload, null, 2));

    // Extract data from KIE webhook payload
    const { code, data } = payload;

    if (!data || !data.taskId) {
      console.error('❌ No taskId found in webhook payload');
      return NextResponse.json({ error: 'No taskId in webhook payload' }, { status: 400 });
    }

    const taskId = data.taskId;
    const supabase = getSupabase();

    console.log(`Processing Multi-Variant Ads callback for taskId: ${taskId}`);

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
      message: 'Multi-variant ads webhook processed successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ Multi-Variant Ads Webhook processing error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the multi-variant ads instance by cover task ID
    const { data: instances, error: findError } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find multi-variant ads instance: ${findError.message}`);
    }

    if (!instances || instances.length === 0) {
      console.log(`⚠️ No multi-variant ads instance found for taskId: ${taskId}`);
      return;
    }

    const instance = instances[0] as MultiVariantInstance;
    console.log(`Found multi-variant ads instance: ${instance.id}, status: ${instance.status}`);

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

async function handleCoverCompletion(instance: MultiVariantInstance, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Extract cover image URL from result
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    const coverImageUrl = (directUrls || responseUrls || flatUrls)?.[0];

    if (!coverImageUrl) {
      throw new Error('No cover image URL in success callback');
    }

    console.log(`Cover completed for instance ${instance.id}: ${coverImageUrl}`);

    const derivedSize = deriveCoverImageSize(resultJson, data, instance);
    const shouldGenerateVideo = (() => {
      if (instance.photo_only === true) return false;
      const raw = instance.elements_data as Record<string, unknown> | null | undefined;
      if (raw && typeof raw === 'object' && 'generate_video' in raw) {
        const flag = (raw as { generate_video?: unknown }).generate_video;
        if (typeof flag === 'boolean') {
          return flag;
        }
      }
      return true;
    })();

    if (!shouldGenerateVideo) {
      // Extract product description information
      const elementsData = instance.elements_data || {};
      const productDescription = elementsData.product_description || elementsData.product || {};
      
      const updatePayload: Record<string, unknown> = {
        cover_image_url: coverImageUrl,
        status: 'completed',
        current_step: 'completed',
        progress_percentage: 100,
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString(),
        elements_data: instance.elements_data || {},
        product_description: productDescription
      };

      if (derivedSize) {
        updatePayload.cover_image_size = derivedSize;
      }

      await supabase
        .from('multi_variant_ads_projects')
        .update(updatePayload)
        .eq('id', instance.id);

      console.log(`Workflow completed with images only for instance ${instance.id}`);
      return;
    }

    // Generate video design using OpenRouter with the cover image
    const videoPrompt = await generateVideoDesignFromCover(
      coverImageUrl,
      instance.elements_data || {},
      instance.id
    );

    // Start video generation with designed prompt
    const videoTaskId = await startVideoGeneration(instance, coverImageUrl, videoPrompt);

    // Update database with cover completion and video start
    // Extract product description information
    const elementsData = instance.elements_data || {};
    const productDescription = elementsData.product_description || elementsData.product || {};
    
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
      last_processed_at: new Date().toISOString(),
      product_description: productDescription
    };

    if (derivedSize) {
      updatePayload.cover_image_size = derivedSize;
    }

    await supabase
      .from('multi_variant_ads_projects')
      .update(updatePayload)
      .eq('id', instance.id);

    console.log(`Started video generation for instance ${instance.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling cover completion for instance ${instance.id}:`, error);

    // Mark instance as failed
    await supabase
      .from('multi_variant_ads_projects')
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

function deriveCoverImageSize(
  resultJson: Record<string, unknown>,
  payload: KieCallbackData,
  instance: MultiVariantInstance
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

async function startVideoGeneration(
  instance: MultiVariantInstance,
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
    includeDialogue: false,
    enableTranslation: false
  };

  console.log('VEO API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

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

async function handleFailureCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the multi-variant ads instance by cover task ID
    const { data: instances, error: findError } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find multi-variant ads instance: ${findError.message}`);
    }

    if (!instances || instances.length === 0) {
      console.log(`⚠️ No multi-variant ads instance found for failed taskId: ${taskId}`);
      return;
    }

    const instance = instances[0];
    const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    console.log(`Multi-variant ads task failed for instance ${instance.id}: ${failureMessage}`);

    // Mark instance as failed
    await supabase
      .from('multi_variant_ads_projects')
      .update({
        status: 'failed',
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

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at Multi-Variant Ads webhook endpoint');
  const url = new URL(request.url);
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({
    success: true,
    message: 'Multi-Variant Ads webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
