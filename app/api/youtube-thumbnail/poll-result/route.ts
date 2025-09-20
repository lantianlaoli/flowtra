import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';
import { THUMBNAIL_CREDIT_COST } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log(`Polling KIE API for taskId: ${taskId}`);

    // Poll KIE API for results
    const kieResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
    });

    if (!kieResponse.ok) {
      console.error('KIE API poll error:', kieResponse.status);
      return NextResponse.json({ error: 'Failed to poll KIE API' }, { status: 500 });
    }

    const kieResult = await kieResponse.json();
    console.log('KIE poll result:', JSON.stringify(kieResult, null, 2));

    const supabase = getSupabase();

    // Check if task is completed
    if (kieResult.code === 200 && kieResult.data) {
      const taskData = kieResult.data;

      // Check if task is finished and has results
      if (taskData.state === 'success' && taskData.resultJson) {
        // Parse resultJson string
        const resultData = JSON.parse(taskData.resultJson);
        const thumbnailUrls = resultData.resultUrls;

        if (thumbnailUrls && thumbnailUrls.length > 0) {
        console.log(`Task ${taskId} is finished with ${thumbnailUrls.length} results`);

        // Get existing records
        const { data: records, error: findError } = await supabase
          .from('thumbnail_history')
          .select('*')
          .eq('task_id', taskId)
          .eq('user_id', userId);

        if (findError || !records || records.length === 0) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Check if task is already fully processed by webhook
        const webhookProcessedRecords = records.filter(r => r.processed_by === 'webhook');
        const webhookCompletedCount = webhookProcessedRecords.filter(r => r.status === 'completed').length;
        const totalExpectedCount = thumbnailUrls.length;

        if (webhookProcessedRecords.length > 0) {
          console.log(`Task ${taskId}: Found ${webhookProcessedRecords.length} webhook-processed records, ${webhookCompletedCount} completed`);

          // If webhook has fully processed all expected thumbnails, skip polling
          if (webhookCompletedCount === totalExpectedCount) {
            console.log(`Task ${taskId} fully completed by webhook (${webhookCompletedCount}/${totalExpectedCount}), skipping polling`);
            return NextResponse.json({
              success: true,
              message: 'Task fully completed by webhook',
              resultsCount: webhookCompletedCount
            });
          }

          // If webhook processed some but not all, or some failed, continue with polling for remaining
          console.log(`Task ${taskId} partially processed by webhook, continuing polling for remaining thumbnails`);
        }

        // Check if task is already completed
        const completedRecords = records.filter(r => r.status === 'completed');
        if (completedRecords.length === thumbnailUrls.length) {
          console.log(`Task ${taskId} already completed with ${completedRecords.length} thumbnails`);
          return NextResponse.json({
            success: true,
            message: 'Task already completed',
            resultsCount: completedRecords.length
          });
        }

        console.log(`Found ${records.length} existing records, ${completedRecords.length} completed`);
        const existingRecord = records[0];

        // If we need more records than exist, create them first
        const recordsNeeded = thumbnailUrls.length;
        const recordsToProcess = [...records];

        // Create additional records if needed
        if (records.length < recordsNeeded) {
          const recordsToCreate = recordsNeeded - records.length;
          console.log(`Creating ${recordsToCreate} additional records for multiple thumbnails`);

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
                  credits_cost: THUMBNAIL_CREDIT_COST, // Each thumbnail has individual credit cost
                  processed_by: 'polling' // Mark as polling processed
                })
                .select()
                .single();

              if (insertError) {
                console.error(`Failed to create additional record ${i + 1}:`, insertError);
                continue;
              }

              recordsToProcess.push(newRecord);
            } catch (error) {
              console.error(`Error creating additional record ${i + 1}:`, error);
            }
          }
        }

        // Process results with available records, skipping webhook-processed ones
        console.log(`Processing ${thumbnailUrls.length} thumbnails with ${recordsToProcess.length} records`);

        let processedCount = 0;
        for (let i = 0; i < thumbnailUrls.length && i < recordsToProcess.length; i++) {
          const thumbnailUrl = thumbnailUrls[i];
          const recordToUpdate = recordsToProcess[i];
          console.log(`Processing thumbnail ${i + 1}/${thumbnailUrls.length}: ${thumbnailUrl}`);

          // Skip if record is already completed or processed by webhook
          if (recordToUpdate.status === 'completed' && recordToUpdate.thumbnail_url) {
            console.log(`Record ${recordToUpdate.id} already completed, skipping`);
            continue;
          }

          // Skip if already processed by webhook (even if not completed, to avoid conflicts)
          if (recordToUpdate.processed_by === 'webhook') {
            console.log(`Record ${recordToUpdate.id} already processed by webhook, skipping`);
            continue;
          }

          try {
            // Download and save thumbnail
            const savedThumbnailUrl = await downloadAndSaveThumbnail(thumbnailUrl, recordToUpdate.id, supabase);

            // Update record
            const { error: updateError } = await supabase
              .from('thumbnail_history')
              .update({
                thumbnail_url: savedThumbnailUrl,
                status: 'completed',
                processed_by: 'polling',
                updated_at: new Date().toISOString()
              })
              .eq('id', recordToUpdate.id);

            if (updateError) {
              console.error(`Failed to update record ${recordToUpdate.id}:`, updateError);
            } else {
              console.log(`Successfully processed thumbnail ${i + 1}`);
              processedCount++;
            }

          } catch (error) {
            console.error(`Error processing thumbnail ${i + 1}:`, error);

            // Mark as failed
            await supabase
              .from('thumbnail_history')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Processing failed',
                processed_by: 'polling',
                updated_at: new Date().toISOString()
              })
              .eq('id', recordToUpdate.id);
          }
        }

        console.log(`Polling completed: processed ${processedCount} new thumbnails`);

        return NextResponse.json({
          success: true,
          message: `Successfully processed ${processedCount} thumbnails via polling`,
          resultsCount: thumbnailUrls.length,
          newlyProcessed: processedCount
        });

        }
      } else if (taskData.state === 'failed') {
        // Mark task as failed
        await supabase
          .from('thumbnail_history')
          .update({
            status: 'failed',
            error_message: taskData.failMsg || 'Task failed',
            processed_by: 'polling',
            updated_at: new Date().toISOString()
          })
          .eq('task_id', taskId)
          .eq('user_id', userId);

        return NextResponse.json({
          success: false,
          message: 'Task failed',
          error: taskData.failMsg
        });

      } else {
        // Still processing
        return NextResponse.json({
          success: true,
          status: 'processing',
          message: `Task status: ${taskData.state}`
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to get task status from KIE API'
      });
    }

  } catch (error) {
    console.error('Poll result error:', error);
    return NextResponse.json({
      error: 'Failed to poll results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function downloadAndSaveThumbnail(thumbnailUrl: string, recordId: string, supabase: ReturnType<typeof getSupabase>): Promise<string> {
  try {
    console.log(`Downloading thumbnail from: ${thumbnailUrl}`);

    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageFile = new Uint8Array(imageBuffer);

    const fileName = `thumbnail_${recordId}_${Date.now()}.png`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`thumbnails/${fileName}`, imageFile, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`thumbnails/${fileName}`);

    console.log(`Thumbnail saved to: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('Error downloading and saving thumbnail:', error);
    throw error;
  }
}