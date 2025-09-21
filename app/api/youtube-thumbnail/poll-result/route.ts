import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    console.log(`Polling KIE API for taskId: ${taskId}`);

    // Poll KIE API for results
    const kieResponse = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
    });

    if (!kieResponse.ok) {
      console.error('KIE API poll error:', kieResponse.status);
      return NextResponse.json({ error: 'Failed to poll KIE API' }, { status: 500 });
    }

    const kieResult = await kieResponse.json();
    console.log('KIE poll result:', JSON.stringify(kieResult, null, 2));


    // Check if task is completed
    if (kieResult.code === 200 && kieResult.data) {
      const taskData = kieResult.data;

      // Check if task is finished and has results
      if (taskData.state === 'success' && taskData.resultJson) {
        // Parse resultJson string
        const resultData = JSON.parse(taskData.resultJson);
        const thumbnailUrls = resultData.resultUrls;

        if (thumbnailUrls && thumbnailUrls.length > 0) {
          console.log(`Task ${taskId} is finished with ${thumbnailUrls.length} results`);

          return NextResponse.json({
            success: true,
            status: 'completed',
            message: 'Task completed successfully',
            resultsCount: thumbnailUrls.length,
            progress: 100
          });
        }
      } else if (taskData.state === 'failed') {
        return NextResponse.json({
          success: false,
          status: 'failed',
          message: 'Task failed',
          error: taskData.failMsg || 'Task failed',
          progress: 0
        });

      } else {
        // Still processing - calculate progress based on state
        let progress = 0;
        switch (taskData.state) {
          case 'queuing':
            progress = 10;
            break;
          case 'running':
            progress = 50;
            break;
          case 'uploading':
            progress = 80;
            break;
          default:
            progress = 30;
        }

        return NextResponse.json({
          success: true,
          status: 'processing',
          message: `Task status: ${taskData.state}`,
          progress
        });
      }
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to get task status from KIE API'
      });
    }

  } catch (error) {
    console.error('Poll result error:', error);
    return NextResponse.json({
      error: 'Failed to poll results',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

