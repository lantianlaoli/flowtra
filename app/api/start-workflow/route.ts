import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/workflow';

export async function POST(request: NextRequest) {
  try {
    const requestData: StartWorkflowRequest = await request.json();
    
    console.log('🚀 Start workflow request received:', {
      imageUrl: requestData.imageUrl,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      watermark: requestData.watermark
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
      console.error('❌ Workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Start workflow API error:', error);
    return NextResponse.json({
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}