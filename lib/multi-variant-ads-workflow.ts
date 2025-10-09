import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getActualImageModel, IMAGE_MODELS } from '@/lib/constants';

export interface MultiVariantAdsRequest {
  imageUrl?: string;
  selectedProductId?: string;
  userId: string;
  elementsCount?: number;
  adCopy?: string;
  textWatermark?: string;
  textWatermarkLocation?: string;
  generateVideo?: boolean;
  videoModel: 'veo3' | 'veo3_fast';
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
    }

    if (!imageUrl) {
      return {
        success: false,
        error: 'Either imageUrl or selectedProductId with photos is required'
      };
    }

    const elementsCount = request.elementsCount || 2;
    const projectIds: string[] = [];

    // Create multiple project records based on elementsCount
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
          video_model: request.videoModel || 'veo3',
          video_aspect_ratio: request.videoAspectRatio || '16:9',
          watermark_text: request.textWatermark || request.watermark?.text,
          watermark_location: request.textWatermarkLocation || request.watermark?.location,
          photo_only: request.photoOnly || false,
          cover_image_size: request.coverImageSize || '1024x1024',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error(`Failed to create multi-variant project ${i + 1}:`, error);
        return { success: false, error: error.message };
      }

      projectIds.push(project.id);
    }

    // Start optimized workflow that processes all projects together
    // Pass the resolved imageUrl to the workflow
    startOptimizedMultiVariantWorkflow(projectIds, { ...request, imageUrl }).catch((error: Error) => {
      console.error('Optimized workflow failed:', error);
    });

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
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
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
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
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
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
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
  const prompt = generatePromptFromElements(request.elementsData || {}, request.adCopy);

  const requestBody = {
    model: kieModelName,
    ...(process.env.KIE_MULTI_VARIANT_ADS_CALLBACK_URL && {
      callBackUrl: process.env.KIE_MULTI_VARIANT_ADS_CALLBACK_URL
    }),
    input: {
      prompt: prompt,
      image_urls: [request.imageUrl],
      output_format: "png",
      // Image size handling per model
      ...(actualImageModel === 'nano_banana'
        ? (() => {
            const val = (request.imageSize || 'auto').trim();
            // Accept direct ratio pass-through per Banana docs
            const allowed = new Set(['1:1','9:16','16:9','3:4','4:3','3:2','2:3','5:4','4:5','21:9']);
            if (allowed.has(val)) return { image_size: val };
            if (val === 'auto') return {}; // omit to let service choose
            return {}; // fallback omit
          })()
        : (() => {
            // Seedream: keep existing behavior; support mapping for 16:9/9:16, else auto
            const val = (request.imageSize || 'auto').trim();
            if (val === '9:16') return { image_size: 'portrait_16_9' };
            if (val === '16:9') return { image_size: 'landscape_16_9' };
            if (val === 'auto') {
              // When image size is 'auto', match the video aspect ratio
              return request.videoAspectRatio === '9:16' 
                ? { image_size: 'portrait_16_9' }
                : { image_size: 'landscape_16_9' };
            }
            return { image_size: 'auto' };
          })()
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

  // Get project details
  const { data: project } = await supabase
    .from('multi_variant_ads_projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error('Project not found');
  }

  // Generate creative video prompt using AI
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
          content: `Create a professional video advertisement prompt for this product based on the cover image and elements data: ${JSON.stringify(elementsData)}

Generate a structured creative prompt with these elements:
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
    // Remove possible Markdown code block wrapper
    let cleanContent = content;
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error('Failed to parse video design result:', content);
    console.error('Parse error:', error);
    // If JSON parsing fails, create a structured response
    return {
      description: "Professional product advertisement showcase",
      setting: "Modern studio environment",
      camera_type: "Close-up product shot",
      camera_movement: "Smooth circular pan",
      action: "Product demonstration and feature highlights",
      lighting: "Soft professional lighting with accent highlights",
      dialogue: "Compelling product benefits and call-to-action",
      music: "Upbeat commercial background music",
      ending: "Strong call-to-action with brand logo",
      other_details: "High-quality commercial production style"
    };
  }
}
