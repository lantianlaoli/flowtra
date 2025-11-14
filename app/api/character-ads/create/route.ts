import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/supabase';
import { CREDIT_COSTS, getActualModel, getActualImageModel, getCreditCost, getSora2ProCreditCost } from '@/lib/constants';
import { validateKieCredits } from '@/lib/kie-credits-check';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    console.log('Character ads create API called');
    
    // Check KIE credits before processing
    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }
    const formData = await request.formData();
    console.log('FormData entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `File: ${value.name}` : value]));

    // Extract form data
    const userId = formData.get('user_id') as string;
    const videoDurationSeconds = parseInt(formData.get('video_duration_seconds') as string);
    const imageModel = formData.get('image_model') as string;
    const imageSize = formData.get('image_size') as string;
    const videoModel = formData.get('video_model') as string;
    const accent = formData.get('accent') as string;
    const customDialogue = (formData.get('custom_dialogue') as string) || '';
    const videoAspectRatio = (formData.get('video_aspect_ratio') as '16:9' | '9:16') || '16:9';
    const selectedPersonPhotoUrl = formData.get('selected_person_photo_url') as string;
    const selectedProductId = formData.get('selected_product_id') as string;
    const language = (formData.get('language') as string) || 'en';

    console.log('Extracted form data:', { userId, videoDurationSeconds, imageModel, imageSize, videoModel, accent, videoAspectRatio, selectedPersonPhotoUrl, selectedProductId });

    if (!userId || !videoDurationSeconds || !imageModel || !videoModel || !accent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate video duration
    if (![8, 10, 16, 20, 24, 30].includes(videoDurationSeconds)) {
      return NextResponse.json(
        { error: 'Invalid video duration. Must be 8, 10, 16, 20, 24, or 30 seconds' },
        { status: 400 }
      );
    }

    // Validate models and accent
    const validImageModels = ['auto', 'nano_banana', 'seedream'];
    const validVideoModels = ['auto', 'veo3', 'veo3_fast', 'sora2', 'sora2_pro'];
    const validAccents = [
      'american', 'canadian', 'british', 'irish', 'scottish',
      'australian', 'new_zealand', 'indian', 'singaporean', 'filipino',
      'south_african', 'nigerian', 'kenyan', 'latin_american'
    ];

    if (!validImageModels.includes(imageModel)) {
      return NextResponse.json(
        { error: 'Invalid image model' },
        { status: 400 }
      );
    }

    if (!validVideoModels.includes(videoModel)) {
      return NextResponse.json(
        { error: 'Invalid video model' },
        { status: 400 }
      );
    }

    // Enforce model-duration compatibility
    const isSora2Duration = [10, 20, 30].includes(videoDurationSeconds);
    if (isSora2Duration && videoModel !== 'sora2' && videoModel !== 'auto') {
      return NextResponse.json(
        { error: 'For 10s/20s/30s duration, video model must be Sora2' },
        { status: 400 }
      );
    }
    if (!isSora2Duration && videoModel === 'sora2') {
      return NextResponse.json(
        { error: 'Sora2 supports 10s/20s/30s durations only' },
        { status: 400 }
      );
    }

    if (!validAccents.includes(accent)) {
      return NextResponse.json(
        { error: 'Invalid accent' },
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
    // Collect product context for AI prompt (future enhancement - not yet integrated into workflow)
    // const productContext = { product_details: '', brand_name: '', brand_slogan: '', brand_details: '' };

    if (selectedProductId) {
      // Check if it's a temporary product (starts with "temp:")
      if (selectedProductId.startsWith('temp:')) {
        // Extract URL from temp format: "temp: URL"
        const tempUrl = selectedProductId.replace(/^temp:\s*`?([^`]+)`?$/, '$1').trim();
        console.log('Using temporary product URL:', tempUrl);
        productImageUrls.push(tempUrl);
      } else {
        // Get product with brand information from database
        const supabase = getSupabaseAdmin();
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

        // Store product and brand context for AI prompt (future enhancement - not yet integrated into workflow)
        // productContext = {
        //   product_details: product.product_details || '',
        //   brand_name: product.brand?.brand_name || '',
        //   brand_slogan: product.brand?.brand_slogan || '',
        //   brand_details: product.brand?.brand_details || ''
        // };
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

    if (productImageUrls.length === 0 && productFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one product image is required' },
        { status: 400 }
      );
    }

    // Upload person images to Supabase if we have files
    for (let i = 0; i < personFiles.length; i++) {
      const file = personFiles[i];
      const fileName = `character-ads/person/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName);
      personImageUrls.push(uploadResult.publicUrl);
    }

    // Upload product images to Supabase if we have files
    for (let i = 0; i < productFiles.length; i++) {
      const file = productFiles[i];
      const fileName = `character-ads/product/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName);
      productImageUrls.push(uploadResult.publicUrl);
    }

    // Convert 'auto' values to actual models using constants
    const actualImageModel = getActualImageModel(imageModel as 'auto' | 'nano_banana' | 'seedream');
    // Determine video model with duration constraints
    let resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
    if (isSora2Duration) {
      resolvedVideoModel = videoModel === 'sora2_pro' ? 'sora2_pro' : 'sora2';
    } else {
      const actualVideoModel = getActualModel(videoModel as 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro', 1000) || (videoModel === 'auto' ? 'veo3_fast' : (videoModel as 'veo3' | 'veo3_fast' | 'sora2_pro'));
      // Guard against sora2/sora2_pro sneaking in for 8/16/24
      resolvedVideoModel = (actualVideoModel === 'sora2' || actualVideoModel === 'sora2_pro') ? 'veo3_fast' : actualVideoModel;
    }
    
    // Calculate credits cost using constants (use actual model for cost calculation)
    const imageCredits = 0; // Image generation is free according to constants
    const sceneUnitSeconds = (resolvedVideoModel === 'sora2' || resolvedVideoModel === 'sora2_pro') ? 10 : 8;
    const videoScenes = videoDurationSeconds / sceneUnitSeconds;

    let videoCreditsPerScene: number;
    if (resolvedVideoModel === 'sora2_pro') {
      // For Sora2 Pro, we need duration and quality params (use defaults for character ads)
      const sora2ProDuration = videoDurationSeconds === 10 ? '10' : '15';
      const sora2ProQuality = 'standard'; // Default for character ads
      videoCreditsPerScene = getSora2ProCreditCost(sora2ProDuration, sora2ProQuality);
    } else {
      videoCreditsPerScene = CREDIT_COSTS[resolvedVideoModel];
    }

    const totalCredits = imageCredits + (videoScenes * videoCreditsPerScene);

    // VEO3 prepaid credit deduction
    let generationCreditsUsed = 0;
    if (resolvedVideoModel === 'veo3') {
      const veo3CostPerScene = getCreditCost('veo3'); // 150 credits per scene
      const totalVeo3Cost = veo3CostPerScene * videoScenes;

      // Check if user has enough credits
      const creditCheck = await checkCredits(userId, totalVeo3Cost);
      if (!creditCheck.success) {
        return NextResponse.json(
          {
            error: 'Failed to check credits',
            details: creditCheck.error || 'Credit check failed'
          },
          { status: 500 }
        );
      }

      if (!creditCheck.hasEnoughCredits) {
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            details: `Need ${totalVeo3Cost} credits for ${videoScenes} VEO3 High Quality scene(s), have ${creditCheck.currentCredits || 0}`
          },
          { status: 400 }
        );
      }

      // Deduct credits upfront
      const deductResult = await deductCredits(userId, totalVeo3Cost);
      if (!deductResult.success) {
        return NextResponse.json(
          {
            error: 'Failed to deduct credits',
            details: deductResult.error || 'Credit deduction failed'
          },
          { status: 500 }
        );
      }

      // Record the transaction
      await recordCreditTransaction(
        userId,
        'usage',
        totalVeo3Cost,
        `Character ads - ${videoScenes}x VEO3 High Quality scenes (prepaid)`,
        undefined,
        true
      );

      generationCreditsUsed = totalVeo3Cost;
    }

    // Create project in database
    const supabase = getSupabaseAdmin();
    const { data: project, error: insertError } = await supabase
      .from('character_ads_projects')
      .insert({
        user_id: userId,
        person_image_urls: personImageUrls,
        product_image_urls: productImageUrls,
        video_duration_seconds: videoDurationSeconds,
        image_model: actualImageModel,
        image_size: imageSize,
        video_model: resolvedVideoModel,
        video_aspect_ratio: videoAspectRatio,
        accent: accent,
        custom_dialogue: customDialogue || null,
        language: language, // Language for AI-generated content
        credits_cost: totalCredits,
        generation_credits_used: generationCreditsUsed,
        status: 'pending',
        current_step: 'analyzing_images',
        progress_percentage: 0,
      })
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
          'Refund for failed character ads project creation',
          undefined,
          true
        );
      }
      return NextResponse.json(
        { error: 'Failed to create project in database' },
        { status: 500 }
      );
    }

    // No longer recording events to character_ads_project_events table

    // Start the workflow in background (fire-and-forget for instant UX)
    // Wrap in IIFE to ensure error handling is reliable
    (async () => {
      try {
        const response = await fetch(`${request.nextUrl.origin}/api/character-ads/${project.id}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'analyze_images', customDialogue })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Workflow trigger failed with status ${response.status}: ${errorText}`);
        }

        console.log(`✅ Successfully triggered workflow for character ads project ${project.id}`);
      } catch (error) {
        console.error('❌ Background workflow trigger failed:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');
        console.error('Context:', {
          projectId: project.id,
          userId,
          generationCreditsUsed,
          videoModel: resolvedVideoModel
        });

        // REFUND credits on failure
        if (generationCreditsUsed > 0) {
          console.log(`⚠️ Refunding ${generationCreditsUsed} credits due to workflow trigger failure`);
          try {
            await deductCredits(userId, -generationCreditsUsed);
            await recordCreditTransaction(
              userId,
              'refund',
              generationCreditsUsed,
              `Character Ads - Refund for failed workflow trigger`,
              project.id,
              true
            );
            console.log(`✅ Successfully refunded ${generationCreditsUsed} credits to user ${userId}`);
          } catch (refundError) {
            console.error('❌ CRITICAL: Refund failed:', refundError);
            console.error('Refund error stack:', refundError instanceof Error ? refundError.stack : 'No stack available');
            // TODO: This should trigger alerting - user paid but didn't get service
          }
        }

        // Update project status to failed
        try {
          const supabase = getSupabaseAdmin();
          const { error: updateError } = await supabase
            .from('character_ads_projects')
            .update({
              status: 'failed',
              error_message: `Workflow trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);

          if (updateError) {
            console.error('❌ CRITICAL: Failed to update project status to failed:', updateError);
            // TODO: This should trigger alerting - project stuck in pending state
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
    console.error('Create character ads project error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
