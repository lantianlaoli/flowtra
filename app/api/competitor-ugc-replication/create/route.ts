import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for complex AI prompt generation
import { auth } from '@clerk/nextjs/server';
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/competitor-ugc-replication-workflow';
import { validateKieCredits } from '@/lib/kie-credits-check';
import type { VideoModel } from '@/lib/constants';
import { getSupabaseAdmin } from '@/lib/supabase';
import { enforceRateLimit, getRequestIp, RateLimitError } from '@/lib/security/rate-limit';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

/**
 * Validates that the video model is one of the supported models
 */
function validateVideoModel(model: string): model is VideoModel {
  return model === 'veo3' || model === 'veo3_fast' || model === 'seedance_1_5_pro' || model === 'kling_3';
}

export async function POST(request: NextRequest) {
  try {
    const internalUserId = request.headers.get('x-project-agent-user-id');
    const internalTimestamp = request.headers.get('x-project-agent-timestamp');
    const internalSignature = request.headers.get('x-project-agent-signature');
    const hasValidInternalSignature = verifyInternalUserRequest({
      userId: internalUserId,
      timestamp: internalTimestamp,
      signature: internalSignature,
    });

    const { userId: clerkUserId } = hasValidInternalSignature
      ? { userId: internalUserId }
      : await auth();

    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    enforceRateLimit({
      key: `ugc-create:${clerkUserId}:${getRequestIp(request)}`,
      limit: 5,
      windowMs: 60 * 1000,
    });

    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const requestData: StartWorkflowRequest = await request.json();
    requestData.userId = clerkUserId;

    // Backward/forward compatibility: always normalize selection arrays.
    const selectedAvatarIds = Array.isArray(requestData.selectedAvatarIds)
      ? requestData.selectedAvatarIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    const selectedProductIds = Array.isArray(requestData.selectedProductIds)
      ? requestData.selectedProductIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    requestData.selectedAvatarIds = Array.from(new Set([
      ...(requestData.selectedAvatarId ? [requestData.selectedAvatarId] : []),
      ...selectedAvatarIds
    ]));
    requestData.selectedProductIds = Array.from(new Set([
      ...(requestData.selectedProductId ? [requestData.selectedProductId] : []),
      ...selectedProductIds
    ]));
    requestData.selectedAvatarId = requestData.selectedAvatarId || requestData.selectedAvatarIds[0];
    requestData.selectedProductId = requestData.selectedProductId || requestData.selectedProductIds[0];

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

    console.log('🚀 Competitor UGC Replication workflow request received:', {
      imageUrl: requestData.imageUrl,
      competitorAdId: requestData.competitorAdId,
      selectedAvatarId: requestData.selectedAvatarId,
      selectedProductId: requestData.selectedProductId,
      selectedAvatarIds: requestData.selectedAvatarIds,
      selectedProductIds: requestData.selectedProductIds,
      userId: requestData.userId,
      videoModel: requestData.videoModel,
      elementsCount: requestData.elementsCount,
      photoOnly: requestData.photoOnly,
      language: requestData.language,
      useCustomScript: requestData.useCustomScript,
      customScriptProvided: !!requestData.customScript
    });

    // Validate video model
    if (requestData.videoModel && !validateVideoModel(requestData.videoModel)) {
      return NextResponse.json(
        {
          error: 'Invalid video model',
          supportedModels: ['veo3', 'veo3_fast', 'seedance_1_5_pro', 'kling_3'],
          message: 'Please select Veo3.1, Veo3.1 fast, Seedance 1.5 Pro, or Kling 3.0'
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
      // Schema verified via Supabase MCP (2026-01-28): creator_source_videos includes id, source_id, analysis_result
      let referenceVideo: { id: string; analysis_result: unknown; analysis_status: unknown } | null = null;
      let referenceError: unknown = null;

      {
        const result = await supabase
          .from('creator_source_videos')
          .select('id, analysis_result, analysis_status')
          .eq('id', requestData.creatorSourceVideoId)
          .eq('user_id', requestData.userId)
          .maybeSingle();
        referenceVideo = result.data as { id: string; analysis_result: unknown; analysis_status: unknown } | null;
        referenceError = result.error;
      }

      // Backward compatibility: old clients may pass creator source id instead of video id.
      if (!referenceVideo) {
        const result = await supabase
          .from('creator_source_videos')
          .select('id, analysis_result, analysis_status')
          .eq('source_id', requestData.creatorSourceVideoId)
          .eq('user_id', requestData.userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        referenceVideo = result.data as { id: string; analysis_result: unknown; analysis_status: unknown } | null;
        referenceError = result.error ?? referenceError;
      }

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

    console.log('📋 Calling startWorkflowProcess...');
    const result = await startWorkflowProcess(requestData);

    console.log('📊 startWorkflowProcess result:', result);

    if (result.success) {
      captureServerEvent(ANALYTICS_EVENTS.ugc_clone_project_created, {
        distinctId: clerkUserId,
        request,
        properties: {
          feature: 'ugc_clone',
          surface: 'ugc_clone_create_api',
          project_id: typeof result.projectId === 'string' ? result.projectId : undefined,
          video_model: requestData.videoModel,
          duration_seconds: Number(requestData.videoDuration || 0) || undefined,
          aspect_ratio: requestData.videoAspectRatio,
          workflow: requestData.photoOnly ? 'replica_photo' : 'clone_video',
          source_type: requestData.creatorSourceVideoId ? 'creator' : 'competitor_ad',
        }
      });
      return NextResponse.json(result);
    } else {
      console.error('❌ Competitor UGC Replication workflow failed:', result.error, result.details);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        {
          status: 429,
          headers: { 'Retry-After': String(error.retryAfterSeconds) },
        }
      );
    }

    console.error('💥 Competitor UGC Replication API error:', error);
    return NextResponse.json({
      error: 'Failed to start Competitor UGC Replication workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
