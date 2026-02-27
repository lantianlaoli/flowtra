import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Generation Webhook Payload
 * Documentation: docs/kie/nano-banana-2.md
 */
interface KIEImageWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'waiting';
    resultJson?: string; // JSON string containing {resultUrls: [...]}
    failCode?: string;
    failMsg?: string;
  };
}

/**
 * POST /api/avatar-ads/webhooks/image
 *
 * Receives webhook callbacks from KIE API when image generation completes.
 * This endpoint is called by KIE after image generation (success or failure).
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses webhook_received_at timestamp to prevent duplicate processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: KIEImageWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, state, resultJson, failCode, failMsg } = data;

    // Security validation: Check if taskId exists in database
    const supabase = getSupabaseAdmin();
    const { data: project, error: fetchError } = await supabase
      .from('avatar_ads_projects')
      .select('id, user_id, status, webhook_received_at')
      .eq('kie_image_task_id', taskId)
      .single();

    if (fetchError || !project) {
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (project.webhook_received_at) {
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    // Parse result URL from resultJson
    let imageUrl: string | undefined;
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        imageUrl = parsed.resultUrls?.[0];
      } catch (parseError) {
        console.error('[Avatar Ads Image Webhook] Failed to parse resultJson:', parseError);
      }
    }

    // Update project based on webhook status
    if (code === 200 && state === 'success' && imageUrl) {
      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          generated_image_url: imageUrl,
          status: 'awaiting_review',
          current_step: 'reviewing',
          progress_percentage: 60,
          last_processed_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[Avatar Ads Image Webhook] Failed to update project:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

    } else if (state === 'fail' || code !== 200) {
      console.error('[Avatar Ads Image Webhook] Image generation failed:', {
        failCode,
        failMsg,
        msg
      });

      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          status: 'failed',
          error_message: failMsg || msg || 'Image generation failed',
          last_processed_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[Avatar Ads Image Webhook] Failed to update project:', updateError);
      }
    } else {
      // Mark as received even if unexpected state to prevent retries
      await supabase
        .from('avatar_ads_projects')
        .update({
          webhook_received_at: new Date().toISOString(),
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);
    }

    // Always return 200 to acknowledge receipt (prevents KIE retries)
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[Avatar Ads Image Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
