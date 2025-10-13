import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWatermarkRemovalWorkflow, StartWatermarkRemovalRequest } from '@/lib/watermark-removal-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';

export async function POST(request: NextRequest) {
  try {
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }

    const requestData: StartWatermarkRemovalRequest = await request.json();

    console.log('🎬 Watermark removal request received:', {
      userId: requestData.userId,
      videoUrl: requestData.videoUrl?.substring(0, 50) + '...',
    });

    if (!requestData.userId || !requestData.videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and videoUrl' },
        { status: 400 }
      );
    }

    console.log('📋 Calling startWatermarkRemovalWorkflow...');
    const result = await startWatermarkRemovalWorkflow(requestData);

    console.log('📊 Workflow result:', result);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      console.error('❌ Watermark removal workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('💥 Watermark removal API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to start watermark removal',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
