import { getSupabaseAdmin, type StandardAdsSegment, type SingleVideoProject } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  getActualImageModel,
  IMAGE_MODELS,
  getAutoModeSelection,
  getGenerationCost,
  getLanguagePromptName,
  getSegmentCountFromDuration,
  getReplicaPhotoCredits,
  snapDurationToModel,
  type LanguageCode,
  type VideoDuration
} from '@/lib/constants';
import { parseCompetitorTimeline, sumShotDurations, type CompetitorShot } from '@/lib/competitor-shots';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

async function retryAsync<T>(fn: () => Promise<T>, options?: { maxAttempts?: number; baseDelayMs?: number; label?: string }): Promise<T> {
  const attempts = options?.maxAttempts && options.maxAttempts > 0 ? options.maxAttempts : 3;
  const baseDelay = options?.baseDelayMs && options.baseDelayMs > 0 ? options.baseDelayMs : 300;
  const label = options?.label || 'retryAsync';
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`[${label}] Attempt ${attempt}/${attempts} failed:`, error);
      if (attempt >= attempts) break;
      await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed after ${attempts} attempts`);
}

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
  audio: string;
  style: string;
  action: string;
  subject: string;
  composition: string;
  context_environment: string;
  first_frame_description: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
  dialogue: string;
  language: string;
  index: number;
  contains_brand?: boolean; // Whether this segment/shot contains brand elements
  contains_product?: boolean; // Whether this segment/shot contains product
  description?: string;
  first_frame_image_size?: string;
};

type DerivedSegmentDetails = {
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
  language: string;
  first_frame_prompt: string;
};

const SEGMENT_DEFAULTS: DerivedSegmentDetails = {
  description: 'Cinematic hero moment highlighting the product',
  setting: 'Premium studio environment',
  camera_type: 'Wide cinematic shot',
  camera_movement: 'Slow push-in',
  action: 'Showcase the hero product in use',
  lighting: 'Soft commercial lighting with warm highlights',
  dialogue: 'Narrate the key benefit in a concise sentence',
  music: 'Tasteful cinematic underscore',
  ending: 'Hold on the hero product for a strong finish',
  other_details: 'Maintain polished advertising aesthetics and consistent color palette',
  language: 'English',
  first_frame_prompt: 'Hero product centered in frame with premium lighting'
};

const cleanSegmentText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function deriveSegmentDetails(segment: SegmentPrompt): DerivedSegmentDetails {
  const subject = cleanSegmentText(segment.subject);
  const action = cleanSegmentText(segment.action);
  const style = cleanSegmentText(segment.style);
  const descriptionParts = [
    action,
    subject ? `Hero focus: ${subject}` : undefined,
    style ? `Style: ${style}` : undefined
  ].filter(Boolean);

  const description = descriptionParts.join('. ') || SEGMENT_DEFAULTS.description;
  const setting = cleanSegmentText(segment.context_environment) || SEGMENT_DEFAULTS.setting;
  const cameraType = cleanSegmentText(segment.composition) || SEGMENT_DEFAULTS.camera_type;
  const cameraMovement = cleanSegmentText(segment.camera_motion_positioning) || SEGMENT_DEFAULTS.camera_movement;
  const lighting = cleanSegmentText(segment.ambiance_colour_lighting) || SEGMENT_DEFAULTS.lighting;
  const dialogue = cleanSegmentText(segment.dialogue) || SEGMENT_DEFAULTS.dialogue;
  const music = cleanSegmentText(segment.audio) || SEGMENT_DEFAULTS.music;
  const otherDetails = style ? `Visual style: ${style}` : SEGMENT_DEFAULTS.other_details;
  const firstFrame = cleanSegmentText(segment.first_frame_description) || description;

  return {
    description,
    setting,
    camera_type: cameraType,
    camera_movement: cameraMovement,
    action: action || SEGMENT_DEFAULTS.action,
    lighting,
    dialogue,
    music,
    ending: action || SEGMENT_DEFAULTS.ending,
    other_details: otherDetails,
    language: cleanSegmentText(segment.language) || SEGMENT_DEFAULTS.language,
    first_frame_prompt: firstFrame
  };
}

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
    errorMessage?: string | null;
  }>;
  mergedVideoUrl?: string | null;
}

export const SEGMENTED_DURATIONS = new Set(['16', '24', '32', '40', '48', '56', '64']);

function shouldForceSingleSegmentGrok(model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok', videoDuration?: string | null): boolean {
  if (model !== 'grok' || !videoDuration) return false;
  const duration = Number(videoDuration);
  if (!Number.isFinite(duration)) return false;
  return duration <= 6;
}

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

      const fetchBrand = async () => {
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
        if (brandError) throw brandError;
        return brand;
      };

      const brand = await retryAsync(fetchBrand, { maxAttempts: 3, baseDelayMs: 500, label: 'Brand fetch' });

      if (!brand) {
        console.error('Brand query failed after retries');
        return {
          success: false,
          error: 'Brand not found',
          details: 'Selected brand does not exist or does not belong to this user'
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
      const fetchCompetitor = async () => {
        const { data: competitorAd, error: competitorError } = await supabase
          .from('competitor_ads')
          .select('ad_file_url, file_type, competitor_name, analysis_result, analysis_status, language, video_duration_seconds')
          .eq('id', request.competitorAdId)
          .eq('user_id', request.userId)
          .single();
        if (competitorError) throw competitorError;
        return competitorAd;
      };

      try {
        const competitorAd = await retryAsync(fetchCompetitor, { maxAttempts: 3, baseDelayMs: 500, label: 'Competitor fetch' });

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
      } catch (competitorError) {
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

    if (competitorAdContext?.existing_analysis) {
      const timeline = parseCompetitorTimeline(
        competitorAdContext.existing_analysis as Record<string, unknown>,
        competitorAdContext.video_duration_seconds
      );
      if (timeline.shots.length > 0) {
        competitorShotTimeline = {
          shots: timeline.shots,
          totalDurationSeconds: timeline.videoDurationSeconds || sumShotDurations(timeline.shots)
        };

        // NEW: Recommend duration based on competitor shot count, but let user decide
        // If user hasn't chosen duration yet, recommend shot_count × segment_duration
        if (!request.videoDuration && (actualVideoModel === 'veo3' || actualVideoModel === 'veo3_fast' || actualVideoModel === 'grok')) {
          const segmentDuration = actualVideoModel === 'grok' ? 6 : 8;
          const recommendedDuration = competitorShotTimeline.shots.length * segmentDuration;

          console.log(`🎯 [SEGMENT DEBUG] Competitor shot analysis:`);
          console.log(`   - Model: ${actualVideoModel}`);
          console.log(`   - Competitor shots: ${competitorShotTimeline.shots.length}`);
          console.log(`   - Segment duration: ${segmentDuration}s per shot`);
          console.log(`   - Recommended duration: ${competitorShotTimeline.shots.length} × ${segmentDuration} = ${recommendedDuration}s`);

          const snappedDuration = snapDurationToModel(actualVideoModel, recommendedDuration);
          console.log(`   - Snapped duration: ${snappedDuration}s`);

          if (snappedDuration) {
            console.log(
              `💡 Final recommended video duration: ${snappedDuration}s (${competitorShotTimeline.shots.length} shots × ${segmentDuration}s per shot)`
            );
            request.videoDuration = snappedDuration;
          }
        }
      }
    }

    const forceSingleSegmentGrok = shouldForceSingleSegmentGrok(actualVideoModel, request.videoDuration);
    const segmentedByDuration = isSegmentedVideoRequest(actualVideoModel, request.videoDuration);
    const isSegmented = forceSingleSegmentGrok || segmentedByDuration;

    // NEW: Smart segment count calculation
    // Priority 1: If competitor shots exist and match user's segment count → use 1:1 mapping
    // Priority 2: Use user's chosen duration
    console.log(`🎯 [SEGMENT DEBUG] Calculating segment count:`);
    console.log(`   - Video model: ${actualVideoModel}`);
    console.log(`   - Video duration: ${request.videoDuration}`);
    console.log(`   - Is segmented: ${isSegmented}`);

    let segmentCount: number;
    const competitorShotCount = competitorShotTimeline?.shots.length || 0;
    const userSegmentCount = forceSingleSegmentGrok
      ? 1
      : segmentedByDuration
        ? getSegmentCountFromDuration(request.videoDuration, actualVideoModel)
        : 1;

    console.log(`   - Competitor shot count: ${competitorShotCount}`);
    console.log(`   - User segment count (from duration): ${userSegmentCount}`);

    if (competitorShotCount > 0 && userSegmentCount === competitorShotCount) {
      segmentCount = competitorShotCount;
      console.log(`✅ Perfect match: ${competitorShotCount} competitor shots = ${userSegmentCount} segments (1:1 mapping)`);
    } else {
      segmentCount = userSegmentCount;
      if (competitorShotCount > 0 && competitorShotCount !== userSegmentCount) {
        console.log(`⚠️ Mismatch: ${competitorShotCount} competitor shots ≠ ${userSegmentCount} segments. Using user's choice, AI will adapt.`);
      } else if (competitorShotCount === 0) {
        console.log(`ℹ️ No competitor shots, using segment count from duration: ${userSegmentCount}`);
      }
    }

    console.log(`🎬 [SEGMENT DEBUG] Final segment count: ${segmentCount}`);

    // Precompute shot-to-segment mapping asap so we can persist plans even if prompt generation fails later
    let shotPlanForSegments: CompetitorShot[] | undefined;
    let precomputedSegmentPlan: SegmentPrompt[] | undefined;
    if (segmentCount > 0 && competitorShotTimeline?.shots.length) {
      if (competitorShotTimeline.shots.length === segmentCount) {
        shotPlanForSegments = competitorShotTimeline.shots;
        console.log('📐 Prepared 1:1 competitor shot map for future recovery');
      } else {
        shotPlanForSegments = compressCompetitorShotsToSegments(competitorShotTimeline.shots, segmentCount);
        console.log(
          `📐 Prepared compressed competitor shot map (${competitorShotTimeline.shots.length} shots → ${segmentCount} segments)`
        );
      }

      precomputedSegmentPlan = buildSegmentPlanFromCompetitorShots(segmentCount, shotPlanForSegments);
    }

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
      const replicaResolution = request.photoResolution || '2K';
      generationCost = getReplicaPhotoCredits(replicaResolution);

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
          details: `Need ${generationCost} credits for replica photo mode (${replicaResolution}), have ${creditCheck.currentCredits || 0}`
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
        `Standard Ads - Replica photo generation (Nano Banana Pro, ${replicaResolution})`,
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

    if (precomputedSegmentPlan?.length === segmentCount) {
      const { error: planSeedError } = await supabase
        .from('standard_ads_projects')
        .update({ segment_plan: { segments: precomputedSegmentPlan } })
        .eq('id', project.id);
      if (planSeedError) {
        console.error('⚠️ Failed to seed segment plan with competitor timeline:', planSeedError);
      } else {
        console.log('💾 Seeded segment_plan with competitor timeline segments');
      }
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
            shotPlanForSegments
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
  initialShotPlan?: CompetitorShot[]
): Promise<void> {
  const supabase = getSupabaseAdmin();
  let shotPlanForSegments = initialShotPlan;

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
      if (competitorAdContext.existing_analysis) {
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
          const { analysis, language } = await analyzeCompetitorAdWithLanguage({
            file_url: competitorAdContext.file_url,
            file_type: competitorAdContext.file_type,
            competitor_name: competitorAdContext.competitor_name
          });
          competitorDescription = analysis;

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
                language: language,
                video_duration_seconds: timeline.videoDurationSeconds
              })
              .eq('id', competitorAdContext.id);
          }
        }
      } else {
        // No existing analysis or analysis failed/pending - perform fresh analysis
        const statusReason = !competitorAdContext.analysis_status
          ? 'no existing analysis found'
          : `status is ${competitorAdContext.analysis_status}`;

        console.log(`🔄 Performing fresh competitor analysis (${statusReason})...`);
        console.log('📺 Step 1: Analyzing competitor ad...');

        const { analysis, language } = await analyzeCompetitorAdWithLanguage({
          file_url: competitorAdContext.file_url,
          file_type: competitorAdContext.file_type,
          competitor_name: competitorAdContext.competitor_name
        });
        competitorDescription = analysis;

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
              language: language,
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
    const forceSingleSegment = shouldForceSingleSegmentGrok(request.resolvedVideoModel, request.videoDuration);
    const segmentedFlow = forceSingleSegment || isSegmentedVideoRequest(request.resolvedVideoModel, request.videoDuration);
    const segmentCount = segmentedFlow
      ? forceSingleSegment
        ? 1
        : getSegmentCountFromDuration(request.videoDuration, request.resolvedVideoModel)
      : 1;

    const { error: projectConfigUpdateError } = await supabase
      .from('standard_ads_projects')
      .update({
        video_duration: request.videoDuration || request.sora2ProDuration || null,
        is_segmented: segmentedFlow,
        segment_count: segmentedFlow ? segmentCount : 1,
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
    const primarySegmentPrompt = segmentCount === 1 ? normalizeSegmentPrompts(prompts, 1)[0] : undefined;
    const primarySegmentDetails = primarySegmentPrompt ? deriveSegmentDetails(primarySegmentPrompt) : undefined;

    if (!shotPlanForSegments && segmentedFlow && competitorTimelineShots && competitorTimelineShots.length > 0) {
      if (competitorTimelineShots.length === segmentCount) {
        shotPlanForSegments = competitorTimelineShots;
        console.log(`✅ Using 1:1 shot-to-segment mapping (${segmentCount} shots)`);
      } else {
        console.log(
          `🤖 Competitor has ${competitorTimelineShots.length} shots but user chose ${segmentCount} segments. Compressing timeline to preserve full narrative.`
        );
        shotPlanForSegments = compressCompetitorShotsToSegments(competitorTimelineShots, segmentCount);
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
        request.imageUrl ? [request.imageUrl] : null, // Provide initial product reference if available
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
    const coverTaskId = await generateCover(
      request.imageUrl,
      prompts,
      request,
      competitorDescription,
      competitorAdContext?.file_type,
      competitorAdContext?.file_type === 'image' ? competitorAdContext.file_url : undefined
    );
    console.log('🆔 Cover task ID:', coverTaskId);

    const finalCoverTaskId = coverTaskId;

    // Update project with cover task ID and prompts
    const updateData = {
      cover_task_id: finalCoverTaskId,
      video_prompts: prompts,
      image_prompt: primarySegmentDetails?.description || 'Product hero shot in premium environment',
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
    model: IMAGE_MODELS.nano_banana,
    input: {
      prompt,
      image_urls: referenceImages.slice(0, 10),
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
 * Analyze a competitor ad with automatic language detection.
 *
 * @param competitorAdContext - Competitor ad metadata including file URL and type
 * @returns Object with { analysis: {...}, language: 'en' }
 */
export async function analyzeCompetitorAdWithLanguage(
  competitorAdContext: { file_url: string; file_type: 'image' | 'video'; competitor_name?: string }
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
   - \`first_frame_description\` - Hyper-detailed 3-4 sentence description (minimum 45 words) of the opening frame, covering foreground, midground, background, lighting cues, and focal hierarchy. Mention left/center/right placement, props, wardrobe, and depth cues so another artist could recreate it perfectly.
   - \`subject\` - People, products, or hero objects featured
   - \`context_environment\` - Location, environment, and background details
   - \`action\` - What happens during the shot
   - \`style\` - Visual style or mood
   - \`camera_motion_positioning\` - Camera movement and framing
   - \`composition\` - Shot type/framing (close-up, medium, wide, etc.)
   - \`ambiance_colour_lighting\` - Lighting scheme, palette, and atmosphere
   - \`audio\` - Voiceover, dialogue, SFX, or music cues
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
  let responseText = '';
  try {
    responseText = await response.text();
    data = JSON.parse(responseText);
  } catch (error) {
    console.error('[analyzeCompetitorAdWithLanguage] JSON parse error:', error);
    if (typeof responseText === 'string' && responseText.includes('Request En')) {
      throw new Error(`Failed to parse competitor analysis response: Possible request body too large. OpenRouter returned: ${responseText.substring(0, 100)}...`);
    }
    throw new Error('Failed to parse competitor analysis response');
  }

  const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
  if (!apiResponse.choices?.[0]?.message?.content) {
    console.error('[analyzeCompetitorAdWithLanguage] Invalid API response structure:', data);
    throw new Error('Invalid competitor analysis response format');
  }

  const result = JSON.parse(apiResponse.choices[0].message.content) as Record<string, unknown>;

  // Extract language and validate it's a valid LanguageCode
  const rawDetectedLanguage = typeof result.detected_language === 'string' ? (result.detected_language as string) : undefined;
  const validLanguageCodes: LanguageCode[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'ru', 'el', 'tr', 'cs', 'ro', 'zh', 'ur', 'pa'];
  const language: LanguageCode = rawDetectedLanguage && validLanguageCodes.includes(rawDetectedLanguage as LanguageCode)
    ? (rawDetectedLanguage as LanguageCode)
    : 'en'; // Default to English if invalid
  const analysis = result as Record<string, unknown>;

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

  const segmentProperties: Record<string, unknown> = {
    audio: { type: "string", description: "Music or sound cue" },
    style: { type: "string", description: "Visual style for the shot" },
    action: { type: "string", description: "Exact moment to recreate" },
    subject: { type: "string", description: "Primary actors or objects" },
    composition: { type: "string", description: "Shot framing" },
    context_environment: { type: "string", description: "Location/environment context" },
    first_frame_description: { type: "string", description: "Detailed opening frame" },
    ambiance_colour_lighting: { type: "string", description: "Color and lighting mood" },
    camera_motion_positioning: { type: "string", description: "Camera motion and placement" },
    dialogue: { type: "string", description: "Voiceover/dialogue line" },
    language: { type: "string", description: "Language identifier" },
    index: { type: "integer", description: "1-indexed order of the shot" }
  };

  const segmentRequiredFields = [
    "audio",
    "style",
    "action",
    "subject",
    "composition",
    "context_environment",
    "first_frame_description",
    "ambiance_colour_lighting",
    "camera_motion_positioning",
    "dialogue",
    "language",
    "index"
  ];

  const segmentFieldList = '"audio", "style", "action", "subject", "composition", "context_environment", "first_frame_description", "ambiance_colour_lighting", "camera_motion_positioning", "dialogue", "language", "index"';

  const strictSegmentFormat = `Segment Output Requirements:
- Output EXACTLY ${segmentCount} segment objects inside the "segments" array.
- Each segment MUST include only: ${segmentFieldList}.
- Dialogue must stay under ${dialogueWordLimit} words and be natural.

Return JSON:
{
  "segments": [
    {
      "audio": string,
      "style": string,
      "action": string,
      "subject": string,
      "composition": string,
      "context_environment": string,
      "first_frame_description": string,
      "ambiance_colour_lighting": string,
      "camera_motion_positioning": string,
      "dialogue": string,
      "language": string,
      "index": number
    }
  ]
}

No other top-level keys or metadata. Do not include timing fields, summaries, or additional properties.`;

  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "shot_segment_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
          segments: {
            type: "array",
            description: `Final storyboard with EXACTLY ${segmentCount} segments`,
            minItems: segmentCount,
            maxItems: segmentCount,
            items: {
              type: "object",
              properties: segmentProperties,
              required: segmentRequiredFields,
              additionalProperties: false
            }
          }
        },
        required: ["segments"],
        additionalProperties: false
      }
    }
  } as const;

  // Define JSON schema for Structured Outputs - IMPORTANT: This must return a SINGLE object
  const requestPayload = JSON.stringify({
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
5. MATCH EVERY SHOT EXACTLY: number of segments, graphic title cards, text overlays, and the final brand sign-off must appear in the same order as the competitor. Do not drop or rearrange any shots.

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

Use the competitor analysis provided in the system message to recreate the same storyboard for OUR product. Replace logos, subjects, and props with our brand while keeping framing, movement, pacing, and energy identical.

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this to ensure accurate product replacement)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Apply without changing the competitor's creative structure)\n` : ''}

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `Recreate the competitor advertisement for our brand using ONLY the information provided in the system message.

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this context when replacing subjects or props)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Apply without inventing new structure)\n` : ''}

${strictSegmentFormat}`
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

Analyze the product image and build a storyboard that feels like a premium advertisement. Keep all details consistent with the supplied product photo (colors, proportions, packaging, materials) while enhancing the production value.

${productContext && (productContext.product_details || productContext.brand_name) ? `Product & Brand Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this context sparingly and only when it matches what you see in the photo)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Blend these ideas into the storyboard without inventing off-image assets)\n` : ''}

Focus on real visual cues from the image: product texture, use cases, target audience, and natural environments. Dialogue must describe the product or experience without adding slogans or pricing.

${strictSegmentFormat}`
                  }
                ]
              : [
                  {
                    type: 'text',
                    text: `🤖 TRADITIONAL AUTO-GENERATION MODE (BRAND-ONLY)

Use ONLY the brand/product context to imagine what the product looks like in the real world, then output a storyboard following the exact competitor-style schema.

${productContext && (productContext.product_details || productContext.brand_name) ? `Brand & Product Context:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}(Use this to inform the visuals you invent)\n` : ''}${userRequirements ? `\nUser Requirements:\n${userRequirements}\n(Blend these ideas directly into the storyboard)\n` : ''}

Every segment must feel grounded, cinematic, and ready for production. Mention props, environments, and characters explicitly.

${strictSegmentFormat}`
                  }
                ]
          }
        ]
  });

  const MAX_PROMPT_GENERATION_ATTEMPTS = 5;
  let lastPromptError: unknown;

  for (let attempt = 1; attempt <= MAX_PROMPT_GENERATION_ATTEMPTS; attempt++) {
    try {
      console.log(`[generateImageBasedPrompts] Attempt ${attempt}/${MAX_PROMPT_GENERATION_ATTEMPTS}`);

      const response = await fetchWithRetry(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: requestPayload
        },
        3,
        30000
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error('❌ OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          responseText: responseText.substring(0, 500)
        });
        throw new Error(`Prompt generation failed: ${response.status} - ${responseText}`);
      }

      console.log('✅ OpenRouter API response received:', {
        status: response.status,
        responseLength: responseText.length,
        preview: responseText.substring(0, 200)
      });

      let data: unknown;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse OpenRouter response as JSON:', parseError);
        console.error('Response text:', responseText.substring(0, 1000));
        throw new Error(`OpenRouter returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      const apiResponse = data as { choices?: Array<{ message?: { content?: string } }> };
      if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message || !apiResponse.choices[0].message.content) {
        console.error('❌ OpenRouter response missing expected structure:', data);
        throw new Error('OpenRouter response missing choices[0].message.content');
      }

      const content = apiResponse.choices[0].message.content;

      let parsed: Record<string, unknown>;

      try {
        const rawParsed = JSON.parse(content);

        if (Array.isArray(rawParsed)) {
          console.warn('⚠️ AI returned an array instead of single object, taking first element');
          parsed = rawParsed[0] || {};
        } else {
          parsed = rawParsed;
        }

        const segments = Array.isArray((parsed as { segments?: SegmentPrompt[] }).segments)
          ? ((parsed as { segments?: SegmentPrompt[] }).segments || [])
          : [];

        if (segments.length !== segmentCount) {
          throw new Error(`AI response returned ${segments.length} segments but ${segmentCount} were requested`);
        }

        segments.forEach((segment, index) => {
          const missingSegmentFields = segmentRequiredFields.filter(field => {
            const value = (segment as Record<string, unknown>)[field];
            return value === undefined || value === null;
          });

          if (missingSegmentFields.length > 0) {
            console.error(`❌ Segment ${index + 1} missing required fields:`, missingSegmentFields);
            throw new Error(`Segment ${index + 1} missing fields: ${missingSegmentFields.join(', ')}`);
          }
        });

        parsed = { segments };

        console.log('✅ Structured output parsed successfully with all required fields');
      } catch (parseError) {
        console.error(`[generateImageBasedPrompts] Failed to parse structured output on attempt ${attempt}:`, parseError);
        console.error('[generateImageBasedPrompts] Content received (truncated):', typeof content === 'string' ? content.substring(0, 1000) : content);
        throw parseError instanceof Error ? parseError : new Error(String(parseError));
      }

      return parsed;
    } catch (error) {
      lastPromptError = error;
      console.error(`[generateImageBasedPrompts] Attempt ${attempt} failed:`, error);
      if (attempt < MAX_PROMPT_GENERATION_ATTEMPTS) {
        const backoffMs = attempt * 2000;
        console.log(`[generateImageBasedPrompts] Retrying prompt generation in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw new Error(
    `Prompt generation failed after ${MAX_PROMPT_GENERATION_ATTEMPTS} attempts${
      lastPromptError instanceof Error ? `: ${lastPromptError.message}` : ''
    }`
  );
}

async function generateCover(
  imageUrl: string,
  prompts: Record<string, unknown>,
  request: StartWorkflowRequest,
  competitorDescription?: Record<string, unknown>,
  competitorFileType?: 'image' | 'video',
  competitorImageUrl?: string
): Promise<string> {
  // Get the actual image model to use
  // CRITICAL: When using competitor reference mode, always upgrade to nano_banana_pro per docs/kie/nano_banana_pro.md
  let actualImageModel: 'nano_banana' | 'seedream' | 'nano_banana_pro';
  const hasCompetitorPhotoReference = Boolean(competitorFileType === 'image' && competitorImageUrl);
  const isCompetitorReferenceMode = Boolean(competitorDescription || hasCompetitorPhotoReference);

  if (isCompetitorReferenceMode) {
    console.log(`📎 Competitor ${competitorFileType} detected → Using nano_banana_pro (docs/kie/nano_banana_pro.md)`);
    actualImageModel = 'nano_banana_pro';
  } else {
    // Normal mode: use user's selection or auto mode
    actualImageModel = getActualImageModel(request.imageModel || 'auto');
  }

  const kieModelName = IMAGE_MODELS[actualImageModel];
  const [primarySegment] = normalizeSegmentPrompts(prompts, 1);
  const primarySegmentDetails = primarySegment ? deriveSegmentDetails(primarySegment) : undefined;

  // Build prompt that preserves original product appearance
  const baseDescription = primarySegmentDetails?.description || primarySegmentDetails?.first_frame_prompt || 'Professional product advertisement';

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
  if (!competitorDescription && hasCompetitorPhotoReference) {
    sceneReplicationSection = `
📷 COMPETITOR PHOTO REPLICATION

You are provided TWO reference images:
- Reference 1: Competitor advertisement photo. This shows the exact background, lighting, pose, props, and camera framing you must COPY.
- Reference 2: Our actual product photo. This shows the exact product you must insert into the replicated scene.

Rules:
1. Copy the entire composition, perspective, lighting, and styling from reference image 1.
2. Replace ONLY the competitor's product with the product from reference image 2.
3. Keep every background prop, surface, and material identical to reference image 1.
4. Maintain the same camera angle, crop, and aspect ratio from reference image 1.
5. The product appearance must match reference image 2 exactly (shape, color, branding).`;
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
  const providedAdCopy = request.adCopy?.trim() || '';
  
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
  const referenceImages = hasCompetitorPhotoReference
    ? [competitorImageUrl!, imageUrl]
    : [imageUrl];
  const inputPayload: Record<string, unknown> = {
    prompt,
    image_urls: referenceImages,
    output_format: "png"
  };

  if (actualImageModel === 'nano_banana_pro') {
    inputPayload.aspect_ratio = targetAspectRatio;
    inputPayload.resolution = '1K';
  } else {
    inputPayload.image_size = targetAspectRatio;
  }

  const requestBody = {
    model: kieModelName,
    input: inputPayload
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
  productImageUrls?: string[] | null, // UPDATED: Multiple product image URLs for product shots
  productContext?: { product_details: string; brand_name: string; brand_slogan: string; brand_details: string } // NEW: For text fallback
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const defaultFrameSize = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const normalizedSegments = normalizeSegmentPrompts(prompts, segmentCount, competitorShots).map(segment => ({
    ...segment,
    first_frame_image_size: segment.first_frame_image_size || defaultFrameSize
  }));
  const now = new Date().toISOString();

  // Clear any previous segment rows for this project to avoid unique key conflicts when restarting workflows
  const { error: cleanupError } = await supabase
    .from('standard_ads_segments')
    .delete()
    .eq('project_id', projectId);
  if (cleanupError) {
    console.error('Failed to clean up existing segments before re-initializing:', cleanupError);
    throw new Error('Failed to reset previous segments');
  }

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
      productImageUrls || null,
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
        productImageUrls || null,
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

export function normalizeSegmentPrompts(
  prompts: Record<string, unknown>,
  segmentCount: number,
  competitorShots?: CompetitorShot[]
): SegmentPrompt[] {
  type LooseSegment = Partial<SegmentPrompt> & Record<string, unknown>;

  const rawSegments = Array.isArray((prompts as { segments?: LooseSegment[] }).segments)
    ? ((prompts as { segments?: LooseSegment[] }).segments || [])
    : [];

  const normalized: SegmentPrompt[] = [];

  for (let index = 0; index < segmentCount; index++) {
    const source = (rawSegments[index] || rawSegments[rawSegments.length - 1] || {}) as LooseSegment;
    const shot = competitorShots?.[index];
    const shotOverrides = shot ? buildSegmentOverridesFromShot(shot) : undefined;

    const segment: SegmentPrompt = {
      audio: cleanSegmentText(source.audio) ?? '',
      style: cleanSegmentText(source.style) ?? '',
      action: cleanSegmentText(source.action) ?? '',
      subject: cleanSegmentText(source.subject) ?? '',
      composition: cleanSegmentText(source.composition) ?? '',
      context_environment: cleanSegmentText(source.context_environment) ?? '',
      first_frame_description: cleanSegmentText(source.first_frame_description) ?? '',
      ambiance_colour_lighting: cleanSegmentText(source.ambiance_colour_lighting) ?? '',
      camera_motion_positioning: cleanSegmentText(source.camera_motion_positioning) ?? '',
      dialogue: cleanSegmentText(source.dialogue) ?? '',
      language: cleanSegmentText(source.language) ?? 'en',
      index:
        typeof source.index === 'number'
          ? source.index
          : typeof shotOverrides?.index === 'number'
            ? shotOverrides.index
            : index + 1,
      contains_brand: typeof source.contains_brand === 'boolean'
        ? source.contains_brand
        : shotOverrides?.contains_brand,
      contains_product: typeof source.contains_product === 'boolean'
        ? source.contains_product
        : shotOverrides?.contains_product,
      first_frame_image_size: source.first_frame_image_size
    };

    normalized.push(segment);
  }

  return normalized;
}

function compressCompetitorShotsToSegments(shots: CompetitorShot[], segmentCount: number): CompetitorShot[] {
  if (segmentCount <= 0 || shots.length === 0) {
    return [];
  }

  if (segmentCount === shots.length) {
    return shots;
  }

  const buckets: CompetitorShot[][] = Array.from({ length: segmentCount }, () => []);
  const totalShots = shots.length;

  for (let i = 0; i < segmentCount; i++) {
    const startRatio = i / segmentCount;
    const endRatio = (i + 1) / segmentCount;
    const startIndex = Math.floor(startRatio * totalShots);
    const endIndex = Math.max(startIndex + 1, Math.floor(endRatio * totalShots));
    let slice = shots.slice(startIndex, Math.min(endIndex, totalShots));

    if (slice.length === 0) {
      const fallbackIndex = Math.min(startIndex, totalShots - 1);
      slice = [shots[Math.max(0, fallbackIndex)]];
    }

    buckets[i] = slice;
  }

  return buckets.map((group, index) => mergeShotGroup(group, index));
}

function mergeShotGroup(shots: CompetitorShot[], segmentIndex: number): CompetitorShot {
  const first = shots[0];
  const last = shots[shots.length - 1] || first;

  const joinText = (values: Array<string | undefined>) => {
    const sanitized = values
      .map(value => (value || '').trim())
      .filter(Boolean);
    if (sanitized.length === 0) return '';
    // Use sentence-like spacing when combining multiple clips
    return sanitized.join('\n\n');
  };

  const durationSeconds = Math.max(
    1,
    Math.round((last.endTimeSeconds ?? 0) - (first.startTimeSeconds ?? 0)) || shots.reduce((sum, shot) => sum + (shot.durationSeconds || 0), 0)
  );

  return {
    id: segmentIndex + 1,
    startTime: first.startTime,
    endTime: last.endTime,
    durationSeconds,
    firstFrameDescription: joinText(shots.map(shot => shot.firstFrameDescription)),
    subject: joinText(shots.map(shot => shot.subject)),
    contextEnvironment: joinText(shots.map(shot => shot.contextEnvironment)),
    action: joinText(shots.map(shot => shot.action)),
    style: joinText(shots.map(shot => shot.style)),
    cameraMotionPositioning: joinText(shots.map(shot => shot.cameraMotionPositioning)),
    composition: joinText(shots.map(shot => shot.composition)),
    ambianceColourLighting: joinText(shots.map(shot => shot.ambianceColourLighting)),
    audio: joinText(shots.map(shot => shot.audio)),
    startTimeSeconds: first.startTimeSeconds,
    endTimeSeconds: last.endTimeSeconds,
    containsBrand: shots.some(shot => shot.containsBrand),
    containsProduct: shots.some(shot => shot.containsProduct)
  };
}

function resolveFrameDescription(segmentPrompt: SegmentPrompt, frameType: 'first' | 'closing'): string {
  const derived = deriveSegmentDetails(segmentPrompt);
  if (frameType === 'first') {
    return derived.first_frame_prompt || derived.description;
  }
  return derived.ending || derived.description;
}

function buildSegmentOverridesFromShot(shot: CompetitorShot): Partial<SegmentPrompt> {
  return {
    index: shot.id,
    contains_brand: shot.containsBrand,
    contains_product: shot.containsProduct
  };
}

export function buildSegmentPlanFromCompetitorShots(segmentCount: number, competitorShots: CompetitorShot[]): SegmentPrompt[] {
  if (segmentCount <= 0 || competitorShots.length === 0) {
    return [];
  }

  const effectiveShots = segmentCount === competitorShots.length
    ? competitorShots
    : compressCompetitorShotsToSegments(competitorShots, segmentCount);

  const placeholderPrompts = {
    segments: Array.from({ length: segmentCount }, (_, index) => ({ index: index + 1 }))
  } as { segments: Array<Partial<SegmentPrompt>> };

  return normalizeSegmentPrompts(placeholderPrompts, segmentCount, effectiveShots);
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
      videoUrl: seg.video_url,
      errorMessage: (seg as { error_message?: string | null }).error_message || null
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
  const derived = deriveSegmentDetails(segmentPrompt);
  const imageModel = 'google/nano-banana';

  // Build prompt from shot description + brand context
  const brandInfo = brandContext && brandContext.brand_name
    ? `\n\nBrand Context:\n- Brand: ${brandContext.brand_name}\n- Slogan: ${brandContext.brand_slogan}\n- Details: ${brandContext.brand_details}`
    : '';

  const frameDescription = resolveFrameDescription(segmentPrompt, frameType);

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

Scene Description:
- ${frameDescription}

Creative Direction:
- Setting: ${derived.setting}
- Camera: ${derived.camera_type} with ${derived.camera_movement}
- Action: ${derived.action}
- Lighting: ${derived.lighting}
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
      model: imageModel,
      input: {
        prompt,
        image_size: aspectRatio,
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
type FrameGenerationOverrides = {
  imageModelOverride?: 'nano_banana' | 'seedream' | 'nano_banana_pro';
  imageSizeOverride?: string;
  resolutionOverride?: '1K' | '2K' | '4K';
};

async function createFrameFromImage(
  referenceImageUrls: string[],
  segmentPrompt: SegmentPrompt,
  segmentIndex: number,
  frameType: 'first' | 'closing',
  aspectRatio: '16:9' | '9:16',
  isBrandShot: boolean,
  competitorFileType?: 'video' | 'image' | null,
  overrides?: FrameGenerationOverrides
): Promise<string> {
  const sanitizedReferences = (referenceImageUrls || []).filter(Boolean);
  if (sanitizedReferences.length === 0) {
    throw new Error('No reference images provided for frame generation');
  }
  const limitedReferences = sanitizedReferences.slice(0, 10);

  const frameLabel = frameType === 'first' ? 'opening' : 'closing';
  const derived = deriveSegmentDetails(segmentPrompt);

  // CRITICAL: Competitor reference defaults to nano_banana_pro, but overrides can force a specific model (e.g., docs/kie/nano_banana.md for manual edits)
  let imageModelKey: 'nano_banana' | 'seedream' | 'nano_banana_pro';
  if (overrides?.imageModelOverride) {
    imageModelKey = overrides.imageModelOverride;
    console.log(`🎛️ Frame override → Using ${imageModelKey} (manual override)`);
  } else if (competitorFileType) {
    console.log(`📎 Competitor ${competitorFileType} detected → Using nano_banana_pro (docs/kie/nano_banana_pro.md)`);
    imageModelKey = 'nano_banana_pro';
  } else {
    console.log('🎬 No competitor reference → Using nano_banana (google/nano-banana-edit)');
    imageModelKey = 'nano_banana';
  }
  const imageModel = IMAGE_MODELS[imageModelKey];
  const resolvedAspectRatio = overrides?.imageSizeOverride || aspectRatio;
  const resolvedResolution = overrides?.resolutionOverride || (imageModelKey === 'nano_banana_pro' ? '1K' : undefined);

  const frameDescription = resolveFrameDescription(segmentPrompt, frameType);

  const prompt = `Segment ${segmentIndex + 1} ${frameLabel} frame for a premium advertisement.

${isBrandShot
  ? 'Use the provided brand logo/asset as the canonical reference. Maintain identical brand styling, colors, and visual identity.'
  : 'Use the provided product image as the canonical reference. Maintain identical product proportions, textures, materials, and branding.'}

Scene Focus:
- Description: ${frameDescription}
- Setting: ${derived.setting}
- Camera: ${derived.camera_type} with ${derived.camera_movement}
- Lighting: ${derived.lighting}
- Maintain SCENE, LIGHTING, CAMERA ANGLE, and STYLE from original segment
- Create ${isBrandShot ? 'brand-focused' : 'product-focused'} keyframe that shows authentic use cases

Render Instructions:
- ${frameDescription}
- Ensure composition seamlessly transitions ${frameType === 'first' ? 'into the upcoming motion clip' : 'out of the prior scene'}
- No text overlays, no watermarks, no borders`;

  const inputPayload: Record<string, unknown> = {
    prompt,
    image_urls: limitedReferences,
    image_input: limitedReferences,
    output_format: 'png'
  };

  if (imageModelKey === 'nano_banana_pro') {
    inputPayload.aspect_ratio = resolvedAspectRatio;
    inputPayload.resolution = resolvedResolution || '1K';
  } else {
    inputPayload.image_size = resolvedAspectRatio;
  }

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: imageModel,
      input: inputPayload
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
    [request.imageUrl],
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
  productImageUrls: string[] | null,
  brandContext?: { brand_name: string; brand_slogan: string; brand_details: string },
  competitorFileType?: 'video' | 'image' | null,
  overrides?: FrameGenerationOverrides
): Promise<string> {
  const containsBrand = segmentPrompt.contains_brand === true;
  const containsProduct = segmentPrompt.contains_product === true;
  const normalizedProductImages = Array.isArray(productImageUrls)
    ? productImageUrls.filter(url => typeof url === 'string' && url.length > 0)
    : [];

  console.log(`🎬 Segment ${segmentIndex + 1} ${frameType} frame generation:`);
  console.log(`   - contains_brand: ${containsBrand}, brandLogoUrl: ${brandLogoUrl ? 'available' : 'missing'}`);
  console.log(`   - contains_product: ${containsProduct}, productImageRefs: ${normalizedProductImages.length}`);

  // Priority 1: Brand shots use brand logo (if available)
  if (containsBrand && brandLogoUrl) {
    console.log(`   ✅ Using Image-to-Image with brand logo`);
    return createFrameFromImage(
      [brandLogoUrl],
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      true, // isBrandShot
      competitorFileType,
      overrides
    );
  }

  // Priority 2: Product shots use product image (if available)
  if (containsProduct && normalizedProductImages.length > 0) {
    console.log(`   ✅ Using Image-to-Image with product image`);
    return createFrameFromImage(
      normalizedProductImages,
      segmentPrompt,
      segmentIndex,
      frameType,
      aspectRatio,
      false, // isProductShot
      competitorFileType,
      overrides
    );
  }

  // Priority 3: Fallback to Text-to-Image for pure scene shots
  // OR when brand/product is flagged but no image available
  if (!containsBrand && !containsProduct) {
    console.log(`   ✅ Using Text-to-Image (pure scene shot)`);
  } else if (containsBrand && !brandLogoUrl) {
    console.warn(`   ⚠️  Brand shot detected but no logo available, falling back to Text-to-Image`);
  } else if (containsProduct && normalizedProductImages.length === 0) {
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
  const description = cleanSegmentText(segmentPrompt.description) || cleanSegmentText(segmentPrompt.first_frame_description) || '';
  const setting = cleanSegmentText(segmentPrompt.context_environment) || '';
  const cameraType = cleanSegmentText(segmentPrompt.composition) || '';
  const cameraMovement = cleanSegmentText(segmentPrompt.camera_motion_positioning) || '';
  const action = cleanSegmentText(segmentPrompt.action) || '';
  const lighting = cleanSegmentText(segmentPrompt.ambiance_colour_lighting) || '';
  const dialogueContent = providedAdCopy || segmentPrompt.dialogue || '';
  const music = cleanSegmentText(segmentPrompt.audio) || '';
  const ending = cleanSegmentText(segmentPrompt.action) || '';
  const otherDetails = segmentPrompt.style ? `Style: ${segmentPrompt.style}` : '';

  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  const voiceDescriptor = 'Calm professional narrator';
  const voiceToneDescriptor = 'warm and confident';

  const fullPrompt = `${languagePrefix}${description}

Setting: ${setting}
Camera: ${cameraType} with ${cameraMovement}
Action: ${action}
Lighting: ${lighting}
Dialogue: ${dialogueContent}
Music: ${music}
Ending: ${ending}
Other details: ${otherDetails}
Voice: This is segment ${segmentIndex + 1} of ${totalSegments}. Use the exact same narrator voice across all segments — ${voiceDescriptor} with a ${voiceToneDescriptor} tone. Match timbre, accent, gender, pacing, and energy perfectly so the audience cannot tell the clips were generated separately.`;

  // Determine imageUrls based on whether a closing frame exists
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
