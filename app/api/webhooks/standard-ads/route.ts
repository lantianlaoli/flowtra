import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
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

interface StandardAdsRecord {
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
  photo_only?: boolean | null;
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
    console.log('📨 Standard Ads Webhook POST request received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const payload = await request.json();
    console.log('📄 Standard ads webhook payload received:', JSON.stringify(payload, null, 2));

    // Extract data from KIE webhook payload
    const { code, data } = payload;

    if (!data || !data.taskId) {
      console.error('❌ No taskId found in webhook payload');
      return NextResponse.json({ error: 'No taskId in webhook payload' }, { status: 400 });
    }

    const taskId = data.taskId;
    const supabase = getSupabase();

    console.log(`Processing Standard Ads callback for taskId: ${taskId}`);

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
      message: 'Standard ads webhook processed successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ Standard Ads Webhook processing error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessCallback(taskId: string, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the standard ads record by cover task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find standard ads record: ${findError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No standard ads record found for taskId: ${taskId}`);
      return;
    }

    const record = records[0] as StandardAdsRecord;
    console.log(`Found standard ads record: ${record.id}, status: ${record.status}`);

    if (record.cover_task_id === taskId) {
      await handleCoverCompletion(record, data, supabase);
    } else {
      console.log(`⚠️ TaskId ${taskId} doesn't match cover task for record ${record.id}`);
    }

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function handleCoverCompletion(record: StandardAdsRecord, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
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

    console.log(`Cover completed for record ${record.id}: ${coverImageUrl}`);

    // If photo_only flag is set, complete without video
    if (record.photo_only === true) {
      await supabase
        .from('standard_ads_projects')
        .update({
          cover_image_url: coverImageUrl,
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      console.log(`Completed image-only standard ads workflow for record ${record.id}`);
      return;
    }

    // For standard ads, start video generation directly
    const videoTaskId = await startVideoGeneration(record, coverImageUrl);

    // Update database with cover completion and video start
    await supabase
      .from('standard_ads_projects')
      .update({
        cover_image_url: coverImageUrl,
        video_task_id: videoTaskId,
        current_step: 'generating_video',
        progress_percentage: 85,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    console.log(`Started video generation for standard ads record ${record.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling cover completion for record ${record.id}:`, error);

    // Mark record as failed
    await supabase
      .from('standard_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Cover completion processing failed',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    throw error;
  }
}

async function startVideoGeneration(record: StandardAdsRecord, coverImageUrl: string): Promise<string> {
  if (!record.video_prompts) {
    throw new Error('No creative prompts available for video generation');
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

  console.log('Generated video prompt:', fullPrompt);

  const requestBody = {
    prompt: fullPrompt,
    model: record.video_model || 'veo3_fast',
    aspectRatio: "16:9",
    imageUrls: [coverImageUrl],
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: true,
    includeDialogue: true,
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
    // Find the standard ads record by cover task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .eq('cover_task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find standard ads record: ${findError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No standard ads record found for failed taskId: ${taskId}`);
      return;
    }

    const record = records[0];
    const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    console.log(`Standard ads task failed for record ${record.id}: ${failureMessage}`);

    // Mark record as failed
    await supabase
      .from('standard_ads_projects')
      .update({
        status: 'failed',
        error_message: failureMessage,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

  } catch (error) {
    console.error(`Error handling failure callback for taskId ${taskId}:`, error);
    throw error;
  }
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at Standard Ads webhook endpoint');
  const url = new URL(request.url);
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({
    success: true,
    message: 'Standard Ads webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
