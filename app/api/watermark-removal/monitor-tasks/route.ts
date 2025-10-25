import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { deductCredits, recordCreditTransaction } from '@/lib/credits';
import { WATERMARK_REMOVAL_COST } from '@/lib/constants';

export async function POST() {
  try {
    console.log('Starting watermark removal task monitoring...');

    // Find tasks that need monitoring
    const supabase = getSupabaseAdmin();
    const { data: tasks, error } = await supabase
      .from('sora2_watermark_removal_tasks')
      .select('*')
      .eq('status', 'processing')
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(20); // Process max 20 tasks per run

    if (error) {
      console.error('Error fetching watermark removal tasks:', error);
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
    }

    console.log(`Found ${tasks?.length || 0} watermark removal tasks to monitor`);

    let processed = 0;
    let completed = 0;
    let failed = 0;

    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const task of tasks) {
        console.log(`Processing task ${task.id} (KIE task ID: ${task.kie_task_id})`);

        try {
          // Check if task has timed out (40 minutes for video processing)
          if (task.updated_at) {
            const lastUpdated = new Date(task.updated_at).getTime();
            const now = Date.now();
            const timeoutMinutes = 40;

            if (now - lastUpdated > timeoutMinutes * 60 * 1000) {
              throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
            }
          }

          // Check task status with KIE API
          if (!task.kie_task_id) {
            throw new Error('No KIE task ID found');
          }

          const result = await checkKieTaskStatus(task.kie_task_id);

          if (result.status === 'success' && result.videoUrl) {
            console.log(`Task ${task.id} completed successfully`);

            // Update task as completed
            await supabase
              .from('sora2_watermark_removal_tasks')
              .update({
                status: 'completed',
                output_video_url: result.videoUrl,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', task.id);

            completed++;
            processed++;
          } else if (result.status === 'fail') {
            throw new Error('KIE task failed');
          } else {
            // Still processing, just update timestamp
            await supabase
              .from('sora2_watermark_removal_tasks')
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq('id', task.id);

            processed++;
          }
        } catch (error) {
          console.error(`Error processing task ${task.id}:`, error);

          // Refund credits on failure
          console.log(`⚠️ Refunding ${WATERMARK_REMOVAL_COST} credits for task ${task.id}`);
          await deductCredits(task.user_id, -WATERMARK_REMOVAL_COST); // Negative = refund
          await recordCreditTransaction(
            task.user_id,
            'refund',
            WATERMARK_REMOVAL_COST,
            'Watermark Removal - Refund for failed removal',
            task.id,
            true
          );

          // Mark task as failed
          await supabase
            .from('sora2_watermark_removal_tasks')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Processing error',
              updated_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          failed++;
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`Watermark removal task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalTasks: tasks?.length || 0,
      message: 'Watermark removal task monitoring completed'
    });

  } catch (error) {
    console.error('Watermark removal task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function checkKieTaskStatus(taskId: string): Promise<{ status: string; videoUrl?: string }> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 5, 15000);

  if (!response.ok) {
    throw new Error(`Failed to check KIE task status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.code !== 200) {
    throw new Error(data?.message || 'Failed to get KIE task status');
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'waiting' };
  }

  // Check task state
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state.toLowerCase() : undefined;

  // Parse result JSON to get video URL
  let resultJson: Record<string, unknown> = {};
  try {
    resultJson = typeof taskData.resultJson === 'string'
      ? JSON.parse(taskData.resultJson)
      : taskData.resultJson || {};
  } catch {
    resultJson = {};
  }

  const resultUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
    ? (resultJson as { resultUrls?: string[] }).resultUrls
    : [];
  const videoUrl = resultUrls?.[0];

  // Determine status based on state
  if (state === 'success' && videoUrl) {
    return { status: 'success', videoUrl };
  } else if (state === 'fail') {
    return { status: 'fail' };
  } else {
    // waiting or processing
    return { status: 'waiting' };
  }
}
