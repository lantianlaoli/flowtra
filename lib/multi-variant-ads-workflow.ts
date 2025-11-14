import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS, getGenerationCost } from '@/lib/constants';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';

export interface MultiVariantAdsRequest {
  imageUrl?: string;
  selectedProductId?: string;
  userId: string;
  elementsCount?: number;
  adCopy?: string;
  textWatermark?: string;
  textWatermarkLocation?: string;
  generateVideo?: boolean;
  videoModel: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
  requestedVideoModel?: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
  imageModel?: 'auto' | 'nano_banana' | 'seedream';
  watermark?: {
    text: string;
    location: string;
  };
  imageSize?: string;
  photoOnly?: boolean;
  coverImageSize?: string;
  elementsData?: Record<string, unknown>;
  videoAspectRatio?: '16:9' | '9:16';
  language?: string; // Language for AI-generated content
  // Generic video params (applicable to all models)
  sora2ProDuration?: '10' | '15'; // DEPRECATED: Use videoDuration
  sora2ProQuality?: 'standard' | 'high'; // DEPRECATED: Use videoQuality
  videoDuration?: string; // Generic video duration (e.g., '8', '10', '15')
  videoQuality?: 'standard' | 'high'; // Generic video quality
}

interface MultiVariantResult {
  success: boolean;
  projectIds?: string[];
  error?: string;
}

export async function startMultiVariantItems(request: MultiVariantAdsRequest): Promise<MultiVariantResult> {
  const supabase = getSupabaseAdmin();

  try {
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
        .single();

      if (productError || !product) {
        return {
          success: false,
          error: 'Product not found'
        };
      }

      // Get the primary photo or the first available photo
      const primaryPhoto = product.user_product_photos?.find((photo: { is_primary: boolean }) => photo.is_primary);
      const fallbackPhoto = product.user_product_photos?.[0];
      const selectedPhoto = primaryPhoto || fallbackPhoto;

      if (!selectedPhoto) {
        return {
          success: false,
          error: 'No product photos found'
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
        error: 'Either imageUrl or selectedProductId with photos is required'
      };
    }

    const elementsCount = request.elementsCount || 2;
    const projectIds: string[] = [];

    // ===== VERSION 3.0: MIXED BILLING - Generation Phase =====
    // Basic models (veo3_fast, sora2): FREE generation, paid download
    // Premium models (veo3, sora2_pro): PAID generation, free download
    let generationCostPerVideo = 0;
    let totalGenerationCost = 0;

    if (!request.photoOnly) {
      const videoModel = request.videoModel || 'veo3';

      // Calculate generation cost based on model (support both old and new param names)
      const duration = request.videoDuration || request.sora2ProDuration;
      const quality = request.videoQuality || request.sora2ProQuality;
      generationCostPerVideo = getGenerationCost(
        videoModel,
        duration,
        quality
      );

      // Total cost = cost per video * number of variants
      totalGenerationCost = generationCostPerVideo * elementsCount;

      // Only check and deduct credits if generation is paid
      if (totalGenerationCost > 0) {
        // Check if user has enough credits
        const creditCheck = await checkCredits(request.userId, totalGenerationCost);
        if (!creditCheck.success) {
          return {
            success: false,
            error: 'Failed to check credits'
          };
        }

        if (!creditCheck.hasEnoughCredits) {
          return {
            success: false,
            error: `Insufficient credits. Need ${totalGenerationCost} credits for ${elementsCount}x ${videoModel.toUpperCase()} videos, have ${creditCheck.currentCredits || 0}`
          };
        }

        // Deduct credits UPFRONT for paid generation models
        const deductResult = await deductCredits(request.userId, totalGenerationCost);
        if (!deductResult.success) {
          return {
            success: false,
            error: 'Failed to deduct credits'
          };
        }

        // Record the transaction
        await recordCreditTransaction(
          request.userId,
          'usage',
          totalGenerationCost,
          `Multi-Variant Ads - Video generation (${elementsCount}x ${videoModel.toUpperCase()})`,
          undefined,
          true
        );
      }
      // If totalGenerationCost is 0, generation is FREE (will charge at download)
    } else {
      generationCostPerVideo = 0; // Photo-only mode is free
    }

    // Create multiple project records based on elementsCount
    const videoModel = request.videoModel || 'veo3';

    for (let i = 0; i < elementsCount; i++) {
      const { data: project, error } = await supabase
        .from('multi_variant_ads_projects')
        .insert({
          user_id: request.userId,
          original_image_url: imageUrl,
          selected_product_id: request.selectedProductId,
          status: 'analyzing_images',
          current_step: 'analyzing_images',
          progress_percentage: 0,
          video_model: videoModel,
          video_aspect_ratio: request.videoAspectRatio || '16:9',
          watermark_text: request.textWatermark || request.watermark?.text,
          watermark_location: request.textWatermarkLocation || request.watermark?.location,
          photo_only: request.photoOnly || false,
          cover_image_aspect_ratio: request.coverImageSize || '16:9',
          language: request.language || 'en', // Language for AI-generated content
          credits_cost: generationCostPerVideo, // Only generation cost (download cost charged separately)
          // NEW: Sora2 Pro fields
          video_duration: request.videoDuration || request.sora2ProDuration || (videoModel === 'veo3' || videoModel === 'veo3_fast' ? '8' : '10'),
          video_quality: request.videoQuality || request.sora2ProQuality || 'standard',
          // DEPRECATED: download_credits_used (downloads are now free)
          download_credits_used: 0,
          // Store product/brand context for later use
          product_context: productContext,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create multi-variant project ${i + 1}:`, error);
        // REFUND credits on failure (only for paid generation models)
        if (!request.photoOnly && totalGenerationCost > 0) {
          console.log(`⚠️ Refunding ${totalGenerationCost} credits due to project creation failure`);
          await deductCredits(request.userId, -totalGenerationCost);
          await recordCreditTransaction(
            request.userId,
            'refund',
            totalGenerationCost,
            'Multi-Variant Ads - Refund for failed project creation',
            undefined,
            true
          );
        }
        return { success: false, error: error.message };
      }

      projectIds.push(project.id);
    }

    // Start optimized workflow that processes all projects together
    // Wrap in IIFE to ensure error handling is reliable
    (async () => {
      try {
        await startOptimizedMultiVariantWorkflow(projectIds, { ...request, imageUrl });
      } catch (error) {
        console.error('❌ Optimized workflow failed:', error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack available');
        console.error('Context:', {
          projectIds,
          userId: request.userId,
          totalGenerationCost,
          photoOnly: request.photoOnly,
          elementsCount
        });

        // REFUND credits on failure (only for paid generation models)
        if (!request.photoOnly && totalGenerationCost > 0) {
          console.log(`⚠️ Refunding ${totalGenerationCost} credits due to workflow failure`);
          try {
            await deductCredits(request.userId, -totalGenerationCost);
            await recordCreditTransaction(
              request.userId,
              'refund',
              totalGenerationCost,
              `Multi-Variant Ads - Refund for failed workflow (${elementsCount} variants)`,
              projectIds[0], // Use first project ID for reference
              true
            );
            console.log(`✅ Successfully refunded ${totalGenerationCost} credits to user ${request.userId}`);
          } catch (refundError) {
            console.error('❌ CRITICAL: Refund failed:', refundError);
            console.error('Refund error stack:', refundError instanceof Error ? refundError.stack : 'No stack available');
            // TODO: This should trigger alerting - user paid but didn't get service
          }
        }

        // Update all projects to failed status
        try {
          const { error: updateError } = await supabase
            .from('multi_variant_ads_projects')
            .update({
              status: 'failed',
              error_message: `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              last_processed_at: new Date().toISOString()
            })
            .in('id', projectIds);

          if (updateError) {
            console.error('❌ CRITICAL: Failed to update projects status to failed:', updateError);
            // TODO: This should trigger alerting - projects stuck in processing state
          } else {
            console.log(`✅ Marked ${projectIds.length} projects as failed`);
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
      projectIds
    };
  } catch (error) {
    console.error('StartMultiVariantItems error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Step 1: Analyze image
async function analyzeImage(imageUrl: string): Promise<Record<string, unknown>> {
  console.log('🔍 Analyzing image...');
  
  const systemText = `Analyze the given image and determine if it primarily depicts a product or a character, or BOTH.`;

  // Define strict JSON Schema structure
  const jsonSchema = {
    name: "image_analysis",
    strict: true,
    schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["product", "character", "both"],
          description: "The type of content in the image: product, character, or both"
        },
        product: {
          type: "object",
          description: "Product details (required if type is 'product' or 'both')",
          properties: {
            brand_name: {
              type: "string",
              description: "Name of the brand shown in the image, if visible or inferable"
            },
            color_scheme: {
              type: "array",
              description: "List of prominent colors used in the product",
              items: {
                type: "object",
                properties: {
                  hex: {
                    type: "string",
                    description: "Hex code of the color (e.g., #FF5733)"
                  },
                  name: {
                    type: "string",
                    description: "Descriptive name of the color (e.g., 'Vibrant Red')"
                  }
                },
                required: ["hex", "name"]
              }
            },
            font_style: {
              type: "string",
              description: "Description of the font family or style used (serif/sans-serif, bold/thin, etc.)"
            },
            visual_description: {
              type: "string",
              description: "A full sentence or two summarizing what is seen in the product, ignoring the background"
            }
          },
          required: ["brand_name", "color_scheme", "visual_description"]
        },
        character: {
          type: "object",
          description: "Character details (required if type is 'character' or 'both')",
          properties: {
            outfit_style: {
              type: "string",
              description: "Description of clothing style, accessories, or notable features"
            },
            visual_description: {
              type: "string",
              description: "A full sentence or two summarizing what the character looks like, ignoring the background"
            }
          },
          required: ["outfit_style", "visual_description"]
        }
      },
      required: ["type"],
      additionalProperties: false,
      allOf: [
        {
          if: {
            properties: { type: { enum: ["product"] } }
          },
          then: {
            required: ["product"]
          }
        },
        {
          if: {
            properties: { type: { enum: ["character"] } }
          },
          then: {
            required: ["character"]
          }
        },
        {
          if: {
            properties: { type: { enum: ["both"] } }
          },
          then: {
            required: ["product", "character"]
          }
        }
      ]
    }
  };

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    messages: [
      {
        role: 'system',
        content: `You are an image analysis expert. Analyze the image to determine if it shows a product, character, or both. Provide detailed information about what you see.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: systemText },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    max_tokens: 700,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: jsonSchema
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Image analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    // Remove possible Markdown code block wrapper
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse analysis result:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse image analysis result');
  }
}

// Step 2: Generate multiple elements
async function generateMultipleElements(imageAnalysis: Record<string, unknown>, elementsCount: number = 2, userAdCopy?: string): Promise<Record<string, unknown>> {
  console.log('🧩 Generating multiple elements...');
  
  // If user provided adCopy, specify in prompt to use the provided adCopy
  const adCopyInstruction = userAdCopy 
    ? `- ad_copy → Use this exact ad copy for all variants: "${userAdCopy}"`
    : `- ad_copy → Short, catchy slogan`;
  
  const systemPrompt = `### A - Ask:
Create exactly ${elementsCount} different sets of ELEMENTS for the uploaded ad image.  
Each set must include **all required fields** and differ in tone, mood, or creative angle.  

### G - Guidance:
**role:** Creative ad concept generator  
**output_count:** ${elementsCount} sets  

**constraints:**  
- product → Product or line name  
- character → Target user/consumer who would use this product (e.g., for jewelry: "young professional woman", for pet food: "golden retriever", for skincare: "woman in her 30s", for sports gear: "athletic young man")  
${adCopyInstruction}
- visual_guide → Describe character's pose, product placement, background mood  
- Primary color → Main color (from packaging/ad)  
- Secondary color → Supporting color  
- Tertiary color → Accent color  

### E - Examples:
{
  "elements": [
    {
      "product": "Happy Dog Sensible Montana",
      "character": "Short-haired hunting dog",
      "ad_copy": ${userAdCopy ? `"${userAdCopy}"` : `"Natural energy, every day."`},
      "visual_guide": "The hunting dog sits calmly beside the pack, background is a soft green gradient, product facing forward and clearly highlighted.",
      "Primary color": "#1A3D2F",
      "Secondary color": "#FFFFFF",
      "Tertiary color": "#C89B3C"
    },
    {
      "product": "Elegant Pearl Necklace",
      "character": "Professional woman in her late 20s",
      "ad_copy": ${userAdCopy ? `"${userAdCopy}"` : `"Timeless elegance, everyday confidence."`},
      "visual_guide": "The woman gently touches the necklace while smiling, product prominently displayed on her neck, background is a soft neutral tone with warm lighting.",
      "Primary color": "#F8F6F0",
      "Secondary color": "#D4AF37",
      "Tertiary color": "#2C2C2C"
    }
  ]
}`;

  const userPrompt = `Description of the reference image: ${JSON.stringify(imageAnalysis, null, 2)}

Generate ${elementsCount} sets of elements for this image.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000,
    temperature: 0.7,
    response_format: { 
      type: "json_schema",
      schema: {
        type: "object",
        required: ["elements"],
        properties: {
          elements: {
            type: "array",
            minItems: elementsCount,
            maxItems: elementsCount,
            items: {
              type: "object",
              required: ["product", "character", "ad_copy", "visual_guide", "Primary color", "Secondary color", "Tertiary color"],
              properties: {
                product: {
                  type: "string",
                  description: "Product or line name"
                },
                character: {
                  type: "string",
                  description: "Featured character (dog breed/appearance)"
                },
                ad_copy: {
                  type: "string",
                  description: "Short, catchy slogan"
                },
                visual_guide: {
                  type: "string",
                  description: "Describe character's pose, product placement, background mood"
                },
                "Primary color": {
                  type: "string",
                  pattern: "^#[0-9A-Fa-f]{6}$",
                  description: "Main color (from packaging/ad) in hex format"
                },
                "Secondary color": {
                  type: "string",
                  pattern: "^#[0-9A-Fa-f]{6}$",
                  description: "Supporting color in hex format"
                },
                "Tertiary color": {
                  type: "string",
                  pattern: "^#[0-9A-Fa-f]{6}$",
                  description: "Accent color in hex format"
                }
              }
            }
          }
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Elements generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  console.log('Elements generation response:', JSON.stringify(data, null, 2));
  console.log('Elements content to parse:', content);

  try {
    // Remove markdown code block wrapper if present
    let cleanContent = content;
    if (content.startsWith('```json') && content.endsWith('```')) {
      cleanContent = content.slice(7, -3).trim();
    } else if (content.startsWith('```') && content.endsWith('```')) {
      cleanContent = content.slice(3, -3).trim();
    }
    
    const parsed = JSON.parse(cleanContent);
    console.log('Successfully parsed elements:', JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (error) {
    console.error('Failed to parse elements result:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse generated elements');
  }
}

// Step 3: Generate cover prompts
async function generateCoverPrompt(
  imageAnalysis: Record<string, unknown>, 
  elements: Record<string, unknown>,
  textWatermark?: string,
  textWatermarkLocation?: string
): Promise<Record<string, unknown>> {
  console.log('📝 Generating cover prompt...');
  
  // Get first element group from elements (use first group by default)
  const firstElement = (elements.elements as Array<Record<string, unknown>>)[0];
  
  const systemPrompt = `## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent

### A - Ask:
Create exactly 1 structured image ad prompt with all required fields filled.

The final prompt should be written like this:

"""
Make an image ad for this product with the following elements. The product looks exactly like what's in the reference image.

product:
character:
ad_copy:
visual_guide:
text_watermark:
text_watermark_location:
Primary color of ad:
Secondary color of ad:
Tertiary color of ad:
"""

### G - Guidance:
**role:** Creative ad prompt engineer
**output_count:** 1
**constraints:**
- Always include all required fields.
- Integrate the user's special request as faithfully as you can in the final image prompt.
- **CRITICAL: If ad_copy is provided by the user, you MUST use it EXACTLY as given. DO NOT modify, rephrase, or replace user-provided ad_copy under any circumstances.**
- If user input is missing, apply smart defaults:
  - **text_watermark_location** → "bottom left of screen"
  - **primary_color** → "decide based on the image provided"
  - **secondary_color** → "decide based on the image provided"
  - **tertiary_color** → "decide based on the image provided"
  - **font_style** → "decide based on the image provided"
  - **ad_copy** → ONLY generate if not provided by user. Keep short, punchy, action-oriented.
  - **visual_guide** → (as defined by the user). If the user's special request is detailed, expand this portion to accommodate their request. Make sure the color palette that is provided is respected even in this portion. If the request involves a human character, define the camera angle and camera used. If no visual guide is given, describe placement of the character and how big they are relative to the image; describe what they're doing with the product; describe the style of the ad, describe the main color of the background and the main color of the text.)
  - **text_watermark** → (as defined by the user, leave blank if none provided)
  - **text_watermark_location** → (as defined by the user, or bottom left if none provided)

### N - Notation:
**format:** text string nested within an "image_prompt" parameter. Avoid using double-quotes or new line breaks.
**example_output:** |
{
  "image_prompt": "final prompt here"
}`;

  const userPrompt = `Your task: Create 1 image prompt as guided by your system guidelines.

Description of the reference image: ${JSON.stringify(imageAnalysis, null, 2)}

ELEMENTS FOR THIS IMAGE:

product: ${firstElement.product}
character: ${firstElement.character}
ad copy: ${firstElement.ad_copy} [USER PROVIDED - USE EXACTLY AS GIVEN]
visual_guide: ${firstElement.visual_guide}
text_watermark: ${textWatermark || ''}
text_watermark_location: ${textWatermarkLocation || 'bottom left'}

Primary color: ${firstElement['Primary color']}
Secondary color: ${firstElement['Secondary color']}
Tertiary color: ${firstElement['Tertiary color']}

IMPORTANT: The ad_copy "${firstElement.ad_copy}" was provided by the user and must be used EXACTLY as written in the final prompt. Do not modify, rephrase, or replace it.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 1000,
    temperature: 0.5,
    response_format: { 
      type: "json_schema",
      schema: {
        type: "object",
        required: ["image_prompt"],
        properties: {
          image_prompt: {
            type: "string",
            description: "The complete image prompt text that includes all required elements"
          }
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Cover prompt generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    // Remove possible Markdown code block wrapper
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse cover prompt result:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse generated cover prompt');
  }
}

async function startOptimizedMultiVariantWorkflow(projectIds: string[], request: MultiVariantAdsRequest & { imageUrl: string }): Promise<void> {
  const supabase = getSupabaseAdmin();

  try {
    // Step 1: Analyze image (execute only once)
    console.log('🔍 Starting image analysis...');
    const imageAnalysis = await analyzeImage(request.imageUrl);
    
    // Update status for all projects
    await supabase
      .from('multi_variant_ads_projects')
      .update({
        product_description: imageAnalysis,
        status: 'generating_elements',
        current_step: 'generating_elements',
        progress_percentage: 10,
        last_processed_at: new Date().toISOString()
      })
      .in('id', projectIds);
    
    // Step 2: Generate multiple elements (execute only once)
    console.log('🧩 Generating multiple elements...');
    const elementsData = await generateMultipleElements(imageAnalysis, projectIds.length, request.adCopy);
    
    // Update status for all projects
    await supabase
      .from('multi_variant_ads_projects')
      .update({
        elements_data: elementsData,
        status: 'generating_cover_prompt',
        current_step: 'generating_cover_prompt',
        progress_percentage: 20,
        last_processed_at: new Date().toISOString()
      })
      .in('id', projectIds);
    
    // Step 3: Generate different cover prompts and covers for each project
    const elements = (elementsData as Record<string, unknown>)?.elements as Record<string, unknown>[] || [];
    
    for (let i = 0; i < projectIds.length; i++) {
      const projectId = projectIds[i];
      const element = elements[i] || elements[0]; // If not enough elements, use first element
      
      try {
        // Generate cover prompt for current project
        console.log(`📝 Generating cover prompt for project ${i + 1}...`);
        const coverPrompt = await generateCoverPrompt(
          imageAnalysis, 
          { elements: [element] }, // Only pass elements for current project
          request.textWatermark || request.watermark?.text,
          request.textWatermarkLocation || request.watermark?.location
        );
        
        // Update current project status, store single element instead of all elements
        await supabase
          .from('multi_variant_ads_projects')
          .update({
            elements_data: element, // Only store single element for current project
            image_prompt: coverPrompt,
            status: 'generating_cover',
            current_step: 'generating_cover',
            progress_percentage: 30,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', projectId);
        
        // Generate cover image
        console.log(`🎨 Starting cover generation for project ${i + 1}...`);
        const coverTaskId = await generateMultiVariantCover({
          ...request,
          elementsData: coverPrompt // coverPrompt contains image_prompt field, generatePromptFromElements will use it preferentially
        });

        // Update project status
        await supabase
          .from('multi_variant_ads_projects')
          .update({
            cover_task_id: coverTaskId,
            status: 'generating_cover',
            current_step: 'generating_cover',
            progress_percentage: 40,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', projectId);

      } catch (error) {
        console.error(`Error processing project ${projectId}:`, error);
        // Update project status to error
        await supabase
          .from('multi_variant_ads_projects')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            last_processed_at: new Date().toISOString()
          })
          .eq('id', projectId);
      }
    }

    console.log('✅ Optimized multi-variant workflow started successfully');

  } catch (error) {
    console.error('Optimized multi-variant workflow error:', error);
    
    // Update all project statuses to error
    await supabase
      .from('multi_variant_ads_projects')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        last_processed_at: new Date().toISOString()
      })
      .in('id', projectIds);
    
    throw error;
  }
}



async function generateMultiVariantCover(request: MultiVariantAdsRequest): Promise<string> {
  // Get the actual image model to use
  const actualImageModel = getActualImageModel(request.imageModel || 'auto');
  const kieModelName = IMAGE_MODELS[actualImageModel];

  // Generate prompt based on elements data and context
  let prompt = generatePromptFromElements(request.elementsData || {}, request.adCopy);

  const fallbackAspect = request.videoAspectRatio === '9:16' ? '9:16' : '16:9';
  const normalisedImageSize = (request.imageSize || 'auto').trim();

  const requestedVideoModel = request.requestedVideoModel || request.videoModel;
  const includeSoraSafety = request.generateVideo !== false && requestedVideoModel === 'sora2';
  const soraSafetySection = `\n\nSora2 Safety Requirements:
- Remove photorealistic humans, faces, and bodies from the scene
- Highlight the product using abstract design, typography, or stylised environments without people
- If characters are unavoidable, use simplified silhouettes without realistic facial detail`;

  if (includeSoraSafety) {
    prompt += soraSafetySection;
  }

  const mapUiSizeToBanana = (value: string): string | undefined => {
    switch (value) {
      case 'auto':
        return fallbackAspect;
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
      default:
        return undefined;
    }
  };

  const mapUiSizeToSeedream = (value: string): string => {
    switch (value) {
      case 'auto':
        return fallbackAspect === '9:16' ? 'portrait_16_9' : 'landscape_16_9';
      case 'square':
      case 'square_hd':
        return value;
      case 'portrait_16_9':
        return 'portrait_16_9';
      case 'landscape_16_9':
        return 'landscape_16_9';
      case 'portrait_4_3':
        return 'portrait_4_3';
      case 'landscape_4_3':
        return 'landscape_4_3';
      case 'portrait_3_2':
        return 'portrait_3_2';
      case 'landscape_3_2':
        return 'landscape_3_2';
      case 'landscape_21_9':
        return 'landscape_21_9';
      default:
        return fallbackAspect === '9:16' ? 'portrait_16_9' : 'landscape_16_9';
    }
  };

  const bananaSize = mapUiSizeToBanana(normalisedImageSize);
  const seedreamSize = mapUiSizeToSeedream(normalisedImageSize);

  const requestBody = {
    model: kieModelName,
    input: {
      prompt: prompt,
      image_urls: [request.imageUrl],
      output_format: "png",
      // Image size handling per model
      ...(actualImageModel === 'nano_banana'
        ? (bananaSize ? { image_size: bananaSize } : {})
        : { image_size: seedreamSize }
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

// Helper function to generate prompt from elements data
function generatePromptFromElements(elementsData: Record<string, unknown>, adCopy?: string): string {
  // Check if elementsData contains image_prompt (from generateCoverPrompt)
  if (elementsData.image_prompt && typeof elementsData.image_prompt === 'string') {
    return elementsData.image_prompt;
  }

  // If elementsData is a single element object, extract its properties
  if (elementsData.product || elementsData.character || elementsData.ad_copy) {
    const product = elementsData.product || 'the product';
    const character = elementsData.character || 'target audience';
    const elementAdCopy = elementsData.ad_copy || adCopy || '';
    const visualGuide = elementsData.visual_guide || '';
    const primaryColor = elementsData['Primary color'] || '';
    const secondaryColor = elementsData['Secondary color'] || '';
    const tertiaryColor = elementsData['Tertiary color'] || '';

    let prompt = `Create a professional advertisement image showcasing ${product}. `;
    
    if (character) {
      prompt += `Target audience: ${character}. `;
    }
    
    if (elementAdCopy) {
      prompt += `Ad copy: "${elementAdCopy}". `;
    }
    
    if (visualGuide) {
      prompt += `Visual guide: ${visualGuide}. `;
    }
    
    if (primaryColor || secondaryColor || tertiaryColor) {
      prompt += `Color scheme: `;
      if (primaryColor) prompt += `Primary color ${primaryColor}`;
      if (secondaryColor) prompt += `, Secondary color ${secondaryColor}`;
      if (tertiaryColor) prompt += `, Tertiary color ${tertiaryColor}`;
      prompt += `. `;
    }
    
    prompt += `Style: modern, clean, professional advertising with high-quality visual appeal.`;
    
    return prompt;
  }

  // Fallback prompt
  const basePrompt = "Create a professional advertisement image showcasing the product";
  if (adCopy) {
    return `${basePrompt}. ${adCopy}. Style: modern, clean, professional advertising.`;
  }
  return `${basePrompt}. Style: modern, clean, professional advertising with high-quality visual appeal.`;
}

export async function getMultiVariantItemsStatus(ids: string[]): Promise<{success: boolean; items?: Record<string, unknown>[]; error?: string}> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data: projects, error } = await supabase
      .from('multi_variant_ads_projects')
      .select('*')
      .in('id', ids);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      items: projects || []
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function generateVideoDesignFromCover(coverImageUrl: string, elementsData: Record<string, unknown>, projectId: string): Promise<{
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
}> {
  const supabase = getSupabaseAdmin();

  // Get project details including product description
  const { data: project } = await supabase
    .from('multi_variant_ads_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error('Project not found');
  }

  // Extract product description and context from project
  const productDescription = project.product_description as Record<string, unknown> | undefined;
  const productContext = (project.product_context || {}) as { product_details?: string; brand_name?: string; brand_slogan?: string; brand_details?: string };

  // Extract element details for richer context
  const product = elementsData.product || 'the product';
  const character = elementsData.character || 'target audience';
  const adCopy = elementsData.ad_copy || '';
  const visualGuide = elementsData.visual_guide || '';
  const primaryColor = elementsData['Primary color'] || '';
  const secondaryColor = elementsData['Secondary color'] || '';
  const tertiaryColor = elementsData['Tertiary color'] || '';

  // Build a comprehensive, detailed prompt with specific examples
  const contextPrompt = `You are a professional video advertisement director. Based on the product information and cover image provided, create a DETAILED, SPECIFIC video advertisement script.

PRODUCT INFORMATION:
- Product Name: ${product}
- Target Audience: ${character}
- Ad Copy/Main Message: ${adCopy}
- Visual Style Guide: ${visualGuide}
- Color Palette: Primary ${primaryColor}, Secondary ${secondaryColor}, Tertiary ${tertiaryColor}
- Product Analysis: ${productDescription ? JSON.stringify(productDescription, null, 2) : 'See cover image for product details'}${productContext && (productContext.product_details || productContext.brand_name) ? `\n\nProduct & Brand Context from Database:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}\nIMPORTANT: Use this authentic product and brand context to enhance the video script. The brand identity and product features should guide the creative direction.` : ''}

REQUIREMENTS:
Create a cinematic, professional advertisement video script that:
1. Maintains EXACT consistency with the cover image's style, colors, and mood
2. Showcases the product's key features through SPECIFIC actions and scenes
3. Appeals directly to ${character} with relatable, concrete scenarios
4. Integrates the ad copy "${adCopy}" naturally into the dialogue/voiceover
5. Creates a compelling narrative with multiple distinct scenes and camera angles

IMPORTANT GUIDELINES:
- Be EXTREMELY SPECIFIC: Instead of "product demonstration", describe EXACTLY what happens (e.g., "Close-up on hands carefully peeling the sticker from backing, revealing the glossy finish")
- Include MULTIPLE SCENES with clear transitions (at least 3-4 different shots/moments)
- Specify EXACT camera movements (e.g., "Slow dolly-in from medium to close-up", "Smooth 360-degree rotation around product")
- Describe CONCRETE ACTIONS in detail (e.g., "Person applies sticker to laptop lid, smooths it with fingertips, then closes laptop to reveal full design")
- Mention SPECIFIC SOUNDS/MUSIC (e.g., "Gentle 'peel' sound effect when removing backing", "Upbeat ukulele melody transitioning to romantic piano")
- Create a VISUAL STORY, not just a description

EXAMPLE OF EXPECTED DETAIL LEVEL:
{
  "description": "A montage showcasing various applications of Rose Stamp Stickers, interspersed with close-ups highlighting the sticker's intricate design and premium quality.",
  "setting": "Varied environments: close-up on a wooden desk with journal and coffee mug, student working at a cafe with sunlight streaming through window, two friends exchanging gifts in a cozy living room, outdoor scene with person decorating water bottle at a park bench.",
  "camera_type": "Dynamic mix of macro shots (extreme close-up on sticker details showing scalloped border and rose petals), medium shots (people using stickers in lifestyle contexts), close-ups (hands applying stickers), and product shots (arranged stickers on white surface).",
  "camera_movement": "Fluid movements including: slow dolly shot gliding across desk surface, gentle zoom-in to emphasize sticker detail, handheld follow shots tracking person's hands as they apply sticker, smooth pan across multiple decorated items, 360-degree rotation around finished product.",
  "action": "1. Extreme close-up: Fingers carefully peel Rose Stamp Sticker from backing sheet, revealing glossy finish and intricate rose design. 2. Medium shot: Student in cafe places sticker on laptop lid, smooths it gently with thumb, then admires the result with a smile. 3. Close-up sequence: Hands stick sticker onto phone case, journal cover, and water bottle in quick succession, each application showing the sticker's versatility. 4. Lifestyle shot: Friend presents decorated phone case as gift, recipient's face lights up with joy. 5. Macro detail shot: Camera slowly travels across sticker surface, highlighting scalloped border, delicate rose petals, and tiny heart details.",
  "lighting": "Bright, cheerful lighting with warm 2700K-3000K color temperature creating inviting atmosphere. Natural window light (soft, diffused) for cafe and living room scenes supplemented with fill lights to eliminate harsh shadows. Outdoor scenes use golden hour sunlight. Studio product shots employ softbox lighting from 45-degree angle with subtle rim light to enhance sticker's glossy finish and create depth.",
  "dialogue": "Voiceover (upbeat female voice, friendly and enthusiastic tone): 'Transform the ordinary into something special with Rose Stamp Stickers! Whether you're personalizing your laptop, decorating a gift, or adding charm to your water bottle, these adorable stickers bring instant joy to everything they touch.' [Brief pause as visual montage plays] 'Durable, weather-resistant, and bursting with romantic charm – each sticker is a tiny work of art at just 5 cents worth of happiness!' [Softer, more intimate tone] 'Express your unique style, spread love to those around you, and make every day a little more beautiful with Rose Stamp Stickers.'",
  "music": "Opens with upbeat, cheerful ukulele melody (120 BPM) featuring playful fingerpicking pattern and light percussion, creating a fun and lighthearted mood. Music transitions to a gentler, more romantic acoustic guitar arrangement (90 BPM) during close-up emotional moments and gift-giving scene. Background includes subtle 'whoosh' sound effects during quick scene transitions, gentle 'peel' sound when sticker is removed from backing, and soft 'press' sound when applied to surfaces.",
  "ending": "Final sequence: Slow-motion shot of person smiling warmly while looking at their newly decorated belongings (laptop, journal, phone) arranged artfully on desk. Camera slowly pulls back to reveal the full collection. Screen fades to white, then text overlay appears in elegant script font matching sticker's romantic aesthetic: 'Rose Stamp Stickers – Spread the Love' followed by website URL (www.rosestamps.com) in clean sans-serif. Final frame holds for 2 seconds with subtle sparkle animation around the rose graphic.",
  "other_details": "Utilize stop-motion animation technique (12 fps) for 2-3 second sequence showing multiple stickers being applied in rapid succession, creating dynamic visual interest. Incorporate subtle color grading with slightly enhanced saturation (+15%) to make the rose pink and hearts pop against backgrounds. Use pastel color palette (soft pinks, cream whites, mint greens) throughout all scenes to maintain cohesive brand aesthetic. Add gentle lens flare effect when showing sticker's glossy finish. Include quick 0.5-second insert shots of sticker packaging to establish product source. Maintain aspect ratio consistent with cover image. Final cut should feel warm, inviting, and aspirational while showcasing practical applications."
}

NOW CREATE YOUR DETAILED SCRIPT:
Your output must match this level of specificity and detail. Do NOT use generic descriptions. Every element should paint a vivid, concrete picture that a film crew could execute exactly as written.`;

  // Generate creative video prompt using AI with structured output
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
          role: 'system',
          content: 'You are an award-winning video advertisement director and creative scriptwriter. Your specialty is creating highly detailed, cinematic advertisement scripts that are specific, actionable, and visually compelling. You never use generic descriptions - every script you write is tailored to the exact product with concrete details a film crew can execute.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: contextPrompt
            },
            {
              type: 'image_url',
              image_url: { url: coverImageUrl }
            }
          ]
        }
      ],
      max_tokens: 2000, // Increased for detailed responses
      temperature: 0.85, // Higher creativity for unique, detailed scripts
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'video_advertisement_script',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Detailed main scene description with specific visual elements and narrative structure. Must be concrete and specific, not generic.'
              },
              setting: {
                type: 'string',
                description: 'Specific location/environment descriptions with details about lighting, props, and atmosphere. Include multiple settings if the ad features scene changes.'
              },
              camera_type: {
                type: 'string',
                description: 'Specific camera shot types (e.g., "macro", "medium shot", "close-up"). Describe multiple shot types if using varied angles.'
              },
              camera_movement: {
                type: 'string',
                description: 'Detailed camera movements with specifics (e.g., "Slow dolly-in from 3 feet to 6 inches", "Smooth 360-degree rotation at 10 seconds per revolution").'
              },
              action: {
                type: 'string',
                description: 'Step-by-step breakdown of what happens in the video. Use numbered sequences (1., 2., 3.) describing exact actions, not general concepts.'
              },
              lighting: {
                type: 'string',
                description: 'Specific lighting setup including color temperature (K), light sources, angles, and mood. Be technical and precise.'
              },
              dialogue: {
                type: 'string',
                description: 'Complete voiceover script or spoken dialogue. Write the EXACT words to be spoken, including tone direction and pacing notes.'
              },
              music: {
                type: 'string',
                description: 'Detailed music and sound description including genre, tempo (BPM), instruments, mood transitions, and specific sound effects with timing.'
              },
              ending: {
                type: 'string',
                description: 'Detailed description of final sequence, including call-to-action, text overlays, logo placement, and final frame composition.'
              },
              other_details: {
                type: 'string',
                description: 'Additional creative elements: post-production effects, color grading specifics, animation techniques, transitions, aspect ratios, overall aesthetic notes.'
              }
            },
            required: ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'dialogue', 'music', 'ending', 'other_details'],
            additionalProperties: false
          }
        }
      }
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Prompt generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    // Remove possible Markdown code block wrapper
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanContent);

    // Ensure ad_copy is used in dialogue if provided
    if (adCopy && typeof adCopy === 'string' && adCopy.trim()) {
      parsed.dialogue = adCopy;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse video design result:', content);
    console.error('Parse error:', error);

    // If JSON parsing fails, create a product-specific fallback based on available data
    const fallbackDescription = (typeof visualGuide === 'string' ? visualGuide : '') || `Professional showcase of ${product} targeting ${character}`;
    const fallbackAdCopy = (typeof adCopy === 'string' ? adCopy : '') || `Discover ${product} - designed for ${character}`;

    return {
      description: fallbackDescription,
      setting: `Professional environment suited for ${product}`,
      camera_type: "Dynamic product-focused shot",
      camera_movement: "Smooth pan highlighting product features",
      action: `${character} engaging with ${product}, demonstrating key benefits`,
      lighting: `Professional lighting matching the brand colors (${primaryColor})`,
      dialogue: fallbackAdCopy,
      music: "Upbeat, modern commercial music matching target audience",
      ending: `Strong call-to-action featuring ${product} with brand message`,
      other_details: `Maintain color consistency (${primaryColor}, ${secondaryColor}) and professional advertising style`
    };
  }
}
