import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { IMAGE_CREDIT_COSTS } from '@/lib/constants';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1/jobs';
const PURIFICATION_COST = IMAGE_CREDIT_COSTS.nano_banana_pro; // 24 credits

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
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({
        error: 'Image URL is required'
      }, { status: 400 });
    }

    // 3. Check credits BEFORE processing
    const creditCheck = await checkCredits(userId, PURIFICATION_COST);
    if (!creditCheck.success || !creditCheck.hasEnoughCredits) {
      return NextResponse.json({
        error: 'Insufficient credits',
        details: `Product photo purification requires ${PURIFICATION_COST} credits. Your balance: ${creditCheck.currentCredits || 0}`
      }, { status: 402 });
    }

    // 4. Deduct credits upfront (Version 2.0 unified billing)
    const deductResult = await deductCredits(userId, PURIFICATION_COST);
    if (!deductResult.success) {
      return NextResponse.json({
        error: 'Failed to process credits',
        details: 'Could not deduct credits from your account'
      }, { status: 500 });
    }

    // 5. Create purification task with nano-banana-pro
    const payload = {
      model: 'nano-banana-pro',
      input: {
        prompt: PURIFICATION_PROMPT,
        image_input: [imageUrl],
        aspect_ratio: '1:1', // Square for product photos
        resolution: '2K',    // High quality
        output_format: 'png' // PNG for transparency support
      }
    };

    console.log('[purify-photo] Starting purification:', { userId, imageUrl, credits: PURIFICATION_COST });

    const response = await fetchWithRetry(`${KIE_API_BASE_URL}/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    }, 3, 30000);

    if (!response.ok) {
      // Refund credits on API failure
      await deductCredits(userId, -PURIFICATION_COST);
      const errorText = await response.text();
      console.error('[purify-photo] KIE task creation failed:', errorText);
      return NextResponse.json({
        error: 'Failed to start purification',
        details: errorText
      }, { status: response.status });
    }

    const data = await response.json();

    if (data.code !== 200) {
      // Refund credits on KIE error
      await deductCredits(userId, -PURIFICATION_COST);
      console.error('[purify-photo] KIE API returned error:', data);
      return NextResponse.json({
        error: data.msg || 'KIE API error',
        details: 'The image processing service returned an error'
      }, { status: 500 });
    }

    // 6. Record credit transaction
    await recordCreditTransaction(
      userId,
      'usage',
      PURIFICATION_COST,
      `Product photo purification task: ${data.data.taskId}`
    );

    console.log('[purify-photo] Task created successfully:', {
      userId,
      taskId: data.data.taskId,
      remainingCredits: deductResult.remainingCredits
    });

    return NextResponse.json({
      success: true,
      taskId: data.data.taskId,
      creditsDeducted: PURIFICATION_COST,
      remainingCredits: deductResult.remainingCredits
    });

  } catch (error) {
    console.error('[purify-photo] POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get taskId from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({
        error: 'Task ID is required'
      }, { status: 400 });
    }

    // 3. Query KIE API for task status
    const response = await fetchWithRetry(`${KIE_API_BASE_URL}/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      }
    }, 3, 10000);

    if (!response.ok) {
      throw new Error(`Failed to check status: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code !== 200) {
      throw new Error(data.msg || 'KIE API error');
    }

    // 4. Parse task result
    const taskData = data.data;
    const state = taskData.state ? taskData.state.toLowerCase() : 'unknown';

    let imageUrl = null;
    if (state === 'success' && taskData.resultJson) {
      try {
        const parsedResult = JSON.parse(taskData.resultJson);
        if (parsedResult.resultUrls && parsedResult.resultUrls.length > 0) {
          imageUrl = parsedResult.resultUrls[0];
        }
      } catch (e) {
        console.error('[purify-photo] Failed to parse result JSON:', e);
      }
    }

    console.log('[purify-photo] Status check:', { userId, taskId, state, hasImage: !!imageUrl });

    return NextResponse.json({
      success: true,
      status: state, // 'waiting', 'success', 'fail'
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('[purify-photo] GET error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
