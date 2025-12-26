import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * fal.ai Merge Webhook Payload (Actual Format)
 * Documentation: https://docs.fal.ai/clients/javascript#queue-subscription
 *
 * Real payload example:
 * {
 *   "status": "OK",
 *   "request_id": "066d69da-4118-457d-a32b-3157a72b4d78",
 *   "payload": {
 *     "video": {
 *       "url": "https://v3b.fal.media/files/...",
 *       "content_type": "video/mp4",
 *       "file_name": "merged_video.mp4",
 *       "file_size": 3684385
 *     }
 *   }
 * }
 */
interface FalMergeWebhookPayload {
  request_id: string;
  gateway_request_id?: string;
  status: 'OK' | 'ERROR' | 'IN_PROGRESS' | 'IN_QUEUE';
  payload?: {
    video?: {
      url: string;
      content_type?: string;
      file_name?: string;
      file_size?: number;
    };
    metadata?: unknown;
  };
  error?: string | null;
}

/**
 * POST /api/avatar-ads/webhooks/merge
 *
 * Receives webhook callbacks from fal.ai when video merge completes.
 * This endpoint is called by fal.ai after merge operation (success or failure).
 *
 * Security: Validates request_id exists in database before processing.
 * Idempotency: Safe to call multiple times - checks project status before updating.
 *
 * Flow:
 * 1. fal.ai merge completes → sends webhook to this endpoint
 * 2. Update avatar_ads_projects with merged_video_url
 * 3. Supabase Realtime pushes update to frontend
 * 4. User sees 100% complete in < 1 second
 */
export async function POST(request: NextRequest) {
  try {
    const webhookPayload: FalMergeWebhookPayload = await request.json();
    const { request_id, status, payload, error } = webhookPayload;

    console.log('[Avatar Ads Merge Webhook] Received:', {
      request_id,
      status,
      hasVideo: !!payload?.video?.url,
      videoUrl: payload?.video?.url,
      error
    });

    // Security validation: Check if request_id exists in database
    const supabase = getSupabaseAdmin();
    const { data: project, error: projectError } = await supabase
      .from('avatar_ads_projects')
      .select('id, status, fal_merge_task_id')
      .eq('fal_merge_task_id', request_id)
      .single();

    if (projectError || !project) {
      console.warn('[Avatar Ads Merge Webhook] Project not found for request_id:', request_id);
      // Return 200 to prevent fal.ai retries for invalid request_id
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if project already completed or failed
    if (project.status === 'completed' || project.status === 'failed') {
      console.log('[Avatar Ads Merge Webhook] Project already finalized:', project.status);
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const videoUrl = payload?.video?.url;

    // Update project based on webhook status
    // fal.ai uses "OK" for success, not "COMPLETED"
    if (status === 'OK' && videoUrl) {
      console.log('✅ [Avatar Ads Merge Webhook] Merge completed for project', project.id);

      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          merged_video_url: videoUrl,
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          error_message: null,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[Avatar Ads Merge Webhook] Failed to update project:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      console.log('🎉 [Avatar Ads Merge Webhook] Project completed successfully:', project.id);

      return NextResponse.json({ success: true, message: 'Merge completed' }, { status: 200 });

    } else if (status === 'ERROR' || error) {
      console.error('[Avatar Ads Merge Webhook] Merge failed for project', project.id, {
        error
      });

      const errorMessage = typeof error === 'string' ? error : 'Video merging failed';

      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          status: 'failed',
          error_message: `Video merging failed: ${errorMessage}`,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[Avatar Ads Merge Webhook] Failed to update project:', updateError);
      }

      return NextResponse.json({ success: true, message: 'Merge failed' }, { status: 200 });

    } else if (status === 'IN_PROGRESS' || status === 'IN_QUEUE') {
      // Update last_processed_at to show we're still monitoring
      await supabase
        .from('avatar_ads_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      console.log('[Avatar Ads Merge Webhook] Merge in progress for project', project.id);
      return NextResponse.json({ success: true, message: 'In progress' }, { status: 200 });

    } else {
      console.warn('[Avatar Ads Merge Webhook] Unknown status:', status, 'Full payload:', webhookPayload);
      return NextResponse.json({ success: true, message: 'Unknown status' }, { status: 200 });
    }

  } catch (error) {
    console.error('[Avatar Ads Merge Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
