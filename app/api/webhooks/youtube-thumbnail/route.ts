import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

interface ThumbnailCallbackData {
  taskId: string;
  resultJson?: string;
  failMsg?: string;
  errorMessage?: string;
  response?: {
    resultUrls?: string[];
  };
  resultUrls?: string[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('📨 YouTube Thumbnail Webhook POST request received');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    const payload = await request.json();
    console.log('📄 YouTube thumbnail webhook payload received:', JSON.stringify(payload, null, 2));

    // Extract data from KIE webhook payload
    const { code, data } = payload;

    if (!data || !data.taskId) {
      console.error('❌ No taskId found in webhook payload');
      return NextResponse.json({ error: 'No taskId in webhook payload' }, { status: 400 });
    }

    const taskId = data.taskId;
    const supabase = getSupabase();

    console.log(`Processing YouTube thumbnail callback for taskId: ${taskId}`);

    if (code === 200) {
      // Success callback
      console.log('✅ YouTube thumbnail generation completed successfully');
      await handleSuccessCallback(taskId, data, supabase);
    } else if (code === 501) {
      // Failure callback
      console.log('❌ YouTube thumbnail generation failed');
      await handleFailureCallback(taskId, data, supabase);
    } else {
      console.log(`⚠️ Unknown callback code: ${code}`);
      return NextResponse.json({ error: 'Unknown callback code' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube thumbnail webhook processed successfully',
      taskId: taskId
    });

  } catch (error) {
    console.error('❌ YouTube Thumbnail Webhook processing error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessCallback(taskId: string, data: ThumbnailCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    // Find the thumbnail record by task_id
    const { data: records, error: findError } = await supabase
      .from('thumbnail_history')
      .select('*')
      .eq('task_id', taskId);

    if (findError) {
      throw new Error(`Failed to find thumbnail record: ${findError.message}`);
    }

    if (!records || records.length === 0) {
      console.log(`⚠️ No thumbnail record found for taskId: ${taskId}`);
      return;
    }

    // Check if already processed by webhook
    const alreadyProcessed = records.some(r => r.processed_by === 'webhook');
    if (alreadyProcessed) {
      console.log(`⚠️ Task ${taskId} already processed by webhook, skipping`);
      return;
    }

    const record = records[0];
    console.log(`Found thumbnail record: ${record.id}, status: ${record.status}`);

    // Extract thumbnail URLs from result
    console.log('📄 Raw data.resultJson:', data.resultJson);
    console.log('📄 Raw data.response:', data.response);
    console.log('📄 Raw data.resultUrls:', data.resultUrls);

    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    console.log('📄 Parsed resultJson:', resultJson);

    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;

    console.log('📄 directUrls:', directUrls);
    console.log('📄 responseUrls:', responseUrls);
    console.log('📄 flatUrls:', flatUrls);

    const thumbnailUrls = directUrls || responseUrls || flatUrls;
    console.log('📄 Final thumbnailUrls:', thumbnailUrls);

    if (!thumbnailUrls || thumbnailUrls.length === 0) {
      throw new Error('No thumbnail URLs in success callback');
    }

    console.log(`Processing ${thumbnailUrls.length} thumbnails for taskId ${taskId}`);

    // Handle multiple thumbnails - for each URL, create a separate record
    console.log(`📄 About to process ${thumbnailUrls.length} thumbnails`);

    for (let i = 0; i < thumbnailUrls.length; i++) {
      const thumbnailUrl = thumbnailUrls[i];
      console.log(`📄 Processing thumbnail ${i + 1}/${thumbnailUrls.length}: ${thumbnailUrl}`);

      let recordToUpdate;

      if (i === 0) {
        // Use the existing record for the first thumbnail
        console.log(`📄 Using existing record for first thumbnail: ${record.id}`);
        recordToUpdate = record;
      } else {
        // Create new records for additional thumbnails with same task_id
        console.log(`📄 Creating new record for thumbnail ${i + 1}`);
        const insertData = {
          user_id: record.user_id,
          task_id: taskId, // Use same task_id for all thumbnails
          identity_image_url: record.identity_image_url,
          title: record.title,
          status: 'processing',
          credits_cost: 5, // Each thumbnail has individual cost
          processed_by: 'webhook' // Mark as webhook processed
        };
        console.log(`📄 Insert data:`, insertData);

        const { data: newRecord, error: insertError } = await supabase
          .from('thumbnail_history')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error(`❌ Failed to create record for thumbnail ${i + 1}:`, insertError);
          continue;
        }

        console.log(`✅ Successfully created new record:`, newRecord);
        recordToUpdate = newRecord;
      }

      try {
        console.log(`Processing thumbnail ${i + 1} of ${thumbnailUrls.length}: ${thumbnailUrl}`);

        // Download and save the thumbnail to Supabase storage
        const savedThumbnailUrl = await downloadAndSaveThumbnail(thumbnailUrl, recordToUpdate.id, supabase);

        // Update the record with the thumbnail URL and completed status
        const { error: updateError } = await supabase
          .from('thumbnail_history')
          .update({
            thumbnail_url: savedThumbnailUrl,
            status: 'completed',
            processed_by: 'webhook',
            updated_at: new Date().toISOString()
          })
          .eq('id', recordToUpdate.id);

        if (updateError) {
          console.error(`Failed to update thumbnail record ${recordToUpdate.id}:`, updateError);
          continue;
        }

        console.log(`Successfully processed thumbnail ${i + 1}: ${savedThumbnailUrl}`);

      } catch (thumbnailError) {
        console.error(`Error processing thumbnail ${i + 1} for record ${recordToUpdate.id}:`, thumbnailError);

        // Mark this specific record as failed
        await supabase
          .from('thumbnail_history')
          .update({
            status: 'failed',
            error_message: thumbnailError instanceof Error ? thumbnailError.message : 'Thumbnail processing failed',
            processed_by: 'webhook',
            updated_at: new Date().toISOString()
          })
          .eq('id', recordToUpdate.id);
      }
    }

    console.log(`Completed processing all ${thumbnailUrls.length} thumbnails for taskId ${taskId}`);

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);

    // Try to mark the record as failed
    try {
      await supabase
        .from('thumbnail_history')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Success callback processing failed',
          processed_by: 'webhook',
          updated_at: new Date().toISOString()
        })
        .eq('task_id', taskId);
    } catch (updateError) {
      console.error('Failed to update record status to failed:', updateError);
    }

    throw error;
  }
}

async function handleFailureCallback(taskId: string, data: ThumbnailCallbackData, supabase: ReturnType<typeof getSupabase>) {
  try {
    const failureMessage = data.failMsg || data.errorMessage || 'Thumbnail generation failed';

    console.log(`Thumbnail generation failed for taskId ${taskId}: ${failureMessage}`);

    // Update the record with failed status
    const { error: updateError } = await supabase
      .from('thumbnail_history')
      .update({
        status: 'failed',
        error_message: failureMessage,
        processed_by: 'webhook',
        updated_at: new Date().toISOString()
      })
      .eq('task_id', taskId);

    if (updateError) {
      throw new Error(`Failed to update thumbnail record: ${updateError.message}`);
    }

    console.log(`Successfully marked thumbnail record as failed for taskId: ${taskId}`);

  } catch (error) {
    console.error(`Error handling failure callback for taskId ${taskId}:`, error);
    throw error;
  }
}

async function downloadAndSaveThumbnail(thumbnailUrl: string, recordId: string, supabase: ReturnType<typeof getSupabase>): Promise<string> {
  try {
    // Download the thumbnail from KIE
    const response = await fetch(thumbnailUrl);
    if (!response.ok) {
      throw new Error(`Failed to download thumbnail: ${response.status}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageFile = new Uint8Array(imageBuffer);

    // Generate filename
    const fileName = `thumbnail_${recordId}_${Date.now()}.png`;

    // Upload to Supabase storage in thumbnails folder
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`thumbnails/${fileName}`, imageFile, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`thumbnails/${fileName}`);

    console.log(`Thumbnail saved to storage: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('Error downloading and saving thumbnail:', error);
    throw error;
  }
}

// Handle GET requests for webhook confirmation
export async function GET(request: NextRequest) {
  console.log('GET request received at YouTube thumbnail webhook endpoint');
  const url = new URL(request.url);
  console.log('GET parameters:', Object.fromEntries(url.searchParams.entries()));

  return NextResponse.json({
    success: true,
    message: 'YouTube thumbnail webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}