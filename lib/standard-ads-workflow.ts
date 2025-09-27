import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS } from '@/lib/constants';

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedProductId?: string;
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast';
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
}

interface WorkflowResult {
  success: boolean;
  projectId?: string;
  error?: string;
  details?: string;
}

export async function startWorkflowProcess(request: StartWorkflowRequest): Promise<WorkflowResult> {
  try {
    const supabase = getSupabaseAdmin();

    // Handle product selection - get the image URL from the selected product
    let imageUrl = request.imageUrl;
    if (request.selectedProductId && !imageUrl) {
      const { data: product, error: productError } = await supabase
        .from('user_products')
        .select(`
          *,
          user_product_photos (*)
        `)
        .eq('id', request.selectedProductId)
        .single();

      if (productError || !product) {
        return {
          success: false,
          error: 'Product not found',
          details: productError?.message || 'Selected product does not exist'
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
    }

    if (!imageUrl) {
      return {
        success: false,
        error: 'Image source required',
        details: 'Either imageUrl or selectedProductId with photos is required'
      };
    }

    // Convert 'auto' videoModel to a specific model
    const actualVideoModel: 'veo3' | 'veo3_fast' = request.videoModel === 'auto' ? 'veo3_fast' : request.videoModel;

    // Create project record in standard_ads_projects table
    const { data: project, error: insertError } = await supabase
      .from('standard_ads_projects')
      .insert({
        user_id: request.userId,
        original_image_url: imageUrl,
        selected_product_id: request.selectedProductId,
        video_model: actualVideoModel,
        status: 'processing',
        current_step: 'describing',
        progress_percentage: 10,
        credits_cost: request.photoOnly ? 5 : 10, // 5 for photo-only, 10 for video
        watermark_text: request.watermark?.text,
        watermark_location: request.watermark?.location || request.watermarkLocation,
        cover_image_size: request.imageSize,
        photo_only: request.photoOnly || false,
        project_type: 'single_video'
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

    // Start the AI workflow by calling image description
    try {
      await startAIWorkflow(project.id, { ...request, imageUrl });
    } catch (workflowError) {
      console.error('Workflow start error:', workflowError);
      // Update project status to failed
      await supabase
        .from('standard_ads_projects')
        .update({
          status: 'failed',
          error_message: workflowError instanceof Error ? workflowError.message : 'Workflow start failed'
        })
        .eq('id', project.id);

      return {
        success: false,
        error: 'Failed to start AI workflow',
        details: workflowError instanceof Error ? workflowError.message : 'Unknown error'
      };
    }

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

async function startAIWorkflow(projectId: string, request: StartWorkflowRequest & { imageUrl: string }): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Describe the image
    console.log('🔍 Starting image description...');
    const description = await describeImage(request.imageUrl);

    // Step 2: Generate creative prompts
    console.log('✨ Generating creative prompts...');
    const prompts = await generateCreativePrompts(description);

    // Step 3: Start cover generation
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request);

    // Update project with cover task ID and prompts
    await supabase
      .from('standard_ads_projects')
      .update({
        cover_task_id: coverTaskId,
        video_prompts: prompts,
        product_description: { description },
        current_step: 'generating_cover',
        progress_percentage: 30,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log('✅ AI workflow started successfully');

  } catch (error) {
    console.error('AI workflow error:', error);
    throw error;
  }
}

async function describeImage(imageUrl: string): Promise<string> {
  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this product image in detail for advertising purposes. Focus on key features, benefits, and selling points that would appeal to potential customers.'
            },
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            }
          ]
        }
      ]
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Image description failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateCreativePrompts(description: string): Promise<Record<string, unknown>> {
  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001',
      messages: [
        {
          role: 'user',
          content: `Based on this product description: "${description}"

Generate a creative video advertisement prompt with these elements:
- description: Main scene description
- setting: Location/environment
- camera_type: Type of camera shot
- camera_movement: Camera movement style
- action: What happens in the scene
- lighting: Lighting setup
- dialogue: Spoken content/voiceover
- music: Music style
- ending: How the ad concludes
- other_details: Additional creative elements

Return as JSON format.`
        }
      ]
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Prompt generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch {
    // If JSON parsing fails, create a structured response
    return {
      description: content,
      setting: "Professional studio",
      camera_type: "Close-up",
      camera_movement: "Smooth pan",
      action: "Product showcase",
      lighting: "Soft professional lighting",
      dialogue: "Highlighting key benefits",
      music: "Upbeat commercial music",
      ending: "Call to action",
      other_details: "High-quality commercial style"
    };
  }
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
- The product must remain visually identical to the original`;

  // Extract watermark information from request
  const watermarkText = request.watermark;
  const watermarkLocation = request.watermarkLocation;
  
  if (watermarkText) {
    prompt += `\n\nWatermark Requirements:
- Add text watermark: "${watermarkText}"
- Watermark location: ${watermarkLocation || 'bottom left'}
- Make the watermark visible but not overpowering
- Use appropriate font size and opacity for the watermark`;
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
  }

  const requestBody = {
    model: kieModelName,
    ...(process.env.KIE_STANDARD_ADS_CALLBACK_URL && {
      callBackUrl: process.env.KIE_STANDARD_ADS_CALLBACK_URL
    }),
    input: {
      prompt: prompt,
      image_urls: [imageUrl],
      output_format: "png",
      image_size: request.imageSize === 'auto' ? 'auto' : (request.imageSize || 'auto')
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