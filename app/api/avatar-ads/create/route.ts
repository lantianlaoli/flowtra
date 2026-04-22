import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/supabase';
import {
  GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
  getGenerationCost,
  getModelSupportedDurations,
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  type VideoModel
} from '@/lib/constants';
import { validateKieCredits } from '@/lib/kie-credits-check';
import { deductCredits, recordCreditTransaction } from '@/lib/credits';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';
import { verifyInternalUserRequest } from '@/lib/security/internal-request';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';
import { isSystemProductId } from '@/lib/default-products';
import { resolveProductForUser } from '@/lib/product-resolution';
import { estimateAvatarAdsSingleSceneDurationSeconds } from '@/lib/avatar-ads-duration-estimate';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const AVATAR_ADS_PERSISTED_IMAGE_MODEL = GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL;
const PUBLIC_AVATAR_ADS_VIDEO_MODELS: VideoModel[] = ['seedance_2_fast', 'kling_3', 'wan_27'];

export async function POST(request: NextRequest) {
  try {
    console.log('Character ads create API called');
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
    
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const formData = await request.formData();
    const isInternalAgentRequest = request.headers.get('x-project-agent-internal') === '1';
    console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value]));

    // Extract form data
    const requestUserId = formData.get('user_id') as string | null;
    const userId = clerkUserId;
    const videoDurationSeconds = parseInt(formData.get('video_duration_seconds') as string);
    const imageSize = (formData.get('image_size') as string | null)?.trim() || null;
    const videoModel = formData.get('video_model') as string;
    const customDialogue = (formData.get('custom_dialogue') as string) || '';
    const videoAspectRatio = '9:16';
    const selectedPersonPhotoUrl = formData.get('selected_person_photo_url') as string;
    const avatarName = formData.get('avatar_name') as string | null;
    const avatarGenderRaw = formData.get('avatar_gender') as string | null;
    const avatarGender = (avatarGenderRaw === 'male' || avatarGenderRaw === 'female') ? avatarGenderRaw : null;
    const selectedProductId = formData.get('selected_product_id') as string;
    const configuredLanguage = (formData.get('language') as string) || 'en';
    const providedResolvedSpokenLanguage = (formData.get('resolved_spoken_language') as string | null) || null;
    const resolvedSpokenLanguage = resolveAvatarSpokenLanguage({
      scriptSource: customDialogue,
      configuredLanguage: providedResolvedSpokenLanguage || configuredLanguage,
    });
    const clientProjectIdRaw = formData.get('project_id');
    const clientProjectId = typeof clientProjectIdRaw === 'string' ? clientProjectIdRaw.trim() : null;
    const talkingHeadModeFlag = formData.get('talking_head_mode');
    let talkingHeadMode = typeof talkingHeadModeFlag === 'string' && talkingHeadModeFlag.toLowerCase() === 'true';
    const prebuiltPromptsRaw = formData.get('prebuilt_prompts');
    const prebuiltImagePromptRaw = formData.get('prebuilt_image_prompt');
    const prebuiltPrompts = typeof prebuiltPromptsRaw === 'string' && prebuiltPromptsRaw.trim()
      ? JSON.parse(prebuiltPromptsRaw) as Record<string, unknown>
      : null;
    const prebuiltImagePrompt = typeof prebuiltImagePromptRaw === 'string' && prebuiltImagePromptRaw.trim()
      ? prebuiltImagePromptRaw.trim()
      : null;

    console.log('Extracted form data:', {
      userId,
      videoDurationSeconds,
      imageSize,
      videoModel,
      videoAspectRatio,
      selectedPersonPhotoUrl,
      selectedProductId,
      configuredLanguage,
      resolvedSpokenLanguage,
      clientProjectId
    });

    if (!videoDurationSeconds || !videoModel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (requestUserId && requestUserId !== clerkUserId) {
      return NextResponse.json(
        { error: 'user_id does not match the authenticated Clerk user' },
        { status: 403 }
      );
    }

    if (clientProjectId && !isUuid(clientProjectId)) {
      return NextResponse.json(
        { error: 'Invalid project_id. Must be a UUID.' },
        { status: 400 }
      );
    }

    const normalizedAspectRatio: '16:9' | '9:16' = videoAspectRatio === '9:16' ? '9:16' : '16:9';
    const enforcedImageSize = normalizedAspectRatio === '9:16' ? 'portrait_16_9' : 'landscape_16_9';
    if (imageSize && imageSize !== enforcedImageSize) {
      console.warn('Character ads image size mismatch. Overriding.', {
        provided: imageSize,
        enforced: enforcedImageSize,
        aspect: normalizedAspectRatio
      });
    }

    if (!PUBLIC_AVATAR_ADS_VIDEO_MODELS.includes(videoModel as VideoModel)) {
      return NextResponse.json(
        { error: 'Invalid video model' },
        { status: 400 }
      );
    }

    const requestedVideoModel = videoModel as VideoModel;
    const supportedDurations = new Set(getModelSupportedDurations(requestedVideoModel));
    const normalizedDuration = String(videoDurationSeconds);
    const isAgentKlingDuration = (
      isInternalAgentRequest &&
      requestedVideoModel === 'kling_3' &&
      Number.isFinite(videoDurationSeconds) &&
      videoDurationSeconds >= KLING_MIN_TASK_DURATION_SECONDS &&
      videoDurationSeconds <= KLING_MAX_PROJECT_DURATION_SECONDS
    );

    if (
      !supportedDurations.has(normalizedDuration as ReturnType<typeof getModelSupportedDurations>[number]) &&
      !isAgentKlingDuration
    ) {
      return NextResponse.json(
        { error: `Invalid video duration for ${requestedVideoModel}` },
        { status: 400 }
      );
    }

    // Handle person images - either uploaded files or selected photo URL
    const personImageUrls: string[] = [];
    const personFiles: File[] = [];

    if (selectedPersonPhotoUrl) {
      // Clean up the URL by removing backticks and extra spaces
      const cleanUrl = selectedPersonPhotoUrl.replace(/`/g, '').trim();
      console.log('Using selected person photo URL:', cleanUrl);
      personImageUrls.push(cleanUrl);
    } else {
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('person_image_') && value instanceof File) {
          personFiles.push(value);
        }
      }
    }

    // Handle product images - either from selected product or uploaded files
    const productImageUrls: string[] = [];
    const productFiles: File[] = [];
    // Product context for AI workflow
    let productContext: {
      product_name?: string;
      talking_head_script?: string;
    } | null = null;

    if (selectedProductId) {
      // Check if it's a temporary product (starts with "temp")
      if (selectedProductId.startsWith('temp')) {
        // Extract URL from temp format: "temp: URL" or "temp-timestamp"
        // For "temp: URL" format, extract the URL part
        // For "temp-timestamp" format, use as is (it's just an ID, not a URL)
        let tempUrl = selectedProductId;
        if (selectedProductId.includes(':')) {
          tempUrl = selectedProductId.replace(/^temp:\s*`?([^`]+)`?$/, '$1').trim();
        }
        console.log('Using temporary product identifier:', tempUrl);
        // Note: temp products without URLs will trigger fallback analysis in workflow
        if (tempUrl.startsWith('http')) {
          productImageUrls.push(tempUrl);
        }
        // For temp products, productContext remains null (will be analyzed during workflow)
      } else {
        const supabase = getSupabaseAdmin();
        const resolvedProduct = await resolveProductForUser({
          supabase,
          userId,
          productId: selectedProductId,
          maxPhotos: 8
        });

        if (!resolvedProduct.found) {
          return NextResponse.json(
            { error: 'Failed to fetch product' },
            { status: 400 }
          );
        }

        if (resolvedProduct.photoUrls.length === 0) {
          return NextResponse.json(
            { error: 'No photos found for selected product' },
            { status: 400 }
          );
        }

        productImageUrls.push(...resolvedProduct.photoUrls);

        productContext = {
          product_name: resolvedProduct.productName || undefined
        };
      }
    } else {
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('product_image_') && value instanceof File) {
          productFiles.push(value);
        }
      }
    }

    // Validate that we have images
    if (personImageUrls.length === 0 && personFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one person image is required' },
        { status: 400 }
      );
    }

    const hasProductAssets = productImageUrls.length > 0 || productFiles.length > 0 || !!selectedProductId;
    talkingHeadMode = !hasProductAssets;
    const trimmedDialogue = (customDialogue || '').trim();

    if (!trimmedDialogue) {
      return NextResponse.json(
        { error: 'Dialogue is required.' },
        { status: 400 }
      );
    }

    if (!talkingHeadMode && productImageUrls.length === 0 && productFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one product image is required' },
        { status: 400 }
      );
    }

    // Upload person images to Supabase if we have files
    for (let i = 0; i < personFiles.length; i++) {
      const file = personFiles[i];
      const fileName = `avatar-ads/person/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName, userId);
      personImageUrls.push(uploadResult.publicUrl);
    }

    if (talkingHeadMode && !productContext) {
      productContext = {
        talking_head_script: `Talking head delivery. Have the character speak directly to camera and read this script verbatim: ${trimmedDialogue}`
      };
    }

    // Upload product images to Supabase if we have files
    for (let i = 0; i < productFiles.length; i++) {
      const file = productFiles[i];
      const fileName = `avatar-ads/product/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName, userId);
      productImageUrls.push(uploadResult.publicUrl);
    }

    const resolvedVideoModel: VideoModel = PUBLIC_AVATAR_ADS_VIDEO_MODELS.includes(requestedVideoModel)
      ? requestedVideoModel
      : 'seedance_2_fast';
    const normalizedVideoDurationSeconds = prebuiltPrompts
      ? videoDurationSeconds
      : (
        estimateAvatarAdsSingleSceneDurationSeconds(
          trimmedDialogue,
          resolvedVideoModel,
          resolvedSpokenLanguage
        ) || videoDurationSeconds
      );
    const totalCredits = getGenerationCost(resolvedVideoModel, String(normalizedVideoDurationSeconds));

    const generationCreditsUsed = 0;

    // Create project in database
    const supabase = getSupabaseAdmin();
    // Schema verified via Supabase MCP (2026-03-17):
    // avatar_ads_projects.image_model stores the provider model used for cover generation.
    const projectInsert: Record<string, unknown> = {
      user_id: userId,
      person_image_urls: personImageUrls,
      product_image_urls: productImageUrls, // Still stored for temp products; will be removed in future migration
      selected_product_id:
        selectedProductId &&
        !selectedProductId.startsWith('temp') &&
        !isSystemProductId(selectedProductId)
          ? selectedProductId
          : null,
      product_context: productContext,
      video_duration_seconds: normalizedVideoDurationSeconds,
      image_model: AVATAR_ADS_PERSISTED_IMAGE_MODEL,
      video_model: resolvedVideoModel,
      video_aspect_ratio: normalizedAspectRatio,
      image_size: enforcedImageSize,
      custom_dialogue: trimmedDialogue,
      language: resolvedSpokenLanguage, // Language used for spoken dialogue generation
      avatar_name: avatarName, // Name of the selected avatar character
      avatar_gender: avatarGender, // Gender of the selected avatar character
      credits_cost: totalCredits,
      generation_credits_used: generationCreditsUsed,
      status: 'pending',
      current_step: 'generating_prompts',
      progress_percentage: 10,
    };
    if (prebuiltPrompts) {
      projectInsert.generated_prompts = prebuiltPrompts;
    }
    if (prebuiltImagePrompt) {
      projectInsert.image_prompt = prebuiltImagePrompt;
    }
    if (clientProjectId) {
      projectInsert.id = clientProjectId;
    }

    const { data: project, error: insertError } = await supabase
      .from('avatar_ads_projects')
      .insert(projectInsert)
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      // Refund credits if project creation failed
      if (generationCreditsUsed > 0) {
        await deductCredits(userId, -generationCreditsUsed);
        await recordCreditTransaction(
          userId,
          'refund',
          generationCreditsUsed,
          'Refund for failed avatar ads project creation',
          undefined,
          true
        );
      }
      return NextResponse.json(
        { error: 'Failed to create project in database' },
        { status: 500 }
      );
    }

    // CRITICAL FIX: Must await workflow completion before returning
    // Vercel terminates serverless functions immediately after API response
    // Fire-and-forget IIFE would be killed before processAvatarAdsProject executes
    console.log(`✅ Avatar Ads project ${project.id} created with status='pending'`);
    console.log(`Starting workflow: generate_prompts → awaiting_review...`);
    captureServerEvent(ANALYTICS_EVENTS.avatar_ads_project_created, {
      distinctId: userId,
      request,
      properties: {
        feature: 'avatar_ads',
        surface: 'avatar_ads_create_api',
        project_id: project.id,
        workflow: talkingHeadMode ? 'talking_head' : 'product_avatar_ads',
        video_model: resolvedVideoModel,
        duration_seconds: normalizedVideoDurationSeconds,
        spoken_language: resolvedSpokenLanguage,
        aspect_ratio: normalizedAspectRatio,
        credits_cost: totalCredits,
      }
    });
    const workflowSupabase = getSupabaseAdmin();

    try {
      const { processAvatarAdsProject } = await import('@/lib/avatar-ads-workflow');

      await processAvatarAdsProject(project, 'generate_prompts');
      console.log(`✅ Workflow initialization completed for project ${project.id} (ready for edit)`);
    } catch (error) {
      console.error(`❌ Workflow failed for project ${project.id}:`, error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');

      // Update project status so frontend gets error via Realtime
      await workflowSupabase
        .from('avatar_ads_projects')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Workflow execution failed',
          last_processed_at: new Date().toISOString()
        })
        .eq('id', project.id);

      // Don't throw - return success response with failed project status
      // Frontend will receive the error via Realtime subscription
    }

    return NextResponse.json({
      id: project.id,
      status: project.status,
      current_step: project.current_step,
      progress_percentage: project.progress_percentage,
      video_duration_seconds: project.video_duration_seconds,
      credits_cost: project.credits_cost,
      // Add computed fields that frontend expects
      has_analysis_result: false,
      has_generated_prompts: false,
      generated_image_url: null,
      generated_video_count: 0,
      kie_image_task_id: null,
      kie_video_task_ids: null,
      fal_merge_task_id: null,
      merged_video_url: null,
      error_message: null,
      person_image_count: personImageUrls.length,
      product_image_count: productImageUrls.length,
      created_at: project.created_at
    });

  } catch (error) {
    console.error('Create avatar ads project error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
