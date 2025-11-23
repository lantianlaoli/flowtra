import { getSupabaseAdmin, type StandardAdsSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  getActualImageModel,
  IMAGE_MODELS,
  getAutoModeSelection,
  getGenerationCost,
  getLanguagePromptName,
  getSegmentCountFromDuration,
  REPLICA_PHOTO_CREDITS,
  snapDurationToModel,
  type LanguageCode,
  type VideoDuration
} from '@/lib/constants';
import { parseCompetitorTimeline, sumShotDurations, type CompetitorShot } from '@/lib/competitor-shots';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

const KIE_PROMPT_LIMIT = 5000;
const truncateText = (value: string | undefined | null, limit: number) => {
  if (!value) return '';
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
};
const clampPromptLength = (value: string) => {
  if (value.length <= KIE_PROMPT_LIMIT) {
    return value;
  }
  return `${value.slice(0, KIE_PROMPT_LIMIT - 3)}...`;
};

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedProductId?: string;
  selectedBrandId?: string; // NEW: Brand selection for ending frame
  competitorAdId?: string; // NEW: Competitor ad reference for creative direction
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
  imageModel?: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro';
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
  referenceImageUrls?: string[];
  photoAspectRatio?: string;
  photoResolution?: '1K' | '2K' | '4K';
  photoOutputFormat?: 'png' | 'jpg';
  replicaMode?: boolean;
  // NEW: Sora2 Pro params
  sora2ProDuration?: '10' | '15';
  sora2ProQuality?: 'standard' | 'high';
  // Generic video params (applies to all models)
  videoDuration?: VideoDuration;
  videoQuality?: 'standard' | 'high';
  language?: string; // Language for AI-generated content
  // NEW: Custom Script mode
  customScript?: string; // User-provided video script for direct video generation
  useCustomScript?: boolean; // Flag to enable custom script mode
  resolvedVideoModel?: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
}

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  remainingCredits?: number;
  creditsUsed?: number;
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
  contains_brand?: boolean; // NEW: Whether this segment/shot contains brand elements
  contains_product?: boolean; // NEW: Whether this segment/shot contains product
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
  model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok',
  videoDuration?: string | null
): boolean {
  if (!videoDuration) return false;
  if (model === 'grok') {
    const duration = Number(videoDuration);
    return Number.isFinite(duration) && duration > 6;
  }
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
    let brandLogoUrl: string | null = null;
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
            brand_details,
            brand_logo_url
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

      // Store brand logo URL for brand-only shots
      brandLogoUrl = product.brand?.brand_logo_url || null;
    }
    // NEW: If no product selected but brand is selected, get default product from brand
    else if (request.selectedBrandId && !imageUrl) {
      console.log(`🏢 No product selected, fetching default from brand: ${request.selectedBrandId}`);

      const { data: brand, error: brandError } = await supabase
        .from('user_brands')
        .select(`
          id,
          brand_name,
          brand_slogan,
          brand_details,
          brand_logo_url,
          user_products (
            id,
            product_details,
            user_product_photos (
              photo_url,
              is_primary
            )
          )
        `)
        .eq('id', request.selectedBrandId)
        .eq('user_id', request.userId)
        .single();

      if (brandError || !brand) {
        console.error('Brand query error:', brandError);
        return {
          success: false,
          error: 'Brand not found',
          details: brandError?.message || 'Selected brand does not exist or does not belong to this user'
        };
      }

      // Store brand context
      productContext = {
        product_details: '',
        brand_name: brand.brand_name || '',
        brand_slogan: brand.brand_slogan || '',
        brand_details: brand.brand_details || ''
      };

      // Store brand logo URL
      brandLogoUrl = brand.brand_logo_url || null;

      // Try to get the first product as default
      const firstProduct = brand.user_products?.[0];
      if (firstProduct && firstProduct.user_product_photos?.length > 0) {
        const primaryPhoto = firstProduct.user_product_photos.find((photo: { is_primary: boolean }) => photo.is_primary);
        const fallbackPhoto = firstProduct.user_product_photos[0];
        const selectedPhoto = primaryPhoto || fallbackPhoto;

        imageUrl = selectedPhoto.photo_url;
        productContext.product_details = firstProduct.product_details || '';

        console.log(`✅ Using brand's first product as default: ${imageUrl}`);
      } else {
        console.log(`ℹ️  No products found for brand. Will use Text-to-Image for product shots.`);
      }
    }

    // imageUrl is now optional when using competitor reference mode
    // It will be used if available, otherwise Text-to-Image will be used

    // Load competitor ad if provided (optional reference for creative direction)
    // Extended type to include existing analysis and language for performance optimization
  let competitorAdContext: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  } | undefined;

    if (request.competitorAdId) {
      console.log(`🎯 Loading competitor ad: ${request.competitorAdId}`);
      const { data: competitorAd, error: competitorError } = await supabase
        .from('competitor_ads')
        .select('ad_file_url, file_type, competitor_name, analysis_result, analysis_status, language, video_duration_seconds')
        .eq('id', request.competitorAdId)
        .eq('user_id', request.userId)
        .single();

      if (competitorAd && !competitorError) {
        competitorAdContext = {
          id: request.competitorAdId,
          file_url: competitorAd.ad_file_url,
          file_type: competitorAd.file_type as 'image' | 'video',
          competitor_name: competitorAd.competitor_name,
          existing_analysis: competitorAd.analysis_result,
          analysis_status: competitorAd.analysis_status as 'pending' | 'analyzing' | 'completed' | 'failed' | undefined,
          language: competitorAd.language,
          video_duration_seconds: competitorAd.video_duration_seconds
        };
        console.log(`✅ Competitor ad loaded: ${competitorAdContext.competitor_name} (${competitorAdContext.file_type})`);
        console.log(`📊 Analysis status: ${competitorAdContext.analysis_status || 'unknown'}`);
        console.log(`🔍 Has existing analysis: ${!!competitorAdContext.existing_analysis}`);
        console.log(`🌍 Detected language: ${competitorAdContext.language || 'none'}`);
      } else {
        console.warn(`⚠️ Competitor ad not found or access denied: ${request.competitorAdId}`, competitorError);
        // Don't fail the workflow if competitor ad is not found, just proceed without it
      }
    }

    // Convert 'auto' to specific model
    let actualVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
    let competitorShotTimeline: { shots: CompetitorShot[]; totalDurationSeconds: number } | null = null;

    if (request.videoModel === 'auto') {
      const autoSelection = getAutoModeSelection(0); // Get cheapest model
        actualVideoModel = autoSelection || 'sora2'; // Fallback to cheapest
    } else {
      actualVideoModel = request.videoModel;
    }

    if (
      competitorAdContext &&
      competitorAdContext.analysis_status === 'completed' &&
      competitorAdContext.existing_analysis
    ) {
      const timeline = parseCompetitorTimeline(
        competitorAdContext.existing_analysis as Record<string, unknown>,
        competitorAdContext.video_duration_seconds
      );
      if (timeline.shots.length > 0) {
        competitorShotTimeline = {
          shots: timeline.shots,
          totalDurationSeconds: timeline.videoDurationSeconds || sumShotDurations(timeline.shots)
        };

        if (
          (actualVideoModel === 'veo3' || actualVideoModel === 'veo3_fast' || actualVideoModel === 'grok') &&
          competitorShotTimeline.totalDurationSeconds > 0
        ) {
          const snappedDuration = snapDurationToModel(actualVideoModel, competitorShotTimeline.totalDurationSeconds);
          if (snappedDuration && request.videoDuration !== snappedDuration) {
            console.log(
              `⏱️ Auto-adjusted video duration to ${snappedDuration}s to mirror competitor reference (${actualVideoModel})`
            );
            request.videoDuration = snappedDuration;
          }
        }
      }
    }

    const isSegmented = isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const segmentCount = isSegmented ? getSegmentCountFromDuration(request.videoDuration, actualVideoModel) : 1;
    let remainingCreditsAfterDeduction: number | undefined;
    const isReplicaMode = Boolean(
      request.replicaMode &&
      request.photoOnly &&
      Array.isArray(request.referenceImageUrls) &&
      request.referenceImageUrls.length > 0
    );

    // ===== VERSION 3.0: MIXED BILLING - Generation Phase =====
    // Basic models (veo3_fast, sora2): FREE generation, paid download
    // Premium models (veo3, sora2_pro): PAID generation, free download
    let generationCost = 0;
    const duration = request.videoDuration || request.sora2ProDuration;
    const quality = request.videoQuality || request.sora2ProQuality;
    if (isReplicaMode) {
      generationCost = REPLICA_PHOTO_CREDITS;

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
          details: `Need ${generationCost} credits for replica photo mode, have ${creditCheck.currentCredits || 0}`
        };
      }

      const deductResult = await deductCredits(request.userId, generationCost);
      if (!deductResult.success) {
        return {
          success: false,
          error: 'Failed to deduct credits',
          details: deductResult.error || 'Credit deduction failed'
        };
      }
      remainingCreditsAfterDeduction = deductResult.remainingCredits;

      await recordCreditTransaction(
        request.userId,
        'usage',
        generationCost,
        'Standard Ads - Replica photo generation (Nano Banana Pro)',
        undefined,
        true
      );
    } else if (!request.photoOnly) {
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
        remainingCreditsAfterDeduction = deductResult.remainingCredits;

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
    if (isReplicaMode && request.photoAspectRatio) {
      actualCoverAspectRatio = request.photoAspectRatio;
    } else if (request.imageSize === 'auto' || !request.imageSize) {
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
        segment_duration_seconds: isSegmented ? (actualVideoModel === 'grok' ? 6 : 8) : null,
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
        if (isReplicaMode) {
          await startReplicaWorkflow(
            project.id,
            { ...request, imageUrl, resolvedVideoModel: actualVideoModel },
            productContext,
            competitorAdContext
          );
        } else {
          await startAIWorkflow(
            project.id,
            { ...request, imageUrl, videoModel: actualVideoModel, resolvedVideoModel: actualVideoModel },
            productContext,
            competitorAdContext, // Pass competitor ad context for reference
            brandLogoUrl, // NEW: Pass brand logo URL for brand-only shots
            imageUrl // NEW: Pass product image URL (may be null if no product)
          );
        }
      } catch (workflowError) {
        console.error('❌ Background workflow error:', workflowError);
        console.error('Stack trace:', workflowError instanceof Error ? workflowError.stack : 'No stack available');
        console.error('Context:', {
          projectId: project.id,
          userId: request.userId,
          videoModel: actualVideoModel,
          generationCost,
          photoOnly: request.photoOnly,
          isReplicaMode
        });

        // REFUND credits on failure (only for paid generation models)
        if (generationCost > 0) {
          console.log(`⚠️ Refunding ${generationCost} credits due to workflow failure`);
          try {
            await deductCredits(request.userId, -generationCost); // Negative = refund
            await recordCreditTransaction(
              request.userId,
              'refund',
              generationCost,
              isReplicaMode
                ? 'Standard Ads - Refund for failed replica photo generation'
                : `Standard Ads - Refund for failed ${actualVideoModel.toUpperCase()} generation`,
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
      projectId: project.id,
      remainingCredits: remainingCreditsAfterDeduction,
      creditsUsed: generationCost
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
    imageUrl?: string; // UPDATED: Now optional to support brand-only mode
    resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
  },
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  },
  brandLogoUrl?: string | null, // NEW: Brand logo URL for brand-only shots
  productImageUrl?: string | null // NEW: Product image URL (may be null if no product)
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

    // TWO-STEP PROCESS for competitor reference mode (with intelligent caching)
    let competitorDescription: Record<string, unknown> | undefined;
    if (competitorAdContext) {
      // Check if we can reuse existing analysis from database
      if (competitorAdContext.analysis_status === 'completed' && competitorAdContext.existing_analysis) {
        // Performance optimization: Reuse cached analysis
        console.log('✅ Using existing competitor analysis from database (cached)');
        console.log(`   - Competitor: ${competitorAdContext.competitor_name}`);
        console.log(`   - Language: ${competitorAdContext.language || 'not detected'}`);
        console.log(`   - Skipping API call to OpenRouter (saving time & cost)`);

        competitorDescription = competitorAdContext.existing_analysis as Record<string, unknown>;

        // Optional: Validate analysis structure
        const requiredFields = ['subject', 'context', 'action', 'style', 'camera_motion', 'composition', 'ambiance', 'audio', 'shots'];
        const hasAllFields = requiredFields.every(field => field in competitorDescription!);

        if (!hasAllFields) {
          console.warn('⚠️ Existing analysis incomplete or invalid, re-analyzing...');
          competitorDescription = await analyzeCompetitorAd({
            file_url: competitorAdContext.file_url,
            file_type: competitorAdContext.file_type,
            competitor_name: competitorAdContext.competitor_name
          });

          if (competitorAdContext.id && competitorDescription) {
            const timeline = parseCompetitorTimeline(
              competitorDescription as Record<string, unknown>,
              competitorAdContext.video_duration_seconds
            );
            await supabase
              .from('competitor_ads')
              .update({
                analysis_result: competitorDescription,
                analysis_status: 'completed',
                video_duration_seconds: timeline.videoDurationSeconds
              })
              .eq('id', competitorAdContext.id);
          }
        }
      } else {
        // No existing analysis or analysis failed/pending - perform fresh analysis
        const statusReason = !competitorAdContext.existing_analysis
          ? 'no existing analysis found'
          : `status is ${competitorAdContext.analysis_status}`;

        console.log(`🔄 Performing fresh competitor analysis (${statusReason})...`);
        console.log('📺 Step 1: Analyzing competitor ad...');

        competitorDescription = await analyzeCompetitorAd({
          file_url: competitorAdContext.file_url,
          file_type: competitorAdContext.file_type,
          competitor_name: competitorAdContext.competitor_name
        });

        console.log('✅ Step 1 complete: Fresh competitor analysis ready');

        if (competitorAdContext.id && competitorDescription) {
          const timeline = parseCompetitorTimeline(
            competitorDescription as Record<string, unknown>,
            competitorAdContext.video_duration_seconds
          );
          await supabase
            .from('competitor_ads')
            .update({
              analysis_result: competitorDescription,
              analysis_status: 'completed',
              video_duration_seconds: timeline.videoDurationSeconds
            })
            .eq('id', competitorAdContext.id);
        }
      }
    }

    let competitorTimelineShots: CompetitorShot[] | undefined;
    if (competitorDescription) {
      const parsedTimeline = parseCompetitorTimeline(
        competitorDescription as Record<string, unknown>,
        competitorAdContext?.video_duration_seconds
      );
      competitorTimelineShots = parsedTimeline.shots;

      if (
        parsedTimeline.videoDurationSeconds &&
        (request.resolvedVideoModel === 'veo3' ||
          request.resolvedVideoModel === 'veo3_fast' ||
          request.resolvedVideoModel === 'grok')
      ) {
        const snappedDuration = snapDurationToModel(request.resolvedVideoModel, parsedTimeline.videoDurationSeconds);
        if (snappedDuration && request.videoDuration !== snappedDuration) {
          console.log(`⏱️ Aligning video duration to competitor timeline (${snappedDuration}s)`);
          request.videoDuration = snappedDuration;
        }
      }
    }

    const totalDurationSeconds = parseInt(request.videoDuration || request.sora2ProDuration || '10', 10);
    const segmentedFlow = isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const segmentCount = segmentedFlow ? getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel) : 1;

    const { error: projectConfigUpdateError } = await supabase
      .from('standard_ads_projects')
      .update({
        video_duration: request.videoDuration || request.sora2ProDuration || null,
        is_segmented: segmentedFlow,
        segment_count: segmentedFlow ? segmentCount : null,
        segment_duration_seconds: segmentedFlow ? (request.resolvedVideoModel === 'grok' ? 6 : 8) : null
      })
      .eq('id', projectId);
    if (projectConfigUpdateError) {
      console.error('⚠️ Failed to sync project video settings with competitor analysis:', projectConfigUpdateError);
    }

    // Step 2: Generate prompts for our product
    console.log(competitorDescription ? '🎯 Step 2: Generating prompts (competitor reference mode)...' : '🎨 Generating prompts (traditional mode)...');
    const prompts = await generateImageBasedPrompts(
      request.imageUrl,
      request.language,
      totalDurationSeconds,
      request.adCopy,
      segmentCount,
      productContext,
      competitorDescription // Pass competitor analysis result (not raw context)
    );

    console.log('🎯 Generated creative prompts:', prompts);
    const productCategory = detectProductCategory(prompts);
    console.log(`📦 Product category detected: ${productCategory}`);

    let shotPlanForSegments: CompetitorShot[] | undefined;
    if (segmentedFlow && competitorTimelineShots && competitorTimelineShots.length > 0) {
      if (competitorTimelineShots.length === segmentCount) {
        shotPlanForSegments = competitorTimelineShots;
      } else {
        console.warn(
          `⚠️ Competitor shot count (${competitorTimelineShots.length}) does not match required segment count (${segmentCount}). Falling back to AI segment plan.`
        );
      }
    }

    if (segmentedFlow) {
      console.log('🎬 Segmented workflow enabled - orchestrating multi-segment pipeline');
      await startSegmentedWorkflow(
        projectId,
        request,
        prompts,
        segmentCount,
        competitorDescription,
        shotPlanForSegments,
        brandLogoUrl, // NEW: Pass brand logo URL
        productImageUrl, // NEW: Pass product image URL
        productContext // NEW: Pass product context for fallback text generation
      );
      return;
    }

    // Non-segmented flow: Requires product image
    if (!request.imageUrl) {
      throw new Error('Non-segmented workflow requires a product image. Please use segmented workflow with competitor reference or provide a product image.');
    }

    // Step 1: Start cover generation
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request, competitorDescription);
    console.log('🆔 Cover task ID:', coverTaskId);

    let finalCoverTaskId = coverTaskId;
    if (productCategory === 'children_toy') {
      console.log('🧸 Children toy product detected — running second cover generation pass');
      finalCoverTaskId = await generateCover(request.imageUrl, prompts, request, competitorDescription);
      console.log('🆔 Secondary cover task ID:', finalCoverTaskId);
    }

    // Update project with cover task ID and prompts
    const updateData = {
      cover_task_id: finalCoverTaskId,
      video_prompts: prompts,
      product_description: prompts, // Store complete AI response with all structured fields (final prompt for our product)
      competitor_description: competitorDescription || null, // Store competitor analysis (Veo Guide 8 elements) if available
      image_prompt: prompts.description as string,
      current_step: 'generating_cover' as const,
      progress_percentage: 30,
      last_processed_at: new Date().toISOString()
    };
    console.log('💾 Updating project with image-driven data' + (competitorDescription ? ' (competitor reference mode)' : ''));

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

async function startReplicaWorkflow(
  projectId: string,
  request: StartWorkflowRequest & {
    imageUrl: string | undefined;
    resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
  },
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorAdContext?: {
    id?: string;
    file_url: string;
    file_type: 'image' | 'video';
    competitor_name: string;
    existing_analysis?: Record<string, unknown> | null;
    analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed';
    language?: string | null;
    video_duration_seconds?: number | null;
  }
): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!request.referenceImageUrls || request.referenceImageUrls.length === 0) {
    throw new Error('Replica workflow requires reference images');
  }

  let competitorDescription: Record<string, unknown> | undefined;
  let detectedLanguage: LanguageCode = (request.language as LanguageCode) || 'en';

  if (competitorAdContext) {
    if (competitorAdContext.analysis_status === 'completed' && competitorAdContext.existing_analysis) {
      competitorDescription = competitorAdContext.existing_analysis as Record<string, unknown>;
      detectedLanguage = (competitorAdContext.language as LanguageCode | undefined) || detectedLanguage;
    } else {
      const { analysis, language } = await analyzeCompetitorAdWithLanguage({
        file_url: competitorAdContext.file_url,
        file_type: competitorAdContext.file_type,
        competitor_name: competitorAdContext.competitor_name
      });
      competitorDescription = analysis;
      detectedLanguage = language;
      const timeline = parseCompetitorTimeline(analysis);

      if (competitorAdContext.id) {
        await supabase
          .from('competitor_ads')
          .update({
            analysis_result: analysis,
            analysis_status: 'completed',
            language,
            video_duration_seconds: timeline.videoDurationSeconds
          })
          .eq('id', competitorAdContext.id);
      }
    }
  }

  const prompt = buildReplicaPrompt({
    competitorDescription,
    productContext,
    language: detectedLanguage,
    additionalRequirements: request.adCopy
  });

  const taskId = await generateReplicaPhoto({
    prompt,
    referenceImages: request.referenceImageUrls,
    aspectRatio: request.photoAspectRatio,
    resolution: request.photoResolution,
    outputFormat: request.photoOutputFormat
  });

  const updateData = {
    cover_task_id: taskId,
    video_prompts: { replica_prompt: prompt },
    product_description: {
      brand_name: productContext?.brand_name,
      brand_slogan: productContext?.brand_slogan,
      brand_details: productContext?.brand_details,
      product_details: productContext?.product_details
    },
    competitor_description: competitorDescription || null,
    current_step: 'generating_cover' as const,
    progress_percentage: 35,
    last_processed_at: new Date().toISOString()
  };

  const { error: updateError } = await supabase
    .from('standard_ads_projects')
    .update(updateData)
    .eq('id', projectId);

  if (updateError) {
    throw updateError;
  }
}

function buildReplicaPrompt({
  competitorDescription,
  productContext,
  language,
  additionalRequirements
}: {
  competitorDescription?: Record<string, unknown>;
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string };
  language?: LanguageCode;
  additionalRequirements?: string;
}): string {
  const brandName = productContext?.brand_name || 'the featured brand';
  const productDetails = truncateText(productContext?.product_details, 800);
  const brandSlogan = truncateText(productContext?.brand_slogan, 200);
  const subject = typeof competitorDescription?.subject === 'string' ? competitorDescription.subject : '';
  const action = typeof competitorDescription?.action === 'string' ? competitorDescription.action : '';
  const ambiance = typeof competitorDescription?.ambiance === 'string' ? competitorDescription.ambiance : '';
  const style = typeof competitorDescription?.style === 'string' ? competitorDescription.style : '';
  const firstFrame = typeof competitorDescription?.first_frame_composition === 'string'
    ? competitorDescription.first_frame_composition
    : '';
  const sceneElements = Array.isArray((competitorDescription as { scene_elements?: Array<{ element: string; position: string; details: string }> })?.scene_elements)
    ? ((competitorDescription as { scene_elements: Array<{ element: string; position: string; details: string }> }).scene_elements)
    : [];
  const MAX_SCENE_ELEMENTS = 12;
  const visibleSceneElements = sceneElements.slice(0, MAX_SCENE_ELEMENTS);
  const hasTrimmedScene = sceneElements.length > MAX_SCENE_ELEMENTS;

  const sceneGuide = visibleSceneElements.length
    ? `${visibleSceneElements.map(el => `- ${el.element} (${el.position}): ${truncateText(el.details, 280)}`).join('\n')}${hasTrimmedScene ? '\n- ... (trimmed additional scene elements)' : ''}`
    : 'Match every visible background object, flooring, wall color, prop, and piece of furniture based on the competitor photo. Keep their placement and proportions identical.';
  const sanitizedAdditionalRequirements = truncateText(additionalRequirements, 800);

  const promptSections = [
    `Replica UGC mode: recreate the competitor scene exactly as analyzed, but swap every branded object with ${brandName}'s products using the provided reference images. Maintain identical framing, pose, lens, lighting, mood, and prop placement.`,
    subject && `Competitor subject focus: ${subject}`,
    action && `Action/motion cues: ${action}`,
    style && `Visual style: ${style}`,
    ambiance && `Ambiance & color palette: ${ambiance}`,
    firstFrame && `Spatial layout (match precisely): ${firstFrame}`,
    'Scene elements to reproduce verbatim:\n' + sceneGuide,
    productDetails && `Brand/Product cues: ${productDetails}`,
    brandSlogan && `Brand tone: ${brandSlogan}`,
    `Use only the supplied ${brandName} assets for replacement props. Preserve the same number of toys, type of flooring, wall textures, and negative space. If people or children are present, keep their poses, clothing vibes, and camera depth identical.`,
    sanitizedAdditionalRequirements && `Additional requirements: ${sanitizedAdditionalRequirements}`,
    `Language for any visible text: ${(language || 'en').toUpperCase()}.`
  ].filter(Boolean);

  return clampPromptLength(promptSections.join('\n\n'));
}

async function generateReplicaPhoto({
  prompt,
  referenceImages,
  aspectRatio,
  resolution,
  outputFormat
}: {
  prompt: string;
  referenceImages: string[];
  aspectRatio?: string;
  resolution?: '1K' | '2K' | '4K';
  outputFormat?: 'png' | 'jpg';
}): Promise<string> {
  if (!referenceImages.length) {
    throw new Error('Replica photo generation requires reference images');
  }

  const requestBody = {
    model: IMAGE_MODELS.nano_banana_pro,
    input: {
      prompt,
      image_input: referenceImages.slice(0, 10),
      aspect_ratio: aspectRatio || '9:16',
      resolution: resolution || '2K',
      output_format: outputFormat || 'png'
    }
  };

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Replica photo generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start replica photo task');
  }

  return data.data.taskId as string;
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

/**
 * Step 1: Analyze competitor ad independently (First API call)
 *
 * This function ONLY analyzes the competitor ad/video using Veo Guide 8 elements.
 * It does NOT consider our product at all - pure competitor analysis.
 *
 * @param competitorAdContext - Competitor ad file URL and type
 * @returns competitor_description - Veo Guide 8-element analysis
 */
async function analyzeCompetitorAd(
  competitorAdContext: { file_url: string; file_type: 'image' | 'video'; competitor_name: string }
): Promise<Record<string, unknown>> {
  console.log(`[analyzeCompetitorAd] Step 1: Analyzing competitor ad from ${competitorAdContext.competitor_name}`);

  // Convert video to base64 if needed
  let processedFileUrl = competitorAdContext.file_url;
  if (competitorAdContext.file_type === 'video') {
    console.log(`[analyzeCompetitorAd] Converting competitor video to base64`);
    try {
      processedFileUrl = await fetchVideoAsBase64(competitorAdContext.file_url);
      console.log(`[analyzeCompetitorAd] Video converted successfully`);
    } catch (error) {
      console.error('[analyzeCompetitorAd] Failed to convert video:', error);
      throw new Error('Failed to process competitor video');
    }
  }

  // Define JSON schema for competitor analysis (Veo Guide 8 elements + Scene Details + Shot timeline)
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "competitor_analysis_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          subject: {
            type: "string",
            description: "Main elements and focal points in the ad (what is shown)"
          },
          context: {
            type: "string",
            description: "Environment, background, setting, time of day"
          },
          action: {
            type: "string",
            description: "What is happening, movement, interactions"
          },
          style: {
            type: "string",
            description: "Overall visual style and artistic direction"
          },
          camera_motion: {
            type: "string",
            description: "Camera movements (pan, zoom, tracking, POV, etc.)"
          },
          composition: {
            type: "string",
            description: "Shot types (close-up, medium shot, wide shot, angles)"
          },
          ambiance: {
            type: "string",
            description: "Color palette, lighting setup, mood, atmosphere"
          },
          audio: {
            type: "string",
            description: "Dialogue, voiceover, music style, sound effects"
          },
          scene_elements: {
            type: "array",
            description: "List of all visible background elements with their positions (furniture, plants, floor type, walls, props)",
            items: {
              type: "object",
              properties: {
                element: {
                  type: "string",
                  description: "Name of the element (e.g., 'monstera plant', 'white chair', 'hardwood floor')"
                },
                position: {
                  type: "string",
                  description: "Position in frame (e.g., 'left background', 'right side', 'bottom', 'center background')"
                },
                details: {
                  type: "string",
                  description: "Visual details (color, material, size, style)"
                }
              },
              required: ["element", "position", "details"],
              additionalProperties: false
            }
          },
          first_frame_composition: {
            type: "string",
            description: "Detailed description of the first frame's spatial layout and visual hierarchy"
          },
          video_duration_seconds: {
            type: "number",
            description: "Total runtime of the analyzed advertisement in seconds"
          },
          shots: {
            type: "array",
            minItems: 1,
            description: "Ordered breakdown of every shot/scene with timestamps and creative cues",
            items: {
              type: "object",
              properties: {
                shot_id: {
                  type: "number",
                  description: "Sequential shot number starting at 1"
                },
                start_time: {
                  type: "string",
                  description: "Shot start timestamp formatted as MM:SS"
                },
                end_time: {
                  type: "string",
                  description: "Shot end timestamp formatted as MM:SS"
                },
                duration_seconds: {
                  type: "number",
                  description: "Shot duration in seconds (round to nearest second)"
                },
                first_frame_description: {
                  type: "string",
                  description: "Visual description of the opening frame for this shot"
                },
                subject: {
                  type: "string",
                  description: "People, products, or hero objects featured in the shot"
                },
                context_environment: {
                  type: "string",
                  description: "Location, environment, and background details"
                },
                action: {
                  type: "string",
                  description: "What happens during the shot"
                },
                style: {
                  type: "string",
                  description: "Visual style or mood for the shot"
                },
                camera_motion_positioning: {
                  type: "string",
                  description: "Camera movement and framing specifics for the shot"
                },
                composition: {
                  type: "string",
                  description: "Shot type/framing (close-up, medium, wide, etc.)"
                },
                ambiance_colour_lighting: {
                  type: "string",
                  description: "Lighting scheme, palette, and atmosphere"
                },
                audio: {
                  type: "string",
                  description: "Voiceover, dialogue, SFX, or music cues"
                },
                narrative_goal: {
                  type: "string",
                  description: "Purpose of the shot inside the story arc (hook, proof, CTA, etc.)"
                },
                recommended_segment_duration: {
                  type: "number",
                  description: "Best segment duration for recreating this shot (use multiples of 8s when possible)"
                },
                generation_guidance: {
                  type: "string",
                  description: "Explicit instructions for recreating the shot with our product"
                }
              },
              required: [
                "shot_id",
                "start_time",
                "end_time",
                "duration_seconds",
                "first_frame_description",
                "subject",
                "context_environment",
                "action",
                "style",
                "camera_motion_positioning",
                "composition",
                "ambiance_colour_lighting",
                "audio",
                "narrative_goal",
                "recommended_segment_duration",
                "generation_guidance"
              ],
              additionalProperties: false
            }
          }
        },
        required: [
          "subject",
          "context",
          "action",
          "style",
          "camera_motion",
          "composition",
          "ambiance",
          "audio",
          "scene_elements",
          "first_frame_composition",
          "video_duration_seconds",
          "shots"
        ],
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
            competitorAdContext.file_type === 'video'
              ? {
                  type: 'video_url' as const,
                  video_url: { url: processedFileUrl }
                }
              : {
                  type: 'image_url' as const,
                  image_url: { url: processedFileUrl }
                },
            {
              type: 'text',
              text: `📺 COMPETITOR AD ANALYSIS - Step 1 (Independent Analysis)

You are analyzing a competitor advertisement ${competitorAdContext.file_type === 'video' ? 'video' : 'image'} from "${competitorAdContext.competitor_name}".

TASK: Analyze this ad using the Veo Prompt Guide's 8 core elements PLUS detailed scene reconstruction data. This is a PURE ANALYSIS - do not consider any other product or make recommendations.

Analyze and describe each element in detail:

1. **Subject (主体)**: What objects, people, animals, or scenes appear? What are the main focal points?

2. **Context (环境/背景)**: What is the environment? Indoor/outdoor? Time of day? Background elements?

3. **Action (动作)**: What movements or actions are happening? How do subjects interact?

4. **Style (风格)**: What is the overall visual or artistic style? (e.g., cinematic, minimalist, retro, modern, cartoon-like)

5. **Camera Motion (摄像机运动)**: How does the camera move? (e.g., static, pan left/right, zoom in/out, tracking shot, POV, crane shot)

6. **Composition (构图)**: What are the shot types and framing? (e.g., close-up, medium shot, wide shot, extreme close-up, angles)

7. **Ambiance (氛围/色彩)**: What is the color palette? Lighting? Mood? Atmosphere? (e.g., warm tones, cold blue, high-key lighting, moody shadows)

8. **Audio (音频)**: What audio elements are present or suggested? Dialogue? Voiceover? Music style? Sound effects?

9. **Scene Elements (场景元素)**: List EVERY visible background element with precise details:
   - Furniture (chairs, tables, shelves, etc.) - specify color, material, style
   - Plants (type, size, position)
   - Floor type (hardwood, carpet, tile, pattern)
   - Wall features (color, texture, decorations)
   - Props and decorative items
   - For each element, specify its EXACT position in the frame (left/right/center, foreground/background)

10. **First Frame Composition (首帧构图)**: Describe the ${competitorAdContext.file_type === 'video' ? 'opening frame' : 'image'}'s spatial layout in detail:
    - What is in the foreground vs background?
    - How is the space divided (left/center/right)?
    - What is the visual hierarchy (what draws the eye first)?
    - Depth perception and layering of elements
    - Negative space and framing

11. **Video Duration (广告总时长)**: Return the precise total runtime in seconds as \`video_duration_seconds\`. Use the video's metadata or timestamps.

12. **Shot Timeline (多镜头拆解)**: Output a JSON array named "shots" describing sequential 6-8 second beats that cover the entire video from start to finish. Each shot MUST include:
    - \`shot_id\`, \`start_time\`, \`end_time\`, and \`duration_seconds\`
    - Visual specifics: \`first_frame_description\`, \`subject\`, \`context_environment\`, \`action\`, \`style\`, \`camera_motion_positioning\`, \`composition\`, \`ambiance_colour_lighting\`
    - Audio cues
    - \`narrative_goal\` explaining the marketing purpose of that shot
    - \`recommended_segment_duration\` (prefer 8 seconds to match Veo3 Fast; use 6 seconds when the shot clearly demands Grok pacing)
    - \`generation_guidance\` explaining exactly how to recreate the shot with our product instead of the competitor's while preserving framing and pacing.

Requirements for the "shots" array:
- Cover the entire runtime with no gaps.
- Keep timestamps strictly increasing and formatted as MM:SS (e.g., "00:24").
- Durations should be rounded to the nearest second and sum to the total runtime.
- Favor concise multi-shot segmentation similar to storyboard beats.

CRITICAL FOR SCENE REPLICATION:
- Be extremely detailed and specific for scene_elements and first_frame_composition
- Include colors, materials, sizes, and exact positions
- Think like you're instructing someone to recreate the exact scene from scratch
- These details will be used to generate an identical scene with a different product

Return a JSON object with all 10 elements.`
            }
          ]
        }
      ]
    })
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error('[analyzeCompetitorAd] JSON parse error:', error);
    throw new Error('Failed to parse competitor analysis response');
  }

  const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
  if (!apiResponse.choices?.[0]?.message?.content) {
    console.error('[analyzeCompetitorAd] Invalid API response structure:', data);
    throw new Error('Invalid competitor analysis response format');
  }

  const analysis = JSON.parse(apiResponse.choices[0].message.content) as Record<string, unknown>;
  console.log('[analyzeCompetitorAd] ✅ Competitor analysis complete:', analysis);

  return analysis;
}

/**
 * Analyze competitor ad with automatic language detection
 *
 * This function extends analyzeCompetitorAd by adding automatic language detection
 * during the analysis process. The detected language is returned as a short code
 * matching the LanguageCode type ('en', 'zh', 'es', etc.).
 *
 * @param competitorAdContext - Competitor ad metadata including file URL and type
 * @returns Object with { analysis: {...}, language: 'en' }
 */
export async function analyzeCompetitorAdWithLanguage(
  competitorAdContext: {
    file_url: string;
    file_type: 'video' | 'image';
    competitor_name?: string;
  }
): Promise<{ analysis: Record<string, unknown>; language: LanguageCode }> {
  console.log('[analyzeCompetitorAdWithLanguage] 🔍 Starting competitor analysis with language detection...');
  console.log('[analyzeCompetitorAdWithLanguage] File type:', competitorAdContext.file_type);
  console.log('[analyzeCompetitorAdWithLanguage] File URL:', competitorAdContext.file_url);

  // Process video to base64 if needed (Gemini requirement)
  let processedFileUrl = competitorAdContext.file_url;
  if (competitorAdContext.file_type === 'video') {
    try {
      processedFileUrl = await fetchVideoAsBase64(competitorAdContext.file_url);
      console.log('[analyzeCompetitorAdWithLanguage] Video converted to base64');
    } catch (error) {
      console.error('[analyzeCompetitorAdWithLanguage] Video processing failed:', error);
      throw new Error('Failed to process competitor video');
    }
  }

  // Extended JSON schema with language detection + shot breakdown
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "competitor_analysis_with_language_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "A concise, descriptive name for this competitor ad (e.g., 'lovevery-playkits-delivery', 'nike-running-motivation'). Use lowercase with hyphens, keep it under 40 characters, make it searchable and memorable."
          },
          video_duration_seconds: {
            type: "number",
            description: "Total runtime of the analyzed advertisement in seconds"
          },
          shots: {
            type: "array",
            minItems: 1,
            description: "Ordered breakdown of every shot/scene with timestamps and creative cues",
            items: {
              type: "object",
              properties: {
                shot_id: {
                  type: "number",
                  description: "Sequential shot number starting at 1"
                },
                start_time: {
                  type: "string",
                  description: "Shot start timestamp formatted as MM:SS"
                },
                end_time: {
                  type: "string",
                  description: "Shot end timestamp formatted as MM:SS"
                },
                duration_seconds: {
                  type: "number",
                  description: "Shot duration in seconds (round to nearest second)"
                },
                first_frame_description: {
                  type: "string",
                  description: "Visual description of the opening frame for this shot"
                },
                subject: {
                  type: "string",
                  description: "People, products, or hero objects featured in the shot"
                },
                context_environment: {
                  type: "string",
                  description: "Location, environment, and background details"
                },
                action: {
                  type: "string",
                  description: "What happens during the shot"
                },
                style: {
                  type: "string",
                  description: "Visual style or mood for the shot"
                },
                camera_motion_positioning: {
                  type: "string",
                  description: "Camera movement and framing specifics for the shot"
                },
                composition: {
                  type: "string",
                  description: "Shot type/framing (close-up, medium, wide, etc.)"
                },
                ambiance_colour_lighting: {
                  type: "string",
                  description: "Lighting scheme, palette, and atmosphere"
                },
                audio: {
                  type: "string",
                  description: "Voiceover, dialogue, SFX, or music cues"
                },
                narrative_goal: {
                  type: "string",
                  description: "Purpose of the shot inside the story arc (hook, proof, CTA, etc.)"
                },
                recommended_segment_duration: {
                  type: "number",
                  description: "Best segment duration for recreating this shot (use multiples of 8s when possible)"
                },
                generation_guidance: {
                  type: "string",
                  description: "Explicit instructions for recreating the shot with our product"
                },
                contains_brand: {
                  type: "boolean",
                  description: "Whether this shot contains brand elements (logo, packaging, brand name, brand signage)"
                },
                contains_product: {
                  type: "boolean",
                  description: "Whether this shot contains physical product(s) that should be replaced with user's product"
                }
              },
              required: [
                "shot_id",
                "start_time",
                "end_time",
                "duration_seconds",
                "first_frame_description",
                "subject",
                "context_environment",
                "action",
                "style",
                "camera_motion_positioning",
                "composition",
                "ambiance_colour_lighting",
                "audio",
                "narrative_goal",
                "recommended_segment_duration",
                "generation_guidance",
                "contains_brand",
                "contains_product"
              ],
              additionalProperties: false
            }
          },
          detected_language: {
            type: "string",
            description: "Detected primary language as a short code (e.g., 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa')"
          }
        },
        required: [
          "name",
          "video_duration_seconds",
          "shots",
          "detected_language"
        ],
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
            competitorAdContext.file_type === 'video'
              ? {
                  type: 'video_url' as const,
                  video_url: { url: processedFileUrl }
                }
              : {
                  type: 'image_url' as const,
                  image_url: { url: processedFileUrl }
                },
            {
              type: 'text',
              text: `📺 COMPETITOR AD MULTI-SHOT ANALYSIS

You are analyzing a competitor advertisement ${competitorAdContext.file_type === 'video' ? 'video' : 'image'}${competitorAdContext.competitor_name ? ` from "${competitorAdContext.competitor_name}"` : ''}.

TASK: Break down this ad into a structured shot-by-shot timeline with language detection. This is a PURE ANALYSIS - do not consider any other product or make recommendations.

OUTPUT REQUIREMENTS:

1. **name** (广告名称): Generate a concise, descriptive name for this ad
   - Format: lowercase-with-hyphens (e.g., "lovevery-playkits-delivery", "nike-running-motivation")
   - Keep it under 40 characters
   - Make it searchable and memorable
   - Include brand/product keywords if visible

2. **video_duration_seconds** (广告总时长): Return the precise total runtime in seconds
   - Use the video's metadata or calculate from timestamps
   - Round to nearest second

3. **shots** (多镜头拆解): Break down the ad into sequential shots/scenes
   - Each shot represents a distinct visual beat or narrative moment
   - Typical shot duration: 6-11 seconds
   - Cover the ENTIRE runtime with NO gaps

   For EACH shot, provide:
   - \`shot_id\` - Sequential number starting at 1
   - \`start_time\` - Format: MM:SS (e.g., "00:06")
   - \`end_time\` - Format: MM:SS
   - \`duration_seconds\` - Shot duration (round to nearest second)
   - \`first_frame_description\` - Detailed visual description of the opening frame
   - \`subject\` - People, products, or hero objects featured
   - \`context_environment\` - Location, environment, and background details
   - \`action\` - What happens during the shot
   - \`style\` - Visual style or mood
   - \`camera_motion_positioning\` - Camera movement and framing
   - \`composition\` - Shot type/framing (close-up, medium, wide, etc.)
   - \`ambiance_colour_lighting\` - Lighting scheme, palette, and atmosphere
   - \`audio\` - Voiceover, dialogue, SFX, or music cues
   - \`narrative_goal\` - Purpose of the shot (hook, proof, CTA, etc.)
   - \`recommended_segment_duration\` - Best duration for recreating (prefer 8s; use 6s only when needed)
   - \`generation_guidance\` - Explicit instructions for recreating with our product
   - \`contains_brand\` - Boolean: Does this shot show brand logo, packaging, brand name, or brand signage?
   - \`contains_product\` - Boolean: Does this shot show physical product(s) that would need to be replaced?

   Shot requirements:
   - Timestamps must be strictly increasing (no gaps, no overlaps)
   - Durations must sum to total video duration
   - Be extremely detailed and specific
   - Think like you're creating a storyboard for recreation

   **BRAND/PRODUCT DETECTION RULES:**
   - \`contains_brand: true\` if the shot shows:
     * Brand logo or wordmark
     * Product packaging with brand name
     * Brand signage or storefront
     * Any visual brand identifier
   - \`contains_product: true\` if the shot shows:
     * Physical product(s) that are the focus or subject
     * Product being used, demonstrated, or displayed
     * Product in hand, on table, or in scene
   - Both can be true simultaneously (e.g., branded product packaging)
   - Both can be false (e.g., pure lifestyle/environment shots)

4. **detected_language** (检测语言): Detect the PRIMARY language
   - Check text overlays, subtitles, captions
   - Listen to voiceover, dialogue, or narration
   - Consider cultural and regional context
   - Return ONLY the short code: 'en', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'ur', 'pa'
   - Default to "en" if unclear or mostly visual

EXAMPLE OUTPUT STRUCTURE:
{
  "name": "lovevery-playkits-delivery",
  "video_duration_seconds": 47,
  "shots": [
    {
      "shot_id": 1,
      "start_time": "00:00",
      "end_time": "00:06",
      "duration_seconds": 6,
      "first_frame_description": "Exterior of a modern apartment building with a package on the doorstep",
      "subject": "Young woman",
      "context_environment": "Urban street entrance, brick building with glass door",
      "action": "Opens door, picks up package, walks inside",
      "style": "Realism, candid lifestyle",
      "camera_motion_positioning": "Static wide shot",
      "composition": "Full body shot",
      "ambiance_colour_lighting": "Natural daylight, soft shadows",
      "audio": "Upbeat acoustic music starts",
      "narrative_goal": "Establish product arrival moment",
      "recommended_segment_duration": 6,
      "generation_guidance": "Show doorstep delivery pickup scene enthusiastically",
      "contains_brand": true,
      "contains_product": true
    }
  ],
  "detected_language": "en"
}`
            }
          ]
        }
      ]
    })
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error('[analyzeCompetitorAdWithLanguage] JSON parse error:', error);
    throw new Error('Failed to parse competitor analysis response');
  }

  const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
  if (!apiResponse.choices?.[0]?.message?.content) {
    console.error('[analyzeCompetitorAdWithLanguage] Invalid API response structure:', data);
    throw new Error('Invalid competitor analysis response format');
  }

  const result = JSON.parse(apiResponse.choices[0].message.content) as Record<string, unknown>;

  // Extract language and validate it's a valid LanguageCode
  const detectedLanguage = result.detected_language as string;
  const validLanguageCodes: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'zh', 'ur', 'pa'];
  const language: LanguageCode = validLanguageCodes.includes(detectedLanguage as LanguageCode)
    ? (detectedLanguage as LanguageCode)
    : 'en'; // Default to English if invalid

  // Remove detected_language from analysis (it's returned separately)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { detected_language, ...analysis } = result;

  console.log('[analyzeCompetitorAdWithLanguage] ✅ Analysis complete');
  console.log('[analyzeCompetitorAdWithLanguage] 🌍 Detected language:', language);

  return { analysis, language };
}

/**
 * Step 2: Generate prompts for our product (Second API call)
 *
 * If competitorDescription is provided, it will be used as a system prompt
 * to guide the generation in competitor reference mode.
 *
 * @param imageUrl - Our product image
 * @param competitorDescription - Optional competitor analysis from Step 1 (used as system prompt)
 */
async function generateImageBasedPrompts(
  imageUrl: string | undefined,
  language?: string,
  videoDurationSeconds?: number,
  userRequirements?: string,
  segmentCount = 1,
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string },
  competitorDescription?: Record<string, unknown> // Changed: Now receives analysis result, not raw context
): Promise<Record<string, unknown>> {
  console.log(`[generateImageBasedPrompts] Step 2: Generating prompts for our product${competitorDescription ? ' (competitor reference mode)' : ' (traditional mode)'}${!imageUrl ? ' (brand-only mode, no product image)' : ''}`);


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
      messages: competitorDescription
        ? // === COMPETITOR REFERENCE MODE (Step 2) ===
          // Use competitor analysis as system prompt
          [
            {
              role: 'system',
              content: `You are an expert advertisement creator. You have been provided with a detailed analysis of a competitor's advertisement.

**COMPETITOR ANALYSIS** (Veo Guide 8 Elements):
${JSON.stringify(competitorDescription, null, 2)}

Your task is to create a similar advertisement for OUR product${imageUrl ? ' (shown in the user\'s image)' : ''} by:
1. CLONING the competitor's creative structure, style, and approach
2. REPLACING the competitor's product with our product
3. MAINTAINING the same narrative flow, visual style, and tone
4. PRESERVING the camera work, composition, and ambiance

${imageUrl ? 'Remember: The user\'s image is OUR product - adapt the competitor\'s ad to showcase OUR product instead.' : 'Note: No product image provided - use brand context to adapt the competitor\'s ad.'}`
            },
            {
              role: 'user',
              content: imageUrl
                ? [
                    {
                      type: 'image_url',
                      image_url: { url: imageUrl }
                    },
                    {
                      type: 'text',
                      text: `📸 OUR PRODUCT IMAGE (above)

Based on the competitor analysis provided in the system message, generate an advertisement for OUR product.

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context:
${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}
(Use this to ensure accurate product replacement)` : ''}${userRequirements ? `\n\nUser Requirements:\n${userRequirements}\n\n(Apply these while maintaining the competitor's core structure)` : ''}

${segmentCount > 1 ? `Segment Plan Requirements:
- Output EXACTLY ${segmentCount} segment objects in the "segments" array
- Each segment: "segment_title", "segment_goal", "first_frame_prompt", "closing_frame_prompt"
- Keep style consistent across segments
- Define one narrator voice for the entire ad
` : ''}
Generate a JSON object with these elements:

**Product Classification (REQUIRED)**:
- product_category: "children_toy" | "adult_product" | "general"
- target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

**Core Concept (Veo Guide)**:
- subject: Main elements (from competitor, adapted to our product)
- context: Environment and setting (matching competitor)
- action: Action sequence (competitor structure + our product)

**Visual Style (Veo Guide)**:
- style: Visual style (from competitor)
- camera_type: Shot type (from competitor)
- camera_movement: Camera movement (from competitor)
- composition: Framing (from competitor)
- ambiance: Color, lighting, mood (from competitor)

**Standard Fields**:
- description: Scene description (competitor structure + our product)
- setting: Environment (from competitor)
- lighting: Lighting style (from competitor)
- dialogue: Voiceover (adapted from competitor, in English)
- music: Music style (from competitor)
- ending: Conclusion (competitor style + our product)
- other_details: Creative elements (from competitor)
- language: Language name for voiceover

**Full Description**:
- full_description: 200-500 word narrative for 60s+ videos

CRITICAL: Return ONE object. All text in English. Dialogue under ${dialogueWordLimit} words per segment.`
                    }
                  ]
                : [
                    {
                      type: 'text',
                      text: `Based on the competitor analysis provided in the system message, generate an advertisement for our brand/product.

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context:
${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}
(Use this context to create the advertisement)` : ''}${userRequirements ? `\n\nUser Requirements:\n${userRequirements}\n\n(Apply these while maintaining the competitor's core structure)` : ''}

${segmentCount > 1 ? `Segment Plan Requirements:
- Output EXACTLY ${segmentCount} segment objects in the "segments" array
- Each segment: "segment_title", "segment_goal", "first_frame_prompt", "closing_frame_prompt"
- Keep style consistent across segments
- Define one narrator voice for the entire ad
` : ''}
Generate a JSON object with these elements:

**Product Classification (REQUIRED)**:
- product_category: "children_toy" | "adult_product" | "general"
- target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

**Core Concept (Veo Guide)**:
- subject: Main elements (from competitor, adapted to our brand)
- context: Environment and setting (matching competitor)
- action: Action sequence (competitor structure + our brand)

**Visual Style (Veo Guide)**:
- style: Visual style (from competitor)
- camera_type: Shot type (from competitor)
- camera_movement: Camera movement (from competitor)
- composition: Framing (from competitor)
- ambiance: Color, lighting, mood (from competitor)

**Standard Fields**:
- description: Scene description (competitor structure + our brand)
- setting: Environment (from competitor)
- lighting: Lighting style (from competitor)
- dialogue: Voiceover (adapted from competitor, in English)
- music: Music style (from competitor)
- ending: Conclusion (competitor style + our brand)
- other_details: Creative elements (from competitor)
- language: Language name for voiceover

**Full Description**:
- full_description: 200-500 word narrative for 60s+ videos

CRITICAL: Return ONE object. All text in English. Dialogue under ${dialogueWordLimit} words per segment.`
                    }
                  ]
            }
          ]
        : // === TRADITIONAL AUTO-GENERATION MODE ===
          [
            {
              role: 'user',
              content: imageUrl
                ? [
                    {
                      type: 'image_url',
                      image_url: { url: imageUrl }
                    },
                    {
                      type: 'text',
                      text: `🤖 TRADITIONAL AUTO-GENERATION MODE

Analyze the product image and generate ONE creative video advertisement prompt.

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context:
${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}
IMPORTANT: Use this context to enhance the advertisement while staying true to the product visuals.
` : ''}${userRequirements ? `
User Requirements:
${userRequirements}

IMPORTANT: Incorporate these requirements into all aspects of the advertisement.
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
                : [
                    {
                      type: 'text',
                      text: `🤖 TRADITIONAL AUTO-GENERATION MODE (BRAND-ONLY)

Generate ONE creative video advertisement prompt based on the brand context provided.

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context:
${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}
IMPORTANT: Use this context to create the advertisement.
` : ''}${userRequirements ? `
User Requirements:
${userRequirements}

IMPORTANT: Incorporate these requirements into all aspects of the advertisement.
` : ''}

${segmentCount > 1 ? `Segment Plan Requirements:
- Output EXACTLY ${segmentCount} segment objects in the "segments" array
- Each segment needs its own "segment_title" and "segment_goal"
- "first_frame_prompt" should paint the exact still image that opens the segment
- "closing_frame_prompt" should describe the precise ending still image
- Keep style, camera, and lighting consistent
- **CRITICAL VOICE CONSISTENCY**: Define one narrator voice for the entire ad. Include "voice_type" and "voice_tone" ONLY in the FIRST segment.` : ''}

Generate a JSON object with these elements:

**Product Classification (REQUIRED)**:
- product_category: "children_toy" | "adult_product" | "general"
- target_audience: "babies (0-2)" | "children (3-12)" | "teens (13-17)" | "adults (18+)"

**Core Concept (Veo Guide)**:
- subject: Main elements and focal points in the advertisement
- context: Environment and setting suitable for the brand
- action: Brand-related scene or lifestyle demonstration

**Visual Style (Veo Guide)**:
- style: Overall visual style and artistic direction appropriate for brand
- camera_type: Cinematic shot type (e.g., "Medium shot", "Close-up")
- camera_movement: Dynamic camera movement (e.g., "Slow push-in", "Tracking shot")
- composition: Framing and shot composition style
- ambiance: Color palette, lighting mood, and atmosphere

**Standard Fields**:
- description: Main scene description${userRequirements ? ' based on user requirements' : ''}
- setting: Environment that suits the brand${userRequirements ? ' (consider user preferences)' : ''}
- lighting: Professional lighting setup
- dialogue: Natural voiceover content${userRequirements ? ', incorporating user messaging' : ''} (in English)
- music: Music style matching the brand mood${userRequirements ? ' and user preferences' : ''}
- ending: Natural ad conclusion
- other_details: Creative visual elements${userRequirements ? ', including user-specified elements' : ''}
- language: The language name for voiceover generation (e.g., "English", "Urdu", "Punjabi")

**Full Description**:
- full_description: A comprehensive 200-500 word narrative description for 60s+ video generation

CRITICAL: Return EXACTLY ONE advertisement prompt object.
CRITICAL: Keep each segment's dialogue under ${dialogueWordLimit} words.`
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

async function generateCover(
  imageUrl: string,
  prompts: Record<string, unknown>,
  request: StartWorkflowRequest,
  competitorDescription?: Record<string, unknown>
): Promise<string> {
  // Get the actual image model to use
  const actualImageModel = getActualImageModel(request.imageModel || 'auto');
  const kieModelName = IMAGE_MODELS[actualImageModel];

  // Build prompt that preserves original product appearance
  const baseDescription = prompts.description as string || "Professional product advertisement";

  // COMPETITOR REFERENCE MODE: Extract detailed scene elements
  let sceneReplicationSection = '';
  if (competitorDescription) {
    const sceneElements = competitorDescription.scene_elements as Array<{ element: string; position: string; details: string }> | undefined;
    const firstFrameComp = competitorDescription.first_frame_composition as string | undefined;

    if (sceneElements && sceneElements.length > 0) {
      const elementsList = sceneElements.map(el =>
        `- ${el.element} (${el.position}): ${el.details}`
      ).join('\n');

      sceneReplicationSection = `
🎯 SCENE REPLICATION MODE (CRITICAL - EXACT MATCH REQUIRED)

You are recreating a competitor's advertisement scene with our product. The scene must be IDENTICAL except for the product.

**SCENE ELEMENTS TO REPLICATE EXACTLY:**
${elementsList}

**SPATIAL LAYOUT (First Frame Composition):**
${firstFrameComp || 'Maintain original composition'}

**REPLICATION RULES:**
1. Every background element listed above MUST appear in the exact position
2. Colors, materials, and sizes must match the descriptions precisely
3. Lighting direction and quality must be identical
4. Only the product should be different - all scene elements stay the same
5. Think: "I'm placing our product into their exact scene"

`;
    }
  }

  // Create a prompt that explicitly instructs to maintain original product appearance
  let prompt = `IMPORTANT: Use the provided product image as the EXACT BASE. Maintain the original product's exact visual appearance, shape, design, colors, textures, and all distinctive features. DO NOT change the product itself.

${sceneReplicationSection}Based on the provided product image, create an enhanced advertising version that keeps the EXACT SAME product while only improving the presentation for marketing purposes. ${baseDescription}

Requirements:
- Keep the original product's exact shape, size, and proportions
- Maintain all original colors, textures, and materials
- Preserve all distinctive design features and details
${competitorDescription ? '- CRITICAL: Replicate the exact scene elements and spatial layout described above' : '- Only enhance lighting, background, or add subtle marketing elements'}
- The product must remain visually identical to the original`;

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

  // Ensure prompt doesn't exceed KIE API's 5000 character limit
  const MAX_PROMPT_LENGTH = KIE_PROMPT_LIMIT;
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
  }
  prompt = clampPromptLength(prompt);

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
  request: StartWorkflowRequest & { imageUrl?: string }, // UPDATED: Optional to support brand-only mode
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorDescription?: Record<string, unknown>, // Competitor analysis
  competitorShots?: CompetitorShot[],
  brandLogoUrl?: string | null, // NEW: Brand logo URL for brand shots
  productImageUrl?: string | null, // NEW: Product image URL for product shots
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string } // NEW: For text fallback
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const normalizedSegments = normalizeSegmentPrompts(prompts, segmentCount, competitorShots);
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
      product_description: prompts, // Store complete AI response with all structured fields (final prompt for our product)
      competitor_description: competitorDescription || null, // Store competitor analysis (Veo Guide 8 elements) if available
      segment_plan: { segments: normalizedSegments },
      current_step: 'generating_segment_frames',
      progress_percentage: 35,
      last_processed_at: now,
      segment_status: buildSegmentStatusPayload(segments)
    })
    .eq('id', projectId);

  for (const segment of segments) {
    const promptData = normalizedSegments[segment.segment_index];
    const aspectRatio = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';

    // Use smart frame generation with automatic routing
    const firstFrameTaskId = await createSmartSegmentFrame(
      promptData,
      segment.segment_index,
      'first',
      aspectRatio,
      brandLogoUrl || null,
      productImageUrl || null,
      productContext
    );

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

    if (segment.segment_index === normalizedSegments.length - 1) {
      // For non-children products, only the last segment gets a closing frame
      const closingFrameTaskId = await createSmartSegmentFrame(
        promptData,
        segment.segment_index,
        'closing',
        aspectRatio,
        brandLogoUrl || null,
        productImageUrl || null,
        productContext
      );

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

  await supabase
    .from('standard_ads_projects')
    .update({
      segment_status: buildSegmentStatusPayload(segments),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', projectId);
}

function normalizeSegmentPrompts(
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorShots?: CompetitorShot[]
): SegmentPrompt[] {
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
    const shot = competitorShots?.[index];
    const shotOverrides = shot ? buildSegmentOverridesFromShot(shot) : undefined;

    const normalizedSegment: SegmentPrompt = {
      ...basePrompt,
      ...source,
      ...(shotOverrides || {})
    };

    normalizedSegment.segment_title =
      shotOverrides?.segment_title || source.segment_title || `Segment ${index + 1}`;
    normalizedSegment.segment_goal =
      shotOverrides?.segment_goal || source.segment_goal || `Highlight product benefit ${index + 1}`;
    normalizedSegment.first_frame_prompt =
      shotOverrides?.first_frame_prompt || source.first_frame_prompt || source.description || basePrompt.description;
    normalizedSegment.closing_frame_prompt =
      shotOverrides?.closing_frame_prompt || source.closing_frame_prompt || source.ending || basePrompt.ending;
    normalizedSegment.voice_type = baseVoiceType;
    normalizedSegment.voice_tone = baseVoiceTone;

    normalized.push(normalizedSegment);
  }

  return normalized;
}

function buildSegmentOverridesFromShot(shot: CompetitorShot): Partial<SegmentPrompt> {
  const descriptionParts = [
    shot.generationGuidance,
    shot.action ? `Action focus: ${shot.action}` : '',
    shot.subject ? `Hero: ${shot.subject}` : '',
    shot.style ? `Style: ${shot.style}` : ''
  ].filter(Boolean);

  const overrides: Partial<SegmentPrompt> = {
    segment_title: `Shot ${shot.id} (${shot.startTime}–${shot.endTime})`,
    segment_goal: shot.narrativeGoal || `Mirror competitor beat ${shot.id}`,
    description: descriptionParts.join('. ').trim() || `Recreate shot ${shot.id}`,
    setting: shot.contextEnvironment || undefined,
    camera_type: shot.composition || undefined,
    camera_movement: shot.cameraMotionPositioning || undefined,
    action: shot.action || undefined,
    lighting: shot.ambianceColourLighting || undefined,
    music: shot.audio || undefined,
    ending: shot.narrativeGoal || undefined,
    first_frame_prompt: shot.firstFrameDescription || undefined,
    closing_frame_prompt: shot.generationGuidance || shot.action || undefined,
    contains_brand: shot.containsBrand, // NEW: Preserve brand flag
    contains_product: shot.containsProduct // NEW: Preserve product flag
  };

  const detailNotes = [
    shot.style ? `Match style: ${shot.style}` : '',
    shot.subject ? `Primary focus: ${shot.subject}` : '',
    `Target duration: ${shot.recommendedSegmentDuration || shot.durationSeconds}s`
  ].filter(Boolean);

  overrides.other_details = detailNotes.join('. ');

  return overrides;
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

/**
 * Generate frame from text prompt only (Text-to-Image)
 * Used for shots that don't contain brand or product (pure scene/lifestyle shots)
 */
async function createFrameFromText(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  brandContext?: { brand_name: string; brand_slogan: string; brand_details: string }
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';

  // Build prompt from shot description + brand context
  const brandInfo = brandContext && brandContext.brand_name
    ? `\n\nBrand Context:\n- Brand: ${brandContext.brand_name}\n- Slogan: ${brandContext.brand_slogan}\n- Details: ${brandContext.brand_details}`
    : '';

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

Scene Description:
- ${frameType === 'first' ? segmentPrompt.first_frame_prompt : segmentPrompt.closing_frame_prompt}

Creative Direction:
- Setting: ${segmentPrompt.setting}
- Camera: ${segmentPrompt.camera_type} with ${segmentPrompt.camera_movement}
- Action: ${segmentPrompt.action}
- Lighting: ${segmentPrompt.lighting}
- Style: Professional, high-quality commercial photography
- Composition: ${frameType === 'first' ? 'Strong opening frame that captures attention' : 'Smooth closing that transitions naturally'}${brandInfo}

Technical Requirements:
- No text overlays, no watermarks, no borders
- Photorealistic rendering
- Commercial-grade quality`;

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODELS.nano_banana_pro,
      input: {
        prompt,
        image_input: [], // Text-to-Image mode
        aspect_ratio: aspectRatio,
        resolution: '2K',
        output_format: 'png'
      }
    })
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Text-to-Image frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate frame from text');
  }

  return data.data.taskId;
}

/**
 * Generate frame from reference image (Image-to-Image)
 * Used for shots that contain brand logo or product
 */
async function createFrameFromImage(
  referenceImageUrl: string,
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  isBrandShot: boolean
): Promise<string> {
  const frameLabel = frameType === 'first' ? 'opening' : 'closing';

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

${isBrandShot
  ? 'Use the provided brand logo/asset as the canonical reference. Maintain identical brand styling, colors, and visual identity.'
  : 'Use the provided product image as the canonical reference. Maintain identical product proportions, textures, materials, and branding.'}

Scene Focus:
- Description: ${segmentPrompt.description}
- Setting: ${segmentPrompt.setting}
- Camera: ${segmentPrompt.camera_type} with ${segmentPrompt.camera_movement}
- Lighting: ${segmentPrompt.lighting}
- Maintain SCENE, LIGHTING, CAMERA ANGLE, and STYLE from original segment
- Create ${isBrandShot ? 'brand-focused' : 'product-focused'} keyframe that shows authentic use cases

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
      model: IMAGE_MODELS.nano_banana_pro,
      input: {
        prompt,
        image_input: [referenceImageUrl], // Image-to-Image mode
        aspect_ratio: aspectRatio,
        resolution: '2K',
        output_format: 'png'
      }
    })
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Image-to-Image frame generation failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate frame from image');
  }

  return data.data.taskId;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createSmartSegmentFrame instead
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createSegmentFrameTask(
  request: StartWorkflowRequest & { imageUrl: string },
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing'
): Promise<string> {
  // Default to product image for backward compatibility
  return createFrameFromImage(
    request.imageUrl,
    segmentPrompt,
    segmentIndex,
    frameType,
    request.videoAspectRatio === '9:16' ? '9:16' : '16:9',
    false
  );
}

/**
 * Smart segment frame generation with automatic routing
 * Decides between Text-to-Image, Brand Image-to-Image, or Product Image-to-Image
 * based on shot analysis flags (contains_brand, contains_product)
 */
export async function createSmartSegmentFrame(
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  brandLogoUrl: string | null,
  productImageUrl: string | null,
  brandContext?: { brand_name: string; brand_slogan: string; brand_details: string }
): Promise<string> {
  // Extract shot flags from competitor analysis
  const competitorShot = typeof segmentPrompt === 'object' && segmentPrompt !== null
    ? segmentPrompt as unknown as { contains_brand?: boolean; contains_product?: boolean }
    : undefined;

  const containsBrand = competitorShot?.contains_brand === true;
  const containsProduct = competitorShot?.contains_product === true;

  console.log(`🎬 Segment ${segmentIndex + 1} ${frameType} frame generation:`);
  console.log(`   - contains_brand: ${containsBrand}, brandLogoUrl: ${brandLogoUrl ? 'available' : 'missing'}`);
  console.log(`   - contains_product: ${containsProduct}, productImageUrl: ${productImageUrl ? 'available' : 'missing'}`);

  // Priority 1: Brand shots use brand logo (if available)
  if (containsBrand && brandLogoUrl) {
    console.log(`   ✅ Using Image-to-Image with brand logo`);
    return createFrameFromImage(
      brandLogoUrl,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      true // isBrandShot
    );
  }

  // Priority 2: Product shots use product image (if available)
  if (containsProduct && productImageUrl) {
    console.log(`   ✅ Using Image-to-Image with product image`);
    return createFrameFromImage(
      productImageUrl,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      false // isProductShot
    );
  }

  // Priority 3: Fallback to Text-to-Image for pure scene shots
  // OR when brand/product is flagged but no image available
  if (!containsBrand && !containsProduct) {
    console.log(`   ✅ Using Text-to-Image (pure scene shot)`);
  } else if (containsBrand && !brandLogoUrl) {
    console.warn(`   ⚠️  Brand shot detected but no logo available, falling back to Text-to-Image`);
  } else if (containsProduct && !productImageUrl) {
    console.warn(`   ⚠️  Product shot detected but no product image available, falling back to Text-to-Image`);
  }

  return createFrameFromText(
    segmentPrompt,
    segmentIndex,
    frameType,
    aspectRatio,
    brandContext
  );
}

export async function startSegmentVideoTask(
  project: SingleVideoProject,
  segmentPrompt: SegmentPrompt,
  firstFrameUrl: string,
  closingFrameUrl: string | null | undefined,
  segmentIndex: number,
  totalSegments: number
): Promise<string> {
  const videoModel = (project.video_model || 'veo3_fast') as 'veo3' | 'veo3_fast' | 'grok';

  if (videoModel !== 'veo3' && videoModel !== 'veo3_fast' && videoModel !== 'grok') {
    throw new Error(`Segmented workflow only supports Veo3 or Grok models. Received ${videoModel}`);
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

  // CRITICAL: Determine imageUrls based on whether closing frame exists
  // For children_toy products, closing_frame_url will be null → only pass first frame
  // generationType remains 'FIRST_AND_LAST_FRAMES_2_VIDEO' but with 1 or 2 images
  const hasClosingFrame = !!closingFrameUrl && closingFrameUrl !== firstFrameUrl;
  const imageUrls = hasClosingFrame ? [firstFrameUrl, closingFrameUrl] : [firstFrameUrl];

  console.log(`🎬 Segment ${segmentIndex + 1}: Images count = ${imageUrls.length} ${hasClosingFrame ? '(first + closing)' : '(first only)'}`);

  if (videoModel === 'grok') {
    const grokRequest = {
      model: 'grok-imagine/image-to-video',
      input: {
        image_urls: [firstFrameUrl],
        prompt: fullPrompt,
        mode: 'normal'
      }
    };

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(grokRequest)
    }, 5, 30000);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to generate Grok segment video: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to generate Grok segment video');
    }

    return data.data.taskId;
  }

  const requestBody = {
    prompt: fullPrompt,
    model: videoModel,
    aspectRatio,
    generationType: 'FIRST_AND_LAST_FRAMES_2_VIDEO',
    imageUrls,
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
