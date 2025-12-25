import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/avatar-ads/webhooks/ (with or without trailing slash)
 *
 * Universal webhook handler that routes to correct endpoint based on taskId lookup
 * This handles cases where:
 * 1. External services (KIE) add unexpected trailing slashes
 * 2. URL is configured without specific path (/video or /image)
 * 3. Internal proxies/tunnels normalize URLs
 *
 * Algorithm:
 * 1. Extract taskId from webhook payload
 * 2. Query database to determine if it's image or video task
 * 3. Forward to appropriate handler (image or video)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Avatar Ads Webhook Router] Received request to /webhooks/');

    const payload = await request.json();
    const taskId = payload?.data?.taskId;

    if (!taskId) {
      console.warn('[Avatar Ads Webhook Router] No taskId in payload');
      return NextResponse.json(
        { success: false, error: 'Missing taskId' },
        { status: 400 }
      );
    }

    console.log('[Avatar Ads Webhook Router] Looking up taskId:', taskId);

    // Check if it's an image task
    const supabase = getSupabaseAdmin();
    const { data: imageProject } = await supabase
      .from('avatar_ads_projects')
      .select('id')
      .eq('kie_image_task_id', taskId)
      .single();

    if (imageProject) {
      console.log('[Avatar Ads Webhook Router] Routing to image webhook handler');

      // Forward to image webhook handler
      const { POST: imageHandler } = await import('./image/route');
      return imageHandler(request);
    }

    // Check if it's a video task (from scenes table)
    const { data: videoScene } = await supabase
      .from('avatar_ads_scenes')
      .select('id')
      .eq('kie_video_task_id', taskId)
      .single();

    if (videoScene) {
      console.log('[Avatar Ads Webhook Router] Routing to video webhook handler');

      // Forward to video webhook handler
      const { POST: videoHandler } = await import('./video/route');
      return videoHandler(request);
    }

    // Task not found
    console.warn('[Avatar Ads Webhook Router] TaskId not found in database:', taskId);
    return NextResponse.json(
      { success: false, error: 'Task not found' },
      { status: 200 } // Return 200 to prevent KIE retries
    );

  } catch (error) {
    console.error('[Avatar Ads Webhook Router] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 200 } // Return 200 to prevent endless retries
    );
  }
}
