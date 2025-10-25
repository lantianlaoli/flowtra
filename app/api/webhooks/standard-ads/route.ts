import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { generateBrandEndingFrame } from '@/lib/standard-ads-workflow';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';

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
  video_aspect_ratio?: '16:9' | '9:16';
  last_processed_at: string;
  photo_only?: boolean | null;
  selected_brand_id?: string;
  brand_ending_frame_url?: string;
  brand_ending_task_id?: string;
  image_model?: 'nano_banana' | 'seedream';
  language?: string;
  video_duration?: string | null;
  video_quality?: 'standard' | 'high' | null;
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
  language?: string;
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
    // Find the standard ads record by cover task ID or brand ending task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .or(`cover_task_id.eq.${taskId},brand_ending_task_id.eq.${taskId}`);

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
    } else if (record.brand_ending_task_id === taskId) {
      await handleBrandEndingCompletion(record, data, supabase);
    } else {
      console.log(`⚠️ TaskId ${taskId} doesn't match cover or brand ending task for record ${record.id}`);
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

    // Check if brand ending frame should be generated
    const shouldGenerateBrandEnding =
      record.selected_brand_id &&
      (record.video_model === 'veo3' || record.video_model === 'veo3_fast');

    if (shouldGenerateBrandEnding) {
      // Generate brand ending frame
      console.log(`Generating brand ending frame for record ${record.id} with brand ${record.selected_brand_id}`);

      try {
        const brandEndingTaskId = await generateBrandEndingFrame(
          record.selected_brand_id!,
          coverImageUrl,
          record.video_aspect_ratio || '16:9',
          record.image_model
        );

        // Update database with brand ending task
        await supabase
          .from('standard_ads_projects')
          .update({
            cover_image_url: coverImageUrl,
            brand_ending_task_id: brandEndingTaskId,
            current_step: 'generating_brand_ending',
            progress_percentage: 70,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        console.log(`Started brand ending frame generation for record ${record.id}, taskId: ${brandEndingTaskId}`);
        return;

      } catch (brandError) {
        console.error(`Failed to generate brand ending frame for record ${record.id}:`, brandError);
        // Continue with single-image video generation as fallback
        console.log(`Falling back to single-image video generation for record ${record.id}`);
      }
    }

    // For standard ads, start video generation (with or without brand ending frame)
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

async function handleBrandEndingCompletion(record: StandardAdsRecord, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Extract brand ending frame URL from result
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    const brandEndingFrameUrl = (directUrls || responseUrls || flatUrls)?.[0];

    if (!brandEndingFrameUrl) {
      throw new Error('No brand ending frame URL in success callback');
    }

    console.log(`Brand ending frame completed for record ${record.id}: ${brandEndingFrameUrl}`);

    // Start video generation with dual images (cover + brand ending)
    if (!record.cover_image_url) {
      throw new Error('Cover image URL not found for dual-image video generation');
    }

    const videoTaskId = await startVideoGeneration(
      record,
      record.cover_image_url,
      brandEndingFrameUrl
    );

    // Update database with brand ending completion and video start
    await supabase
      .from('standard_ads_projects')
      .update({
        brand_ending_frame_url: brandEndingFrameUrl,
        video_task_id: videoTaskId,
        current_step: 'generating_video',
        progress_percentage: 85,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    console.log(`Started dual-image video generation for record ${record.id}, taskId: ${videoTaskId}`);

  } catch (error) {
    console.error(`Error handling brand ending completion for record ${record.id}:`, error);

    // Mark record as failed
    await supabase
      .from('standard_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Brand ending frame processing failed',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    throw error;
  }
}

async function startVideoGeneration(record: StandardAdsRecord, coverImageUrl: string, brandEndingFrameUrl?: string): Promise<string> {
  if (!record.video_prompts) {
    throw new Error('No creative prompts available for video generation');
  }

  const videoPrompt = record.video_prompts as VideoPrompt & { ad_copy?: string };
  const providedAdCopyRaw =
    typeof videoPrompt.ad_copy === 'string'
      ? videoPrompt.ad_copy.trim()
      : undefined;
  const providedAdCopy = providedAdCopyRaw && providedAdCopyRaw.length > 0 ? providedAdCopyRaw : undefined;
  const dialogueContent = providedAdCopy || videoPrompt.dialogue;
  const adCopyInstruction = providedAdCopy
    ? `\nAd Copy (use verbatim): ${providedAdCopy}\nOn-screen Text: Display "${providedAdCopy}" prominently without paraphrasing.\nVoiceover: Speak "${providedAdCopy}" exactly as written.`
    : '';

  // Get language information from video_prompts if available, fallback to record.language
  const languageFromPrompt = typeof videoPrompt.language === 'string' ? videoPrompt.language : undefined;
  const language = (record.language || 'en') as LanguageCode;
  const languageName = languageFromPrompt || getLanguagePromptName(language);

  console.log('🌍 Language handling:');
  console.log('  - languageFromPrompt:', languageFromPrompt);
  console.log('  - record.language:', record.language);
  console.log('  - languageName (final):', languageName);
  console.log('  - Will add prefix:', languageName !== 'English');

  // Add language metadata at the beginning of the prompt (simple format for VEO3 API)
  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  console.log('🎬 Language prefix:', languagePrefix ? `YES - "${languageName}"` : 'NO (English)');

  const fullPrompt = `${languagePrefix}${videoPrompt.description}

Setting: ${videoPrompt.setting}
Camera: ${videoPrompt.camera_type} with ${videoPrompt.camera_movement}
Action: ${videoPrompt.action}
Lighting: ${videoPrompt.lighting}
Dialogue: ${dialogueContent}
Music: ${videoPrompt.music}
Ending: ${videoPrompt.ending}
Other details: ${videoPrompt.other_details}${adCopyInstruction}`;

  console.log('Generated video prompt:', fullPrompt);

  const videoModel = (record.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
  const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

  const isSoraFamily = videoModel === 'sora2' || videoModel === 'sora2_pro';
  const apiEndpoint = isSoraFamily
    ? 'https://api.kie.ai/api/v1/jobs/createTask'
    : 'https://api.kie.ai/api/v1/veo/generate';

  // Determine if dual-image generation (veo3.1 with brand ending frame)
  const isDualImage = !isSoraFamily && brandEndingFrameUrl && (videoModel === 'veo3' || videoModel === 'veo3_fast');
  const imageUrls = isDualImage ? [coverImageUrl, brandEndingFrameUrl] : [coverImageUrl];

  console.log(`Video generation mode: ${isDualImage ? 'dual-image (veo3.1)' : 'single-image'}`);
  if (isDualImage) {
    console.log(`First frame: ${coverImageUrl}`);
    console.log(`Last frame: ${brandEndingFrameUrl}`);
  }

  const soraInput = {
    prompt: fullPrompt,
    image_urls: [coverImageUrl],
    aspect_ratio: aspectRatio === '9:16' ? 'portrait' : 'landscape'
  } as Record<string, unknown>;

  if (videoModel === 'sora2_pro') {
    soraInput.n_frames = record.video_duration === '15' ? '15' : '10';
    soraInput.size = record.video_quality === 'high' ? 'high' : 'standard';
    soraInput.remove_watermark = true;
  }

  const requestBody = isSoraFamily
    ? {
        model: videoModel === 'sora2_pro' ? 'sora-2-pro-image-to-video' : 'sora-2-image-to-video',
        input: soraInput
      }
    : {
        prompt: fullPrompt,
        model: videoModel,
        aspectRatio,
        imageUrls: imageUrls,
        enableAudio: true,
        audioEnabled: true,
        generateVoiceover: true,
        includeDialogue: true,
        enableTranslation: false
      };

  console.log('Video API endpoint:', apiEndpoint);
  console.log('Video API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetchWithRetry(apiEndpoint, {
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
    // Find the standard ads record by cover task ID or brand ending task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .or(`cover_task_id.eq.${taskId},brand_ending_task_id.eq.${taskId}`);

    if (findError) {
      throw new Error(`Failed to find standard ads record: ${findError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No standard ads record found for failed taskId: ${taskId}`);
      return;
    }

    const record = records[0] as StandardAdsRecord;
    const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    console.log(`Standard ads task failed for record ${record.id}: ${failureMessage}`);

    // If brand ending failed, fallback to single-image video generation
    if (record.brand_ending_task_id === taskId && record.cover_image_url) {
      console.log(`Brand ending frame failed for record ${record.id}, falling back to single-image video`);

      try {
        const videoTaskId = await startVideoGeneration(record, record.cover_image_url);

        await supabase
          .from('standard_ads_projects')
          .update({
            video_task_id: videoTaskId,
            current_step: 'generating_video',
            progress_percentage: 85,
            error_message: `Brand ending frame failed (${failureMessage}), continuing with single-image video`,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        console.log(`Fallback video generation started for record ${record.id}, taskId: ${videoTaskId}`);
        return;

      } catch (fallbackError) {
        console.error(`Fallback video generation also failed for record ${record.id}:`, fallbackError);
        // Continue to mark as failed below
      }
    }

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
