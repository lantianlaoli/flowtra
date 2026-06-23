import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for complex AI prompt generation
import { auth } from '@clerk/nextjs/server';
import { startWorkflowProcess, StartWorkflowRequest } from '@/lib/video-clone-workflow';
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
  return model === 'seedance_2_fast' || model === 'seedance_2' || model === 'seedance_2_mini' || model === 'kling_3' || model === 'wan_27';
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

    if (requestData.executionMode === 'edit_video') {
      const prompt = requestData.editVideoPrompt?.trim();
      const sourceUrl = requestData.editVideoSourceUrl?.trim();
      const durationSeconds = Number(requestData.videoDuration);

      if (!prompt) {
        return NextResponse.json({ error: 'Edit-video prompt is required' }, { status: 400 });
      }

      if (!sourceUrl) {
        return NextResponse.json({ error: 'Edit-video source video URL is required' }, { status: 400 });
      }

      const maxEditVideoDuration = requestData.videoModel === 'wan_27' ? 10 : 15;
      if (!Number.isFinite(durationSeconds) || durationSeconds < 2 || durationSeconds > maxEditVideoDuration) {
        return NextResponse.json(
          { error: `Edit-video source duration must be between 2 and ${maxEditVideoDuration} seconds` },
          { status: 400 }
        );
      }

      if (
        requestData.videoModel !== 'seedance_2' &&
        requestData.videoModel !== 'seedance_2_fast' &&
        requestData.videoModel !== 'seedance_2_mini' &&
        requestData.videoModel !== 'wan_27'
      ) {
        return NextResponse.json(
          { error: 'Edit-video mode supports Seedance 2 models and Wan 2.7 only' },
          { status: 400 }
        );
      }

      requestData.editVideoPrompt = prompt;
      requestData.editVideoSourceUrl = sourceUrl;
      requestData.requestSource = 'project_agent_edit_video';
    }

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

    if (typeof requestData.supplementalText === 'string') {
      const trimmedSupplementalText = requestData.supplementalText.trim();
      requestData.supplementalText = trimmedSupplementalText || undefined;
    } else {
      requestData.supplementalText = undefined;
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

    console.log('🚀 Video Clone workflow request received:', {
      imageUrl: requestData.imageUrl,
      referenceVideoId: requestData.referenceVideoId,
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
          supportedModels: ['seedance_2_fast', 'seedance_2', 'seedance_2_mini', 'kling_3', 'wan_27'],
          message: 'Please select Seedance 2 Fast, Seedance 2, Seedance 2 Mini, Kling 3.0, or Wan 2.7'
        },
        { status: 400 }
      );
    }

    if (requestData.executionMode !== 'edit_video' && requestData.videoModel === 'wan_27') {
      return NextResponse.json(
        {
          error: 'Wan 2.7 is currently available for edit-video mode only',
          supportedModels: ['seedance_2_fast', 'seedance_2', 'seedance_2_mini', 'kling_3'],
        },
        { status: 400 }
      );
    }

    if (
      requestData.executionMode !== 'edit_video' &&
      !requestData.referenceVideoId &&
      !requestData.creatorSourceVideoId
    ) {
      return NextResponse.json(
        { error: 'Reference video is required' },
        { status: 400 }
      );
    }

    if (requestData.executionMode !== 'edit_video' && requestData.creatorSourceVideoId) {
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
          workflow: requestData.executionMode === 'edit_video'
            ? 'edit_video'
            : requestData.photoOnly
              ? 'replica_photo'
              : 'clone_video',
          source_type: requestData.executionMode === 'edit_video'
            ? 'source_video'
            : requestData.creatorSourceVideoId
              ? 'creator'
              : 'reference_video',
        }
      });
      return NextResponse.json(result);
    } else {
      console.error('❌ Video Clone workflow failed:', result.error, result.details);
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

    console.error('💥 Video Clone API error:', error);
    return NextResponse.json({
      error: 'Failed to start Video Clone workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
