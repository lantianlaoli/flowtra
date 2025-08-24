import { NextRequest, NextResponse } from 'next/server';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { checkKieCreditsForFullWorkflow } from '@/lib/kieCredits';

export async function POST(request: NextRequest) {
  try {
    const { originalImageUrl, imagePrompt } = await request.json();

    if (!originalImageUrl || !imagePrompt) {
      return NextResponse.json({ 
        error: 'Original image URL and image prompt are required' 
      }, { status: 400 });
    }

    // Check KIE credits before starting the workflow
    const kieCreditsCheck = await checkKieCreditsForFullWorkflow();
    
    if (!kieCreditsCheck.sufficient) {
      console.log(`KIE credits insufficient: ${kieCreditsCheck.currentCredits}/${kieCreditsCheck.requiredCredits}`);
      
      // Return friendly maintenance message for insufficient KIE credits
      return NextResponse.json({
        error: 'Server is currently under maintenance. You will be notified by email once it\'s completed. Thank you for your patience.',
        maintenance: true,
        code: 'MAINTENANCE'
      }, { status: 503 });
    }

    console.log(`KIE credits sufficient: ${kieCreditsCheck.currentCredits}/${kieCreditsCheck.requiredCredits}, proceeding with cover generation`)

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/gpt4o-image/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filesUrl: [originalImageUrl],
        prompt: `Take the product in the image and place it in this scenario: ${imagePrompt}`,
        size: "3:2"
      })
    }, 8, 30000); // 8 retries, 30 second timeout

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: 'Failed to generate cover image', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Handle new API response format
    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || 'Failed to generate cover image' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      taskId: data.data.taskId
    });
  } catch (error) {
    console.error('Cover generation error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const response = await fetchWithRetry(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
    }, 5, 15000); // 5 retries, 15 second timeout

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: 'Failed to get image details', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      return NextResponse.json(
        { error: data.msg || 'Failed to get image details' },
        { status: 400 }
      );
    }

    const taskData = data.data;
    let status = 'GENERATING';
    let imageUrl = null;

    // Map status based on successFlag and status
    if (taskData.status === 'SUCCESS' && taskData.successFlag === 1) {
      status = 'SUCCESS';
      imageUrl = taskData.response?.resultUrls?.[0] || null;
    } else if (taskData.status === 'CREATE_TASK_FAILED' || taskData.status === 'GENERATE_FAILED') {
      status = 'FAILED';
    } else {
      status = 'GENERATING';
    }
    
    return NextResponse.json({
      success: true,
      status,
      imageUrl,
      progress: taskData.progress || '0.00'
    });
  } catch (error) {
    console.error('Get cover image error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.status });
  }
}