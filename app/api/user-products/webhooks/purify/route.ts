import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Webhook Payload (Nano Banana 2)
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
 * POST /api/user-products/webhooks/purify
 *
 * Receives webhook callbacks from KIE API when photo purification completes.
 * This endpoint is called by KIE after purification (success or failure).
 *
 * Security: Simple taskId validation - checks if taskId exists in database.
 * Idempotency: Uses webhook_received_at timestamp to prevent duplicate processing.
 */
export async function POST(request: NextRequest) {
  try {
    const payload: KIEImageWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, state, resultJson, failCode, failMsg } = data;

    console.log('[Purify Webhook] Received:', { taskId, code, state });

    // Security validation: Check if taskId exists in database
    const supabase = getSupabaseAdmin();
    const { data: photo, error: fetchError } = await supabase
      .from('user_product_photos')
      .select('id, user_id, product_id, purification_status, webhook_received_at')
      .eq('purification_task_id', taskId)
      .single();

    if (fetchError || !photo) {
      console.warn('[Purify Webhook] Task not found:', taskId);
      // Return 200 to prevent KIE retries for invalid taskId
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 200 }
      );
    }

    // Idempotency check: Skip if webhook already processed
    if (photo.webhook_received_at) {
      console.log('[Purify Webhook] Already processed:', taskId);
      return NextResponse.json({ success: true, message: 'Already processed' }, { status: 200 });
    }

    // Parse result URL from resultJson
    let purifiedImageUrl: string | undefined;
    if (resultJson) {
      try {
        const parsed = JSON.parse(resultJson);
        purifiedImageUrl = parsed.resultUrls?.[0];
      } catch (parseError) {
        console.error('[Purify Webhook] Failed to parse resultJson:', parseError);
      }
    }

    // Update photo record based on webhook status
    if (code === 200 && state === 'success' && purifiedImageUrl) {
      console.log('[Purify Webhook] Success:', { taskId, purifiedImageUrl });

      const { error: updateError } = await supabase
        .from('user_product_photos')
        .update({
          photo_url: purifiedImageUrl,
          purification_status: 'completed',
          purification_error: null,
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', photo.id);

      if (updateError) {
        console.error('[Purify Webhook] Failed to update photo:', updateError);
        // Still return 200 to prevent retries
        return NextResponse.json(
          { success: false, error: 'Database update failed' },
          { status: 200 }
        );
      }

      console.log('[Purify Webhook] Photo updated successfully:', photo.id);

    } else if (state === 'fail' || code !== 200) {
      console.error('[Purify Webhook] Purification failed:', {
        taskId,
        failCode,
        failMsg,
        msg
      });

      const errorMessage = failMsg || msg || 'Photo purification failed';

      const { error: updateError } = await supabase
        .from('user_product_photos')
        .update({
          purification_status: 'failed',
          purification_error: errorMessage,
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', photo.id);

      if (updateError) {
        console.error('[Purify Webhook] Failed to update photo:', updateError);
      }
    } else {
      // Mark as received even if unexpected state to prevent retries
      console.warn('[Purify Webhook] Unexpected state:', { taskId, code, state });
      await supabase
        .from('user_product_photos')
        .update({
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', photo.id);
    }

    // Always return 200 to acknowledge receipt (prevents KIE retries)
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('[Purify Webhook] Error:', error);
    // Return 200 even on error to prevent endless retries
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 }
    );
  }
}
