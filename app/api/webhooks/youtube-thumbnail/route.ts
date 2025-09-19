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

    const record = records[0];
    console.log(`Found thumbnail record: ${record.id}, status: ${record.status}`);

    // Extract thumbnail URL from result
    const resultJson = JSON.parse(data.resultJson || '{}') as Record<string, unknown>;
    const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
      ? (resultJson as { resultUrls?: string[] }).resultUrls
      : undefined;
    const responseUrls = Array.isArray(data.response?.resultUrls) ? data.response?.resultUrls : undefined;
    const flatUrls = Array.isArray(data.resultUrls) ? data.resultUrls : undefined;
    const thumbnailUrl = (directUrls || responseUrls || flatUrls)?.[0];

    if (!thumbnailUrl) {
      throw new Error('No thumbnail URL in success callback');
    }

    console.log(`Thumbnail completed for record ${record.id}: ${thumbnailUrl}`);

    // Download and save the thumbnail to Supabase storage
    const savedThumbnailUrl = await downloadAndSaveThumbnail(thumbnailUrl, record.id, supabase);

    // Update the record with the thumbnail URL and completed status
    const { error: updateError } = await supabase
      .from('thumbnail_history')
      .update({
        thumbnail_url: savedThumbnailUrl,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (updateError) {
      throw new Error(`Failed to update thumbnail record: ${updateError.message}`);
    }

    console.log(`Successfully updated thumbnail record ${record.id} with URL: ${savedThumbnailUrl}`);

  } catch (error) {
    console.error(`Error handling success callback for taskId ${taskId}:`, error);

    // Try to mark the record as failed
    try {
      await supabase
        .from('thumbnail_history')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Success callback processing failed',
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