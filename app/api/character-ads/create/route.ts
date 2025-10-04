import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/supabase';
import { CREDIT_COSTS, getActualModel, getActualImageModel } from '@/lib/constants';
import { validateKieCredits } from '@/lib/kie-credits-check';

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
    const validVideoModels = ['auto', 'veo3', 'veo3_fast', 'sora2'];
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

    if (selectedProductId) {
      // Check if it's a temporary product (starts with "temp:")
      if (selectedProductId.startsWith('temp:')) {
        // Extract URL from temp format: "temp: URL"
        const tempUrl = selectedProductId.replace(/^temp:\s*`?([^`]+)`?$/, '$1').trim();
        console.log('Using temporary product URL:', tempUrl);
        productImageUrls.push(tempUrl);
      } else {
        // Get product images from database via user_product_photos table
        const supabase = getSupabaseAdmin();
        const { data: productPhotos, error: productError } = await supabase
          .from('user_product_photos')
          .select('photo_url')
          .eq('product_id', selectedProductId)
          .eq('user_id', userId);

        if (productError) {
          console.error('Error fetching product photos:', productError);
          return NextResponse.json(
            { error: 'Failed to fetch product photos' },
            { status: 400 }
          );
        }

        if (!productPhotos || productPhotos.length === 0) {
          return NextResponse.json(
            { error: 'No photos found for selected product' },
            { status: 400 }
          );
        }

        productImageUrls.push(...productPhotos.map(photo => photo.photo_url));
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
    let resolvedVideoModel: 'veo3' | 'veo3_fast' | 'sora2';
    if (isSora2Duration) {
      resolvedVideoModel = 'sora2';
    } else {
      const actualVideoModel = getActualModel(videoModel as 'auto' | 'veo3' | 'veo3_fast' | 'sora2', 1000) || (videoModel === 'auto' ? 'veo3_fast' : (videoModel as 'veo3' | 'veo3_fast'));
      // Guard against sora2 sneaking in for 8/16/24
      resolvedVideoModel = actualVideoModel === 'sora2' ? 'veo3_fast' : actualVideoModel;
    }
    
    // Calculate credits cost using constants (use actual model for cost calculation)
    const imageCredits = 0; // Image generation is free according to constants
    const sceneUnitSeconds = resolvedVideoModel === 'sora2' ? 10 : 8;
    const videoScenes = videoDurationSeconds / sceneUnitSeconds;
    const videoCreditsPerScene = CREDIT_COSTS[resolvedVideoModel];
    const totalCredits = imageCredits + (videoScenes * videoCreditsPerScene);

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
        credits_cost: totalCredits,
        status: 'pending',
        current_step: 'analyzing_images',
        progress_percentage: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create project in database' },
        { status: 500 }
      );
    }

    // No longer recording events to character_ads_project_events table

    // Start the workflow by triggering image analysis
    // This will be handled by a separate background process or webhook
    // For now, we'll trigger it via a separate API call
    try {
      await fetch(`${request.nextUrl.origin}/api/character-ads/${project.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'analyze_images', customDialogue })
      });
    } catch (error) {
      console.error('Failed to trigger workflow:', error);
      // Don't fail the entire request, the workflow can be triggered later
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
