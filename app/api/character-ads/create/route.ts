import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadImageToStorage } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract form data
    const userId = formData.get('user_id') as string;
    const videoDurationSeconds = parseInt(formData.get('video_duration_seconds') as string);
    const imageModel = formData.get('image_model') as string;
    const videoModel = formData.get('video_model') as string;

    if (!userId || !videoDurationSeconds || !imageModel || !videoModel) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate video duration
    if (![8, 16, 24].includes(videoDurationSeconds)) {
      return NextResponse.json(
        { error: 'Invalid video duration. Must be 8, 16, or 24 seconds' },
        { status: 400 }
      );
    }

    // Validate models
    if (!['nano_banana', 'seedream'].includes(imageModel)) {
      return NextResponse.json(
        { error: 'Invalid image model' },
        { status: 400 }
      );
    }

    if (!['veo3', 'veo3_fast'].includes(videoModel)) {
      return NextResponse.json(
        { error: 'Invalid video model' },
        { status: 400 }
      );
    }

    // Extract and upload person images
    const personImageUrls: string[] = [];
    const personFiles: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('person_image_') && value instanceof File) {
        personFiles.push(value);
      }
    }

    // Extract and upload product images
    const productImageUrls: string[] = [];
    const productFiles: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('product_image_') && value instanceof File) {
        productFiles.push(value);
      }
    }

    // Validate that we have images
    if (personFiles.length === 0 || productFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one person image and one product image are required' },
        { status: 400 }
      );
    }

    // Upload person images to Supabase
    for (let i = 0; i < personFiles.length; i++) {
      const file = personFiles[i];
      const fileName = `character-ads/person/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName);
      personImageUrls.push(uploadResult.publicUrl);
    }

    // Upload product images to Supabase
    for (let i = 0; i < productFiles.length; i++) {
      const file = productFiles[i];
      const fileName = `character-ads/product/${userId}/${Date.now()}_${i}_${file.name}`;
      const uploadResult = await uploadImageToStorage(file, fileName);
      productImageUrls.push(uploadResult.publicUrl);
    }

    // Calculate credits cost
    const imageCredits = 1; // Scene 0 image generation
    const videoScenes = videoDurationSeconds / 8;
    const videoCreditsPerScene = videoModel === 'veo3' ? 15 : 10; // Estimate based on model
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
        image_model: imageModel,
        video_model: videoModel,
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

    // Start the workflow by triggering image analysis
    // This will be handled by a separate background process or webhook
    // For now, we'll trigger it via a separate API call
    try {
      await fetch(`${request.nextUrl.origin}/api/character-ads/${project.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'analyze_images' })
      });
    } catch (error) {
      console.error('Failed to trigger workflow:', error);
      // Don't fail the entire request, the workflow can be triggered later
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        current_step: project.current_step,
        progress_percentage: project.progress_percentage,
        video_duration_seconds: project.video_duration_seconds,
        credits_cost: project.credits_cost,
        person_image_count: personImageUrls.length,
        product_image_count: productImageUrls.length,
        created_at: project.created_at
      }
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