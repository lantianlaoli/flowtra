import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/workflow';

export async function POST(request: NextRequest) {
  try {
    const requestData: StartWorkflowRequest = await request.json();

    console.log('🚀 Single video workflow request received:', {
      imageUrl: requestData.imageUrl,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      imageModel: requestData.imageModel,
      watermark: requestData.watermark,
      watermarkLocation: requestData.watermarkLocation,
      imageSize: requestData.imageSize,
      elementsCount: requestData.elementsCount
    });

    if (!requestData.imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    console.log('📋 Calling startWorkflowProcess...');
    const result = await startWorkflowProcess(requestData);

    console.log('📊 startWorkflowProcess result:', result);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      console.error('❌ Single video workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Single video API error:', error);
    return NextResponse.json({
      error: 'Failed to start single video workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}