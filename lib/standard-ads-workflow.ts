import { getSupabaseAdmin, type StandardAdsSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  getActualImageModel,
  IMAGE_MODELS,
  getAutoModeSelection,
  getGenerationCost,
  getLanguagePromptName,
  getSegmentCountFromDuration,
  type LanguageCode
} from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedProductId?: string;
  selectedBrandId?: string; // NEW: Brand selection for ending frame
  competitorAdId?: string; // NEW: Competitor ad reference for creative direction
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
  imageModel?: 'auto' | 'nano_banana' | 'seedream';
  watermark?: {
    text: string;
    location: string;
  };
  watermarkLocation?: string;
  imageSize?: string;
  elementsCount?: number;
  photoOnly?: boolean;
  shouldGenerateVideo?: boolean;
  videoAspectRatio?: '16:9' | '9:16';
  adCopy?: string;
  // NEW: Sora2 Pro params
  sora2ProDuration?: '10' | '15';
  sora2ProQuality?: 'standard' | 'high';
  // Generic video params (applies to all models)
  videoDuration?: '8' | '10' | '15' | '16' | '24' | '32';
  videoQuality?: 'standard' | 'high';
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
}

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  error?: string;
  details?: string;
}

export type SegmentPrompt = {
  description: string;
  setting: string;
  camera_type: string;
  camera_movement: string;
  action: string;
  lighting: string;
  dialogue: string;
  music: string;
  ending: string;
  other_details: string;
  language?: string;
  voice_type?: string;
  voice_tone?: string;
  segment_title?: string;
  segment_goal?: string;
  first_frame_prompt?: string;
  closing_frame_prompt?: string;
};

export interface SegmentStatusPayload {
  total: number;
  framesReady: number;
  videosReady: number;
  segments: Array<{
    index: number;
    status: string;
    firstFrameUrl?: string | null;
    closingFrameUrl?: string | null;
    videoUrl?: string | null;
  }>;
  mergedVideoUrl?: string | null;
}

export const SEGMENTED_DURATIONS = new Set(['16', '24', '32', '40', '48', '56', '64']);

export function isSegmentedVideoRequest(
  model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro',
  videoDuration?: string | null
): boolean {
  if (!videoDuration) return false;
  if (model !== 'veo3' && model !== 'veo3_fast') return false;
  return SEGMENTED_DURATIONS.has(videoDuration);
}

/**
 * Detect product category from AI-generated prompts to determine if closing_frame should be generated
 * @param prompts - The video prompts object returned from AI
 * @returns Product category: 'children_toy' | 'adult_product' | 'general'
 *
 * CRITICAL: For children's toys, we should NOT generate closing_frame because:
 * - Google Veo3 checks both first_frame and closing_frame
 * - If both frames have NO children → Video also won't have children (even if prompt mentions children)
 * - Solution: Only generate first_frame for children's products → Children can appear in video
 */
function detectProductCategory(prompts: Record<string, unknown>): 'children_toy' | 'adult_product' | 'general' {
  // Method 1: Check if AI explicitly provided product_category (recommended)
  if (typeof prompts.product_category === 'string') {
    const category = prompts.product_category.toLowerCase();
    if (category === 'children_toy') return 'children_toy';
    if (category === 'adult_product') return 'adult_product';
    return 'general';
  }

  // Method 2: Keyword detection as fallback
  const childrenKeywords = [
    'baby', 'babies', 'infant', 'toddler', 'child', 'children', 'kid', 'kids',
    'toy', 'toys', 'nursery', 'playmat', 'stroller', 'crib', 'diaper',
    'preschool', 'kindergarten', '0-2', '3-12', 'newborn'
  ];

  // Search in multiple fields
  const searchText = JSON.stringify({
    description: prompts.description,
    subject: prompts.subject,
    context: prompts.context,
    action: prompts.action,
    target_audience: prompts.target_audience,
    full_description: prompts.full_description
  }).toLowerCase();

  const hasChildrenKeywords = childrenKeywords.some(keyword => searchText.includes(keyword));

  if (hasChildrenKeywords) {
    console.log('🔍 Detected children_toy product based on keywords');
    return 'children_toy';
  }

  return 'general';
}

export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Handle product selection - get the image URL from the selected product
    let imageUrl = request.imageUrl;
    let productContext = { product_details: '', brand_name: '', brand_slogan: '', brand_details: '' };
    if (request.selectedProductId && !imageUrl) {
      const { data: product, error: productError } = await supabase
        .from('user_products')
        .select(`
          *,
          user_product_photos (*),
          brand:user_brands (
            id,
            brand_name,
            brand_slogan,
            brand_details
          )
        `)
        .eq('id', request.selectedProductId)
        .eq('user_id', request.userId)
        .single();

      if (productError || !product) {
        console.error('Product query error:', productError);
        console.error('Product query params:', { id: request.selectedProductId, userId: request.userId });
        return {
          success: false,
          error: 'Product not found',
          details: productError?.message || 'Selected product does not exist or does not belong to this user'
        };
      }

      // Get the primary photo or the first available photo
      const primaryPhoto = product.user_product_photos?.find((photo: { is_primary: boolean }) => photo.is_primary);
      const fallbackPhoto = product.user_product_photos?.[0];
      const selectedPhoto = primaryPhoto || fallbackPhoto;

      if (!selectedPhoto) {
        return {
          success: false,
          error: 'No product photos found',
          details: 'The selected product has no photos available'
        };
      }

      imageUrl = selectedPhoto.photo_url;

      // Store product and brand context for AI prompt
      productContext = {
        product_details: product.product_details || '',
        brand_name: product.brand?.brand_name || '',
        brand_slogan: product.brand?.brand_slogan || '',
        brand_details: product.brand?.brand_details || ''
      };
    }

    if (!imageUrl) {
      return {
        success: false,
        error: 'Image source required',
        details: 'Either imageUrl or selectedProductId with photos is required'
      };
    }

    // Load competitor ad if provided (optional reference for creative direction)
    let competitorAdContext: { file_url: string; file_type: 'image' | 'video'; competitor_name: string } | undefined;
    if (request.competitorAdId) {
      console.log(`🎯 Loading competitor ad: ${request.competitorAdId}`);
      const { data: competitorAd, error: competitorError } = await supabase
        .from('competitor_ads')
        .select('ad_file_url, file_type, competitor_name')
        .eq('id', request.competitorAdId)
        .eq('user_id', request.userId)
        .single();

      if (competitorAd && !competitorError) {
        competitorAdContext = {
          file_url: competitorAd.ad_file_url,
          file_type: competitorAd.file_type as 'image' | 'video',
          competitor_name: competitorAd.competitor_name
        };
        console.log(`✅ Competitor ad loaded: ${competitorAdContext.competitor_name} (${competitorAdContext.file_type})`);
      } else {
        console.warn(`⚠️ Competitor ad not found or access denied: ${request.competitorAdId}`, competitorError);
        // Don't fail the workflow if competitor ad is not found, just proceed without it
      }
    }

    // Convert 'auto' to specific model
    let actualVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
    if (request.videoModel === 'auto') {
      const autoSelection = getAutoModeSelection(0); // Get cheapest model
      actualVideoModel = autoSelection || 'sora2'; // Fallback to cheapest
    } else {
      actualVideoModel = request.videoModel;
    }

    const isSegmented = isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const segmentCount = isSegmented ? getSegmentCountFromDuration(request.videoDuration) : 1;

    // ===== VERSION 3.0: MIXED BILLING - Generation Phase =====
    // Basic models (veo3_fast, sora2): FREE generation, paid download
    // Premium models (veo3, sora2_pro): PAID generation, free download
    let generationCost = 0;
    const duration = request.videoDuration || request.sora2ProDuration;
    const quality = request.videoQuality || request.sora2ProQuality;
    if (!request.photoOnly) {
      // Calculate generation cost based on model
      generationCost = getGenerationCost(
        actualVideoModel,
        duration,
        quality
      );

      // Only check and deduct credits if generation is paid
      if (generationCost > 0) {
        // Check if user has enough credits
        const creditCheck = await checkCredits(request.userId, generationCost);
        if (!creditCheck.success) {
          return {
            success: false,
            error: 'Failed to check credits',
            details: creditCheck.error || 'Credit check failed'
          };
        }

        if (!creditCheck.hasEnoughCredits) {
          return {
            success: false,
            error: 'Insufficient credits',
            details: `Need ${generationCost} credits for ${actualVideoModel.toUpperCase()} model, have ${creditCheck.currentCredits || 0}`
          };
        }

        // Deduct credits UPFRONT for paid generation models
        const deductResult = await deductCredits(request.userId, generationCost);
        if (!deductResult.success) {
          return {
            success: false,
            error: 'Failed to deduct credits',
            details: deductResult.error || 'Credit deduction failed'
          };
        }

        // Record the transaction
        await recordCreditTransaction(
          request.userId,
          'usage',
          generationCost,
          `Standard Ads - Video generation (${actualVideoModel.toUpperCase()})`,
          undefined,
          true
        );
      }
      // If generationCost is 0, generation is FREE (will charge at download)
    } else {
      generationCost = 0; // Photo-only mode is free
    }

    // Determine actual cover_image_aspect_ratio (resolve 'auto' to actual value)
    let actualCoverAspectRatio: string;
    if (request.imageSize === 'auto' || !request.imageSize) {
      // When image size is 'auto', use the video aspect ratio
      actualCoverAspectRatio = request.videoAspectRatio || '16:9';
    } else {
      actualCoverAspectRatio = request.imageSize;
    }

    // Create project record in standard_ads_projects table
    const { data: project, error: insertError} = await supabase
      .from('standard_ads_projects')
      .insert({
        user_id: request.userId,
        original_image_url: imageUrl,
        selected_product_id: request.selectedProductId,
        selected_brand_id: request.selectedBrandId, // NEW: Brand selection
        competitor_ad_id: request.competitorAdId || null, // NEW: Competitor ad reference
        video_model: actualVideoModel,
        video_aspect_ratio: request.videoAspectRatio || '16:9',
        status: 'processing',
        current_step: request.useCustomScript
          ? 'ready_for_video'
          : isSegmented
            ? 'generating_segment_frames'
            : 'generating_cover',
        progress_percentage: request.useCustomScript ? 50 : isSegmented ? 25 : 20,
        credits_cost: generationCost, // Only generation cost (download cost charged separately)
        watermark_text: request.watermark?.text,
        watermark_location: request.watermark?.location || request.watermarkLocation,
        cover_image_aspect_ratio: actualCoverAspectRatio, // Store actual ratio, never 'auto'
        photo_only: request.photoOnly || false,
        language: request.language || 'en', // Language for AI-generated content
        // Generic video fields (renamed from sora2_pro_*)
        video_duration: duration || (actualVideoModel === 'veo3' || actualVideoModel === 'veo3_fast' ? '8' : '10'),
        video_quality: quality || 'standard',
        // NEW: Custom script fields
        custom_script: request.customScript || null,
        use_custom_script: request.useCustomScript || false,
        // DEPRECATED: download_credits_used (downloads are now free)
        download_credits_used: 0,
        is_segmented: isSegmented,
        segment_count: segmentCount,
        segment_duration_seconds: isSegmented ? 8 : null,
        segment_status: isSegmented
          ? {
              total: segmentCount,
              framesReady: 0,
              videosReady: 0,
              segments: []
            }
          : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return {
        success: false,
        error: 'Failed to create project record',
        details: insertError.message
      };
    }

    // Start the AI workflow in background (fire-and-forget for instant UX)
    // Wrap in IIFE to ensure error handling is reliable
    (async () => {
      try {
        await startAIWorkflow(
          project.id,
          { ...request, imageUrl, videoModel: actualVideoModel, resolvedVideoModel: actualVideoModel },
          productContext,
          competitorAdContext // Pass competitor ad context for reference
        );
      } catch (workflowError) {
        console.error('❌ Background workflow error:', workflowError);
        console.error('Stack trace:', workflowError instanceof Error ? workflowError.stack : 'No stack available');
        console.error('Context:', {
          projectId: project.id,
          userId: request.userId,
          videoModel: actualVideoModel,
          generationCost,
          photoOnly: request.photoOnly
        });

        // REFUND credits on failure (only for paid generation models)
        if (!request.photoOnly && generationCost > 0) {
          console.log(`⚠️ Refunding ${generationCost} credits due to workflow failure`);
          try {
            await deductCredits(request.userId, -generationCost); // Negative = refund
            await recordCreditTransaction(
              request.userId,
              'refund',
              generationCost,
              `Standard Ads - Refund for failed ${actualVideoModel.toUpperCase()} generation`,
              project.id,
              true
            );
            console.log(`✅ Successfully refunded ${generationCost} credits to user ${request.userId}`);
          } catch (refundError) {
            console.error('❌ CRITICAL: Refund failed:', refundError);
            console.error('Refund error stack:', refundError instanceof Error ? refundError.stack : 'No stack available');
            // TODO: This should trigger alerting - user paid but didn't get service
          }
        }

        // Update project status to failed
        try {
          const { error: updateError } = await supabase
            .from('standard_ads_projects')
            .update({
              status: 'failed',
              error_message: `Workflow failed: ${workflowError instanceof Error ? workflowError.message : 'Unknown error'}`,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);

          if (updateError) {
            console.error('❌ CRITICAL: Failed to update project status to failed:', updateError);
            // TODO: This should trigger alerting - project stuck in processing state
          } else {
            console.log(`✅ Marked project ${project.id} as failed`);
          }
        } catch (dbError) {
          console.error('❌ CRITICAL: Database update exception:', dbError);
          console.error('DB error stack:', dbError instanceof Error ? dbError.stack : 'No stack available');
          // TODO: This should trigger alerting
        }
      }
    })();

    return {
      success: true,
      projectId: project.id
    };

  } catch (error) {
    console.error('StartWorkflowProcess error:', error);
    return {
      success: false,
      error: 'Failed to start workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function startAIWorkflow(
  projectId: string,
  request: StartWorkflowRequest & {
    imageUrl: string;
    resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
  },
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: { file_url: string; file_type: 'image' | 'video'; competitor_name: string }
): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // CUSTOM SCRIPT MODE: Skip AI steps and use original image
    if (request.useCustomScript && request.customScript) {
      console.log('📜 Custom script mode enabled - skipping AI description and cover generation');
      console.log('📝 Custom script:', request.customScript.substring(0, 100) + '...');

      // Store custom script directly in video_prompts field
      // Convert language code to language name for video generation
      const languageCode = (request.language || 'en') as LanguageCode;
      const languageName = getLanguagePromptName(languageCode);

      const customScriptPrompt = {
        customScript: request.customScript,
        language: languageName
      };

      // Update project: use original image as cover, store custom script, mark ready for video
      const updateData = {
        cover_image_url: request.imageUrl, // Use original image directly
        video_prompts: customScriptPrompt,
        product_description: { customScript: request.customScript },
        current_step: 'ready_for_video' as const,
        progress_percentage: 50,
        last_processed_at: new Date().toISOString()
      };

      console.log('💾 Updating project with custom script data');

      const { data: updateResult, error: updateError } = await supabase
        .from('standard_ads_projects')
        .update(updateData)
        .eq('id', projectId)
        .select();

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      console.log('✅ Custom script workflow prepared successfully:', updateResult);
      return;
    }

    // AUTO MODE: Image-driven workflow with AI creative generation
    // Generate prompts based purely on visual analysis of the product image
    console.log('🤖 Generating creative video prompts from product image...');
    const totalDurationSeconds = parseInt(request.videoDuration || request.sora2ProDuration || '10', 10);
    const segmentedFlow = isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const segmentCount = segmentedFlow ? getSegmentCountFromDuration(request.videoDuration) : 1;
    const prompts = await generateImageBasedPrompts(
      request.imageUrl,
      request.language,
      totalDurationSeconds,
      request.adCopy,
      segmentCount,
      productContext,
      competitorAdContext // Pass competitor ad as reference
    );

    console.log('🎯 Generated creative prompts:', prompts);

    if (segmentedFlow) {
      console.log('🎬 Segmented workflow enabled - orchestrating multi-segment pipeline');
      await startSegmentedWorkflow(projectId, request, prompts, segmentCount);
      return;
    }

    // Step 1: Start cover generation
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request);
    console.log('🆔 Cover task ID:', coverTaskId);

    // Update project with cover task ID and prompts
    const updateData = {
      cover_task_id: coverTaskId,
      video_prompts: prompts,
      product_description: { description: prompts.description },
      image_prompt: prompts.description as string,
      current_step: 'generating_cover' as const,
      progress_percentage: 30,
      last_processed_at: new Date().toISOString()
    };
    console.log('💾 Updating project with image-driven data');

    const { error: updateError } = await supabase
      .from('standard_ads_projects')
      .update(updateData)
      .eq('id', projectId)
      .select();

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully');
    console.log('✅ Auto mode workflow started successfully (image-based prompts)');

  } catch (error) {
    console.error('AI workflow error:', error);
    throw error;
  }
}

async function fetchVideoAsBase64(videoUrl: string): Promise<string> {
  try {
    console.log(`[fetchVideoAsBase64] Starting download: ${videoUrl}`);
    const startTime = Date.now();

    // Set timeout for video download (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(videoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const downloadTime = Date.now() - startTime;
    const sizeInMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2);

    console.log(`[fetchVideoAsBase64] Downloaded ${sizeInMB}MB in ${downloadTime}ms`);

    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Detect mime type from URL extension
    let mimeType = 'video/mp4';
    if (videoUrl.endsWith('.webm')) mimeType = 'video/webm';
    else if (videoUrl.endsWith('.mov')) mimeType = 'video/mov';
    else if (videoUrl.endsWith('.mpeg')) mimeType = 'video/mpeg';

    const base64Url = `data:${mimeType};base64,${base64}`;
    const base64SizeInMB = (base64Url.length / (1024 * 1024)).toFixed(2);
    console.log(`[fetchVideoAsBase64] Base64 size: ${base64SizeInMB}MB`);

    return base64Url;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[fetchVideoAsBase64] Download timeout after 60 seconds');
      throw new Error('Video download timeout (60s limit exceeded)');
    }
    console.error('[fetchVideoAsBase64] Error fetching video:', error);
    throw error;
  }
}

async function generateImageBasedPrompts(
  imageUrl: string,
  language?: string,
  videoDurationSeconds?: number,
  userRequirements?: string,
  segmentCount = 1,
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: { file_url: string; file_type: 'image' | 'video'; competitor_name: string }
): Promise<Record<string, unknown>> {
  // Convert competitor video to base64 if needed (Gemini only accepts YouTube URLs or base64 for videos)
  let processedCompetitorContext = competitorAdContext;
  if (competitorAdContext && competitorAdContext.file_type === 'video') {
    console.log(`[generateImageBasedPrompts] Converting competitor video to base64: ${competitorAdContext.file_url}`);
    try {
      const base64VideoUrl = await fetchVideoAsBase64(competitorAdContext.file_url);
      processedCompetitorContext = {
        ...competitorAdContext,
        file_url: base64VideoUrl
      };
      console.log(`[generateImageBasedPrompts] Video converted to base64 successfully`);
    } catch (error) {
      console.error('[generateImageBasedPrompts] Failed to convert video to base64:', error);
      // Fallback: skip competitor video if conversion fails
      processedCompetitorContext = undefined;
    }
  }

  const duration = Number.isFinite(videoDurationSeconds) && videoDurationSeconds ? videoDurationSeconds : 10;
  const perSegmentDuration = Math.max(8, Math.round(duration / Math.max(1, segmentCount)));
  const dialogueWordLimit = Math.max(12, Math.round(perSegmentDuration * 2.2));

  const baseProperties = {
    description: {
      type: "string",
      description: "Main scene description"
    },
    setting: {
      type: "string",
      description: "Location/environment"
    },
    camera_type: {
      type: "string",
      description: "Type of camera shot"
    },
    camera_movement: {
      type: "string",
      description: "Camera movement style"
    },
    action: {
      type: "string",
      description: "What happens in the scene"
    },
    lighting: {
      type: "string",
      description: "Lighting setup"
    },
    dialogue: {
      type: "string",
      description: "Spoken content/voiceover"
    },
    music: {
      type: "string",
      description: "Music style"
    },
    ending: {
      type: "string",
      description: "How the ad concludes"
    },
    other_details: {
      type: "string",
      description: "Additional creative elements"
    },
    language: {
      type: "string",
      description: "Language name for voiceover generation"
    }
  } as Record<string, unknown>;

  const requiredFields = [
    "description",
    "setting",
    "camera_type",
    "camera_movement",
    "action",
    "lighting",
    "dialogue",
    "music",
    "ending",
    "other_details",
    "language"
  ];

  if (segmentCount > 1) {
    baseProperties.segments = {
      type: "array",
      description: `Breakdown of ${segmentCount} sequential segments`,
      minItems: segmentCount,
      maxItems: segmentCount,
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          setting: { type: "string" },
          camera_type: { type: "string" },
          camera_movement: { type: "string" },
          action: { type: "string" },
          lighting: { type: "string" },
          dialogue: { type: "string" },
          music: { type: "string" },
          ending: { type: "string" },
          other_details: { type: "string" },
          segment_title: { type: "string" },
          segment_goal: { type: "string" },
          first_frame_prompt: { type: "string" },
          closing_frame_prompt: { type: "string" },
          voice_type: { type: "string" },
          voice_tone: { type: "string" }
        },
        required: [
          "description",
          "setting",
          "camera_type",
          "camera_movement",
          "action",
          "lighting",
          "dialogue",
          "music",
          "ending",
          "other_details",
          "segment_title",
          "segment_goal",
          "first_frame_prompt",
          "closing_frame_prompt",
          "voice_type",
          "voice_tone"
        ],
        additionalProperties: false
      }
    };
    requiredFields.push("segments");
  }

  // Define JSON schema for Structured Outputs - IMPORTANT: This must return a SINGLE object
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "video_advertisement_schema",
      strict: true,
      schema: {
        type: "object",
        properties: baseProperties,
        required: requiredFields,
        additionalProperties: false
      }
    }
  };

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      response_format: responseFormat,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            // Add competitor ad as reference if provided
            ...(processedCompetitorContext ? (
              processedCompetitorContext.file_type === 'video'
                ? [{
                    type: 'video_url' as const,
                    video_url: { url: processedCompetitorContext.file_url }
                  }]
                : [{
                    type: 'image_url' as const,
                    image_url: { url: processedCompetitorContext.file_url }
                  }]
            ) : []),
            {
              type: 'text',
              text: processedCompetitorContext
                ? // === COMPETITOR REFERENCE MODE ===
                  // Analyze competitor ad structure and adapt it for our product
                  `🎯 COMPETITOR REFERENCE MODE

You are analyzing a competitor advertisement to create a similar ad for OUR product.

📺 COMPETITOR AD (${processedCompetitorContext.file_type.toUpperCase()}):
From: "${processedCompetitorContext.competitor_name}"

TASK: Analyze the competitor ${processedCompetitorContext.file_type} and extract its complete creative structure following Veo prompt guide principles:

1. **Product Classification (CRITICAL)**:
   - Identify product_category: "children_toy" | "adult_product" | "general"
     * "children_toy" if video shows babies/children (0-12 years) using the product
     * "adult_product" if for adult use only
     * "general" if unclear or all-ages
   - Identify target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

2. **Core Concept (Veo Guide: Subject + Context + Action)**:
   - Subject: Main elements and focal points in the video
   - Context: Environment, background, setting, time of day
   - Action: What is happening, movement, interaction with product

3. **Visual Style (Veo Guide: Style + Camera + Composition + Ambiance)**:
   - Style: Overall visual style and artistic direction
   - Camera Motion: Camera movements (pan, zoom, tracking, POV shots, etc.)
   - Composition: Shot types (close-up, medium shot, wide shot, angles)
   - Ambiance: Color palette, lighting setup, mood, atmosphere

4. **Complete Video Script Analysis**:
   - Extract all dialogue, voiceover, and text content
   - Document the narrative flow and storytelling structure
   - Note pacing, transitions, and segment timing

5. **Audio Elements**:
   - Dialogue/voiceover content and delivery style
   - Music style and emotional tone
   - Sound effects and ambient audio

📸 OUR PRODUCT:
The second image shows our product that should REPLACE the competitor's product in the advertisement.

🎬 GENERATION REQUIREMENTS:
Generate a JSON advertisement prompt that:
- **CLONES the competitor's complete creative structure** (script, timing, camera work, style)
- **REPLACES the competitor's product with ours** from the product image
- **MAINTAINS identical narrative flow** and storytelling approach
- **PRESERVES the visual style** (colors, lighting, aesthetics)
- **KEEPS the same tone and pacing** for equivalent engagement

⚠️ CRITICAL:
- DO NOT analyze the product image deeply - it's only for visual reference to replace the competitor's product
- Focus on extracting and replicating the competitor's creative approach
- The output should feel like the same ad, just with our product instead

${productContext && (productContext.product_details || productContext.brand_name) ? `\nProduct & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}\n(Use only to ensure product placement accuracy)` : ''}${userRequirements ? `\n\nUser Requirements:\n${userRequirements}\n\nNote: Apply these requirements while maintaining the competitor's core creative structure.` : ''}

DO NOT include:
- Brand names or slogans (unless visually present in the image)
- Marketing copy or taglines
- Pre-existing brand positioning or assumptions

${segmentCount > 1 ? `Segment Plan Requirements:
- Output EXACTLY ${segmentCount} segment objects in the "segments" array
- Each segment needs its own "segment_title" and "segment_goal"
- "first_frame_prompt" should paint the exact still image that opens the segment
- "closing_frame_prompt" should describe the precise ending still image
- Keep style, camera, and lighting consistent so stitched clips feel cohesive
- Define one narrator voice that works for the entire ad and keep it identical for each segment
` : ''}
Generate a JSON object with these elements:

**Product Classification (REQUIRED)**:
- product_category: "children_toy" | "adult_product" | "general" (CRITICAL for determining closing_frame generation)
- target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

**Core Concept (Veo Guide)**:
- subject: Main elements and focal points (extracted from competitor)
- context: Environment and setting (matching competitor ad style)
- action: Action sequence based on competitor structure, with our product

**Visual Style (Veo Guide)**:
- style: Overall visual style and artistic direction (from competitor)
- camera_type: Shot type matching competitor ad (e.g., "Medium shot", "Close-up", "Wide shot")
- camera_movement: Camera movement from competitor ad (e.g., "Slow tracking shot", "Static with gentle zoom")
- composition: Framing and shot composition (from competitor)
- ambiance: Color palette, lighting, and mood (matching competitor)

**Standard Fields (for compatibility)**:
- description: Main scene description based on competitor structure, with our product
- setting: Environment matching competitor ad style
- lighting: Lighting style from competitor ad
- dialogue: Voiceover content adapted from competitor script, for our product (in English)
- music: Music style matching competitor ad
- ending: Conclusion style from competitor ad, with our product
- other_details: Creative elements from competitor ad applied to our product
- language: The language name for voiceover generation

**Full Description (for long-form video - NEW)**:
- full_description: A comprehensive 200-500 word narrative description combining all elements above, suitable for 60s+ video generation. Include detailed subject description, environmental context, complete action sequence, visual style notes, camera work details, lighting and color information, audio elements, and narrative flow. This should be detailed enough to guide multi-segment video generation.

CRITICAL: Return EXACTLY ONE advertisement prompt object, NOT an array of objects.
IMPORTANT: All text content must be in English. The 'language' field specifies voiceover language only.
CRITICAL: Keep each segment's dialogue concise (under ${dialogueWordLimit} words for ~${perSegmentDuration} seconds).`
                : // === TRADITIONAL AI AUTO-GENERATION MODE ===
                  // Deep product analysis for original creative generation
                  `🤖 TRADITIONAL AUTO-GENERATION MODE

Analyze the product image and generate ONE creative video advertisement prompt.

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context:
${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}
IMPORTANT: Use this context to enhance the advertisement while staying true to the product visuals. The brand identity and product features should guide the creative direction.
` : ''}${userRequirements ? `
User Requirements:
${userRequirements}

IMPORTANT: Incorporate these user requirements into all aspects of the video advertisement (description, setting, camera, action, dialogue, etc.). The requirements should guide the creative direction while staying true to the product visuals.
` : ''}

Focus on:
- **Product Classification**: Determine if product is for children (toys, baby products) or adults
- Visual elements in the product image (appearance, colors, textures, design)
- Product category and potential use cases you can infer from the visuals
- Target audience demographics (babies, children, teens, adults)
- Emotional appeal based on visual presentation
- Natural scene settings that match the product aesthetics${productContext && (productContext.product_details || productContext.brand_name) ? '\n- Product details and brand identity provided above' : ''}${userRequirements ? '\n- User-specified requirements and creative direction' : ''}
${segmentCount > 1 ? `- Maintain narrative continuity across ${segmentCount} segments (each approximately 8 seconds)` : ''}

${segmentCount > 1 ? `Segment Plan Requirements:
- Output EXACTLY ${segmentCount} segment objects in the "segments" array
- Each segment needs its own "segment_title" and "segment_goal"
- "first_frame_prompt" should paint the exact still image that opens the segment
- "closing_frame_prompt" should describe the precise ending still image (for segments 1-${segmentCount - 1}, this will double as the next segment's starting frame)
- Keep style, camera, and lighting consistent so stitched clips feel cohesive
- Ensure every prompt keeps the product design identical to the supplied photo
- **CRITICAL VOICE CONSISTENCY**: Define one narrator voice that works for the entire ad. Include "voice_type" (accent + gender) and "voice_tone" (mood/energy) ONLY in the FIRST segment. All subsequent segments MUST NOT include voice_type or voice_tone fields - the voice will be automatically unified across all segments to guarantee perfect continuity.` : ''}

DO NOT include:
- Brand names or slogans (unless visually present in the image)
- Marketing copy or taglines
- Pre-existing brand positioning or assumptions

Generate a JSON object with these elements:

**Product Classification (REQUIRED)**:
- product_category: "children_toy" | "adult_product" | "general" (CRITICAL - classify based on product visuals and intended use)
- target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

**Core Concept (Veo Guide)**:
- subject: Main elements and focal points in the advertisement
- context: Environment and setting suitable for the product
- action: Product demonstration or lifestyle scene showing product use

**Visual Style (Veo Guide)**:
- style: Overall visual style and artistic direction appropriate for product
- camera_type: Cinematic shot type that showcases the product best (e.g., "Medium shot", "Close-up")
- camera_movement: Dynamic camera movement (e.g., "Slow push-in", "Tracking shot")
- composition: Framing and shot composition style
- ambiance: Color palette, lighting mood, and atmosphere

**Standard Fields (for compatibility)**:
- description: Main scene description based on product visuals${userRequirements ? ' and user requirements' : ''}
- setting: Natural environment that suits the product${userRequirements ? ' (consider user preferences)' : ''}
- lighting: Professional lighting setup that enhances the product
- dialogue: Natural voiceover content focused on product benefits and features${userRequirements ? ', incorporating user messaging' : ''} (in English, NO brand slogans)
- music: Music style matching the mood and product category${userRequirements ? ' and user preferences' : ''}
- ending: Natural ad conclusion (e.g., product close-up, lifestyle shot)
- other_details: Creative visual elements that enhance the advertisement${userRequirements ? ', including user-specified elements' : ''}
- language: The language name for voiceover generation (e.g., "English", "Urdu", "Punjabi")

**Full Description (for long-form video - NEW)**:
- full_description: A comprehensive 200-500 word narrative description combining all elements above, suitable for 60s+ video generation. Include detailed subject description, environmental context, complete action sequence, visual style notes, camera work details, lighting and color information, audio elements, and narrative flow.

CRITICAL: Return EXACTLY ONE advertisement prompt object, NOT an array of objects.
IMPORTANT: All text content (dialogue, descriptions, etc.) should be written in English. The 'language' field is metadata only to specify what language the video voiceover should use.
IMPORTANT: The dialogue should be naturally creative and product-focused, NOT a brand slogan.
CRITICAL: Keep each segment's dialogue concise enough for ~${perSegmentDuration} seconds of narration (under ${dialogueWordLimit} words). Avoid long sentences.`
            }
          ]
        }
      ]
    })
  }, 3, 30000);

  // Read response text first to handle both success and error cases
  const responseText = await response.text();

  if (!response.ok) {
    console.error('❌ OpenRouter API error:', {
      status: response.status,
      statusText: response.statusText,
      responseText: responseText.substring(0, 500)
    });
    throw new Error(`Prompt generation failed: ${response.status} - ${responseText}`);
  }

  // Log successful response for debugging
  console.log('✅ OpenRouter API response received:', {
    status: response.status,
    responseLength: responseText.length,
    preview: responseText.substring(0, 200)
  });

  // Parse JSON from text
  let data: unknown;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('❌ Failed to parse OpenRouter response as JSON:', parseError);
    console.error('Response text:', responseText.substring(0, 1000));
    throw new Error(`OpenRouter returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }

  // Validate response structure
  const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
  if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message || !apiResponse.choices[0].message.content) {
    console.error('❌ OpenRouter response missing expected structure:', data);
    throw new Error('OpenRouter response missing choices[0].message.content');
  }

  const content = apiResponse.choices[0].message.content;

  // With Structured Outputs, the response is guaranteed to match our schema
  let parsed: Record<string, unknown>;

  try {
    const rawParsed = JSON.parse(content);

    // CRITICAL FIX: Handle case where AI returns an array instead of a single object
    if (Array.isArray(rawParsed)) {
      console.warn('⚠️ AI returned an array instead of single object, taking first element');
      parsed = rawParsed[0] || {};
    } else {
      parsed = rawParsed;
    }

    // Validate all required fields are present
    const requiredFields = ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'dialogue', 'music', 'ending', 'other_details', 'language'];
    const missingFields = requiredFields.filter(field => !parsed[field]);

    if (missingFields.length > 0) {
      console.error('❌ Missing required fields in AI response:', missingFields);
      console.error('Parsed content:', parsed);
      throw new Error(`AI response missing fields: ${missingFields.join(', ')}`);
    }

    console.log('✅ Structured output parsed successfully with all required fields');
  } catch (parseError) {
    console.error('Failed to parse structured output:', parseError);
    console.error('Content received:', content);

    // Fallback (should rarely happen with Structured Outputs)
    parsed = {
      description: "Professional product showcase in modern setting",
      setting: "Professional studio",
      camera_type: "Close-up",
      camera_movement: "Smooth pan",
      action: "Product showcase",
      lighting: "Soft professional lighting",
      dialogue: "Experience quality and innovation in every detail",
      music: "Upbeat commercial music",
      ending: "Call to action",
      other_details: "High-quality commercial style",
      language: language ? getLanguagePromptName(language as LanguageCode) : "English"
    };
  }

  // Set language metadata (AI should have generated it, but ensure it's set)
  if (language) {
    parsed.language = getLanguagePromptName(language as LanguageCode);
  } else if (!parsed.language) {
    parsed.language = "English";
  }

  return parsed;
}

async function generateCover(imageUrl: string, prompts: Record<string, unknown>, request: StartWorkflowRequest): Promise<string> {
  // Get the actual image model to use
  const actualImageModel = getActualImageModel(request.imageModel || 'auto');
  const kieModelName = IMAGE_MODELS[actualImageModel];

  // Build prompt that preserves original product appearance
  const baseDescription = prompts.description as string || "Professional product advertisement";

  // Create a prompt that explicitly instructs to maintain original product appearance
  let prompt = `IMPORTANT: Use the provided product image as the EXACT BASE. Maintain the original product's exact visual appearance, shape, design, colors, textures, and all distinctive features. DO NOT change the product itself.

Based on the provided product image, create an enhanced advertising version that keeps the EXACT SAME product while only improving the presentation for marketing purposes. ${baseDescription}

Requirements:
- Keep the original product's exact shape, size, and proportions
- Maintain all original colors, textures, and materials
- Preserve all distinctive design features and details
- Only enhance lighting, background, or add subtle marketing elements
- The product must remain visually identical to the original

⚠️ ZERO-CHILD POLICY (ALL MODELS):

PROHIBITED Elements:
❌ Absolutely NO children/minors (under 18) in ANY form:
   - No child faces, hands, limbs, or body parts
   - No child silhouettes, back views, or blurred figures
   - No recognizable children in any way

ALLOWED Human Elements (Adults 18+ ONLY):
✅ Adults: FULLY ALLOWED in all forms
   - Clear frontal faces with visible facial features
   - Close-up face shots and detailed portraits
   - Multiple people with visible faces in the same frame
   - Hands/arms showing product interaction
   - Body parts demonstrating product use
   - Blurred background figures, silhouettes, back views
   - All forms of adult human presence

TRANSFORMATION RULES:
- If original prompt has children → Replace with adults OR product-only display
- Adults can be shown naturally without face restrictions
- Maintain SCENE, LIGHTING, and STYLE from original prompt
- Focus on product presentation and authentic use cases`;

  // Extract watermark information from request
  const watermarkText = request.watermark?.text?.trim();
  const watermarkLocation = request.watermark?.location || request.watermarkLocation;
  const providedAdCopy = request.adCopy?.trim() || (typeof prompts.ad_copy === 'string' ? (prompts.ad_copy as string).trim() : '');
  
  if (watermarkText) {
    prompt += `\n\nWatermark Requirements:
- Add text watermark: "${watermarkText}"
- Watermark location: ${watermarkLocation || 'bottom left'}
- Make the watermark visible but not overpowering
- Use appropriate font size and opacity for the watermark`;
  }

  if (providedAdCopy) {
    const escapedAdCopy = providedAdCopy.replace(/"/g, '\\"');
    prompt += `\n\nAd Copy Requirements:
- Prominently include the headline text "${escapedAdCopy}" in the design
- Keep typography clean and highly legible against the background
- Use the provided text exactly as written without paraphrasing`;
  }

  const includeSoraSafety = request.shouldGenerateVideo !== false && (request.videoModel === 'sora2' || request.videoModel === 'sora2_pro');
  const soraSafetySection = `\n\nSora2 STRICT Safety Requirements (Very Important):
❌ NO children/minors (under 18) in ANY form (same as above)
❌ NO human faces of any age - Sora2 content moderation is extremely strict
✅ Allowed for adults: hands/limbs, body parts, blurred figures, silhouettes, back views
✅ Highlight product using hands-on demonstration WITHOUT showing any faces
✅ Use side views, back views, or obscured angles for human presence if needed`;

  if (includeSoraSafety) {
    prompt += soraSafetySection;
  }

  // Ensure prompt doesn't exceed KIE API's 5000 character limit
  const MAX_PROMPT_LENGTH = 5000;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    // Truncate the description part while keeping the critical instructions and watermark
    const criticalInstructions = `IMPORTANT: Use the provided product image as the EXACT BASE. Maintain the original product's exact visual appearance, shape, design, colors, textures, and all distinctive features. DO NOT change the product itself.

Based on the provided product image, create an enhanced advertising version that keeps the EXACT SAME product while only improving the presentation for marketing purposes.`;

    const watermarkSection = watermarkText ? `\n\nWatermark Requirements:
- Add text watermark: "${watermarkText}"
- Watermark location: ${watermarkLocation || 'bottom left'}
- Make the watermark visible but not overpowering
- Use appropriate font size and opacity for the watermark` : '';

    const remainingLength = MAX_PROMPT_LENGTH - criticalInstructions.length - watermarkSection.length - 100; // Reserve space for requirements
    const truncatedDescription = baseDescription.length > remainingLength
      ? baseDescription.substring(0, remainingLength - 3) + "..."
      : baseDescription;

    prompt = `${criticalInstructions} ${truncatedDescription}

Requirements: Keep exact product appearance, only enhance presentation.${watermarkSection}`;
    if (includeSoraSafety) {
      prompt += soraSafetySection;
    }
  }

  const targetAspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const resolvedImageSize = actualImageModel === 'nano_banana'
    ? targetAspectRatio
    : targetAspectRatio === '9:16'
      ? 'portrait_16_9'
      : 'landscape_16_9';

  const requestBody = {
    model: kieModelName,
    input: {
      prompt: prompt,
      image_urls: [imageUrl],
      output_format: "png",
      image_size: resolvedImageSize
    }
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Cover generation failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate cover');
  }

  return data.data.taskId;
}

async function startSegmentedWorkflow(
  projectId: string,
  request: StartWorkflowRequest & { imageUrl: string },
  prompts: Record<string, unknown>,
  segmentCount: number
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const normalizedSegments = normalizeSegmentPrompts(prompts, segmentCount);
  const now = new Date().toISOString();

  const segmentRows = normalizedSegments.map((segmentPrompt, index) => ({
    project_id: projectId,
    segment_index: index,
    status: 'pending_first_frame',
    prompt: segmentPrompt
  }));

  const { data: insertedSegments, error } = await supabase
    .from('standard_ads_segments')
    .insert(segmentRows)
    .select();

  if (error || !insertedSegments) {
    console.error('Failed to insert segmented rows:', error);
    throw new Error('Failed to initialize segment records');
  }

  const segments = insertedSegments as StandardAdsSegment[];

  await supabase
    .from('standard_ads_projects')
    .update({
      video_prompts: prompts,
      product_description: { description: (prompts as { description?: string }).description },
      segment_plan: { segments: normalizedSegments },
      current_step: 'generating_segment_frames',
      progress_percentage: 35,
      last_processed_at: now,
      segment_status: buildSegmentStatusPayload(segments)
    })
    .eq('id', projectId);

  for (const segment of segments) {
    const promptData = normalizedSegments[segment.segment_index];
    const firstFrameTaskId = await createSegmentFrameTask(request, promptData, segment.segment_index, 'first');

    const { error: updateError } = await supabase
      .from('standard_ads_segments')
      .update({
        first_frame_task_id: firstFrameTaskId,
        status: 'generating_first_frame',
        updated_at: new Date().toISOString()
      })
      .eq('id', segment.id)
      .select();

    if (updateError) {
      console.error('Failed to update segment after keyframe start:', updateError);
      throw new Error('Failed to update segment state');
    }

    segment.first_frame_task_id = firstFrameTaskId;
    segment.status = 'generating_first_frame';

    // Last segment gets a dedicated closing frame
    // CRITICAL: Skip closing_frame for children_toy products to allow children to appear in video
    // Reason: Google Veo3 checks both first_frame and closing_frame
    // - If both have NO children → video won't have children even if prompt mentions them
    // - If only first_frame (no closing_frame) → children can appear in video
    if (segment.segment_index === normalizedSegments.length - 1) {
      const productCategory = detectProductCategory(prompts);

      if (productCategory === 'children_toy') {
        console.log('🧸 Detected children_toy product - SKIPPING closing_frame generation to allow children in video');
      } else {
        const closingFrameTaskId = await createSegmentFrameTask(request, promptData, segment.segment_index, 'closing');

        await supabase
          .from('standard_ads_segments')
          .update({
            closing_frame_task_id: closingFrameTaskId,
            updated_at: new Date().toISOString()
          })
          .eq('id', segment.id);

        segment.closing_frame_task_id = closingFrameTaskId;
      }
    }
  }

  await supabase
    .from('standard_ads_projects')
    .update({
      segment_status: buildSegmentStatusPayload(segments),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

function normalizeSegmentPrompts(prompts: Record<string, unknown>, segmentCount: number): SegmentPrompt[] {
  const basePrompt = {
    description: (prompts as { description?: string }).description || 'Product hero shot in premium environment',
    setting: (prompts as { setting?: string }).setting || 'Studio lighting with branded backdrop',
    camera_type: (prompts as { camera_type?: string }).camera_type || 'Wide cinematic shot',
    camera_movement: (prompts as { camera_movement?: string }).camera_movement || 'Slow push-in',
    action: (prompts as { action?: string }).action || 'Showcase product with lifestyle interaction',
    lighting: (prompts as { lighting?: string }).lighting || 'Soft, high-key commercial lighting',
    dialogue: (prompts as { dialogue?: string }).dialogue || 'Highlight product benefits naturally',
    music: (prompts as { music?: string }).music || 'Warm, upbeat instrumental',
    ending: (prompts as { ending?: string }).ending || 'Product close-up with CTA',
    other_details: (prompts as { other_details?: string }).other_details || 'Include brand colors and typography elements',
    language: (prompts as { language?: string }).language || 'English'
  };

  const rawSegments = Array.isArray((prompts as { segments?: SegmentPrompt[] }).segments)
    ? ((prompts as { segments?: SegmentPrompt[] }).segments || [])
    : [];

  const baseVoiceType = (rawSegments[0] && rawSegments[0].voice_type) || (prompts as { voice_type?: string }).voice_type || 'Warm American female narrator';
  const baseVoiceTone = (rawSegments[0] && rawSegments[0].voice_tone) || (prompts as { voice_tone?: string }).voice_tone || 'Friendly and confident';

  const normalized: SegmentPrompt[] = [];

  for (let index = 0; index < segmentCount; index++) {
    const source = rawSegments[index] || rawSegments[rawSegments.length - 1] || {};
    normalized.push({
      ...basePrompt,
      ...source,
      segment_title: source.segment_title || `Segment ${index + 1}`,
      segment_goal: source.segment_goal || `Highlight product benefit ${index + 1}`,
      first_frame_prompt: source.first_frame_prompt || source.description || basePrompt.description,
      closing_frame_prompt: source.closing_frame_prompt || source.ending || basePrompt.ending,
      voice_type: baseVoiceType,  // Force unified voice across all segments
      voice_tone: baseVoiceTone   // Force unified tone across all segments
    });
  }

  return normalized;
}

export function buildSegmentStatusPayload(
  segments: StandardAdsSegment[],
  mergedVideoUrl: string | null = null
): SegmentStatusPayload {
  const total = segments.length;
  const framesReady = segments.filter(seg => !!seg.first_frame_url).length;
  const videosReady = segments.filter(seg => !!seg.video_url).length;

  return {
    total,
    framesReady,
    videosReady,
    segments: segments.map(seg => ({
      index: seg.segment_index,
      status: seg.status,
      firstFrameUrl: seg.first_frame_url,
      closingFrameUrl: seg.closing_frame_url,
      videoUrl: seg.video_url
    })),
    mergedVideoUrl
  };
}

async function createSegmentFrameTask(
  request: StartWorkflowRequest & { imageUrl: string },
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing'
): Promise<string> {
  const actualImageModel = getActualImageModel(request.imageModel || 'auto');
  const kieModelName = IMAGE_MODELS[actualImageModel];
  const targetAspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const resolvedImageSize = actualImageModel === 'nano_banana'
    ? targetAspectRatio
    : targetAspectRatio === '9:16'
      ? 'portrait_16_9'
      : 'landscape_16_9';

  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium product advertisement.

Use the provided product image as the canonical reference. Maintain identical product proportions, textures, materials, and branding.

Scene Focus:
- Description: ${segmentPrompt.description}
- Setting: ${segmentPrompt.setting}
- Camera: ${segmentPrompt.camera_type} with ${segmentPrompt.camera_movement}
- Lighting: ${segmentPrompt.lighting}

⚠️ ZERO-CHILD POLICY (ALL MODELS):

PROHIBITED Elements:
❌ Absolutely NO children/minors (under 18) in ANY form:
   - No child faces, hands, limbs, or body parts
   - No child silhouettes, back views, or blurred figures
   - No recognizable children in any way

ALLOWED Human Elements (Adults 18+ ONLY):
✅ Adults: FULLY ALLOWED in all forms
   - Clear frontal faces with visible facial features
   - Close-up face shots and detailed portraits
   - Multiple people with visible faces in the same frame
   - Hands/arms showing product interaction
   - Body parts demonstrating product use
   - Blurred background figures, silhouettes, back views
   - All forms of adult human presence

TRANSFORMATION RULES:
- If segment describes children → Replace with adults OR product-only display
- Adults can be shown naturally without face restrictions
- Maintain SCENE, LIGHTING, CAMERA ANGLE, and STYLE from original segment
- Create product-focused keyframe that shows authentic use cases

Render Instructions:
- ${frameType === 'first' ? segmentPrompt.first_frame_prompt : segmentPrompt.closing_frame_prompt}
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: kieModelName,
      input: {
        prompt,
        image_urls: [request.imageUrl],
        output_format: 'png',
        image_size: resolvedImageSize
      }
    })
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Segment frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate segment frame');
  }

  return data.data.taskId;
}

export async function startSegmentVideoTask(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string,
  closingFrameUrl: string,
  segmentIndex: number,
  totalSegments: number
): Promise<string> {
  const videoModel = (project.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast';

  if (videoModel !== 'veo3' && videoModel !== 'veo3_fast') {
    throw new Error(`Segmented workflow only supports VEO3 models. Received ${videoModel}`);
  }

  const aspectRatio = project.video_aspect_ratio === '9:16' ? '9:16' : '16:9';
  const languageCode = (project.language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode);
  const prompts = (project.video_prompts || {}) as { ad_copy?: string };
  const providedAdCopyRaw = typeof prompts.ad_copy === 'string' ? prompts.ad_copy.trim() : undefined;
  const providedAdCopy = providedAdCopyRaw && providedAdCopyRaw.length > 0 ? providedAdCopyRaw : undefined;
  const dialogueContent = providedAdCopy || segmentPrompt.dialogue;
  const adCopyInstruction = providedAdCopy
    ? `\nAd Copy (use verbatim): ${providedAdCopy}\nOn-screen Text: Display "${providedAdCopy}" prominently without paraphrasing.`
    : '';

  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  const voiceDescriptor = segmentPrompt.voice_type || 'Calm professional narrator';
  const voiceToneDescriptor = segmentPrompt.voice_tone || 'warm and confident';

  const fullPrompt = `${languagePrefix}${segmentPrompt.description}

Setting: ${segmentPrompt.setting}
Camera: ${segmentPrompt.camera_type} with ${segmentPrompt.camera_movement}
Action: ${segmentPrompt.action}
Lighting: ${segmentPrompt.lighting}
Dialogue: ${dialogueContent}
Music: ${segmentPrompt.music}
Ending: ${segmentPrompt.ending}
Other details: ${segmentPrompt.other_details}
Voice: This is segment ${segmentIndex + 1} of ${totalSegments}. Use the exact same narrator voice across all segments — ${voiceDescriptor} with a ${voiceToneDescriptor} tone. Match timbre, accent, gender, pacing, and energy perfectly so the audience cannot tell the clips were generated separately.${adCopyInstruction}`;

  const requestBody = {
    prompt: fullPrompt,
    model: videoModel,
    aspectRatio,
    generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
    imageUrls: [firstFrameUrl, closingFrameUrl],
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: true,
    includeDialogue: true,
    enableTranslation: false
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to generate segment video: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate segment video');
  }

  return data.data.taskId;
}
