import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, type CompetitorUgcReplicationSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getLanguagePromptName, getSegmentDurationForModel, type LanguageCode, type VideoModel } from '@/lib/constants';
import {
  startSegmentVideoTask,
  buildSegmentStatusPayload,
  createSmartSegmentFrame,
  deriveSegmentDetails,
  buildSegmentPlanFromCompetitorShots,
  normalizeSegmentPrompts,
  normalizeKlingDuration,
  serializeSegmentPlan,
  serializeSegmentPrompt,
  hydrateSegmentPlan,
  hydrateSerializedSegmentPrompt,
  buildStoredVideoPromptsPayload,
  type SegmentPrompt,
  type SegmentShot,
  type SerializedSegmentPlan,
  type SerializedSegmentPlanSegment
} from '@/lib/competitor-ugc-replication-workflow';
import { formatTimecode, parseCompetitorTimeline, type CompetitorShot } from '@/lib/competitor-shots';
import { checkFalTaskStatus } from '@/lib/video-merge';

export async function POST(request: NextRequest) {
  try {
    let targetProjectId: string | null = null;
    try {
      const body = await request.json();
      if (body && typeof body.projectId === 'string') {
        targetProjectId = body.projectId;
      }
    } catch {
      // No body – treat as bulk run
    }

    console.log('Starting Competitor UGC Replication task monitoring...');

    // Find records that need monitoring
    const supabase = getSupabaseAdmin();
    let records: HistoryRecord[] | null = null;

    if (targetProjectId) {
      const { data: project, error } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('*')
        .eq('id', targetProjectId)
        .single();

      if (error) {
        console.error(`Error fetching project ${targetProjectId}:`, error);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      records = project ? [project as HistoryRecord] : [];
    } else {
      const { data, error } = await supabase
        .from('competitor_ugc_replication_projects')
        .select('*')
        .in('status', ['processing', 'generating_cover', 'generating_video', 'segment_frames_ready', 'failed'])
        .or(
          'cover_task_id.not.is.null,' +
          'use_custom_script.eq.true,' +
          'current_step.eq.ready_for_video,' +
          'is_segmented.eq.true,' +
          'current_step.eq.generating_cover'
        )
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching records:', error);
        return NextResponse.json({ error: 'Database query failed' }, { status: 500 });
      }

      records = data as HistoryRecord[] | null;
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
              .from('competitor_ugc_replication_projects')
              .update({
                last_processed_at: new Date().toISOString()
              })
              .eq('id', record.id);
          } else {
            // For non-retryable errors, mark as failed immediately
            console.error(`❌ Non-retryable error for record ${record.id}, marking as failed`);
            await supabase
              .from('competitor_ugc_replication_projects')
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
        .from('competitor_ugc_replication_projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Updated in last minute

      completed = completedCount || 0;
    }

    console.log(`Competitor UGC Replication task monitoring completed: ${processed} processed, ${completed} completed, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed,
      completed,
      failed,
      totalRecords: records?.length || 0,
      message: 'Competitor UGC Replication task monitoring completed'
    });

  } catch (error) {
    console.error('Competitor UGC Replication task monitoring error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

type LegacyVideoPrompt = {
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
  ad_copy?: string;
  video_advertisement_prompt?: LegacyVideoPrompt;
  video_ad_prompt?: LegacyVideoPrompt;
  advertisement_prompt?: LegacyVideoPrompt;
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
  video_prompts: Record<string, unknown> | LegacyVideoPrompt | string | null;
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
  competitor_ad_id?: string;
  video_generation_requested?: boolean | null;
  image_model?: 'nano_banana' | 'seedream';
  language?: string;
  // NEW: Custom script fields
  custom_script?: string | null;
  use_custom_script?: boolean | null;
  video_duration?: string | null;
  video_quality?: 'standard' | 'high' | null;
  is_segmented?: boolean | null;
  segment_count?: number | null;
  segment_duration_seconds?: number | null;
  segment_plan?: SerializedSegmentPlan | Record<string, unknown> | null;
  segment_status?: Record<string, unknown> | null;
  fal_merge_task_id?: string | null;
  merged_video_url?: string | null;
  retry_count?: number; // Number of automatic retries for server errors
  __hydrated_plan_segments?: SegmentPrompt[] | null;
}

const MAX_WORKFLOW_AGE_MINUTES = 30;
function resolveSegmentDuration(record: HistoryRecord): number {
  const recordModel = (record.video_model ?? null) as VideoModel | null;
  return record.segment_duration_seconds || getSegmentDurationForModel(recordModel);
}

async function processRecord(record: HistoryRecord) {
  const supabase = getSupabaseAdmin();
  console.log(`Processing record ${record.id}, step: ${record.current_step}, status: ${record.status}`);

  if (record.status === 'completed') {
    return;
  }

  const createdAt = new Date(record.created_at);
  const workflowAgeMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);

  if (workflowAgeMinutes > MAX_WORKFLOW_AGE_MINUTES) {
    console.warn(`⏱️ Record ${record.id} exceeded ${MAX_WORKFLOW_AGE_MINUTES} minutes since creation, marking as failed`);

    const { error: timeoutErr } = await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        status: 'failed',
        error_message: 'Workflow timeout: exceeded 30 minutes since creation',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);

    if (timeoutErr) {
      console.error(`Failed to mark record ${record.id} as timed-out failed:`, timeoutErr);
      throw new Error(`DB update failed for timeout record ${record.id}`);
    }

    return;
  }

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
      .from('competitor_ugc_replication_projects')
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

  // Handle replica mode (photo-only) monitoring
  // Replica mode generates a single photo using reference images (not project-level cover for video)
  if (record.current_step === 'generating_cover' && record.cover_task_id && !record.cover_image_url && record.photo_only === true) {
    const coverResult = await checkCoverStatus(record.cover_task_id);

    if (coverResult.status === 'SUCCESS' && coverResult.imageUrl) {
      console.log(`Replica photo completed for record ${record.id}`);

      const { error: updErr } = await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          cover_image_url: coverResult.imageUrl,
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (updErr) {
        console.error(`Failed to mark record ${record.id} as completed (replica photo):`, updErr);
        throw new Error(`DB update failed for record ${record.id}`);
      }

      console.log(`Completed replica photo workflow for record ${record.id}`);
      return;
    } else if (coverResult.status === 'FAILED') {
      throw new Error('Replica photo generation failed');
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
        .from('competitor_ugc_replication_projects')
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
          .from('competitor_ugc_replication_projects')
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

        // SIMPLIFY ERROR MESSAGE for user
        let simplifiedError = videoResult.errorMessage || 'Unknown error';

        // Simplify content policy errors
        if (videoResult.errorMessage?.toLowerCase().includes('content polic') ||
            videoResult.errorMessage?.toLowerCase().includes('violating content') ||
            videoResult.errorMessage?.toLowerCase().includes('flagged by')) {
          simplifiedError = 'Content policy violation. Please try regenerating with a different prompt or adjust your requirements.';
        }

        throw new Error(`Video generation failed: ${simplifiedError}`);
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
  // Load competitor metadata up-front so recovery can mirror reference shots
  let competitorFileType: 'video' | 'image' | null = null;
  let competitorShots: CompetitorShot[] | undefined;
  if (record.competitor_ad_id) {
    const { data: competitorAd } = await supabase
      .from('competitor_ads')
      .select('file_type, analysis_result, video_duration_seconds')
      .eq('id', record.competitor_ad_id)
      .single();

    if (competitorAd?.file_type) {
      competitorFileType = competitorAd.file_type as 'video' | 'image';
      console.log(`📊 Project ${record.id} uses ${competitorFileType} competitor reference → Image model will be optimized`);
    }

    if (competitorAd?.analysis_result) {
      const timeline = parseCompetitorTimeline(
        competitorAd.analysis_result as Record<string, unknown>,
        competitorAd.video_duration_seconds
      );

      if (timeline.shots.length) {
        competitorShots = timeline.shots;
        console.log(`🧠 Loaded ${competitorShots.length} competitor shots for project ${record.id}`);
      }
    }
  }

  let segments = await fetchSegments(record.id, supabase);

  if (!segments.length && record.is_segmented) {
    console.warn(`⚠️ Project ${record.id} has no segment rows despite segmented workflow. Attempting auto-recovery…`);
    segments = await reinitializeMissingSegments(record, supabase, { competitorShots });
    if (!segments.length) {
      console.error(`❌ Failed to reinitialize segments for project ${record.id}. Marking as failed.`);
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          status: 'failed',
          error_message: 'Failed to initialize segment tasks. Please restart this generation.',
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      return;
    }
  }

  await ensureProjectInProgress(record, segments, supabase);

  segments = await syncSegmentFrameTasks(record, segments, supabase, competitorFileType);

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

    // NEW: Check approval before starting video
    if (!segment.video_generation_approved) {
      console.log(`[Semi-Automatic] Segment ${segment.segment_index} awaiting user approval for video generation`);
      continue;  // Skip automatic video generation
    }

    // For other products, use next segment's first frame as fallback for continuity
    const nextSegment = segments.find(s => s.segment_index === segment.segment_index + 1);
    const closingFrameUrl = segment.closing_frame_url || nextSegment?.first_frame_url || null;
    // Don't skip if closingFrameUrl is null - startSegmentVideoTask will handle single-frame mode

    const prompt = getSegmentPrompt(record, segment.segment_index, segments);
    const taskId = await startSegmentVideoTask(
      record as unknown as SingleVideoProject,
      prompt,
      segment.first_frame_url,
      closingFrameUrl,
      segment.segment_index,
      segments.length
    );

    await supabase
      .from('competitor_ugc_replication_segments')
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
      .from('competitor_ugc_replication_projects')
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
          .from('competitor_ugc_replication_segments')
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
          const prompt = getSegmentPrompt(record, segment.segment_index, segments);
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
            .from('competitor_ugc_replication_segments')
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

          // SIMPLIFY ERROR MESSAGE for user
          let simplifiedError = videoResult.errorMessage || 'Segment video generation failed';

          // Simplify content policy errors
          if (videoResult.errorMessage?.toLowerCase().includes('content polic') ||
              videoResult.errorMessage?.toLowerCase().includes('violating content') ||
              videoResult.errorMessage?.toLowerCase().includes('flagged by')) {
            simplifiedError = 'Content policy violation. Please try regenerating with a different prompt or adjust your requirements.';
          }

          await supabase
            .from('competitor_ugc_replication_segments')
            .update({
              status: 'failed',
              error_message: simplifiedError,
              updated_at: new Date().toISOString()
            })
            .eq('id', segment.id);

          segment.status = 'failed';
          segment.video_url = null;
          segment.video_task_id = null;

          const failureStatus = buildSegmentStatusPayload(segments);

          await supabase
            .from('competitor_ugc_replication_projects')
            .update({
              status: 'processing',
              current_step: 'generating_segment_videos',
              error_message: simplifiedError,
              segment_status: failureStatus,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id);

          console.error(`❌ Segment ${segment.segment_index} video failed: ${simplifiedError}`);
          continue;
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
      .from('competitor_ugc_replication_projects')
      .update({
        segment_status: buildSegmentStatusPayload(segments),
        progress_percentage: videoProgress,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', record.id);
  }

  const videosReady = segments.every(seg => !!seg.video_url);
  if (videosReady && !record.fal_merge_task_id) {
    if (record.current_step !== 'awaiting_merge') {
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          current_step: 'awaiting_merge',
          segment_status: buildSegmentStatusPayload(segments),
          progress_percentage: 95,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
      console.log(`⏸️ Project ${record.id} awaiting manual merge confirmation`);
    }
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
        .from('competitor_ugc_replication_projects')
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
        .from('competitor_ugc_replication_projects')
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
        .from('competitor_ugc_replication_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', record.id);
    }
  }
}

async function fetchSegments(projectId: string, supabase: ReturnType<typeof getSupabaseAdmin>): Promise<CompetitorUgcReplicationSegment[]> {
  const { data, error } = await supabase
    .from('competitor_ugc_replication_segments')
    .select('*')
    .eq('project_id', projectId)
    .order('segment_index', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch segments: ${error.message}`);
  }

  return (data || []) as CompetitorUgcReplicationSegment[];
}

async function reinitializeMissingSegments(
  record: HistoryRecord,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  options?: { competitorShots?: CompetitorShot[] }
): Promise<CompetitorUgcReplicationSegment[]> {
  const competitorShots = options?.competitorShots;
  const planSegments = getPlanSegments(record);
  let promptSegments =
    (Array.isArray(planSegments) && planSegments.length > 0
      ? planSegments
      : getVideoPromptSegments(record)) || [];

  let segmentCount = record.segment_count && record.segment_count > 0
    ? record.segment_count
    : promptSegments.length;
  if (!segmentCount || segmentCount < 1) {
    segmentCount = Math.max(1, promptSegments.length || 1);
  }

  if ((!promptSegments.length || promptSegments.length !== segmentCount) && competitorShots?.length) {
    console.log(`🧱 Rebuilding ${segmentCount} prompts from competitor timeline for project ${record.id}`);
    const rebuilt = buildSegmentPlanFromCompetitorShots(segmentCount, competitorShots);
    if (rebuilt.length === segmentCount) {
      promptSegments = rebuilt;
    }
  }

  if (!promptSegments.length) {
    console.warn(`⚠️ No stored prompt segments for project ${record.id}. Generating defaults for ${segmentCount} segments.`);
    promptSegments = Array.from({ length: segmentCount }, (_, index) => getSegmentPrompt(record, index));
  } else if (promptSegments.length < segmentCount) {
    const fallbackPrompt = promptSegments[promptSegments.length - 1] || getSegmentPrompt(record, promptSegments.length - 1);
    while (promptSegments.length < segmentCount) {
      promptSegments.push({ ...fallbackPrompt, index: promptSegments.length + 1 });
    }
  }

  const now = new Date().toISOString();

  // Persist recovered prompts for future retries so we don't fall back to generic templates again
  const hasPlanSegments = Array.isArray(planSegments) && planSegments.length > 0;
  const needsPlanUpdate = !hasPlanSegments;

  if (needsPlanUpdate) {
    const updatePayload: Record<string, unknown> = { last_processed_at: now };
    updatePayload.segment_plan = serializeSegmentPlan(promptSegments);
    record.segment_plan = updatePayload.segment_plan as SerializedSegmentPlan;
    record.__hydrated_plan_segments = promptSegments;

    // NOTE: No longer updating video_prompts here - it's already correct from initial write
    // The normalizeSegmentPrompts() fallback mechanism ensures first_frame_description
    // is populated from competitor shots if AI doesn't provide it

    const { error: planUpdateError } = await supabase
      .from('competitor_ugc_replication_projects')
      .update(updatePayload)
      .eq('id', record.id);

    if (planUpdateError) {
      console.error(`❌ Failed to persist recovered prompts for project ${record.id}:`, planUpdateError);
    }
  }

  const rows = Array.from({ length: segmentCount }, (_, index) => {
    const prompt =
      promptSegments[index] ||
      promptSegments[promptSegments.length - 1] ||
      ({} as SegmentPrompt);
    return {
      project_id: record.id,
      segment_index: index,
      status: 'pending_first_frame',
      prompt: serializeSegmentPrompt(prompt as SegmentPrompt),
      contains_brand: Boolean(prompt.contains_brand),
      contains_product: Boolean(prompt.contains_product),
      created_at: now,
      updated_at: now
    };
  });

  const { data, error } = await supabase
    .from('competitor_ugc_replication_segments')
    .insert(rows)
    .select('*');

  if (error || !data) {
    console.error(`❌ Failed to insert missing segments for project ${record.id}:`, error);
    return [];
  }

  const insertedSegments = data as CompetitorUgcReplicationSegment[];
  await supabase
    .from('competitor_ugc_replication_projects')
    .update({
      segment_status: buildSegmentStatusPayload(insertedSegments),
      last_processed_at: now
    })
    .eq('id', record.id);

  console.log(`✅ Rebuilt ${insertedSegments.length} missing segments for project ${record.id}`);
  return insertedSegments;
}

async function ensureProjectInProgress(
  record: HistoryRecord,
  segments: CompetitorUgcReplicationSegment[],
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  if (record.status !== 'failed') return;
  const hasSuccessfulVideo = segments.some(seg => !!seg.video_url);
  const hasPendingSegments = segments.some(seg => seg.status !== 'failed');

  if (!hasSuccessfulVideo && !hasPendingSegments) {
    // All segments failed with no successes – keep failed status.
    return;
  }

  const updatePayload = {
    status: 'processing',
    current_step: 'generating_segment_videos',
    last_processed_at: new Date().toISOString()
  } as const;

  const { error } = await supabase
    .from('competitor_ugc_replication_projects')
    .update(updatePayload)
    .eq('id', record.id);

  if (error) {
    console.error(`❌ Failed to reset project ${record.id} to processing:`, error);
    return;
  }

  record.status = 'processing';
  record.current_step = 'generating_segment_videos';
  console.log(`🔄 Project ${record.id} recovered from failed status (segments still running).`);
}

async function syncSegmentFrameTasks(
  record: HistoryRecord,
  segments: CompetitorUgcReplicationSegment[],
  supabase: ReturnType<typeof getSupabaseAdmin>,
  competitorFileType: 'video' | 'image' | null
): Promise<CompetitorUgcReplicationSegment[]> {
  let updated = false;
  const now = new Date().toISOString();

  for (const segment of segments) {
    const promptData = getSegmentPrompt(record, segment.segment_index, segments);
    const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
    const needsContinuation = Boolean(
      promptData.is_continuation_from_prev && segment.segment_index > 0
    );
    const previousSegment = segments.find(s => s.segment_index === segment.segment_index - 1);
    const previousFirstFrameUrl = previousSegment?.first_frame_url || null;

    if (segment.status === 'awaiting_prev_first_frame') {
      if (!needsContinuation || previousFirstFrameUrl) {
        console.log(`🔁 Continuation segment ${segment.segment_index} ready to start (prev frame available: ${Boolean(previousFirstFrameUrl)})`);
        try {
          const firstFrameTaskId = await createSmartSegmentFrame(
            promptData,
            segment.segment_index,
            'first',
            aspectRatio,
            null,
            null,
            undefined,
            competitorFileType,
            undefined,
            previousFirstFrameUrl
          );

          await supabase
            .from('competitor_ugc_replication_segments')
            .update({
              first_frame_task_id: firstFrameTaskId,
              status: 'generating_first_frame',
              updated_at: now
            })
            .eq('id', segment.id);

          segment.first_frame_task_id = firstFrameTaskId;
          segment.status = 'generating_first_frame';
          updated = true;
          console.log(`✅ Started continuation first frame for segment ${segment.segment_index}, taskId: ${firstFrameTaskId}`);
        } catch (error) {
          console.error(`❌ Failed to start continuation frame for segment ${segment.segment_index}:`, error);
          throw error;
        }
      } else {
        console.log(`⏳ Waiting for previous frame before starting segment ${segment.segment_index}`);
      }
      continue;
    }

    // FIX: Handle stuck segments in pending_first_frame without task_id
    // This can happen when initial workflow fails mid-way (e.g., insufficient credits)
    if (segment.status === 'pending_first_frame' && !segment.first_frame_task_id) {
      if (needsContinuation && !previousFirstFrameUrl) {
        await supabase
          .from('competitor_ugc_replication_segments')
          .update({
            status: 'awaiting_prev_first_frame',
            updated_at: now
          })
          .eq('id', segment.id);
        segment.status = 'awaiting_prev_first_frame';
        console.log(`⏸ Segment ${segment.segment_index} now waiting for previous frame before generation`);
        continue;
      }

      console.log(`🔧 Recovering stuck segment ${segment.segment_index} - creating first frame task`);

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
          undefined, // brandContext
          competitorFileType, // Pass competitor file type for model optimization
          undefined,
          needsContinuation ? previousFirstFrameUrl : null
        );

        await supabase
          .from('competitor_ugc_replication_segments')
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
            undefined,
            competitorFileType,
            undefined,
            null // Continuation not required for closing frames
          );

          await supabase
            .from('competitor_ugc_replication_segments')
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
          .from('competitor_ugc_replication_segments')
          .update({
            first_frame_url: frameStatus.imageUrl,
            status: 'first_frame_ready',
            video_generation_approved: false,  // NEW: Explicitly set to false (awaiting approval)
            updated_at: now
          })
          .eq('id', segment.id);

        segment.first_frame_url = frameStatus.imageUrl;
        segment.status = 'first_frame_ready';
        updated = true;

        if (segment.segment_index === 0 && !record.cover_image_url) {
          record.cover_image_url = frameStatus.imageUrl;
        }

        // NEW: Update project status to indicate manual review needed
        const { data: allSegments } = await supabase
          .from('competitor_ugc_replication_segments')
          .select('first_frame_url, video_generation_approved, video_url')
          .eq('project_id', record.id)
          .order('segment_index', { ascending: true });

        const hasFramesAwaitingReview = allSegments?.some(seg =>
          seg.first_frame_url && !seg.video_generation_approved && !seg.video_url
        );

        if (hasFramesAwaitingReview) {
          await supabase
            .from('competitor_ugc_replication_projects')
            .update({
              status: 'segment_frames_ready',
              current_step: 'reviewing_segment_frames',
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id);
          console.log(`[Semi-Automatic] Project ${record.id} status updated to segment_frames_ready - awaiting user review`);
        }

        // FRAME SYNCHRONIZATION FIX:
        // Always update the previous segment's closing_frame_url when the next segment's
        // first_frame_url is ready. This ensures smooth transitions even after regeneration.
        if (segment.segment_index > 0) {
          const prev = segments.find(s => s.segment_index === segment.segment_index - 1);
          if (prev) {
            // Only update if the closing frame has actually changed (prevents unnecessary DB writes)
            if (prev.closing_frame_url !== frameStatus.imageUrl) {
              await supabase
                .from('competitor_ugc_replication_segments')
                .update({
                  closing_frame_url: frameStatus.imageUrl,
                  updated_at: now
                })
                .eq('id', prev.id);

              prev.closing_frame_url = frameStatus.imageUrl;
              updated = true;

              console.log(`✅ Synchronized segment ${prev.segment_index} closing frame with segment ${segment.segment_index} first frame`);
            }
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
          .from('competitor_ugc_replication_segments')
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
      .from('competitor_ugc_replication_projects')
      .update({
        cover_image_url: record.cover_image_url,
        segment_status: buildSegmentStatusPayload(segments),
        progress_percentage: frameProgress,
        last_processed_at: now
      })
      .eq('id', record.id);
  } else {
    // Even if no segments were updated, refresh timestamp to indicate backend is still processing
    // This prevents the frontend from showing a "frozen" progress bar
    await supabase
      .from('competitor_ugc_replication_projects')
      .update({
        last_processed_at: now
      })
      .eq('id', record.id);

    console.log(`⏳ No segment updates for project ${record.id}, but refreshed timestamp to keep frontend alive`);
  }

  return segments;
}

function getSegmentPrompt(
  record: HistoryRecord,
  index: number,
  segments?: CompetitorUgcReplicationSegment[]
): SegmentPrompt {
  const duration = resolveSegmentDuration(record);

  if (segments) {
    const match = segments.find(seg => seg.segment_index === index);
    if (match) {
      return ensureSegmentShots(
        record,
        hydrateSerializedSegmentPrompt(
          match.prompt as SerializedSegmentPlanSegment,
          match.segment_index,
          duration,
          match.contains_brand,
          match.contains_product
        )
      );
    }
  }

  const planSegments = getPlanSegments(record);
  if (Array.isArray(planSegments) && planSegments[index]) {
    return ensureSegmentShots(record, planSegments[index] as SegmentPrompt);
  }

  const promptSegments = getVideoPromptSegments(record);
  if (promptSegments[index]) {
    return ensureSegmentShots(record, promptSegments[index]);
  }

  const legacy = record.video_prompts as LegacyVideoPrompt | null;
  if (legacy) {
    return ensureSegmentShots(record, {
      audio: legacy.music || 'Warm instrumental',
      style: 'Premium lifestyle realism',
      action: legacy.action || 'Showcase product details',
      subject: 'Hero product',
      composition: legacy.camera_type || 'Wide cinematic shot',
      context_environment: legacy.setting || 'Premium studio environment',
      first_frame_description: legacy.description || 'Hero frame showing product clearly',
      ambiance_colour_lighting: legacy.lighting || 'Soft commercial lighting',
      camera_motion_positioning: legacy.camera_movement || 'Slow push-in',
      dialogue: legacy.dialogue || 'Narrate the primary benefit in one sentence',
      language: legacy.language || record.language || 'English',
      index: index + 1
    });
  }

  return ensureSegmentShots(record, {
    audio: 'Warm instrumental underscore',
    style: 'Premium lifestyle realism',
    action: 'Showcase product hero shot',
    subject: 'Hero product',
    composition: 'Wide cinematic shot',
    context_environment: 'Professional studio',
    first_frame_description: 'Hero product centered with premium lighting',
    ambiance_colour_lighting: 'Soft glam lighting',
    camera_motion_positioning: 'Slow push-in',
    dialogue: 'Narrate the core benefit in a concise line',
    language: record.language || 'English',
    index: index + 1
  });
}

function getPlanSegments(record: HistoryRecord): SegmentPrompt[] | null {
  if (record.__hydrated_plan_segments) {
    return record.__hydrated_plan_segments;
  }
  const hydrated = hydrateSegmentPlan(
    record.segment_plan as SerializedSegmentPlan | Record<string, unknown> | null,
    record.segment_count || 0,
    resolveSegmentDuration(record)
  );
  record.__hydrated_plan_segments = hydrated.length > 0 ? hydrated : null;
  return record.__hydrated_plan_segments;
}

function parseVideoPromptContainer(record: HistoryRecord): Record<string, unknown> | null {
  const raw = record.video_prompts;
  if (!raw) {
    return null;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      record.video_prompts = parsed as Record<string, unknown>;
      return parsed;
    } catch (error) {
      console.warn(`⚠️ Failed to parse video_prompts JSON for project ${record.id}:`, error);
      return null;
    }
  }

  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }

  return null;
}

function getVideoPromptSegments(record: HistoryRecord): SegmentPrompt[] {
  const container = parseVideoPromptContainer(record);
  if (!container) {
    return [];
  }

  const rawSegments = Array.isArray((container as { segments?: unknown[] }).segments)
    ? ((container as { segments?: unknown[] }).segments as unknown[])
    : null;

  if (!rawSegments || rawSegments.length === 0) {
    return [];
  }

  const segmentCount = record.segment_count && record.segment_count > 0
    ? record.segment_count
    : rawSegments.length;

  return hydrateSegmentPlan(
    { segments: rawSegments },
    segmentCount,
    resolveSegmentDuration(record)
  );
}

function ensureSegmentShots(record: HistoryRecord, prompt: SegmentPrompt): SegmentPrompt {
  const duration = resolveSegmentDuration(record);
  const hydrate = (segment: SegmentPrompt): SegmentPrompt => {
    const normalized = normalizeSegmentPrompts({ segments: [segment] }, 1, undefined, duration);
    if (normalized.length > 0) {
      return normalized[0];
    }
    return segment;
  };

  if (!Array.isArray(prompt.shots) || prompt.shots.length === 0) {
    const fallbackSegment = {
      ...prompt,
      shots: [
        {
          id: 1,
          time_range: `00:00 - ${formatTimecode(duration)}`,
          audio: prompt.audio || 'Warm instrumental underscore',
          style: prompt.style || 'Premium lifestyle realism',
          action: prompt.action || 'Showcase hero product',
          subject: prompt.subject || 'Hero product',
          dialogue: prompt.dialogue || 'Narrate the core benefit in a concise line',
          language: prompt.language || record.language || 'English',
          composition: prompt.composition || 'Wide cinematic shot',
          context_environment: prompt.context_environment || 'Professional studio',
          ambiance_colour_lighting: prompt.ambiance_colour_lighting || 'Soft commercial lighting',
          camera_motion_positioning: prompt.camera_motion_positioning || 'Slow push-in'
        }
      ]
    } as SegmentPrompt;

    return hydrate(fallbackSegment);
  }

  const needsMetadata = !prompt.audio || !prompt.style || !prompt.action || !prompt.subject || !prompt.context_environment || !prompt.composition || !prompt.ambiance_colour_lighting || !prompt.camera_motion_positioning || !prompt.dialogue || !prompt.language;

  if (needsMetadata) {
    return hydrate(prompt);
  }

  return prompt;
}

async function startVideoGeneration(record: HistoryRecord, coverImageUrl: string): Promise<string> {
  if (!record.video_prompts && !record.segment_plan) {
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
    const videoModel = (record.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
    const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

    const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok' || videoModel === 'kling_2_6';
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
    } else if (videoModel === 'kling_2_6') {
      const klingDuration = normalizeKlingDuration(record.video_duration);
      requestBody = {
        model: 'kling-2.6/image-to-video',
        input: {
          prompt: fullPrompt,
          image_urls: imageUrls,
          sound: true,
          duration: klingDuration
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
  const baseSegment = getSegmentPrompt(record, 0);
  const derived = deriveSegmentDetails(baseSegment);
  const language = (record.language || 'en') as LanguageCode;
  const languageName = derived.language || getLanguagePromptName(language);
  const dialogueContent = derived.dialogue;

  console.log('🌍 Language handling:');
  console.log('  - languageFromPrompt:', derived.language);
  console.log('  - record.language:', record.language);
  console.log('  - languageName (final):', languageName);
  console.log('  - Will add prefix:', languageName !== 'English');

  // Add language metadata at the beginning of the prompt (simple format for VEO3 API)
  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  console.log('🎬 Language prefix:', languagePrefix ? `YES - "${languageName}"` : 'NO (English)');

  const voiceDescriptor = 'Calm professional narrator';
  const voiceToneDescriptor = 'warm and confident';

  const fullPrompt = `${languagePrefix}${derived.description}

Setting: ${derived.setting}
Camera: ${derived.camera_type} with ${derived.camera_movement}
Action: ${derived.action}
Lighting: ${derived.lighting}
Dialogue: ${dialogueContent}
Music: ${derived.music}
Ending: ${derived.ending}
Other details: ${derived.other_details}
Voice: Use a ${voiceDescriptor} with a ${voiceToneDescriptor} tone to maintain consistency with the storyboard.`;

  console.log('Generated video prompt:', fullPrompt);

  const videoModel = (record.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6';
  const aspectRatio = record.video_aspect_ratio === '9:16' ? '9:16' : '16:9';

  const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok' || videoModel === 'kling_2_6';
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
  } else if (videoModel === 'kling_2_6') {
    const klingDuration = normalizeKlingDuration(record.video_duration);
    requestBody = {
      model: 'kling-2.6/image-to-video',
      input: {
        prompt: fullPrompt,
        image_urls: imageUrls,
        sound: true,
        duration: klingDuration
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
  const usesJobsEndpoint = videoModel === 'sora2' || videoModel === 'sora2_pro' || videoModel === 'grok' || videoModel === 'kling_2_6';
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

    const isSuccess = (state && (state.toLowerCase() === 'success' || state.toLowerCase() === 'succeeded')) || successFlag === 1 || (!!videoUrl && state === undefined);
    const isFailed = (state && (state.toLowerCase() === 'failed' || state.toLowerCase() === 'fail')) || successFlag === 2 || successFlag === 3;

    // CRITICAL: Check for failCode 500 (KIE server error) - this is retryable
    const isServerError = failCode === '500';

    if (isSuccess) {
      return { status: 'SUCCESS', videoUrl };
    }
    if (isFailed) {
      const errorMessage = taskData.failMsg || taskData.errorMessage || 'Video generation failed';

      // Check for content policy violations (retryable)
      const isContentPolicyError = errorMessage && (
        errorMessage.toLowerCase().includes('content polic') ||
        errorMessage.toLowerCase().includes('violating content policies') ||
        errorMessage.toLowerCase().includes('flagged by') ||
        errorMessage.toLowerCase().includes('safety check failed')
      );

      // If it's a content policy or server error, mark as retryable
      if (isContentPolicyError || isServerError) {
        const errorType = isContentPolicyError ? 'Content policy violation' : 'KIE server error';
        console.warn(`⚠️ ${errorType} (retryable) for task ${taskId}: ${errorMessage}`);
        return {
          status: 'FAILED',
          errorMessage: `${errorType} (retryable): ${errorMessage}`,
          isRetryable: true
        };
      }

      // Non-retryable error
      return {
        status: 'FAILED',
        errorMessage,
        isRetryable: false
      };
    }
    return { status: 'GENERATING' };
  }

  // VEO3 endpoint (non-jobs)
  if (taskData.successFlag === 1) {
    return {
      status: 'SUCCESS',
      videoUrl: taskData.response?.resultUrls?.[0] || undefined
    };
  } else if (taskData.successFlag === 2 || taskData.successFlag === 3) {
    const errorMessage = taskData.errorMessage || taskData.failMsg || 'Video generation failed';
    const failCode: string | undefined = typeof taskData.failCode === 'string' ? taskData.failCode : undefined;

    // Check for content policy violations (retryable)
    const isContentPolicyError = errorMessage && (
      errorMessage.toLowerCase().includes('content polic') ||
      errorMessage.toLowerCase().includes('violating content policies') ||
      errorMessage.toLowerCase().includes('flagged by') ||
      errorMessage.toLowerCase().includes('safety check failed')
    );

    const isServerError = failCode === '500';

    // Check for retryable errors
    if (isContentPolicyError || isServerError) {
      const errorType = isContentPolicyError ? 'Content policy violation' : 'VEO3 server error';
      console.warn(`⚠️ ${errorType} (retryable) for task ${taskId}: ${errorMessage}`);
      return {
        status: 'FAILED',
        errorMessage: `${errorType} (retryable): ${errorMessage}`,
        isRetryable: true
      };
    }

    // Non-retryable error
    return {
      status: 'FAILED',
      errorMessage,
      isRetryable: false
    };
  } else {
    return { status: 'GENERATING' };
  }
}
