import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * KIE Image Generation Webhook Payload
 * Documentation: docs/kie/gpt_2_img.md and docs/kie/gpt_2_img_api.md
 */
interface KIEImageWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'failed' | 'error' | 'waiting';
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
      .select('id, user_id, status, webhook_received_at, generated_prompts, kie_image_task_id')
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
      const generatedPrompts = project.generated_prompts && typeof project.generated_prompts === 'object'
        ? project.generated_prompts as Record<string, unknown>
        : null;
      const nextGeneratedPrompts = generatedPrompts?.storyboard_mode &&
        typeof generatedPrompts.storyboard_mode === 'object'
          ? {
              ...generatedPrompts,
              storyboard_mode: {
                ...(generatedPrompts.storyboard_mode as Record<string, unknown>),
                storyboard_task_id: project.kie_image_task_id || null,
                storyboard_image_url: imageUrl,
              }
            }
          : project.generated_prompts;
      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          generated_image_url: imageUrl,
          generated_prompts: nextGeneratedPrompts,
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

      captureServerEvent(ANALYTICS_EVENTS.avatar_ads_cover_generated, {
        distinctId: project.user_id,
        request,
        properties: {
          feature: 'avatar_ads',
          surface: 'avatar_ads_image_webhook',
          project_id: project.id,
        }
      });

    } else if (
      (code === 200 && state === 'success' && !imageUrl) ||
      state === 'fail' ||
      state === 'failed' ||
      state === 'error' ||
      code !== 200
    ) {
      const errorMessage = code === 200 && state === 'success' && !imageUrl
        ? 'No images found in AI response. Unable to show the generated image. The image may have been filtered by the image provider policy.'
        : failMsg || msg || 'Image generation failed';

      console.error('[Avatar Ads Image Webhook] Image generation failed:', {
        failCode,
        failMsg: errorMessage,
        msg
      });

      const { error: updateError } = await supabase
        .from('avatar_ads_projects')
        .update({
          status: 'failed',
          current_step: 'generating_image',
          error_message: errorMessage,
          last_processed_at: new Date().toISOString(),
          webhook_received_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) {
        console.error('[Avatar Ads Image Webhook] Failed to update project:', updateError);
      }

      captureServerEvent(ANALYTICS_EVENTS.avatar_ads_video_generation_failed, {
        distinctId: project.user_id,
        request,
        properties: {
          feature: 'avatar_ads',
          surface: 'avatar_ads_image_webhook',
          project_id: project.id,
          error_code: failCode || String(code),
          error_message: errorMessage,
        }
      });
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
