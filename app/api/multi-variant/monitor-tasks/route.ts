import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { generateVideoDesignFromCover } from '@/lib/workflow-v2';

export async function POST() {
  try {
    console.log('Starting multi-variant workflow task monitoring...');

    const supabase = getSupabaseAdmin();

    const { data: instances, error } = await supabase
      .from('multi_variant_projects')
      .select('*')
      .in('status', ['generating_cover', 'generating_video'])
      .order('last_processed_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error fetching multi-variant workflow instances:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    console.log(`Found ${instances?.length || 0} multi-variant instances to monitor`);

    let processed = 0;
    let completed = 0;
    let failed = 0;

    if (Array.isArray(instances) && instances.length > 0) {
      for (const instance of instances) {
        try {
          await processInstance(instance);
          processed++;
        } catch (error) {
          console.error(`Error processing multi-variant instance ${instance.id}:`, error);
          failed++;

          await supabase
            .from('multi_variant_projects')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Processing failed',
              updated_at: new Date().toISOString(),
              last_processed_at: new Date().toISOString()
            })
            .eq('id', instance.id);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const { count: completedCount } = await supabase
        .from('multi_variant_projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString());

      completed = completedCount || 0;
    }

    console.log(`Multi-variant task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalInstances: instances?.length || 0,
      message: 'Multi-variant task monitoring completed'
    });

  } catch (error) {
    console.error('Multi-variant task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

interface InstanceRecord {
  id: string;
  user_id: string;
  elements_data?: Record<string, unknown>;
  product_description?: string | Record<string, unknown>;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  video_url?: string;
  photo_only?: boolean | null;
  status: string;
  current_step: string;
  video_model?: string;
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  created_at: string;
  updated_at: string;
  last_processed_at: string;
}

async function processInstance(instance: InstanceRecord) {
  const supabase = getSupabaseAdmin();
  console.log(`Processing multi-variant instance ${instance.id}, status: ${instance.status}, step: ${instance.current_step}`);

  let currentStatus = instance.status;
  let currentStep = instance.current_step;
  let lastProcessedAt = instance.last_processed_at;

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

  if (instance.status === 'generating_cover' && instance.cover_task_id && !instance.cover_image_url) {
    const coverResult = await checkNanoBananaStatus(instance.cover_task_id);

    if (coverResult.status === 'SUCCESS' && coverResult.imageUrl) {
      console.log(`Cover completed for multi-variant instance ${instance.id}`);
      if (shouldGenerateVideo) {
        const videoPrompt = await generateVideoDesignFromCover(
          coverResult.imageUrl,
          instance.elements_data,
          instance.product_description
        );

        const videoTaskId = await startVideoGeneration(instance, coverResult.imageUrl, videoPrompt);

        await supabase
          .from('multi_variant_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
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
          })
          .eq('id', instance.id);

        console.log(`Started video generation for multi-variant instance ${instance.id}, taskId: ${videoTaskId}`);

        currentStatus = 'generating_video';
        currentStep = 'generating_video';
        lastProcessedAt = new Date().toISOString();
      } else {
        await supabase
          .from('multi_variant_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
            status: 'completed',
            current_step: 'completed',
            progress_percentage: 100,
            updated_at: new Date().toISOString(),
            last_processed_at: new Date().toISOString()
          })
          .eq('id', instance.id);

        console.log(`Multi-variant workflow completed with images only for instance ${instance.id}`);

        currentStatus = 'completed';
        currentStep = 'completed';
        lastProcessedAt = new Date().toISOString();
      }

    } else if (coverResult.status === 'FAILED') {
      throw new Error('Cover generation failed');
    }
    else if (coverResult.status === 'GENERATING') {
      await supabase
        .from('multi_variant_projects')
        .update({
          progress_percentage: 25,
          updated_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      lastProcessedAt = new Date().toISOString();
    }
  }

  if (instance.status === 'generating_video' && instance.video_task_id && !instance.video_url) {
    const videoResult = await checkVideoStatus(instance.video_task_id);

    if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
      console.log(`Video completed for multi-variant instance ${instance.id}`);

      await supabase
        .from('multi_variant_projects')
        .update({
          video_url: videoResult.videoUrl,
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          updated_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      currentStatus = 'completed';
      currentStep = 'completed';
      lastProcessedAt = new Date().toISOString();

    } else if (videoResult.status === 'FAILED') {
      throw new Error(`Video generation failed: ${videoResult.errorMessage || 'Unknown error'}`);
    }
    else if (videoResult.status === 'GENERATING') {
      await supabase
        .from('multi_variant_projects')
        .update({
          progress_percentage: 75,
          updated_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString()
        })
        .eq('id', instance.id);

      lastProcessedAt = new Date().toISOString();
    }
  }

  const lastProcessed = lastProcessedAt ? new Date(lastProcessedAt).getTime() : 0;
  const now = Date.now();
  const isVideoStage = currentStatus === 'generating_video' || currentStep === 'generating_video';
  const timeoutMinutes = isVideoStage ? 30 : 15;

  if (lastProcessed && now - lastProcessed > timeoutMinutes * 60 * 1000) {
    throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
  }
}

async function checkNanoBananaStatus(taskId: string): Promise<{status: string, imageUrl?: string}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 3, 15000);

  if (!response.ok) {
    throw new Error(`Failed to check nano-banana status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.code !== 200) {
    throw new Error(data?.message || 'Failed to get nano-banana status');
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'GENERATING' };
  }

  if (taskData.state === 'success') {
    let resultJson: Record<string, unknown> = {};
    try {
      resultJson = JSON.parse(taskData.resultJson || '{}');
    } catch {
      resultJson = {};
    }
    const urls = (resultJson as { resultUrls?: string[] }).resultUrls;
    const firstUrl = Array.isArray(urls) ? urls[0] : undefined;
    return {
      status: 'SUCCESS',
      imageUrl: firstUrl
    };
  } else if (taskData.state === 'failed') {
    return { status: 'FAILED' };
  } else {
    return { status: 'GENERATING' };
  }
}

async function startVideoGeneration(
  instance: InstanceRecord,
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
  const finalPrompt = `Create a short, cinematic product ad video based on the provided cover image. Maintain consistency with the cover's style, layout, and color palette.\n\nDescription: ${videoPrompt.description}\nSetting: ${videoPrompt.setting}\nCamera: ${videoPrompt.camera_type}\nCamera Movement: ${videoPrompt.camera_movement}\nAction: ${videoPrompt.action}\nLighting: ${videoPrompt.lighting}\nOther Details: ${videoPrompt.other_details}\nDialogue: ${videoPrompt.dialogue}\nMusic: ${videoPrompt.music}\nEnding: ${videoPrompt.ending}`;

  console.log('Generated multi-variant video prompt:', finalPrompt);

  const selectedModel = instance.video_model === 'veo3' ? 'veo3' : 'veo3_fast';

  const requestBody: Record<string, unknown> = {
    prompt: finalPrompt,
    model: selectedModel,
    aspectRatio: "16:9",
    imageUrls: [coverImageUrl],
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: false,
    includeDialogue: false
  };

  console.log('Multi-variant VEO API request body:', JSON.stringify(requestBody, null, 2));

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

async function checkVideoStatus(taskId: string): Promise<{status: string, videoUrl?: string, errorMessage?: string}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 3, 15000);

  if (!response.ok) {
    throw new Error(`Failed to check video status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.code !== 200) {
    throw new Error(data?.msg || 'Failed to get video status');
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'GENERATING' };
  }

  if (taskData.successFlag === 1) {
    return {
      status: 'SUCCESS',
      videoUrl: taskData.response?.resultUrls?.[0] || undefined
    };
  } else if (taskData.successFlag === 2 || taskData.successFlag === 3) {
    return {
      status: 'FAILED',
      errorMessage: taskData.errorMessage || 'Video generation failed'
    };
  } else {
    return { status: 'GENERATING' };
  }
}