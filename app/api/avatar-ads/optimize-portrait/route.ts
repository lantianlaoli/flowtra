import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { buildKieGptImageTaskPayload, createKieGptImageTask } from '@/lib/kie-image-generation';
import { moderatePromptBeforeGeneration, isCreemModerationError } from '@/lib/creem-moderation';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1/jobs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl, prompt } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Default prompt if not provided
    const optimizationPrompt = prompt || "Generate a clear, high-quality portrait of this person, upper body only, photorealistic, 8k resolution, natural lighting.";

    // Moderate user-supplied prompt before generation
    try {
      await moderatePromptBeforeGeneration(optimizationPrompt, {
        externalId: `user_${userId}:avatar_ads:optimize_portrait`,
      });
    } catch (moderationError) {
      if (isCreemModerationError(moderationError)) {
        return NextResponse.json({ error: moderationError.message }, { status: (moderationError as { status?: number }).status || 400 });
      }
      throw moderationError;
    }

    const payload = buildKieGptImageTaskPayload({
      prompt: optimizationPrompt,
      referenceImageUrls: [imageUrl],
      aspectRatio: '9:16'
    });

    console.log('Starting portrait optimization with KIE:', { imageUrl, prompt: optimizationPrompt });
    console.log('KIE GPT Image 2 payload:', {
      model: payload.model,
      inputFields: Object.keys(payload.input)
    });
    const taskId = await createKieGptImageTask({
      prompt: optimizationPrompt,
      referenceImageUrls: [imageUrl],
      aspectRatio: '9:16',
      moderationExternalId: `user_${userId}:avatar_ads:optimize_portrait`
    }, 3, 30000);

    return NextResponse.json({ 
      success: true, 
      taskId
    });

  } catch (error) {
    console.error('Optimization error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

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
        console.error('Failed to parse result JSON:', e);
      }
    }

    return NextResponse.json({
      success: true,
      status: state, // 'waiting', 'success', 'fail'
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
