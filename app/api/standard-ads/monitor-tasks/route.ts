import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getSupabaseAdmin, type StandardAdsSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { startSegmentVideoTask, buildSegmentStatusPayload, createSmartSegmentFrame, type SegmentPrompt } from '@/lib/standard-ads-workflow';
import { mergeVideosWithFal, checkFalTaskStatus } from '@/lib/video-merge';

export async function POST() {
  try {
    console.log('Starting standard ads task monitoring...');

    // Find records that need monitoring
    const supabase = getSupabaseAdmin();
    const { data: records, error } = await supabase
      .from('standard_ads_projects')
      .select('*')
      .in('status', ['processing', 'generating_cover', 'generating_video'])
      .or(
        // Include any of these conditions:
        'cover_task_id.not.is.null,' +           // Has cover task
        'use_custom_script.eq.true,' +           // Custom script mode
        'current_step.eq.ready_for_video,' +    // Ready for video
        'is_segmented.eq.true,' +                // Segmented workflow
        'current_step.eq.generating_cover'       // Generating cover (even if task_id is null - might be stuck)
      )
      .order('last_processed_at', { ascending: true, nullsFirst: true }) // Process new records (null last_processed_at) first
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

          // Check if it's a retryable error (connection timeout, network issues)
          const isRetryableError = error instanceof Error && (
            error.message.includes('connection timeout') ||
            error.message.includes('Connect Timeout') ||
            error.message.includes('UND_ERR_CONNECT_TIMEOUT') ||
            error.message.includes('fal.ai service may be slow') ||
            error.message.includes('fetch failed') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ETIMEDOUT')
          );

          if (isRetryableError) {
            // For retryable errors, don't mark as failed - just log and let it retry on next monitor run
            console.warn(`⚠️ Retryable error for record ${record.id}, will retry on next monitor run: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Update last_processed_at to track retry attempts
            await supabase
              .from('standard_ads_projects')
              .update({
                last_processed_at: new Date().toISOString()
              })
              .eq('id', record.id);
          } else {
            // For non-retryable errors, mark as failed immediately
            console.error(`❌ Non-retryable error for record ${record.id}, marking as failed`);
            await supabase
              .from('standard_ads_projects')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Processing error',
                last_processed_at: new Date().toISOString()
              })
              .eq('id', record.id);
            failed++;
          }
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Count completed records from this run
      const { count: completedCount } = await supabase
        .from('standard_ads_projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Updated in last minute

      completed = completedCount || 0;
    }

    console.log(`Standard ads task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalRecords: records?.length || 0,
      message: 'Standard ads task monitoring completed'
    });

  } catch (error) {
    console.error('Standard ads task monitoring error:', error);
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
  language?: string;
};

interface HistoryRecord {
  id: string;
  user_id: string;
  created_at: string;
  current_step: string;
  status: string;
  cover_task_id: string;
  video_task_id: string;
  cover_image_url: string;
  video_url: string;
  video_prompts: VideoPrompt;
  video_model: string;
  video_aspect_ratio?: string;
  credits_cost: number;
  download_credits_used: number;
  downloaded: boolean;
  last_processed_at: string;
  watermark_text?: string | null;
  watermark_location?: string | null;
  cover_image_aspect_ratio?: string | null;
  image_prompt?: string | null;
  photo_only?: boolean | null;
  selected_brand_id?: string;
  image_model?: 'nano_banana' | 'seedream';
  language?: string;
  // NEW: Custom script fields
  custom_script?: string | null;
  use_custom_script?: boolean | null;
  original_image_url?: string; // For custom script mode (use original image instead of generated cover)
  video_duration?: string | null;
  video_quality?: 'standard' | 'high' | null;
  is_segmented?: boolean | null;
  segment_count?: number | null;
  segment_plan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
  segment_status?: Record<string, unknown> | null;
  fal_merge_task_id?: string | null;
  merged_video_url?: string | null;
  retry_count?: number; // Number of automatic retries for server errors
}

async function processRecord(record: HistoryRecord) {
  const supabase = getSupabaseAdmin();
  console.log(`Processing record ${record.id}, step: ${record.current_step}, status: ${record.status}`);

  if (record.is_segmented) {
    await processSegmentedRecord(record, supabase);
    return;
  }

  // Handle custom script mode - ready to generate video directly
  if (record.current_step === 'ready_for_video' && record.use_custom_script && record.cover_image_url && !record.video_task_id) {
    console.log(`📜 Custom script mode - starting video generation for record ${record.id}`);

    // Start video generation using cover_image_url (which is the original image in custom script mode)
    const videoTaskId = await startVideoGeneration(record, record.cover_image_url);

    const { error: vidStartErr } = await supabase
      .from('standard_ads_projects')
      .update({
        video_task_id: videoTaskId,
        current_step: 'generating_video',
        progress_percentage: 85,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (vidStartErr) {
      console.error(`Failed to update record ${record.id} after starting custom script video:`, vidStartErr);
      throw new Error(`DB update failed for record ${record.id}`);
    }

    console.log(`✅ Started custom script video generation for record ${record.id}, taskId: ${videoTaskId}`);
    return;
  }

  // Handle stuck records: generating_cover but no cover_task_id (workflow failed before calling generateCover)
  if (record.current_step === 'generating_cover' && !record.cover_task_id) {
    const createdAt = new Date(record.created_at);
    const now = new Date();
    const ageInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    // If record is older than 5 minutes and still has no cover_task_id, mark as failed
    if (ageInMinutes > 5) {
      console.error(`❌ Record ${record.id} stuck in generating_cover for ${ageInMinutes.toFixed(1)} minutes without cover_task_id`);

      const { error: failErr } = await supabase
        .from('standard_ads_projects')
        .update({
          status: 'failed',
          error_message: 'Workflow timeout: Failed to start cover generation (possible AI prompt generation failure or video download timeout)',
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (failErr) {
        console.error(`Failed to mark stuck record ${record.id} as failed:`, failErr);
        throw new Error(`DB update failed for stuck record ${record.id}`);
      }

      console.log(`✅ Marked stuck record ${record.id} as failed`);
      return;
    } else {
      console.log(`⏳ Record ${record.id} is ${ageInMinutes.toFixed(1)} minutes old, waiting for cover_task_id (will timeout at 5min)`);
      return; // Still within timeout window, skip for now
    }
  }

  // Handle cover generation monitoring
  if (record.current_step === 'generating_cover' && record.cover_task_id && !record.cover_image_url) {
    const coverResult = await checkCoverStatus(record.cover_task_id);

    if (coverResult.status === 'SUCCESS' && coverResult.imageUrl) {
      console.log(`Cover completed for record ${record.id}`);

      // If photo_only, complete workflow here
      if (record.photo_only === true) {
        const { error: updErr } = await supabase
          .from('standard_ads_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
            status: 'completed',
            current_step: 'completed',
            progress_percentage: 100,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updErr) {
          console.error(`Failed to mark record ${record.id} as completed (photo-only):`, updErr);
          throw new Error(`DB update failed for record ${record.id}`);
        }

        console.log(`Completed image-only workflow for record ${record.id}`);
      } else {
        // Cover completed, start video generation
        const videoTaskId = await startVideoGeneration(record, coverResult.imageUrl);

        const { error: startErr } = await supabase
          .from('standard_ads_projects')
          .update({
            cover_image_url: coverResult.imageUrl,
            video_task_id: videoTaskId,
            current_step: 'generating_video',
            progress_percentage: 85,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (startErr) {
          console.error(`Failed to update record ${record.id} after starting video:`, startErr);
          throw new Error(`DB update failed for record ${record.id}`);
        }

        console.log(`Started video generation for record ${record.id}, taskId: ${videoTaskId}`);
      }

    } else if (coverResult.status === 'FAILED') {
      throw new Error('Cover generation failed');
    }
  }

  // Handle video generation monitoring
  if (record.current_step === 'generating_video' && record.video_task_id && !record.video_url) {
    const videoResult = await checkVideoStatus(record.video_task_id, record.video_model);

    if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
      console.log(`Video completed for record ${record.id}`);

      // Note: Credits are charged on download only; nothing to deduct now
      console.log(`✅ Workflow completed for user ${record.user_id}`);

      const { error: vidUpdErr } = await supabase
        .from('standard_ads_projects')
        .update({
          video_url: videoResult.videoUrl,
          status: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (vidUpdErr) {
        console.error(`Failed to mark record ${record.id} as completed after video:`, vidUpdErr);
        throw new Error(`DB update failed for record ${record.id}`);
      }

    } else if (videoResult.status === 'FAILED') {
      // CRITICAL: Check if error is retryable (failCode: 500)
      const MAX_RETRIES = 3;
      const currentRetryCount = record.retry_count || 0;

      if (videoResult.isRetryable && currentRetryCount < MAX_RETRIES) {
        console.warn(`⚠️ Retryable error for project ${record.id} (retry ${currentRetryCount + 1}/${MAX_RETRIES})`);
        console.warn(`   Error: ${videoResult.errorMessage}`);
        console.warn(`   Restarting video generation...`);

        // Restart video generation
        const newVideoTaskId = await startVideoGeneration(record, record.cover_image_url!);

        // Update project with new task ID and increment retry count
        const { error: retryErr } = await supabase
          .from('standard_ads_projects')
          .update({
            video_task_id: newVideoTaskId,
            retry_count: currentRetryCount + 1,
            error_message: `Retrying after server error (attempt ${currentRetryCount + 1}/${MAX_RETRIES})`,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (retryErr) {
          console.error(`Failed to update record ${record.id} for retry:`, retryErr);
          throw new Error(`DB update failed for record ${record.id}`);
        }

        console.log(`✅ Restarted video generation for project ${record.id}, new task ID: ${newVideoTaskId}`);
        return; // Exit processRecord - will retry on next monitor run
      } else {
        // Non-retryable error OR max retries exceeded
        if (videoResult.isRetryable) {
          console.error(`❌ Max retries (${MAX_RETRIES}) exceeded for project ${record.id}`);
        }

        throw new Error(`Video generation failed: ${videoResult.errorMessage || 'Unknown error'}`);
      }
    }
    // If still generating, do nothing and wait for next check
  }

  // Handle timeout checks (records not updated for too long)
  const lastProcessed = new Date(record.last_processed_at).getTime();
  const now = Date.now();
  const timeoutMinutes = 40; // 40min timeout for all steps

  if (now - lastProcessed > timeoutMinutes * 60 * 1000) {
    throw new Error(`Task timeout: no progress for ${timeoutMinutes} minutes`);
  }
}

async function processSegmentedRecord(record: HistoryRecord, supabase: ReturnType<typeof getSupabaseAdmin>) {
  let segments = await fetchSegments(record.id, supabase);

  segments = await syncSegmentFrameTasks(record, segments, supabase);

  if (!segments.length) {
    console.warn(`No segments found for segmented record ${record.id}`);
    return;
  }

  let videosStarted = false;
  let videosUpdated = false;

  for (const segment of segments) {
    if (segment.video_task_id || segment.video_url) {
      continue;
    }

    if (!segment.first_frame_url) {
      continue;
    }

    // For other products, use next segment's first frame as fallback for continuity
    const nextSegment = segments.find(s => s.segment_index === segment.segment_index + 1);
    const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;
    // Don't skip if closingFrameUrl is null - startSegmentVideoTask will handle single-frame mode

    const prompt = getSegmentPrompt(record, segment.segment_index);
    const taskId = await startSegmentVideoTask(
      record as unknown as SingleVideoProject,
      prompt,
      segment.first_frame_url,
      closingFrameUrl,
      segment.segment_index,
      segments.length
    );

    await supabase
      .from('standard_ads_segments')
      .update({
        video_task_id: taskId,
        status: 'generating_video',
        updated_at: new Date().toISOString()
      })
      .eq('id', segment.id);

    segment.video_task_id = taskId;
    segment.status = 'generating_video';
    videosStarted = true;
  }

  if (videosStarted) {
    await supabase
      .from('standard_ads_projects')
      .update({
        current_step: 'generating_segment_videos',
        progress_percentage: 70,
        segment_status: buildSegmentStatusPayload(segments),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);
  }

  for (const segment of segments) {
    if (segment.video_task_id && !segment.video_url) {
      const videoResult = await checkVideoStatus(segment.video_task_id, record.video_model);

      if (videoResult.status === 'SUCCESS' && videoResult.videoUrl) {
        await supabase
          .from('standard_ads_segments')
          .update({
            video_url: videoResult.videoUrl,
            status: 'video_ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', segment.id);

        segment.video_url = videoResult.videoUrl;
        segment.status = 'video_ready';
        videosUpdated = true;
      } else if (videoResult.status === 'FAILED') {
        // CRITICAL: Check if error is retryable (failCode: 500)
        const MAX_RETRIES = 3;
        const currentRetryCount = segment.retry_count || 0;

        if (videoResult.isRetryable && currentRetryCount < MAX_RETRIES) {
          console.warn(`⚠️ Retryable error for segment ${segment.segment_index} (retry ${currentRetryCount + 1}/${MAX_RETRIES})`);
          console.warn(`   Error: ${videoResult.errorMessage}`);
          console.warn(`   Restarting video generation...`);

          // Get closing frame URL for retry
          const nextSegment = segments.find(s => s.segment_index === segment.segment_index + 1);
          const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;

          // Restart video generation
          const prompt = getSegmentPrompt(record, segment.segment_index);
          const newTaskId = await startSegmentVideoTask(
            record as unknown as SingleVideoProject,
            prompt,
            segment.first_frame_url!,
            closingFrameUrl,
            segment.segment_index,
            segments.length
          );

          // Update segment with new task ID and increment retry count
          await supabase
            .from('standard_ads_segments')
            .update({
              video_task_id: newTaskId,
              status: 'generating_video',
              retry_count: currentRetryCount + 1,
              error_message: `Retrying after server error (attempt ${currentRetryCount + 1}/${MAX_RETRIES})`,
              updated_at: new Date().toISOString()
            })
            .eq('id', segment.id);

          console.log(`✅ Restarted video generation for segment ${segment.segment_index}, new task ID: ${newTaskId}`);

          // Update segment object in memory
          segment.video_task_id = newTaskId;
          segment.status = 'generating_video';
          videosUpdated = true;
        } else {
          // Non-retryable error OR max retries exceeded
          if (videoResult.isRetryable) {
            console.error(`❌ Max retries (${MAX_RETRIES}) exceeded for segment ${segment.segment_index}`);
          }

          await supabase
            .from('standard_ads_segments')
            .update({
              status: 'failed',
              error_message: videoResult.errorMessage || 'Segment video generation failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', segment.id);

          await supabase
            .from('standard_ads_projects')
            .update({
              status: 'failed',
              error_message: videoResult.errorMessage || 'Segment video generation failed',
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id);

          throw new Error(`Segment ${segment.segment_index} video failed: ${videoResult.errorMessage || 'unknown error'}`);
        }
      }
    }
  }

  if (videosUpdated) {
    // Calculate incremental progress based on videos ready (70% → 95% range)
    const videosReady = segments.filter(seg => !!seg.video_url).length;
    const totalSegments = segments.length;
    const videoProgressRange = 25; // 95% - 70%
    const videoProgress = 70 + Math.round((videosReady / totalSegments) * videoProgressRange);

    console.log(`📊 Video progress: ${videosReady}/${totalSegments} videos ready → ${videoProgress}%`);

    await supabase
      .from('standard_ads_projects')
      .update({
        segment_status: buildSegmentStatusPayload(segments),
        progress_percentage: videoProgress,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);
  }

  const videosReady = segments.every(seg => !!seg.video_url);
  if (videosReady && !record.fal_merge_task_id) {
    const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
    const { taskId } = await mergeVideosWithFal(segments.map(seg => seg.video_url as string), aspectRatio);

    await supabase
      .from('standard_ads_projects')
      .update({
        fal_merge_task_id: taskId,
        current_step: 'merging_segments',
        progress_percentage: 95,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

      record.fal_merge_task_id = taskId;
    return;
  }

  if (record.fal_merge_task_id && record.current_step === 'merging_segments' && !record.video_url) {
    // Check if merging has been running too long (timeout protection)
    const lastProcessedTime = new Date(record.last_processed_at || record.created_at);
    const mergeTimeoutMinutes = 15; // 15 minutes timeout for video merging
    const ageInMinutes = (new Date().getTime() - lastProcessedTime.getTime()) / (1000 * 60);

    if (ageInMinutes > mergeTimeoutMinutes) {
      console.error(`❌ Record ${record.id} stuck in merging_segments for ${ageInMinutes.toFixed(1)} minutes, marking as failed`);
      await supabase
        .from('standard_ads_projects')
        .update({
          status: 'failed',
          error_message: `Video merging timeout after ${ageInMinutes.toFixed(1)} minutes. Please retry.`,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      return;
    }

    const status = await checkFalTaskStatus(record.fal_merge_task_id);

    if (status.status === 'COMPLETED' && status.resultUrl) {
      await supabase
        .from('standard_ads_projects')
        .update({
          video_url: status.resultUrl,
          merged_video_url: status.resultUrl,
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
    } else if (status.status === 'FAILED') {
      throw new Error(status.error || 'Merge failed');
    } else if (status.status === 'NETWORK_ERROR') {
      // Network error - will retry on next monitor run
      console.warn(`⚠️ Network error checking merge status for record ${record.id}, will retry: ${status.error}`);
      await supabase
        .from('standard_ads_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
    }
  }
}

async function fetchSegments(projectId: string, supabase: ReturnType<typeof getSupabaseAdmin>): Promise<StandardAdsSegment[]> {
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

async function syncSegmentFrameTasks(
  record: HistoryRecord,
  segments: StandardAdsSegment[],
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<StandardAdsSegment[]> {
  let updated = false;
  const now = new Date().toISOString();

  for (const segment of segments) {
    // FIX: Handle stuck segments in pending_first_frame without task_id
    // This can happen when initial workflow fails mid-way (e.g., insufficient credits)
    if (segment.status === 'pending_first_frame' && !segment.first_frame_task_id) {
      console.log(`🔧 Recovering stuck segment ${segment.segment_index} - creating first frame task`);

      const promptData = getSegmentPrompt(record, segment.segment_index);
      const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

      try {
        // Use createSmartSegmentFrame with null for brand/product to fallback to Text-to-Image
        // This ensures the segment can progress even without brand/product images
        const firstFrameTaskId = await createSmartSegmentFrame(
          promptData,
          segment.segment_index,
          'first',
          aspectRatio,
          null, // brandLogoUrl - will fallback to Text-to-Image
          null, // productImageUrl - will fallback to Text-to-Image
          undefined // brandContext
        );

        await supabase
          .from('standard_ads_segments')
          .update({
            first_frame_task_id: firstFrameTaskId,
            status: 'generating_first_frame',
            updated_at: now
          })
          .eq('id', segment.id);

        segment.first_frame_task_id = firstFrameTaskId;
        segment.status = 'generating_first_frame';
        updated = true;

        console.log(`✅ Started first frame generation for stuck segment ${segment.segment_index}, taskId: ${firstFrameTaskId}`);

        // Also generate closing frame for the last segment
        if (segment.segment_index === segments.length - 1) {
          const closingFrameTaskId = await createSmartSegmentFrame(
            promptData,
            segment.segment_index,
            'closing',
            aspectRatio,
            null,
            null,
            undefined
          );

          await supabase
            .from('standard_ads_segments')
            .update({
              closing_frame_task_id: closingFrameTaskId,
              updated_at: now
            })
            .eq('id', segment.id);

          segment.closing_frame_task_id = closingFrameTaskId;
          console.log(`✅ Started closing frame generation for last segment ${segment.segment_index}, taskId: ${closingFrameTaskId}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create first frame for stuck segment ${segment.segment_index}:`, error);
        throw error; // Re-throw to be handled by processRecord's error handler
      }
    }

    if (segment.first_frame_task_id && !segment.first_frame_url) {
      const frameStatus = await checkCoverStatus(segment.first_frame_task_id);

      if (frameStatus.status === 'SUCCESS' && frameStatus.imageUrl) {
        await supabase
          .from('standard_ads_segments')
          .update({
            first_frame_url: frameStatus.imageUrl,
            status: 'first_frame_ready',
            updated_at: now
          })
          .eq('id', segment.id);

        segment.first_frame_url = frameStatus.imageUrl;
        segment.status = 'first_frame_ready';
        updated = true;

        if (segment.segment_index === 0 && !record.cover_image_url) {
          record.cover_image_url = frameStatus.imageUrl;
        }

        if (segment.segment_index > 0) {
          const prev = segments.find(s => s.segment_index === segment.segment_index - 1);
          if (prev && !prev.closing_frame_url) {
            await supabase
              .from('standard_ads_segments')
              .update({
                closing_frame_url: frameStatus.imageUrl,
                updated_at: now
              })
              .eq('id', prev.id);

            prev.closing_frame_url = frameStatus.imageUrl;
            updated = true;
          }
        }
      } else if (frameStatus.status === 'FAILED') {
        throw new Error(`Segment ${segment.segment_index} first frame failed`);
      }
    }

    const isLastSegment = segment.segment_index === segments.length - 1;
    if (isLastSegment && segment.closing_frame_task_id && !segment.closing_frame_url) {
      const closingStatus = await checkCoverStatus(segment.closing_frame_task_id);

      if (closingStatus.status === 'SUCCESS' && closingStatus.imageUrl) {
        await supabase
          .from('standard_ads_segments')
          .update({
            closing_frame_url: closingStatus.imageUrl,
            updated_at: now
          })
          .eq('id', segment.id);

        segment.closing_frame_url = closingStatus.imageUrl;
        updated = true;
      } else if (closingStatus.status === 'FAILED') {
        throw new Error(`Segment ${segment.segment_index} closing frame failed`);
      }
    }
  }

  if (updated) {
    // Calculate incremental progress based on frames ready (25% → 70% range)
    const framesReady = segments.filter(seg => !!seg.first_frame_url).length;
    const totalSegments = segments.length;
    const frameProgressRange = 45; // 70% - 25%
    const frameProgress = 25 + Math.round((framesReady / totalSegments) * frameProgressRange);

    console.log(`📊 Frame progress: ${framesReady}/${totalSegments} frames ready → ${frameProgress}%`);

    await supabase
      .from('standard_ads_projects')
      .update({
        cover_image_url: record.cover_image_url,
        segment_status: buildSegmentStatusPayload(segments),
        progress_percentage: frameProgress,
        last_processed_at: now
      })
      .eq('id', record.id);
  }

  return segments;
}

function getSegmentPrompt(record: HistoryRecord, index: number): SegmentPrompt {
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

async function startVideoGeneration(record: HistoryRecord, coverImageUrl: string): Promise<string> {
  if (!record.video_prompts) {
    throw new Error('No creative prompts available for video generation');
  }

  // ===== CUSTOM SCRIPT MODE =====
  if (record.use_custom_script) {
    console.log('📜 Custom script mode - using user-provided script');

    // Extract custom script from video_prompts
    const customScriptData = record.video_prompts as { customScript?: string; language?: string };
    const customScript = customScriptData.customScript || record.custom_script;

    if (!customScript) {
      throw new Error('Custom script not found in video_prompts or custom_script field');
    }

    console.log('📝 Custom script:', customScript.substring(0, 200) + '...');

    // Get language
    const language = (record.language || customScriptData.language || 'en') as LanguageCode;
    const languageName = getLanguagePromptName(language);

    // Add language prefix if not English
    const languagePrefix = languageName !== 'English'
      ? `"language": "${languageName}"\n\n`
      : '';

    console.log('🌍 Custom script language:', languageName);

    // Use custom script directly as prompt
    const fullPrompt = `${languagePrefix}${customScript}`;

    console.log('Generated custom script video prompt (first 300 chars):', fullPrompt.substring(0, 300));

    // Skip to API call section below (continue with existing API logic)
    const videoModel = (record.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
    const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

    const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok';
    const apiEndpoint = usesJobsEndpoint
      ? 'https://api.kie.ai/api/v1/jobs/createTask'
      : 'https://api.kie.ai/api/v1/veo/generate';

    // Custom script mode always uses a single image input
    const imageUrls = [coverImageUrl];

    console.log('📽️  Custom script video generation - single image mode');

    let requestBody: Record<string, unknown>;
    if (videoModel === 'grok') {
      requestBody = {
        model: 'grok-imagine/image-to-video',
        input: {
          image_urls: imageUrls,
          prompt: fullPrompt,
          mode: 'normal'
        }
      };
    } else if (videoModel === 'sora2' || videoModel === 'sora2_pro') {
      const soraInput = {
        prompt: fullPrompt,
        image_urls: imageUrls,
        aspect_ratio: aspectRatio === '9:16' ? 'portrait' : 'landscape'
      } as Record<string, unknown>;

      if (videoModel === 'sora2_pro') {
        soraInput.n_frames = record.video_duration === '15' ? '15' : '10';
        soraInput.size = record.video_quality === 'high' ? 'high' : 'standard';
        soraInput.remove_watermark = true;
      }

      requestBody = {
        model: videoModel === 'sora2_pro' ? 'sora-2-pro-image-to-video' : 'sora-2-image-to-video',
        input: soraInput
      };
    } else {
      requestBody = {
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
    }

    console.log('Video API endpoint:', apiEndpoint);
    console.log('Video API request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetchWithRetry(apiEndpoint, {
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

  // ===== NORMAL MODE (AI-generated prompts) =====
  // With Structured Outputs, video_prompts should already be in the correct format
  // But keep backward compatibility for old records with nested structures
  let videoPrompt = record.video_prompts as VideoPrompt & {
    ad_copy?: string;
    video_advertisement_prompt?: VideoPrompt;
    video_ad_prompt?: VideoPrompt;
    advertisement_prompt?: VideoPrompt;
  };

  // Check for legacy nested structures (from before Structured Outputs)
  if (videoPrompt.video_advertisement_prompt && typeof videoPrompt.video_advertisement_prompt === 'object') {
    console.log('⚠️ Legacy format detected: video_advertisement_prompt');
    videoPrompt = videoPrompt.video_advertisement_prompt as VideoPrompt & { ad_copy?: string };
  } else if (videoPrompt.video_ad_prompt && typeof videoPrompt.video_ad_prompt === 'object') {
    console.log('⚠️ Legacy format detected: video_ad_prompt');
    videoPrompt = videoPrompt.video_ad_prompt as VideoPrompt & { ad_copy?: string };
  } else if (videoPrompt.advertisement_prompt && typeof videoPrompt.advertisement_prompt === 'object') {
    console.log('⚠️ Legacy format detected: advertisement_prompt');
    videoPrompt = videoPrompt.advertisement_prompt as VideoPrompt & { ad_copy?: string };
  }

  // Validate that we have all required fields
  const requiredFields = ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'dialogue', 'music', 'ending', 'other_details'];
  const missingFields = requiredFields.filter(field => !videoPrompt[field as keyof VideoPrompt]);

  if (missingFields.length > 0) {
    console.error(`Missing required fields in video_prompts:`, missingFields);
    console.error(`Record ID: ${record.id}`);
    console.error(`video_prompts structure:`, JSON.stringify(record.video_prompts, null, 2));
    throw new Error(`Invalid video_prompts: missing fields [${missingFields.join(', ')}]`);
  }

  // Use the dialogue from AI-generated video prompts (purely image-based, no brand slogans)
  const dialogueContent = videoPrompt.dialogue;

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
Other details: ${videoPrompt.other_details}`;

  console.log('Generated video prompt:', fullPrompt);

  const videoModel = (record.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
  const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

  const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok';
  const apiEndpoint = usesJobsEndpoint
    ? 'https://api.kie.ai/api/v1/jobs/createTask'
    : 'https://api.kie.ai/api/v1/veo/generate';

  const imageUrls = [coverImageUrl];

  console.log('Video generation mode: single-image');

  let requestBody: Record<string, unknown>;
  if (videoModel === 'grok') {
    requestBody = {
      model: 'grok-imagine/image-to-video',
      input: {
        image_urls: imageUrls,
        prompt: fullPrompt,
        mode: 'normal'
      }
    };
  } else if (videoModel === 'sora2' || videoModel === 'sora2_pro') {
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

    requestBody = {
      model: videoModel === 'sora2_pro' ? 'sora-2-pro-image-to-video' : 'sora-2-image-to-video',
      input: soraInput
    };
  } else {
    requestBody = {
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
  }

  console.log('Video API endpoint:', apiEndpoint);
  console.log('Video API request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetchWithRetry(apiEndpoint, {
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
  console.log(`Checking cover status for taskId: ${taskId}`);
  
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 5, 15000);

  if (!response.ok) {
    throw new Error(`Failed to check nano-banana status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log(`Raw API response for task ${taskId}:`, JSON.stringify(data, null, 2));

  if (!data || data.code !== 200) {
    throw new Error((data && (data.message || data.msg)) || 'Failed to get nano-banana status');
  }

  const taskData = data.data;
  if (!taskData) {
    console.log(`No taskData found for task ${taskId}`);
    return { status: 'GENERATING' };
  }

  // Normalize state flags and extract URL robustly
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

  console.log(`Task ${taskId} state: ${state}, successFlag: ${successFlag}`);
  console.log(`Task ${taskId} resultJson:`, taskData.resultJson);
  console.log(`Task ${taskId} response:`, taskData.response);
  console.log(`Task ${taskId} resultUrls:`, taskData.resultUrls);

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

  console.log(`Task ${taskId} extracted imageUrl: ${imageUrl}`);
  console.log(`Task ${taskId} directUrls:`, directUrls);
  console.log(`Task ${taskId} responseUrls:`, responseUrls);
  console.log(`Task ${taskId} flatUrls:`, flatUrls);

  const isSuccess = (state && state.toLowerCase() === 'success') || successFlag === 1 || (!!imageUrl && (state === undefined));
  const isFailed = (state && state.toLowerCase() === 'failed') || successFlag === 2 || successFlag === 3;

  console.log(`Task ${taskId} isSuccess: ${isSuccess}, isFailed: ${isFailed}`);

  if (isSuccess) {
    return { status: 'SUCCESS', imageUrl };
  }
  if (isFailed) {
    return { status: 'FAILED' };
  }
  return { status: 'GENERATING' };
}

async function checkVideoStatus(taskId: string, videoModel?: string): Promise<{status: string, videoUrl?: string, errorMessage?: string, isRetryable?: boolean}> {
  const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok';
  const endpoint = usesJobsEndpoint
    ? `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`
    : `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`;

  const response = await fetchWithRetry(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    },
  }, 5, 15000);

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

  if (usesJobsEndpoint) {
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
    const videoUrl = (directUrls || responseUrls || flatUrls)?.[0];

    const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
    const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;
    const failCode: string | undefined = typeof taskData.failCode === 'string' ? taskData.failCode : undefined;

    const isSuccess = (state && state.toLowerCase() === 'success') || successFlag === 1 || (!!videoUrl && state === undefined);
    const isFailed = (state && state.toLowerCase() === 'failed') || successFlag === 2 || successFlag === 3;

    // CRITICAL: Check for failCode 500 (KIE server error) - this is retryable
    const isServerError = failCode === '500';

    if (isSuccess) {
      return { status: 'SUCCESS', videoUrl };
    }
    if (isFailed) {
      const errorMessage = taskData.failMsg || taskData.errorMessage || 'Video generation failed';

      // If it's a server error (failCode: 500), mark as retryable
      if (isServerError) {
        console.warn(`⚠️ KIE server error (failCode: 500) for task ${taskId}: ${errorMessage}`);
        return {
          status: 'FAILED',
          errorMessage: `KIE server error (retryable): ${errorMessage}`,
          isRetryable: true
        };
      }

      return {
        status: 'FAILED',
        errorMessage,
        isRetryable: false
      };
    }
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
      errorMessage: taskData.errorMessage || 'Video generation failed',
      isRetryable: false
    };
  } else {
    return { status: 'GENERATING' };
  }
}
