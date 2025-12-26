import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * fal.ai Merge Webhook Payload
 * Documentation: https://docs.fal.ai/clients/javascript#queue-subscription
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
 * POST /api/competitor-ugc-replication/webhooks/merge
 *
 * Receives webhook callbacks from fal.ai when video merge completes.
 * This endpoint is called by fal.ai after merge operation (success or failure).
 *
 * Security: Validates request_id exists in database before processing.
 * Idempotency: Safe to call multiple times - checks project status before updating.
 *
 * Flow:
 * 1. fal.ai merge completes → sends webhook to this endpoint
 * 2. Update competitor_ugc_replication_projects with merged_video_url
 * 3. Supabase Realtime pushes update to frontend
 * 4. User sees 100% complete in < 1 second
 */
export async function POST(request: NextRequest) {
  try {
    const webhookPayload: FalMergeWebhookPayload = await request.json();
    const { request_id, status, payload, error } = webhookPayload;

    console.log('[UGC Merge Webhook] Received:', {
      request_id,
      status,
      hasVideo: !!payload?.video?.url,
      videoUrl: payload?.video?.url,
      error
    });

    // Security validation: Check if request_id exists in database
    const supabase = getSupabaseAdmin();
    const { data: project, error: projectError } = await supabase
      .from('competitor_ugc_replication_projects')
      .select('id, status, fal_merge_task_id')
      .eq('fal_merge_task_id', request_id)
      .single();

    if (projectError || !project) {
      console.warn('[UGC Merge Webhook] Project not found for request_id:', request_id);
      // Return 200 to prevent fal.ai retries for invalid request_id
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if project already completed or failed
    if (project.status === 'completed' || project.status === 'failed') {
      console.log('[UGC Merge Webhook] Project already finalized:', project.status);
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    const videoUrl = payload?.video?.url;

    // Update project based on webhook status
    if (status === 'OK' && videoUrl) {
      console.log('✅ [UGC Merge Webhook] Merge completed for project', project.id);

      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          merged_video_url: videoUrl,
          video_url: videoUrl, // Also set main video_url for consistency
          status: 'completed',
          current_step: 'completed',
          progress_percentage: 100,
          error_message: null,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[UGC Merge Webhook] Failed to update project:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      console.log('🎉 [UGC Merge Webhook] Project completed successfully:', project.id);

      return NextResponse.json({ success: true, message: 'Merge completed' }, { status: 200 });

    } else if (status === 'ERROR' || error) {
      console.error('[UGC Merge Webhook] Merge failed for project', project.id, {
        error
      });

      const errorMessage = typeof error === 'string' ? error : 'Video merging failed';

      const { error: updateError } = await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          status: 'failed',
          error_message: `Video merging failed: ${errorMessage}`,
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[UGC Merge Webhook] Failed to update project:', updateError);
      }

      return NextResponse.json({ success: true, message: 'Merge failed' }, { status: 200 });

    } else if (status === 'IN_PROGRESS' || status === 'IN_QUEUE') {
      // Update last_processed_at to show we're still monitoring
      await supabase
        .from('competitor_ugc_replication_projects')
        .update({
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      console.log('[UGC Merge Webhook] Merge in progress for project', project.id);
      return NextResponse.json({ success: true, message: 'In progress' }, { status: 200 });

    } else {
      console.warn('[UGC Merge Webhook] Unknown status:', status);
      return NextResponse.json({ success: true, message: 'Unknown status' }, { status: 200 });
    }

  } catch (error) {
    console.error('[UGC Merge Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
