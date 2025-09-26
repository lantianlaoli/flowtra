import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/standard-ads-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';

export async function POST(request: NextRequest) {
  try {
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const requestData: StartWorkflowRequest = await request.json();

    // Ensure photoOnly field is correctly set as inverse of shouldGenerateVideo
    // If interface selected image only, then shouldGenerateVideo should be false, photoOnly should be true
    requestData.photoOnly = requestData.shouldGenerateVideo === undefined ? false : !requestData.shouldGenerateVideo;
    
    // Log shows photoOnly inconsistent with user choice, may be shouldGenerateVideo passing issue
    // If user selected "image only" in interface, ensure photoOnly is true
    if (requestData.shouldGenerateVideo === false) {
      requestData.photoOnly = true;
    }
    
    // Fix model selection issue: ensure nano_banana selection doesn't show as auto
    if (requestData.imageModel === 'auto') {
      // Default to use nano_banana as the actual model for auto
      requestData.imageModel = 'nano_banana';
    }

    console.log('🚀 Standard ads workflow request received:', {
      imageUrl: requestData.imageUrl,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      imageModel: requestData.imageModel,
      watermark: requestData.watermark,
      watermarkLocation: requestData.watermarkLocation,
      imageSize: requestData.imageSize,
      elementsCount: requestData.elementsCount,
      photoOnly: requestData.photoOnly
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
      console.error('❌ Standard ads workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Standard ads API error:', error);
    return NextResponse.json({
      error: 'Failed to start standard ads workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}