import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/competitor-ugc-replication-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';

export async function POST(request: NextRequest) {
  try {
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const requestData: StartWorkflowRequest = await request.json();

    // Validate custom script mode
    if (requestData.useCustomScript) {
      const trimmedScript = requestData.customScript?.trim();
      if (!trimmedScript) {
        return NextResponse.json(
          { error: 'Custom script is required when custom script mode is enabled' },
          { status: 400 }
        );
      }
      requestData.customScript = trimmedScript;
    }

    // Ensure photoOnly field is correctly set as inverse of shouldGenerateVideo
    // If interface selected image only, then shouldGenerateVideo should be false, photoOnly should be true
    requestData.photoOnly = requestData.shouldGenerateVideo === undefined ? false : !requestData.shouldGenerateVideo;

    // Log shows photoOnly inconsistent with user choice, may be shouldGenerateVideo passing issue
    // If user selected "image only" in interface, ensure photoOnly is true
    if (requestData.shouldGenerateVideo === false) {
      requestData.photoOnly = true;
    }

    if (requestData.replicaMode) {
      if (!Array.isArray(requestData.referenceImageUrls) || requestData.referenceImageUrls.length === 0) {
        return NextResponse.json(
          { error: 'Replica mode requires reference images' },
          { status: 400 }
        );
      }
      requestData.referenceImageUrls = requestData.referenceImageUrls.slice(0, 10);
      requestData.photoOnly = true;
    }

    // Fix model selection issue: ensure nano_banana selection doesn't show as auto
    if (requestData.imageModel === 'auto') {
      // Default to use nano_banana as the actual model for auto
      requestData.imageModel = 'nano_banana';
    }

    if (requestData.adCopy) {
      const trimmed = requestData.adCopy.trim();
      requestData.adCopy = trimmed.length > 0 ? trimmed : undefined;
    }

    console.log('🚀 Competitor UGC Replication workflow request received:', {
      imageUrl: requestData.imageUrl,
      selectedProductId: requestData.selectedProductId,
      selectedBrandId: requestData.selectedBrandId, // NEW: Log brand ID
      competitorAdId: requestData.competitorAdId, // NEW: Log competitor ad ID
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      imageModel: requestData.imageModel,
      watermark: requestData.watermark,
      watermarkLocation: requestData.watermarkLocation,
      imageSize: requestData.imageSize,
      elementsCount: requestData.elementsCount,
      photoOnly: requestData.photoOnly,
      adCopyProvided: !!requestData.adCopy,
      language: requestData.language,
      useCustomScript: requestData.useCustomScript,
      customScriptProvided: !!requestData.customScript
    });

    // NEW: Updated validation to support brand-only mode
    // At least one of: imageUrl, selectedProductId, or selectedBrandId is required
    if (!requestData.imageUrl && !requestData.selectedProductId && !requestData.selectedBrandId) {
      return NextResponse.json(
        { error: 'Either imageUrl, selectedProductId, or selectedBrandId is required' },
        { status: 400 }
      );
    }

    console.log('📋 Calling startWorkflowProcess...');
    const result = await startWorkflowProcess(requestData);

    console.log('📊 startWorkflowProcess result:', result);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      console.error('❌ Competitor UGC Replication workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('💥 Competitor UGC Replication API error:', error);
    return NextResponse.json({
      error: 'Failed to start Competitor UGC Replication workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
