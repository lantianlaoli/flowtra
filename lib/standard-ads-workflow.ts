import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS, getAutoModeSelection, getGenerationCost, getLanguagePromptName, type LanguageCode } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export interface StartWorkflowRequest {
  imageUrl?: string;
  selectedProductId?: string;
  selectedBrandId?: string; // NEW: Brand selection for ending frame
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
  videoDuration?: '8' | '10' | '15';
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
    }

    if (!imageUrl) {
      return {
        success: false,
        error: 'Image source required',
        details: 'Either imageUrl or selectedProductId with photos is required'
      };
    }

    // Convert 'auto' to specific model
    let actualVideoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
    if (request.videoModel === 'auto') {
      const autoSelection = getAutoModeSelection(0); // Get cheapest model
      actualVideoModel = autoSelection || 'sora2'; // Fallback to cheapest
    } else {
      actualVideoModel = request.videoModel;
    }

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
        video_model: actualVideoModel,
        video_aspect_ratio: request.videoAspectRatio || '16:9',
        status: 'processing',
        current_step: request.useCustomScript ? 'ready_for_video' : 'describing',
        progress_percentage: request.useCustomScript ? 50 : 10,
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
    // Don't await - let it run asynchronously so the button can be clicked again immediately
    startAIWorkflow(project.id, { ...request, imageUrl, videoModel: actualVideoModel })
      .catch(async (workflowError) => {
        console.error('Background workflow error:', workflowError);

        // REFUND credits on failure (only for paid generation models)
        if (!request.photoOnly && generationCost > 0) {
          console.log(`⚠️ Refunding ${generationCost} credits due to workflow failure`);
          await deductCredits(request.userId, -generationCost); // Negative = refund
          await recordCreditTransaction(
            request.userId,
            'refund',
            generationCost,
            `Standard Ads - Refund for failed ${actualVideoModel.toUpperCase()} generation`,
            project.id,
            true
          );
        }

        // Update project status to failed
        await supabase
          .from('standard_ads_projects')
          .update({
            status: 'failed',
            error_message: workflowError instanceof Error ? workflowError.message : 'Workflow start failed'
          })
          .eq('id', project.id);
      });

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

    // AUTO MODE: Brand-driven workflow with AI creative generation
    // Fetch brand information to use slogan directly
    let brandSlogan = request.adCopy || '';
    let description = '';

    if (request.selectedBrandId) {
      console.log('🏷️  Fetching brand information for auto mode...');
      const { data: brand, error: brandError } = await supabase
        .from('user_brands')
        .select('brand_name, brand_slogan')
        .eq('id', request.selectedBrandId)
        .eq('user_id', request.userId)
        .single();

      if (!brandError && brand) {
        brandSlogan = brand.brand_slogan || brand.brand_name || '';
        description = `Brand: ${brand.brand_name}. ${brand.brand_slogan || ''}`;
        console.log('✅ Using brand slogan:', brandSlogan);
      } else {
        console.warn('⚠️  Brand not found, using adCopy fallback');
      }
    }

    // Generate full creative prompts using AI (required for video generation)
    console.log('🤖 Generating creative video prompts from brand information...');
    const prompts = await generateCreativePrompts(
      description || brandSlogan,
      brandSlogan,
      request.language
    );

    console.log('🎯 Generated creative prompts:', prompts);

    // Step 1: Start cover generation (using brand prompt directly)
    console.log('🎨 Starting cover generation...');
    const coverTaskId = await generateCover(request.imageUrl, prompts, request);
    console.log('🆔 Cover task ID:', coverTaskId);

    // Update project with cover task ID and prompts
    const updateData = {
      cover_task_id: coverTaskId,
      video_prompts: prompts,
      product_description: { description: description || brandSlogan },
      image_prompt: (prompts.description as string) || description || brandSlogan,
      current_step: 'generating_cover' as const,
      progress_percentage: 30,
      last_processed_at: new Date().toISOString()
    };
    console.log('💾 Updating project with brand-driven data');

    const { data: updateResult, error: updateError } = await supabase
      .from('standard_ads_projects')
      .update(updateData)
      .eq('id', projectId)
      .select();

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully');
    console.log('✅ Auto mode workflow started successfully (no AI pre-processing)');

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
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
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

async function generateCreativePrompts(description: string, adCopy?: string, language?: string): Promise<Record<string, unknown>> {
  const trimmedAdCopy = adCopy?.trim();

  // Define JSON schema for Structured Outputs - IMPORTANT: This must return a SINGLE object, not an array
  const responseFormat = {
    type: "json_schema",
    json_schema: {
      name: "video_advertisement_schema",
      strict: true,
      schema: {
        type: "object",
        properties: {
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
          "language"
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
          content: `Based on this product description: "${description}"

Generate ONE creative video advertisement prompt as a single JSON object with these elements:
- description: Main scene description
- setting: Location/environment
- camera_type: Type of camera shot
- camera_movement: Camera movement style
- action: What happens in the scene
- lighting: Lighting setup
- dialogue: Spoken content/voiceover (in English)
- music: Music style
- ending: How the ad concludes
- other_details: Additional creative elements
- language: The language name for voiceover generation (e.g., "English", "Urdu (Pakistan's national language)", "Punjabi")
${trimmedAdCopy ? `\nUse this exact ad copy for dialogue and on-screen headline. Do not paraphrase: "${trimmedAdCopy}".` : ''}

CRITICAL: Return EXACTLY ONE advertisement prompt object, NOT an array of objects.
IMPORTANT: All text content (dialogue, descriptions, etc.) should be written in English. The 'language' field is metadata only to specify what language the video voiceover should use.`
        }
      ]
    })
  }, 3, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prompt generation failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

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
      dialogue: trimmedAdCopy || "Highlighting key benefits",
      music: "Upbeat commercial music",
      ending: "Call to action",
      other_details: "High-quality commercial style",
      language: language ? getLanguagePromptName(language as LanguageCode) : "English"
    };
  }

  // Override dialogue with adCopy if provided
  if (trimmedAdCopy) {
    parsed.dialogue = trimmedAdCopy;
    parsed.ad_copy = trimmedAdCopy;
    parsed.tagline = trimmedAdCopy;
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

  const includeSoraSafety = request.shouldGenerateVideo !== false && (request.videoModel === 'sora2' || request.videoModel === 'sora2_pro');
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

// NEW: Generate brand ending frame for video末帧
export async function generateBrandEndingFrame(
  brandId: string,
  productImageUrl: string,
  aspectRatio: '16:9' | '9:16',
  imageModel?: 'nano_banana' | 'seedream'
): Promise<string> {
  const supabase = getSupabaseAdmin();

  // Fetch brand data
  const { data: brand, error: brandError } = await supabase
    .from('user_brands')
    .select('*')
    .eq('id', brandId)
    .single();

  if (brandError || !brand) {
    throw new Error(`Brand not found: ${brandError?.message || 'Unknown error'}`);
  }

  // Determine image model to use
  const actualImageModel = imageModel || 'nano_banana';
  const kieModelName = IMAGE_MODELS[actualImageModel];

  // Build brand ending frame prompt - combining product and brand
  const prompt = `Create a professional brand ending frame for video advertisement by combining the product image and brand logo provided.

Brand Information:
- Brand Name: ${brand.brand_name}
${brand.brand_slogan ? `- Brand Slogan: "${brand.brand_slogan}"` : ''}

Design Requirements:
- Reference both the product image (first image) and brand logo (second image)
- Create a cohesive ending frame that showcases the product with prominent brand identity
- Position the brand logo strategically (bottom-third, corner, or integrated into the design)
${brand.brand_slogan ? `- Display "${brand.brand_slogan}" in elegant, readable typography` : ''}
- Maintain the product's visual appeal from the first image
- Professional composition that combines product showcase with brand elements
- Clean, premium aesthetic suitable for video conclusion
- Aspect ratio: ${aspectRatio}
- Style: Modern, polished, memorable brand impression
- Ensure brand logo is clearly visible and recognizable
- Balance between product visibility and brand prominence
- High contrast for readability
- Professional color scheme that complements both product and brand identity`;

  // Map aspect ratio to KIE image size format
  let imageSize: string;
  if (actualImageModel === 'nano_banana') {
    imageSize = aspectRatio; // nano_banana uses "16:9" or "9:16" directly
  } else {
    // seedream uses portrait_16_9 or landscape_16_9
    imageSize = aspectRatio === '9:16' ? 'portrait_16_9' : 'landscape_16_9';
  }

  const requestBody = {
    model: kieModelName,
    input: {
      prompt: prompt,
      image_urls: [productImageUrl, brand.brand_logo_url], // Product image + brand logo
      output_format: "png",
      ...(actualImageModel === 'nano_banana'
        ? { image_size: imageSize }
        : { image_size: imageSize }
      )
    }
  };

  console.log('🎨 Generating brand ending frame for brand:', brand.brand_name);
  console.log('🖼️  Product image:', productImageUrl);
  console.log('🏷️  Brand logo:', brand.brand_logo_url);
  console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Brand ending frame generation failed:', response.status, errorText);
    throw new Error(`Brand ending frame generation failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate brand ending frame');
  }

  console.log('✅ Brand ending frame task created:', data.data.taskId);
  return data.data.taskId;
}
