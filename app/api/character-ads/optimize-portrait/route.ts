import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { IMAGE_MODELS } from '@/lib/constants';

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

    const payload = {
      model: IMAGE_MODELS.nano_banana, // google/nano-banana-edit
      input: {
        prompt: optimizationPrompt,
        image_urls: [imageUrl],
        output_format: "png",
        image_size: "9:16" // Default to portrait for character ads
      }
    };

    console.log('Starting portrait optimization with KIE:', { imageUrl, prompt: optimizationPrompt });

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
      console.error('KIE optimization task creation failed:', errorText);
      return NextResponse.json({ error: `Failed to start optimization: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      console.error('KIE API returned error:', data);
      return NextResponse.json({ error: data.msg || 'KIE API error' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      taskId: data.data.taskId 
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
