import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS, getCreditCost } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedProductId?: string;
  userId: string;
  videoModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2';
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
    const actualVideoModel: 'veo3' | 'veo3_fast' | 'sora2' = request.videoModel === 'auto' ? 'veo3_fast' : request.videoModel;

    // Calculate credits cost based on model and photo/video mode
    let creditsCost = request.photoOnly ? 5 : 10; // Default: 5 for photo-only, 10 for video
    if (!request.photoOnly && actualVideoModel === 'sora2') {
      creditsCost = 30; // Sora2 costs 30 credits for video generation
    }

    // For VEO3 model, deduct credits upfront (prepaid model)
    if (!request.photoOnly && actualVideoModel === 'veo3') {
      const veo3Cost = getCreditCost('veo3'); // 150 credits

      // Check if user has enough credits
      const creditCheck = await checkCredits(request.userId, veo3Cost);
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
          details: `Need ${veo3Cost} credits for VEO3 High Quality model, have ${creditCheck.currentCredits || 0}`
        };
      }

      // Deduct credits upfront
      const deductResult = await deductCredits(request.userId, veo3Cost);
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
        veo3Cost,
        'Video generation - VEO3 High Quality (prepaid)',
        undefined,
        true
      );

      creditsCost = veo3Cost; // Update credits cost for record
    }

    // Create project record in standard_ads_projects table
    const { data: project, error: insertError} = await supabase
      .from('standard_ads_projects')
      .insert({
        user_id: request.userId,
        original_image_url: imageUrl,
        selected_product_id: request.selectedProductId,
        video_model: actualVideoModel,
        video_aspect_ratio: request.videoAspectRatio || '16:9',
        status: 'processing',
        current_step: 'describing',
        progress_percentage: 10,
        credits_cost: creditsCost,
        watermark_text: request.watermark?.text,
        watermark_location: request.watermark?.location || request.watermarkLocation,
        cover_image_size: request.imageSize,
        photo_only: request.photoOnly || false,
        // For VEO3, mark as generation credits already used (prepaid)
        generation_credits_used: (!request.photoOnly && actualVideoModel === 'veo3') ? creditsCost : 0
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
      await startAIWorkflow(project.id, { ...request, imageUrl, videoModel: actualVideoModel });
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
    console.log('📝 Image description received:', description?.substring(0, 100) + '...');

    // Step 2: Generate creative prompts
    console.log('✨ Generating creative prompts...');
    const prompts = await generateCreativePrompts(description, request.adCopy);
    console.log('🎯 Creative prompts generated:', Object.keys(prompts).join(', '));

    // Step 3: Start cover generation
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request);
    console.log('🆔 Cover task ID:', coverTaskId);

    // Update project with cover task ID and prompts
    // Note: product_description is JSONB in DB, store as object
    // Store the image_prompt used for cover generation for auditing purposes
    const updateData = {
      cover_task_id: coverTaskId,
      video_prompts: prompts,
      product_description: { description },
      image_prompt: description, // Store the original product description for image generation auditing
      current_step: 'generating_cover' as const,
      progress_percentage: 30,
      last_processed_at: new Date().toISOString()
    };
    console.log('💾 Updating project with data:', { ...updateData, product_description: { description: description?.substring(0, 50) + '...' } });

    const { data: updateResult, error: updateError } = await supabase
      .from('standard_ads_projects')
      .update(updateData)
      .eq('id', projectId)
      .select();

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully:', updateResult);
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

async function generateCreativePrompts(description: string, adCopy?: string): Promise<Record<string, unknown>> {
  const trimmedAdCopy = adCopy?.trim();
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
${trimmedAdCopy ? `\nUse this exact ad copy for dialogue and on-screen headline. Do not paraphrase: "${trimmedAdCopy}".` : ''}

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
    // First, try to extract JSON from markdown code blocks if present
    let jsonContent = content;
    
    // Check if content contains markdown JSON code block
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonContent = jsonBlockMatch[1];
    }
    
    const parsed = JSON.parse(jsonContent);
    
    // Ensure description is a simple string, not JSON content
    if (parsed.description && typeof parsed.description === 'string') {
      // If description contains JSON markers or is too complex, simplify it
      if (parsed.description.includes('```json') || parsed.description.includes('{')) {
        parsed.description = parsed.description.replace(/```json\s*[\s\S]*?\s*```/g, '')
                                            .replace(/\{[\s\S]*?\}/g, '')
                                            .replace(/\s+/g, ' ')
                                            .trim();
        
        // If after cleaning, description is empty or too short, provide a default
        if (!parsed.description || parsed.description.length < 10) {
          parsed.description = "Professional product showcase in modern setting";
        }
      }
    }
    
    if (trimmedAdCopy) {
      parsed.dialogue = trimmedAdCopy;
      parsed.ad_copy = trimmedAdCopy;
      parsed.tagline = trimmedAdCopy;
    }
    return parsed;
  } catch {
    // If JSON parsing fails, create a structured response
    // Clean the content to ensure it's a simple string description
    const cleanDescription = content.replace(/```json\s*[\s\S]*?\s*```/g, '')
                                     .replace(/\{[\s\S]*?\}/g, '')
                                     .replace(/\s+/g, ' ')
                                     .trim()
                                     .substring(0, 200); // Limit length
    
    const fallback = {
      description: cleanDescription || "Professional product showcase in modern setting",
      setting: "Professional studio",
      camera_type: "Close-up",
      camera_movement: "Smooth pan",
      action: "Product showcase",
      lighting: "Soft professional lighting",
      dialogue: trimmedAdCopy || "Highlighting key benefits",
      music: "Upbeat commercial music",
      ending: "Call to action",
      other_details: "High-quality commercial style"
    };
    if (trimmedAdCopy) {
      (fallback as Record<string, unknown>).ad_copy = trimmedAdCopy;
      (fallback as Record<string, unknown>).tagline = trimmedAdCopy;
    }
    return fallback;
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

  const includeSoraSafety = request.shouldGenerateVideo !== false && request.videoModel === 'sora2';
  const soraSafetySection = `\n\nSora2 Safety Requirements:
- Do not include photorealistic humans, faces, or bodies
- Focus entirely on the product, typography, or abstract environments without people
- Maintain a people-free composition that still feels dynamic and premium`;

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

  // Map image_size for Nano Banana to ratio strings
  const mapUiSizeToBanana = (val?: string): string | undefined => {
    switch (val) {
      case 'square':
      case 'square_hd':
        return '1:1';
      case 'portrait_16_9':
        return '9:16';
      case 'landscape_16_9':
        return '16:9';
      case 'portrait_4_3':
        return '3:4';
      case 'landscape_4_3':
        return '4:3';
      case 'portrait_3_2':
        return '2:3';
      case 'landscape_3_2':
        return '3:2';
      case 'portrait_5_4':
        return '4:5';
      case 'landscape_5_4':
        return '5:4';
      case 'landscape_21_9':
        return '21:9';
      case 'auto':
        // When image size is 'auto', match the video aspect ratio
        return request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
      case undefined:
      case '':
        return undefined;
      default:
        return undefined;
    }
  };

  const requestBody = {
    model: kieModelName,
    ...(process.env.KIE_STANDARD_ADS_CALLBACK_URL && {
      callBackUrl: process.env.KIE_STANDARD_ADS_CALLBACK_URL
    }),
    input: {
      prompt: prompt,
      image_urls: [imageUrl],
      output_format: "png",
      ...(actualImageModel === 'nano_banana'
        ? (() => { const r = mapUiSizeToBanana(request.imageSize); return r ? { image_size: r } : {}; })()
        : { image_size: request.imageSize === 'auto' ? (request.videoAspectRatio === '9:16' ? 'portrait_16_9' : 'landscape_16_9') : (request.imageSize || 'auto') }
      )
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
