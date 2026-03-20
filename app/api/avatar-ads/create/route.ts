import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createServerUserSupabaseClient } from '@/lib/supabase/server-user';
import { uploadImageToStorage } from '@/lib/supabase';
import {
  getGenerationCost,
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS
} from '@/lib/constants';
import { validateKieCredits } from '@/lib/kie-credits-check';
import { deductCredits, recordCreditTransaction } from '@/lib/credits';
import { AVATAR_ADS_DURATION_OPTIONS } from '@/lib/avatar-ads-dialogue';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { captureServerEvent } from '@/lib/analytics/server';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const AVATAR_ADS_PERSISTED_IMAGE_MODEL = 'nano_banana_pro' as const;

export async function POST(request: NextRequest) {
  try {
    console.log('Character ads create API called');
    const { userId: clerkUserId } = await auth();

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
    const videoAspectRatio = (formData.get('video_aspect_ratio') as '16:9' | '9:16') || '16:9';
    const selectedPersonPhotoUrl = formData.get('selected_person_photo_url') as string;
    const selectedProductId = formData.get('selected_product_id') as string;
    const language = (formData.get('language') as string) || 'en';
    const clientProjectIdRaw = formData.get('project_id');
    const clientProjectId = typeof clientProjectIdRaw === 'string' ? clientProjectIdRaw.trim() : null;
    const talkingHeadModeFlag = formData.get('talking_head_mode');
    let talkingHeadMode = typeof talkingHeadModeFlag === 'string' && talkingHeadModeFlag.toLowerCase() === 'true';
    const prebuiltPromptsRaw = formData.get('prebuilt_prompts');
    const prebuiltImagePromptRaw = formData.get('prebuilt_image_prompt');
    const startAtStepRaw = formData.get('start_at_step');
    const startAtStep = typeof startAtStepRaw === 'string' ? startAtStepRaw.trim() : '';
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
      language,
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

    const isAgentKlingDuration = (
      isInternalAgentRequest &&
      videoModel === 'kling_3' &&
      Number.isFinite(videoDurationSeconds) &&
      videoDurationSeconds >= KLING_MIN_TASK_DURATION_SECONDS &&
      videoDurationSeconds <= KLING_MAX_PROJECT_DURATION_SECONDS
    );

    // Validate video duration
    if (
      !isAgentKlingDuration &&
      !AVATAR_ADS_DURATION_OPTIONS.includes(videoDurationSeconds as typeof AVATAR_ADS_DURATION_OPTIONS[number])
    ) {
      return NextResponse.json(
        { error: 'Invalid video duration.' },
        { status: 400 }
      );
    }

    // Validate models
    const validVideoModels = isInternalAgentRequest ? ['veo3_fast', 'kling_3'] : ['veo3_fast'];

    if (!validVideoModels.includes(videoModel)) {
      return NextResponse.json(
        { error: 'Invalid video model' },
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
        // Schema verified via Supabase MCP (2026-03-01) and migration 20260301_restructure_storage_and_remove_brands:
        // user_products is product-first and no longer depends on brand tables.
        const supabase = await createServerUserSupabaseClient();
        const { data: product, error: productError } = await supabase
          .from('user_products')
          .select(`
            *,
            user_product_photos (*)
          `)
          .eq('id', selectedProductId)
          .eq('user_id', userId)
          .single();

        if (productError) {
          console.error('Error fetching product:', productError);
          return NextResponse.json(
            { error: 'Failed to fetch product' },
            { status: 400 }
          );
        }

        if (!product || !product.user_product_photos || product.user_product_photos.length === 0) {
          return NextResponse.json(
            { error: 'No photos found for selected product' },
            { status: 400 }
          );
        }

        productImageUrls.push(...product.user_product_photos.map((photo: { photo_url: string }) => photo.photo_url));

        productContext = {
          product_name: product.product_name
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
      const trimmedDialogue = (customDialogue || '').trim();
      productContext = {
        talking_head_script: trimmedDialogue
          ? `Talking head delivery. Have the character speak directly to camera and read this script verbatim: ${trimmedDialogue}`
          : 'Talking head delivery. Have the character speak directly to camera about their experience or advice without showing a specific product.'
      };
    }

    // Upload product images to Supabase if we have files
    for (let i = 0; i < productFiles.length; i++) {
      const file = productFiles[i];
      const fileName = `avatar-ads/product/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName, userId);
      productImageUrls.push(uploadResult.publicUrl);
    }

    const resolvedVideoModel: 'kling_3' | 'veo3_fast' = videoModel === 'kling_3' && isInternalAgentRequest
      ? 'kling_3'
      : 'veo3_fast';
    const totalCredits = getGenerationCost(resolvedVideoModel, String(videoDurationSeconds));

    const generationCreditsUsed = 0;

    // Create project in database
    const supabase = await createServerUserSupabaseClient();
    // Schema verified via Supabase MCP (2026-03-17):
    // avatar_ads_projects.image_model exists and constraint long_video_projects_image_model_check
    // only allows: nano_banana, seedream, nano_banana_pro.
    const projectInsert: Record<string, unknown> = {
      user_id: userId,
      person_image_urls: personImageUrls,
      product_image_urls: productImageUrls, // Still stored for temp products; will be removed in future migration
      selected_product_id: selectedProductId && !selectedProductId.startsWith('temp') ? selectedProductId : null,
      product_context: productContext,
      video_duration_seconds: videoDurationSeconds,
      image_model: AVATAR_ADS_PERSISTED_IMAGE_MODEL,
      video_model: resolvedVideoModel,
      video_aspect_ratio: normalizedAspectRatio,
      image_size: enforcedImageSize,
      custom_dialogue: customDialogue || null,
      language: language, // Language for AI-generated content
      credits_cost: totalCredits,
      generation_credits_used: generationCreditsUsed,
      status: 'pending',
      current_step: startAtStep === 'generate_image' && prebuiltPrompts ? 'generating_image' : 'generating_prompts',
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
    console.log(`Starting workflow: generate_prompts → generate_image → awaiting_review...`);
    captureServerEvent(ANALYTICS_EVENTS.avatar_ads_project_created, {
      distinctId: userId,
      request,
      properties: {
        feature: 'avatar_ads',
        surface: 'avatar_ads_create_api',
        project_id: project.id,
        workflow: talkingHeadMode ? 'talking_head' : 'product_avatar_ads',
        video_model: resolvedVideoModel,
        duration_seconds: videoDurationSeconds,
        aspect_ratio: normalizedAspectRatio,
        credits_cost: totalCredits,
      }
    });
    const workflowSupabase = getSupabaseAdmin();

    try {
      const { processAvatarAdsProject } = await import('@/lib/avatar-ads-workflow');

      // Start with generate_prompts and continue with subsequent steps
      let currentStep = startAtStep === 'generate_image' && prebuiltPrompts ? 'generate_image' : 'generate_prompts';
      let result = await processAvatarAdsProject(project, currentStep);
      console.log(`✅ ${currentStep} completed for project ${project.id}`);

      // Continue with next steps automatically until we hit a stopping point
      // Stop at 'check_image_status' (user review) or when no nextStep
      while (result.nextStep) {
        currentStep = result.nextStep;
        console.log(`⏭️ Triggering next step: ${currentStep} for project ${project.id}`);

        // Get fresh project data before next step
        const { data: freshProject } = await workflowSupabase
          .from('avatar_ads_projects')
          .select('*')
          .eq('id', project.id)
          .single();

        if (!freshProject) {
          throw new Error('Project not found');
        }

        result = await processAvatarAdsProject(freshProject, currentStep);
        console.log(`✅ ${currentStep} completed for project ${project.id}`);

        // Stop at 'awaiting_review' - user needs to review cover image
        if (freshProject.status === 'awaiting_review') {
          console.log(`⏸️ Workflow paused at 'awaiting_review' - waiting for user action`);
          break;
        }
      }

      console.log(`✅ Workflow initialization completed for project ${project.id}`);
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
