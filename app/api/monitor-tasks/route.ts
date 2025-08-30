import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabase } from '@/lib/supabase';
import { recordCreditTransaction, deductCredits } from '@/lib/credits';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

export async function POST() {
  try {
    console.log('Starting task monitoring...');

    // Find records that need monitoring
    const supabase = getSupabase();
    const { data: records, error } = await supabase
      .from('user_history')
      .select('*')
      .in('workflow_status', ['started', 'in_progress'])
      .not('cover_task_id', 'is', null)
      .order('last_processed_at', { ascending: true })
      .limit(20); // Process max 20 records per run

    if (error) {
      console.error('Error fetching records:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    console.log(`Found ${records?.length || 0} records to monitor`);

    let processed = 0;
    let completed = 0;
    let failed = 0;

    if (Array.isArray(records) && records.length > 0) {
      for (const record of (records as HistoryRecord[])) {
        try {
          await processRecord(record);
          processed++;
        } catch (error) {
          console.error(`Error processing record ${record.id}:`, error);
          
          // Update retry count and handle failures
          const newRetryCount = (record.retry_count || 0) + 1;
          if (newRetryCount >= 5) {
            // Mark as failed after 5 retries and refund credits
            await supabase
              .from('user_history')
              .update({
                workflow_status: 'failed',
                error_message: error instanceof Error ? error.message : 'Max retries exceeded',
                last_processed_at: new Date().toISOString()
              })
              .eq('id', record.id);
            
            // Refund generation credits for failed workflow
            if (record.user_id && record.generation_credits_used > 0) {
              const refundResult = await deductCredits(record.user_id, -record.generation_credits_used); // Negative amount adds credits back
              if (refundResult.success) {
                await recordCreditTransaction(
                  record.user_id,
                  'refund',
                  record.generation_credits_used,
                  'Refund for failed workflow after max retries',
                  record.id,
                  true // useAdminClient
                );
                console.log(`↩️ Refunded ${record.generation_credits_used} generation credits due to workflow failure (max retries) for user ${record.user_id}`);
              } else {
                console.error(`Failed to refund generation credits for failed workflow:`, refundResult.error);
              }
            }
            
            failed++;
          } else {
            // Increment retry count
            await supabase
              .from('user_history')
              .update({
                retry_count: newRetryCount as number,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', record.id);
          }
        }
        
        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Count completed records from this run
      const { count: completedCount } = await supabase
        .from('user_history')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Updated in last minute

      completed = completedCount || 0;
    }

    console.log(`Task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalRecords: records?.length || 0,
      message: 'Task monitoring completed'
    });

  } catch (error) {
    console.error('Task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

interface HistoryRecord {
  id: string;
  user_id: string;
  current_step: string;
  workflow_status: string;
  cover_task_id: string;
  video_task_id: string;
  cover_image_url: string;
  video_url: string;
  creative_prompts: Record<string, unknown>;
  video_model: string;
  credits_used: number;
  generation_credits_used: number;
  download_credits_used: number;
  downloaded: boolean;
  retry_count: number;
  last_processed_at: string;
}

async function processRecord(record: HistoryRecord) {
  const supabase = getSupabase();
  console.log(`Processing record ${record.id}, step: ${record.current_step}, status: ${record.workflow_status}`);

  // Handle cover generation monitoring
  if (record.current_step === 'generating_cover' && record.cover_task_id && !record.cover_image_url) {
    const coverResult = await checkCoverStatus(record.cover_task_id);
    
    if (coverResult.status === 'SUCCESS' && coverResult.imageUrl) {
      console.log(`Cover completed for record ${record.id}`);
      
      // Cover completed, start video generation
      const videoTaskId = await startVideoGeneration(record, coverResult.imageUrl);
      
      await supabase
        .from('user_history')
        .update({
          cover_image_url: coverResult.imageUrl,
          video_task_id: videoTaskId,
          current_step: 'generating_video',
          progress_percentage: 85,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
        
      console.log(`Started video generation for record ${record.id}, taskId: ${videoTaskId}`);
      
    } else if (coverResult.status === 'FAILED') {
      // Refund generation credits when cover generation fails
      if (record.user_id && record.generation_credits_used > 0) {
        const refundResult = await deductCredits(record.user_id, -record.generation_credits_used);
        if (refundResult.success) {
          await recordCreditTransaction(
            record.user_id,
            'refund',
            record.generation_credits_used,
            'Refund for cover generation failure',
            record.id,
            true
          );
          console.log(`↩️ Refunded ${record.generation_credits_used} generation credits due to cover generation failure for user ${record.user_id}`);
        }
      }
      throw new Error('Cover generation failed');
    }
    // If still generating, do nothing and wait for next check
  }

  // Handle video generation monitoring
  if (record.current_step === 'generating_video' && record.video_task_id && !record.video_url) {
    const videoResult = await checkVideoStatus(record.video_task_id);
    
    if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
      console.log(`Video completed for record ${record.id}`);
      
      // Note: Credits are already deducted at workflow start, no need to deduct again
      console.log(`✅ Workflow completed for user ${record.user_id} - credits were deducted at start`);
      
      await supabase
        .from('user_history')
        .update({
          video_url: videoResult.videoUrl,
          workflow_status: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
        
    } else if (videoResult.status === 'FAILED') {
      // Refund generation credits when video generation fails
      if (record.user_id && record.generation_credits_used > 0) {
        const refundResult = await deductCredits(record.user_id, -record.generation_credits_used);
        if (refundResult.success) {
          await recordCreditTransaction(
            record.user_id,
            'refund',
            record.generation_credits_used,
            'Refund for video generation failure',
            record.id,
            true
          );
          console.log(`↩️ Refunded ${record.generation_credits_used} generation credits due to video generation failure for user ${record.user_id}`);
        }
      }
      throw new Error(`Video generation failed: ${videoResult.errorMessage || 'Unknown error'}`);
    }
    // If still generating, do nothing and wait for next check
  }

  // Handle timeout checks (records not updated for too long)
  const lastProcessed = new Date(record.last_processed_at).getTime();
  const now = Date.now();
  const timeoutMinutes = record.current_step === 'generating_video' ? 30 : 15; // 30min for video, 15min for cover
  
  if (now - lastProcessed > timeoutMinutes * 60 * 1000) {
    throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
  }
}

async function startVideoGeneration(record: HistoryRecord, coverImageUrl: string): Promise<string> {
  if (!record.creative_prompts) {
    throw new Error('No creative prompts available for video generation');
  }

  const videoPrompt = record.creative_prompts;
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
  console.log('Dialogue content:', videoPrompt.dialogue);

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

  console.log('VEO API request body:', JSON.stringify(requestBody, null, 2));

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
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 3, 10000);

  if (!response.ok) {
    throw new Error(`Failed to check cover status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to get cover status');
  }

  const taskData = data.data;
  
  if (taskData.status === 'SUCCESS' && taskData.successFlag === 1) {
    return {
      status: 'SUCCESS',
      imageUrl: taskData.response?.resultUrls?.[0] || null
    };
  } else if (taskData.status === 'CREATE_TASK_FAILED' || taskData.status === 'GENERATE_FAILED') {
    return { status: 'FAILED' };
  } else {
    return { status: 'GENERATING' };
  }
}

async function checkVideoStatus(taskId: string): Promise<{status: string, videoUrl?: string, errorMessage?: string}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 3, 10000);

  if (!response.ok) {
    throw new Error(`Failed to check video status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to get video status');
  }

  const taskData = data.data;
  
  if (taskData.successFlag === 1) {
    return {
      status: 'SUCCESS',
      videoUrl: taskData.response?.resultUrls?.[0] || null
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