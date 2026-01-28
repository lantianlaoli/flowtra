import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for complex AI prompt generation
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/competitor-ugc-replication-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';
import type { VideoModel } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Validates that the video model is one of the supported models
 */
function validateVideoModel(model: string): model is VideoModel {
  return model === 'veo3' || model === 'veo3_fast' || model === 'seedance_1_5_pro';
}

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
      requestData.referenceImageUrls = requestData.referenceImageUrls.slice(0, 8);
      requestData.photoOnly = true;
    }

    // Fix model selection issue: ensure nano_banana selection doesn't show as auto
    if (requestData.imageModel === 'auto') {
      // Default to use nano_banana as the actual model for auto
      requestData.imageModel = 'nano_banana';
    }

    console.log('🚀 Competitor UGC Replication workflow request received:', {
      imageUrl: requestData.imageUrl,
      selectedBrandId: requestData.selectedBrandId,
      competitorAdId: requestData.competitorAdId,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      imageModel: requestData.imageModel,
      imageSize: requestData.imageSize,
      elementsCount: requestData.elementsCount,
      photoOnly: requestData.photoOnly,
      language: requestData.language,
      useCustomScript: requestData.useCustomScript,
      customScriptProvided: !!requestData.customScript
    });

    // Validate video model (veo3, veo3_fast, and seedance_1_5_pro are supported)
    if (requestData.videoModel && !validateVideoModel(requestData.videoModel)) {
      return NextResponse.json(
        {
          error: 'Invalid video model',
          supportedModels: ['veo3', 'veo3_fast', 'seedance_1_5_pro'],
          message: 'Please select Veo3.1, Veo3.1 fast, or Seedance 1.5 Pro'
        },
        { status: 400 }
      );
    }

    if (!requestData.competitorAdId && !requestData.creatorSourceVideoId) {
      return NextResponse.json(
        { error: 'Reference video is required' },
        { status: 400 }
      );
    }

    if (requestData.creatorSourceVideoId) {
      const supabase = getSupabaseAdmin();
      // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes analysis_result
      const { data: referenceVideo, error: referenceError } = await supabase
        .from('creator_source_videos')
        .select('id, analysis_result, analysis_status')
        .eq('id', requestData.creatorSourceVideoId)
        .eq('user_id', requestData.userId)
        .single();

      if (referenceError || !referenceVideo) {
        return NextResponse.json(
          { error: 'Reference video not found' },
          { status: 404 }
        );
      }

      if (!referenceVideo.analysis_result) {
        return NextResponse.json(
          { error: 'Reference video analysis is not ready yet' },
          { status: 409 }
        );
      }
    }

    if (!requestData.selectedBrandId && requestData.competitorAdId) {
      const supabase = getSupabaseAdmin();
      // Schema verified via Supabase MCP (2026-01-28): competitor_ads has brand_id
      const { data: competitorAd, error: competitorError } = await supabase
        .from('competitor_ads')
        .select('brand_id')
        .eq('id', requestData.competitorAdId)
        .eq('user_id', requestData.userId)
        .single();

      if (competitorError || !competitorAd?.brand_id) {
        return NextResponse.json(
          { error: 'Brand could not be resolved from the selected video' },
          { status: 400 }
        );
      }

      requestData.selectedBrandId = competitorAd.brand_id;
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
