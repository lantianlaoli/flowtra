import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('[YouTube Thumbnail Callback] Received callback request');

    // Parse the callback data
    const callbackData = await request.json();
    console.log('[YouTube Thumbnail Callback] Data:', JSON.stringify(callbackData, null, 2));

    // Validate callback structure
    if (!callbackData.taskId) {
      console.error('[YouTube Thumbnail Callback] Missing taskId in callback');
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    const taskId = callbackData.taskId;
    const supabase = getSupabase();

    // Check if task is successful and has results
    if (callbackData.state === 'success' && callbackData.resultJson) {
      const resultData = JSON.parse(callbackData.resultJson);
      const thumbnailUrls = resultData.resultUrls;

      if (!thumbnailUrls || thumbnailUrls.length === 0) {
        console.error('[YouTube Thumbnail Callback] No thumbnail URLs in successful result');
        return NextResponse.json({ error: 'No results in callback' }, { status: 400 });
      }

      console.log(`[YouTube Thumbnail Callback] Task ${taskId} completed with ${thumbnailUrls.length} thumbnails`);

      // Get existing records for this task
      const { data: records, error: findError } = await supabase
        .from('thumbnail_history')
        .select('*')
        .eq('task_id', taskId);

      if (findError) {
        console.error('[YouTube Thumbnail Callback] Error finding records:', findError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (!records || records.length === 0) {
        console.error(`[YouTube Thumbnail Callback] No records found for task ${taskId}`);
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      // Check if task is already processed by webhook
      const webhookProcessedRecords = records.filter(r => r.processed_by === 'webhook');
      if (webhookProcessedRecords.length > 0) {
        console.log(`[YouTube Thumbnail Callback] Task ${taskId} already processed by webhook, skipping`);
        return NextResponse.json({
          success: true,
          message: 'Task already processed by webhook'
        });
      }

      const existingRecord = records[0];
      const recordsToProcess = [...records];

      // Create additional records if we have more results than records
      if (records.length < thumbnailUrls.length) {
        const recordsToCreate = thumbnailUrls.length - records.length;
        console.log(`[YouTube Thumbnail Callback] Creating ${recordsToCreate} additional records`);

        for (let i = 0; i < recordsToCreate; i++) {
          try {
            const { data: newRecord, error: insertError } = await supabase
              .from('thumbnail_history')
              .insert({
                user_id: existingRecord.user_id,
                task_id: taskId,
                identity_image_url: existingRecord.identity_image_url,
                title: existingRecord.title,
                status: 'processing',
                credits_cost: existingRecord.credits_cost, // Same cost as original
                processed_by: 'webhook' // Mark as webhook processed
              })
              .select()
              .single();

            if (insertError) {
              console.error(`[YouTube Thumbnail Callback] Failed to create additional record ${i + 1}:`, insertError);
              continue;
            }

            recordsToProcess.push(newRecord);
          } catch (error) {
            console.error(`[YouTube Thumbnail Callback] Error creating additional record ${i + 1}:`, error);
          }
        }
      }

      // Process each thumbnail URL
      let processedCount = 0;
      for (let i = 0; i < thumbnailUrls.length && i < recordsToProcess.length; i++) {
        const thumbnailUrl = thumbnailUrls[i];
        const recordToUpdate = recordsToProcess[i];

        try {
          console.log(`[YouTube Thumbnail Callback] Processing thumbnail ${i + 1}/${thumbnailUrls.length}: ${thumbnailUrl}`);

          // Store thumbnail URL directly (no download/upload needed)
          const { error: updateError } = await supabase
            .from('thumbnail_history')
            .update({
              thumbnail_url: thumbnailUrl,
              status: 'completed',
              processed_by: 'webhook',
              updated_at: new Date().toISOString()
            })
            .eq('id', recordToUpdate.id);

          if (updateError) {
            console.error(`[YouTube Thumbnail Callback] Failed to update record ${recordToUpdate.id}:`, updateError);
          } else {
            console.log(`[YouTube Thumbnail Callback] Successfully processed thumbnail ${i + 1}`);
            processedCount++;
          }

        } catch (error) {
          console.error(`[YouTube Thumbnail Callback] Error processing thumbnail ${i + 1}:`, error);

          // Mark as failed
          await supabase
            .from('thumbnail_history')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Processing failed',
              processed_by: 'webhook',
              updated_at: new Date().toISOString()
            })
            .eq('id', recordToUpdate.id);
        }
      }

      console.log(`[YouTube Thumbnail Callback] Callback completed: processed ${processedCount} thumbnails`);

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${processedCount} thumbnails via callback`,
        processedCount,
        totalResults: thumbnailUrls.length
      });

    } else if (callbackData.state === 'failed') {
      console.log(`[YouTube Thumbnail Callback] Task ${taskId} failed:`, callbackData.failMsg);

      // Mark all records for this task as failed
      const { error: updateError } = await supabase
        .from('thumbnail_history')
        .update({
          status: 'failed',
          error_message: callbackData.failMsg || 'Task failed',
          processed_by: 'webhook',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskId);

      if (updateError) {
        console.error('[YouTube Thumbnail Callback] Error updating failed status:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Task marked as failed',
        error: callbackData.failMsg
      });

    } else {
      console.log(`[YouTube Thumbnail Callback] Task ${taskId} still processing, state: ${callbackData.state}`);

      return NextResponse.json({
        success: true,
        message: `Task still processing (${callbackData.state})`
      });
    }

  } catch (error) {
    console.error('[YouTube Thumbnail Callback] Error:', error);
    return NextResponse.json({
      error: 'Callback processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}