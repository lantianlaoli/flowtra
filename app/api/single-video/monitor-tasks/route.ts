import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export async function POST() {
  try {
    console.log('Starting single video task monitoring...');

    const supabase = getSupabaseAdmin();
    const { data: records, error } = await supabase
      .from('single_video_projects')
      .select('*')
      .in('status', ['started', 'in_progress', 'generating_cover', 'generating_video'])
      .not('cover_task_id', 'is', null)
      .order('last_processed_at', { ascending: true })
      .limit(20);

    if (error) {
      console.error('Error fetching single video records:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    console.log(`Found ${records?.length || 0} single video records to monitor`);

    let processed = 0;
    let completed = 0;
    let failed = 0;

    if (Array.isArray(records) && records.length > 0) {
      for (const record of (records as HistoryRecord[])) {
        try {
          await processRecord(record);
          processed++;
        } catch (error) {
          console.error(`Error processing single video record ${record.id}:`, error);
          await supabase
            .from('single_video_projects')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Processing error',
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id);
          failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const { count: completedCount } = await supabase
        .from('single_video_projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString());

      completed = completedCount || 0;
    }

    console.log(`Single video task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalRecords: records?.length || 0,
      message: 'Single video task monitoring completed'
    });

  } catch (error) {
    console.error('Single video task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
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

interface HistoryRecord {
  id: string;
  user_id: string;
  current_step: string;
  status: string;
  cover_task_id: string;
  video_task_id: string;
  cover_image_url: string;
  video_url: string;
  video_prompts: VideoPrompt;
  video_model: string;
  credits_cost: number;
  download_credits_used: number;
  downloaded: boolean;
  last_processed_at: string;
  watermark_text?: string | null;
  watermark_location?: string | null;
  cover_image_size?: string | null;
  image_prompt?: string | null;
  photo_only?: boolean | null;
}

async function processRecord(record: HistoryRecord) {
  const supabase = getSupabaseAdmin();
  console.log(`Processing single video record ${record.id}, step: ${record.current_step}, status: ${record.status}`);

  if (record.current_step === 'generating_cover' && record.cover_task_id && !record.cover_image_url) {
    const coverResult = await checkCoverStatus(record.cover_task_id);

    if (coverResult.status === 'SUCCESS' && coverResult.imageUrl) {
      console.log(`Cover completed for single video record ${record.id}`);

      if (record.photo_only === true) {
        const { error: updErr } = await supabase
          .from('single_video_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
            status: 'completed',
            current_step: 'completed',
            progress_percentage: 100,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updErr) {
          console.error(`Failed to mark single video record ${record.id} as completed (photo-only):`, updErr);
          throw new Error(`DB update failed for record ${record.id}`);
        }

        console.log(`Completed image-only workflow for single video record ${record.id}`);
      } else {
        const videoTaskId = await startVideoGeneration(record, coverResult.imageUrl);

        const { error: startErr } = await supabase
          .from('single_video_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
            video_task_id: videoTaskId,
            current_step: 'generating_video',
            progress_percentage: 85,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (startErr) {
          console.error(`Failed to update single video record ${record.id} after starting video:`, startErr);
          throw new Error(`DB update failed for record ${record.id}`);
        }

        console.log(`Started video generation for single video record ${record.id}, taskId: ${videoTaskId}`);
      }

    } else if (coverResult.status === 'FAILED') {
      throw new Error('Cover generation failed');
    }
  }

  if (record.current_step === 'generating_video' && record.video_task_id && !record.video_url) {
    const videoResult = await checkVideoStatus(record.video_task_id);

    if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
      console.log(`Video completed for single video record ${record.id}`);

      console.log(`✅ Single video workflow completed for user ${record.user_id}`);

      const { error: vidUpdErr } = await supabase
        .from('single_video_projects')
        .update({
          video_url: videoResult.videoUrl,
          status: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (vidUpdErr) {
        console.error(`Failed to mark single video record ${record.id} as completed after video:`, vidUpdErr);
        throw new Error(`DB update failed for record ${record.id}`);
      }

    } else if (videoResult.status === 'FAILED') {
      throw new Error(`Video generation failed: ${videoResult.errorMessage || 'Unknown error'}`);
    }
  }

  const lastProcessed = new Date(record.last_processed_at).getTime();
  const now = Date.now();
  const timeoutMinutes = record.current_step === 'generating_video' ? 30 : 15;

  if (now - lastProcessed > timeoutMinutes * 60 * 1000) {
    throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
  }
}

async function startVideoGeneration(record: HistoryRecord, coverImageUrl: string): Promise<string> {
  if (!record.video_prompts) {
    throw new Error('No creative prompts available for video generation');
  }

  const videoPrompt = record.video_prompts;
  const fullPrompt = `${videoPrompt.description}

Setting: ${videoPrompt.setting}
Camera: ${videoPrompt.camera_type} with ${videoPrompt.camera_movement}
Action: ${videoPrompt.action}
Lighting: ${videoPrompt.lighting}
Dialogue: ${videoPrompt.dialogue}
Music: ${videoPrompt.music}
Ending: ${videoPrompt.ending}
Other details: ${videoPrompt.other_details}`;

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

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 8, 30000);

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

async function checkCoverStatus(taskId: string): Promise<{status: string, imageUrl?: string}> {
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
    throw new Error((data && (data.message || data.msg)) || 'Failed to get nano-banana status');
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'GENERATING' };
  }

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
    throw new Error(data.msg || 'Failed to get video status');
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