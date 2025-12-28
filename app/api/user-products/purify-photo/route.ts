import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getSupabaseAdmin } from '@/lib/supabase';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1/jobs';
// Product photo purification is FREE - no credits required

// Purification prompt - optimized for product photos
const PURIFICATION_PROMPT =
  "Studio product photography: Isolate the main product by removing all " +
  "background elements, clutter, and distractions. Center the product " +
  "perfectly in frame. Apply pure white (#FFFFFF) background. Maintain " +
  "original product appearance - preserve all colors, textures, materials, " +
  "and fine details. Professional e-commerce quality.";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validate request
    const body = await request.json();
    const { imageUrl, photoId } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    if (!photoId || typeof photoId !== 'string') {
      return NextResponse.json({
        error: 'Photo ID is required'
      }, { status: 400 });
    }

    // 3. Verify NEXT_PUBLIC_SITE_URL is configured (required for webhooks)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      console.error('[purify-photo] NEXT_PUBLIC_SITE_URL not configured');
      return NextResponse.json({
        error: 'Webhook URL not configured. Please contact support.',
        details: 'NEXT_PUBLIC_SITE_URL environment variable is required for photo purification.'
      }, { status: 500 });
    }

    const callBackUrl = `${siteUrl}/api/user-products/webhooks/purify`;

    // 4. Create purification task with nano-banana-pro (FREE - no credits required)
    const payload = {
      model: 'nano-banana-pro',
      callBackUrl, // Add webhook URL
      input: {
        prompt: PURIFICATION_PROMPT,
        image_input: [imageUrl],
        aspect_ratio: '1:1', // Square for product photos
        resolution: '2K',    // High quality
        output_format: 'png' // PNG for transparency support
      }
    };

    console.log('[purify-photo] Starting FREE purification with webhook:', { userId, imageUrl, photoId, callBackUrl });

    const response = await fetchWithRetry(`${KIE_API_BASE_URL}/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }, 3, 30000);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[purify-photo] KIE task creation failed:', errorText);
      return NextResponse.json({
        error: 'Failed to start purification',
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();

    if (data.code !== 200) {
      console.error('[purify-photo] KIE API returned error:', data);
      return NextResponse.json({
        error: data.msg || 'KIE API error',
        details: 'The image processing service returned an error'
      }, { status: 500 });
    }

    const taskId = data.data.taskId;

    // 5. Update photo record with purification tracking
    const supabase = getSupabaseAdmin();
    const { error: updateError } = await supabase
      .from('user_product_photos')
      .update({
        purification_task_id: taskId,
        purification_status: 'purifying',
        original_photo_url: imageUrl,
        purification_error: null,
        webhook_received_at: null
      })
      .eq('id', photoId)
      .eq('user_id', userId); // Security: Verify ownership

    if (updateError) {
      console.error('[purify-photo] Failed to update photo record:', updateError);
      return NextResponse.json({
        error: 'Failed to update photo record',
        details: updateError.message
      }, { status: 500 });
    }

    console.log('[purify-photo] Task created successfully (FREE):', {
      userId,
      photoId,
      taskId,
      callBackUrl
    });

    return NextResponse.json({
      success: true,
      taskId: taskId,
      photoId: photoId,
      creditsDeducted: 0
    });

  } catch (error) {
    console.error('[purify-photo] POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET endpoint removed - polling deprecated, webhooks handle status updates
