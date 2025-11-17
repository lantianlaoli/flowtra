import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, type StandardAdsSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { mergeVideosWithFal } from '@/lib/video-merge';
import { buildSegmentStatusPayload, startSegmentVideoTask, type SegmentPrompt } from '@/lib/standard-ads-workflow';

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
  image_model?: 'nano_banana' | 'seedream';
  language?: string;
  video_duration?: string | null;
  video_quality?: 'standard' | 'high' | null;
  is_segmented?: boolean;
  segment_count?: number | null;
  segment_plan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
  segment_status?: Record<string, unknown> | null;
  fal_merge_task_id?: string | null;
  merged_video_url?: string | null;
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

function extractResultUrl(data: KieCallbackData): string | undefined {
  try {
    const resultJson = data.resultJson ? JSON.parse(data.resultJson) as { resultUrls?: string[] } : {};
    const directUrls = Array.isArray(resultJson.resultUrls) ? resultJson.resultUrls : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    return (directUrls || responseUrls || flatUrls)?.[0];
  } catch (error) {
    console.error('Failed to parse resultJson for task:', data, error);
    return undefined;
  }
}

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
    const segment = await findSegmentByTaskId(taskId, supabase);
    if (segment) {
      const project = await fetchProjectById(segment.project_id, supabase);
      if (!project) {
        console.warn(`Segment callback received but project ${segment.project_id} not found`);
        return;
      }
      await handleSegmentSuccessCallback(project, segment, data, supabase);
      return;
    }

    // Find the standard ads record by cover or video task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .or(`cover_task_id.eq.${taskId},video_task_id.eq.${taskId}`);

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
    } else if (record.video_task_id === taskId) {
      await handleVideoCompletion(record, data, supabase);
    } else {
      console.log(`⚠️ TaskId ${taskId} doesn't match cover or video task for record ${record.id}`);
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

    // For standard ads, start video generation using the generated cover image
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

async function handleVideoCompletion(record: StandardAdsRecord, data: KieCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    const videoUrl = (directUrls || responseUrls || flatUrls)?.[0];

    if (!videoUrl) {
      throw new Error('No video URL in success callback');
    }

    console.log(`Video completed for record ${record.id}: ${videoUrl}`);

    await supabase
      .from('standard_ads_projects')
      .update({
        video_url: videoUrl,
        status: 'completed',
        current_step: 'completed',
        progress_percentage: 100,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    console.log(`Marked record ${record.id} as completed via webhook`);

  } catch (error) {
    console.error(`Error handling video completion for record ${record.id}:`, error);

    await supabase
      .from('standard_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Video completion processing failed',
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

  const imageUrls = [coverImageUrl];

  console.log('Video generation mode: single-image');

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
    const segment = await findSegmentByTaskId(taskId, supabase);
    const failureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    if (segment) {
      const project = await fetchProjectById(segment.project_id, supabase);
      if (project) {
        await handleSegmentFailureCallback(project, segment, failureMessage, supabase);
      }
      return;
    }

    // Find the standard ads record by cover or video task ID
    const { data: records, error: findError } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .or(`cover_task_id.eq.${taskId},video_task_id.eq.${taskId}`);

    if (findError) {
      throw new Error(`Failed to find standard ads record: ${findError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No standard ads record found for failed taskId: ${taskId}`);
      return;
    }

    const record = records[0] as StandardAdsRecord;
    const fallbackFailureMessage = data.failMsg || data.errorMessage || 'KIE task failed';

    console.log(`Standard ads task failed for record ${record.id}: ${fallbackFailureMessage}`);

    // Mark record as failed
    await supabase
      .from('standard_ads_projects')
      .update({
        status: 'failed',
        error_message: fallbackFailureMessage,
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

async function findSegmentByTaskId(taskId: string, supabase: ReturnType<typeof getSupabase>): Promise<StandardAdsSegment | null> {
  const { data, error } = await supabase
    .from('standard_ads_segments')
    .select('*')
    .or(`first_frame_task_id.eq.${taskId},closing_frame_task_id.eq.${taskId},video_task_id.eq.${taskId}`)
    .limit(1);

  if (error) {
    console.error('Failed to query segment by taskId:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as StandardAdsSegment;
}

async function fetchProjectById(projectId: string, supabase: ReturnType<typeof getSupabase>): Promise<StandardAdsRecord | null> {
  const { data, error } = await supabase
    .from('standard_ads_projects')
    .select('*')
    .eq('id', projectId)
    .limit(1);

  if (error) {
    console.error(`Failed to fetch project ${projectId}:`, error);
    return null;
  }

  return data?.[0] as StandardAdsRecord;
}

async function fetchSegmentsForProject(projectId: string, supabase: ReturnType<typeof getSupabase>): Promise<StandardAdsSegment[]> {
  const { data, error } = await supabase
    .from('standard_ads_segments')
    .select('*')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch segments: ${error.message}`);
  }

  return (data || []) as StandardAdsSegment[];
}

function getSegmentPromptFromProject(record: StandardAdsRecord, index: number): SegmentPrompt {
  const planSegments = (record.segment_plan as { segments?: SegmentPrompt[] })?.segments;
  if (Array.isArray(planSegments) && planSegments[index]) {
    return planSegments[index] as SegmentPrompt;
  }

  const fallback = (record.video_prompts || {}) as SegmentPrompt;
  return {
    description: fallback.description || 'Product hero shot',
    setting: fallback.setting || 'Premium studio',
    camera_type: fallback.camera_type || 'Wide cinematic shot',
    camera_movement: fallback.camera_movement || 'Slow push-in',
    action: fallback.action || 'Showcase product details',
    lighting: fallback.lighting || 'Soft glam lighting',
    dialogue: fallback.dialogue || 'Narrate core benefit',
    music: fallback.music || 'Warm instrumental',
    ending: fallback.ending || 'Product close-up',
    other_details: fallback.other_details || '',
    language: fallback.language || record.language || 'English',
    segment_title: fallback.segment_title || `Segment ${index + 1}`,
    segment_goal: fallback.segment_goal || `Highlight benefit ${index + 1}`,
    first_frame_prompt: fallback.first_frame_prompt || fallback.description || 'Show product hero shot',
    closing_frame_prompt: fallback.closing_frame_prompt || fallback.ending || 'End with product close-up'
  };
}

async function updateProjectSegmentStatus(
  projectId: string,
  supabase: ReturnType<typeof getSupabase>,
  segments: StandardAdsSegment[],
  options: {
    coverImageUrl?: string;
    currentStep?: string;
    progress?: number;
    mergedVideoUrl?: string | null;
    status?: string;
    error?: string;
  } = {}
) {
  const payload: Record<string, unknown> = {
    segment_status: buildSegmentStatusPayload(segments, options.mergedVideoUrl ?? null),
    last_processed_at: new Date().toISOString()
  };

  if (options.coverImageUrl) {
    payload.cover_image_url = options.coverImageUrl;
  }

  if (options.currentStep) {
    payload.current_step = options.currentStep;
  }

  if (typeof options.progress === 'number') {
    payload.progress_percentage = options.progress;
  }

  if (options.status) {
    payload.status = options.status;
  }

  if (options.error) {
    payload.error_message = options.error;
  }

  await supabase
    .from('standard_ads_projects')
    .update(payload)
    .eq('id', projectId);
}

async function handleSegmentSuccessCallback(
  project: StandardAdsRecord,
  segment: StandardAdsSegment,
  data: KieCallbackData,
  supabase: ReturnType<typeof getSupabase>
) {
  const taskId = data.taskId;
  const isFirstFrame = segment.first_frame_task_id === taskId;
  const isClosingFrame = segment.closing_frame_task_id === taskId;
  const isVideo = segment.video_task_id === taskId;

  if (!isFirstFrame && !isClosingFrame && !isVideo) {
    console.warn(`Segment ${segment.id} does not match task ${taskId}`);
    return;
  }

  const segments = await fetchSegmentsForProject(project.id, supabase);
  const targetIndex = segments.findIndex(s => s.id === segment.id);
  if (targetIndex === -1) {
    console.warn(`Segment ${segment.id} not found in latest snapshot`);
    return;
  }

  const url = extractResultUrl(data);
  if (!url) {
    throw new Error('No asset URL in segment callback');
  }

  const now = new Date().toISOString();

  if (isFirstFrame) {
    await supabase
      .from('standard_ads_segments')
      .update({
        first_frame_url: url,
        status: 'first_frame_ready',
        updated_at: now
      })
      .eq('id', segment.id);

    segments[targetIndex].first_frame_url = url;
    segments[targetIndex].status = 'first_frame_ready';

    if (segment.segment_index === 0 && !project.cover_image_url) {
      project.cover_image_url = url;
    }

    if (segment.segment_index > 0) {
      const previous = segments[targetIndex - 1];
      if (!previous.closing_frame_url) {
        await supabase
          .from('standard_ads_segments')
          .update({
            closing_frame_url: url,
            updated_at: now
          })
          .eq('id', previous.id);

        previous.closing_frame_url = url;
      }
    }

    await updateProjectSegmentStatus(project.id, supabase, segments, {
      coverImageUrl: segment.segment_index === 0 ? project.cover_image_url : undefined,
      currentStep: project.current_step === 'generating_segment_frames' ? 'generating_segment_frames' : undefined,
      progress: project.current_step === 'generating_segment_frames' ? 45 : undefined
    });

    await maybeTriggerSegmentVideos(project, segments, supabase);
    return;
  }

  if (isClosingFrame) {
    await supabase
      .from('standard_ads_segments')
      .update({
        closing_frame_url: url,
        updated_at: now
      })
      .eq('id', segment.id);

    segments[targetIndex].closing_frame_url = url;
    await updateProjectSegmentStatus(project.id, supabase, segments);
    await maybeTriggerSegmentVideos(project, segments, supabase);
    return;
  }

  // Video completion
  await supabase
    .from('standard_ads_segments')
    .update({
      video_url: url,
      status: 'video_ready',
      updated_at: now
    })
    .eq('id', segment.id);

  segments[targetIndex].video_url = url;
  segments[targetIndex].status = 'video_ready';

  await updateProjectSegmentStatus(project.id, supabase, segments, {
    currentStep: 'generating_segment_videos',
    progress: 90
  });

  await maybeStartSegmentMerge(project, segments, supabase);
}

async function handleSegmentFailureCallback(
  project: StandardAdsRecord,
  segment: StandardAdsSegment,
  failureMessage: string,
  supabase: ReturnType<typeof getSupabase>
) {
  await supabase
    .from('standard_ads_segments')
    .update({
      status: 'failed',
      error_message: failureMessage,
      updated_at: new Date().toISOString()
    })
    .eq('id', segment.id);

  await supabase
    .from('standard_ads_projects')
    .update({
      status: 'failed',
      error_message: failureMessage,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', project.id);
}

async function maybeTriggerSegmentVideos(
  project: StandardAdsRecord,
  segments: StandardAdsSegment[],
  supabase: ReturnType<typeof getSupabase>
) {
  if (!project.is_segmented) return;

  let videosStarted = 0;

  for (const seg of segments) {
    if (seg.video_task_id || seg.video_url) continue;
    if (!seg.first_frame_url) continue;

    // For children_toy products, closing_frame_url will be null for all segments
    // For other products, use next segment's first frame as fallback for continuity
    const nextSegment = segments.find(s => s.segment_index === seg.segment_index + 1);
    const closingFrameUrl = seg.closing_frame_url || nextSegment?.first_frame_url || null;
    // Don't skip if closingFrameUrl is null - startSegmentVideoTask will handle single-frame mode

    const segmentPrompt = getSegmentPromptFromProject(project, seg.segment_index);
    const taskId = await startSegmentVideoTask(
      project as unknown as SingleVideoProject,
      segmentPrompt,
      seg.first_frame_url,
      closingFrameUrl,
      seg.segment_index,
      segments.length
    );

    await supabase
      .from('standard_ads_segments')
      .update({
        video_task_id: taskId,
        status: 'generating_video',
        updated_at: new Date().toISOString()
      })
      .eq('id', seg.id);

    seg.video_task_id = taskId;
    seg.status = 'generating_video';
    videosStarted++;
  }

  if (videosStarted > 0) {
    await updateProjectSegmentStatus(project.id, supabase, segments, {
      currentStep: 'generating_segment_videos',
      progress: 70
    });
  }
}

async function maybeStartSegmentMerge(
  project: StandardAdsRecord,
  segments: StandardAdsSegment[],
  supabase: ReturnType<typeof getSupabase>
) {
  if (project.fal_merge_task_id) return;
  if (!segments.length) return;

  const incomplete = segments.some(seg => !seg.video_url);
  if (incomplete) return;

  const videoUrls = segments.map(seg => seg.video_url as string);
  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const { taskId } = await mergeVideosWithFal(videoUrls, aspectRatio);

  await supabase
    .from('standard_ads_projects')
    .update({
      fal_merge_task_id: taskId,
      current_step: 'merging_segments',
      progress_percentage: 95,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', project.id);

  project.fal_merge_task_id = taskId;
}
