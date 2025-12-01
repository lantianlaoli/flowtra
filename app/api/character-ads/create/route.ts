import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/supabase';
import { CREDIT_COSTS, getActualImageModel } from '@/lib/constants';
import { validateKieCredits } from '@/lib/kie-credits-check';
import { deductCredits, recordCreditTransaction } from '@/lib/credits';
import { CHARACTER_ADS_DURATION_OPTIONS } from '@/lib/character-ads-dialogue';

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
    const customDialogue = (formData.get('custom_dialogue') as string) || '';
    const videoAspectRatio = (formData.get('video_aspect_ratio') as '16:9' | '9:16') || '16:9';
    const selectedPersonPhotoUrl = formData.get('selected_person_photo_url') as string;
    const selectedProductId = formData.get('selected_product_id') as string;
    const language = (formData.get('language') as string) || 'en';

    console.log('Extracted form data:', { userId, videoDurationSeconds, imageModel, imageSize, videoModel, videoAspectRatio, selectedPersonPhotoUrl, selectedProductId, language });

    if (!userId || !videoDurationSeconds || !imageModel || !videoModel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Validate video duration
    if (!CHARACTER_ADS_DURATION_OPTIONS.includes(videoDurationSeconds as typeof CHARACTER_ADS_DURATION_OPTIONS[number])) {
      return NextResponse.json(
        { error: 'Invalid video duration. Select between 8s and 80s in 8-second increments.' },
        { status: 400 }
      );
    }

    // Validate models
    const validImageModels = ['auto', 'nano_banana', 'seedream', 'nano_banana_pro'];
    const validVideoModels = ['veo3_fast'];

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
      product_details: string;
      brand_name?: string;
      brand_slogan?: string;
      brand_details?: string;
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

        // Store product and brand context for AI workflow
        if (!product.product_details) {
          return NextResponse.json(
            { error: 'Product details not found. Please ensure the product has been analyzed.' },
            { status: 400 }
          );
        }

        productContext = {
          product_details: product.product_details,
          brand_name: product.brand?.brand_name,
          brand_slogan: product.brand?.brand_slogan,
          brand_details: product.brand?.brand_details
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
    const actualImageModel = getActualImageModel(imageModel as 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro');
    const resolvedVideoModel = 'veo3_fast' as const;

    const sceneUnitSeconds = 8;
    const videoScenes = videoDurationSeconds / sceneUnitSeconds;
    const videoCreditsPerScene = CREDIT_COSTS[resolvedVideoModel];
    const totalCredits = videoScenes * videoCreditsPerScene;

    const generationCreditsUsed = 0;

    // Create project in database
    const supabase = getSupabaseAdmin();
    const { data: project, error: insertError } = await supabase
      .from('character_ads_projects')
      .insert({
        user_id: userId,
        person_image_urls: personImageUrls,
        product_image_urls: productImageUrls, // Still stored for temp products; will be removed in future migration
        selected_product_id: selectedProductId && !selectedProductId.startsWith('temp') ? selectedProductId : null,
        product_context: productContext,
        video_duration_seconds: videoDurationSeconds,
        image_model: actualImageModel,
        video_model: resolvedVideoModel,
        video_aspect_ratio: normalizedAspectRatio,
        image_size: enforcedImageSize, // ✅ Fix Bug 1: Ensure image_size is saved for nano_banana API
        custom_dialogue: customDialogue || null,
        language: language, // Language for AI-generated content
        credits_cost: totalCredits,
        generation_credits_used: generationCreditsUsed,
        status: 'pending',
        current_step: 'generating_prompts', // Start directly at prompt generation (skip analyze_images)
        progress_percentage: 10,
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

    // ✅ Fire-and-forget mechanism removed (architecture simplification)
    // Workflow is now completely driven by monitor-tasks
    // After project creation with status='pending', monitor-tasks will
    // automatically detect and start processing in the next polling cycle

    console.log(`✅ Character ads project ${project.id} created with status='pending'`);
    console.log(`Monitor-tasks will start processing in the next cycle`);

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
