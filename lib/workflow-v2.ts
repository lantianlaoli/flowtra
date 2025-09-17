import { getSupabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getCreditCost } from '@/lib/constants';

export interface StartBatchWorkflowRequest {
  imageUrl: string;
  userId: string;
  videoModel: 'veo3' | 'veo3_fast';
  elementsCount?: number;
  textWatermark?: string;
  textWatermarkLocation?: string;
  imageSize?: string;
}

interface AdElements {
  product?: string;
  character?: string;
  ad_copy?: string;
  visual_guide?: string;
  text_watermark?: string;
  text_watermark_location?: string;
  primary_color?: string;
  secondary_color?: string;
  tertiary_color?: string;
}

// Removed all batch-based functions and types

async function describeImage(imageUrl: string): Promise<string> {
  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze the given image and determine if it primarily depicts a product or a character, or BOTH. Return the analysis in the specified JSON format.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    max_tokens: 500,
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'image_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['product', 'character', 'both']
            },
            brand_name: {
              type: 'string',
              description: 'Name of the brand shown in the image, if visible or inferable'
            },
            color_scheme: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  hex: { type: 'string' },
                  name: { type: 'string' }
                },
                required: ['hex', 'name']
              }
            },
            font_style: {
              type: 'string',
              description: 'Font family or style used: serif/sans-serif, bold/thin, etc.'
            },
            visual_description: {
              type: 'string',
              description: 'Full sentence or two summarizing what is seen in the image, ignoring the background'
            },
            outfit_style: {
              type: 'string',
              description: 'Description of clothing style, accessories, or notable features (for character type)'
            }
          },
          required: ['type', 'visual_description'],
          additionalProperties: false
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra',
      'User-Agent': 'Flowtra/1.0'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'No description generated';
}

async function generateMultipleElements(
  imageUrl: string,
  count: number,
  userWatermark?: string,
  userWatermarkLocation?: string
): Promise<Record<string, unknown>[]> {
  const systemPrompt = `### A - Ask:
Create exactly ${count} different sets of ELEMENTS for the uploaded ad image.  
Each set must include **all required fields** and differ in tone, mood, or creative angle.  

### G - Guidance:
**role:** Creative ad concept generator  
**output_count:** ${count} sets  
**constraints:**
- Every set must have:
  - product
  - character
  - ad_copy
  - visual_guide
  - Primary color, Secondary color, Tertiary color
- Ensure creative DIVERSITY between the ${count} sets:
  - One can be minimal/clean, the other bold/energetic (or premium/elegant vs. playful/dynamic).
- If user does not specify details, apply smart defaults:
  - ad_copy → short, catchy slogan
  - visual_guide → describe placement, size, activity of character, product angle, background mood
  - colors → decide based on the ad image
- IMPORTANT: Do NOT generate text_watermark field - this will be provided separately by the user

### E - Examples:
**good_examples:**
- **Set 1:** minimal, clean, muted tones, straightforward CTA.  
- **Set 2:** bold, colorful, dynamic composition, playful character usage.

### N - Notation:
**format:** structured JSON with ${count} sets clearly separated.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Your task: Based on the ad image I uploaded, create exactly ${count} different sets of ELEMENTS.`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    max_tokens: 1500,
    temperature: 0.8,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'elements_sets',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            elements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product: { type: 'string' },
                  character: { type: 'string' },
                  ad_copy: { type: 'string' },
                  visual_guide: { type: 'string' },
                  primary_color: { type: 'string' },
                  secondary_color: { type: 'string' },
                  tertiary_color: { type: 'string' }
                },
                required: ['product', 'character', 'ad_copy', 'visual_guide', 'primary_color', 'secondary_color', 'tertiary_color']
              }
            }
          },
          required: ['elements']
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra',
      'User-Agent': 'Flowtra/1.0'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  try {
    const parsed = JSON.parse(content);
    const elements = parsed.elements || [];

    // Add user-provided watermark data to each element
    return elements.map((element: Record<string, unknown>) => ({
      ...element,
      text_watermark: userWatermark || '',
      text_watermark_location: userWatermarkLocation || 'bottom left'
    }));
  } catch (parseError) {
    throw new Error(`Failed to parse generated elements: ${parseError}`);
  }
}

// Step 3: Combine description + one elements set to generate final cover prompt
async function generateFinalCoverPrompt(
  productDescription: string,
  elements: AdElements
): Promise<string> {
  const systemPrompt = `## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent\n\n### A - Ask:\nCreate exactly 1 structured image ad prompt with all required fields filled.\n\nThe final prompt should be written like this:\n\n"""\nMake an image ad for this product with the following elements. The product looks exactly like what's in the reference image.\n\nproduct:\ncharacter:\nad_copy:\nvisual_guide:\ntext_watermark:\ntext_watermark_location:\nPrimary color of ad:\nSecondary color of ad:\nTertiary color of ad:\n"""\n\n### G - Guidance:\nrole: Creative ad prompt engineer\noutput_count: 1\nconstraints:\n- Always include all required fields.\n- Integrate the user's special request as faithfully as you can in the final image prompt.\n- If user input is missing, apply smart defaults:\n  - text_watermark_location → "bottom left of screen"\n  - primary_color → decide based on the image provided\n  - secondary_color → decide based on the image provided\n  - tertiary_color → decide based on the image provided\n  - font_style → decide based on the image provided\n  - ad_copy → keep short, punchy, action-oriented.\n  - visual_guide → If the request involves a human character, define camera angle/camera used. If no visual guide is given, describe placement/size of character, what they're doing with the product, style of the ad, main background color and text color.\n- CRITICAL: The product must look exactly like what's in the reference image. Do not redraw or alter logos, text, proportions, materials, or exact colors.\n\n### E - Examples:\ngood_examples:\n- character: as defined by the user\n- ad_copy: as defined by the user, or decide if not provided\n- visual_guide: as defined by the user. If detailed, expand to accommodate while respecting the color palette.\n- text_watermark: as defined by the user, leave blank if none provided\n- text_watermark_location: as defined by the user, or bottom left if none provided\n\n### N - Notation:\nformat: text string nested within an "image_prompt" parameter. Avoid using double-quotes or raw newlines.\nexample_output: |\n{\n  "image_prompt": "final prompt here"\n}`;

  const userPrompt = `Your task: Create 1 image prompt as guided by your system guidelines.\n\nDescription of the reference image: ${productDescription}\n\nELEMENTS FOR THIS IMAGE:\n\nproduct: ${String(elements.product || '')}\ncharacter: ${String(elements.character || '')}\nad_copy: ${String(elements.ad_copy || '')}\nvisual_guide: ${String(elements.visual_guide || '')}\ntext_watermark: ${String(elements.text_watermark || '')}\ntext_watermark_location: ${String(elements.text_watermark_location || 'bottom left')}\n\nPrimary color: ${String(elements.primary_color || '')}\nSecondary color: ${String(elements.secondary_color || '')}\nTertiary color: ${String(elements.tertiary_color || '')}`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 800,
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'final_cover_prompt',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            image_prompt: { type: 'string' }
          },
          required: ['image_prompt'],
          additionalProperties: false
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra',
      'User-Agent': 'Flowtra/1.0'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(content);
    if (!parsed?.image_prompt) throw new Error('Missing image_prompt');
    return String(parsed.image_prompt);
  } catch (e) {
    throw new Error(`Failed to parse final cover prompt: ${e}`);
  }
}

async function generateCoverWithNanoBanana(originalImageUrl: string, imagePrompt: string, imageSize = 'auto'): Promise<string> {
  // Build request payload to match KIE nano-banana-edit expectations
  const requestBody: Record<string, unknown> = {
    model: 'google/nano-banana-edit',
    input: {
      prompt: imagePrompt,
      image_urls: [originalImageUrl],
      output_format: 'png',
      image_size: imageSize
    }
  };

  // Optionally attach callback URL if provided via env
  if (process.env.KIE_CALLBACK_URL) {
    requestBody.callBackUrl = process.env.KIE_CALLBACK_URL;
  }

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`KIE nano-banana API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(data.message || 'Failed to generate cover with nano-banana');
  }

  return data.data.taskId;
}

export type VideoPromptDesign = {
  description: string;
  setting: string;
  camera_type: string;
  camera_movement: string;
  action: string;
  lighting: string;
  other_details: string;
  dialogue: string;
  music: string;
  ending: string;
};

export async function generateVideoDesignFromCover(
  coverImageUrl: string,
  elements: Record<string, unknown> | undefined,
  productDescription?: string
): Promise<VideoPromptDesign> {
  const systemPrompt = `Video Prompt Generator for Product Creatives\nRole\nYou are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned video content for product marketing.\n\nTask\nGenerate a video prompt and return ONLY the JSON object inside video_prompt.\n\nGuidance\nAlways use the product description and creative brief as provided by the user. Include these essential details in every prompt: description, setting, camera_type, camera_movement, action, lighting, other_details, dialogue, music, ending. Scenes must be visually rich and avoid generic or vague descriptions. Adhere strictly to the brand identity and ensure the final output feels polished, cinematic, and aligned with the marketing intent.\n\nConstraints\nRespond ONLY with the JSON object of video_prompt. Do NOT include any image URLs or references to image links in the JSON.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Context:\nproduct_description: ${productDescription || ''}\nelements: ${JSON.stringify(elements || {})}\n\nUse the attached image input to ground the design. Return ONLY the JSON object for video_prompt.`
          },
          {
            type: 'image_url',
            image_url: {
              url: coverImageUrl
            }
          }
        ]
      }
    ],
    max_tokens: 1200,
    temperature: 0.7,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'video_prompt',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            setting: { type: 'string' },
            camera_type: { type: 'string' },
            camera_movement: { type: 'string' },
            action: { type: 'string' },
            lighting: { type: 'string' },
            other_details: { type: 'string' },
            dialogue: { type: 'string' },
            music: { type: 'string' },
            ending: { type: 'string' }
          },
          required: ['description','setting','camera_type','camera_movement','action','lighting','other_details','dialogue','music','ending']
        }
      }
    }
  });

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra',
      'User-Agent': 'Flowtra/1.0'
    },
    body: requestBody
  }, 3, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  try {
    return JSON.parse(content) as VideoPromptDesign;
  } catch (e) {
    throw new Error(`Failed to parse video_prompt JSON: ${e}`);
  }
}

// Removed: getBatchStatus (batch-based status)

// ========== V2 (no-batch) additions ==========
export interface WorkflowV2Item {
  id: string;
  user_id: string;
  original_image_url: string;
  product_description?: string;
  elements_data?: Record<string, unknown>;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  video_url?: string;
  status: 'pending' | 'generating_cover' | 'generating_video' | 'completed' | 'failed';
  current_step: 'waiting' | 'generating_cover' | 'generating_video' | 'completed';
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  last_processed_at: string | null;
}

export async function startV2Items({
  imageUrl,
  userId,
  videoModel,
  elementsCount = 2,
  textWatermark,
  textWatermarkLocation,
  imageSize = 'auto'
}: StartBatchWorkflowRequest): Promise<{ success: boolean; itemIds?: string[]; message?: string; error?: string }> {
  try {
    if (!imageUrl || !userId) {
      return { success: false, error: 'Image URL and User ID are required' };
    }

    const supabase = getSupabase();

    // Generation is free now; only deduct on download

    const description = await describeImage(imageUrl);
    const elements = await generateMultipleElements(imageUrl, elementsCount, textWatermark, textWatermarkLocation);

    const itemsPayload = elements.map((element) => ({
      user_id: userId,
      original_image_url: imageUrl,
      product_description: description,
      elements_data: {
        ...element,
        image_size: imageSize
      },
      video_model: videoModel,
      credits_cost: getCreditCost(videoModel),
      status: 'pending' as const,
      current_step: 'waiting' as const,
      progress_percentage: 0
    }));

    const { data: created, error } = await supabase
      .from('user_history_v2')
      .insert(itemsPayload)
      .select();

    if (error) {
      return { success: false, error: `Failed to create items: ${error.message}` };
    }

    type CreatedRow = { id: string; elements_data: Record<string, unknown> | null };
    const itemIds = (created || []).map((r: CreatedRow) => r.id);

    // No upfront credit deduction or transaction logging here

    for (const item of (created || []) as CreatedRow[]) {
      try {
        await startCoverGenerationV2(
          item.id,
          imageUrl,
          description,
          (item as CreatedRow).elements_data as Record<string, unknown>
        );
      } catch (e) {
        await supabase
          .from('user_history_v2')
          .update({
            status: 'failed',
            error_message: e instanceof Error ? e.message : 'Cover generation failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    }

    return { success: true, itemIds, message: 'V2 items started' };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function getV2ItemsStatus(ids: string[]): Promise<{ success: boolean; items?: WorkflowV2Item[]; error?: string }>{
  try {
    if (!ids?.length) return { success: true, items: [] };
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('user_history_v2')
      .select('*')
      .in('id', ids);
    if (error) return { success: false, error: error.message };
    return { success: true, items: (data || []) as WorkflowV2Item[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function startCoverGenerationV2(
  itemId: string,
  originalImageUrl: string,
  productDescription: string,
  elements: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from('user_history_v2')
    .update({
      status: 'generating_cover',
      current_step: 'generating_cover',
      progress_percentage: 10,
      updated_at: new Date().toISOString(),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', itemId);

  // Step 3: Generate final image_prompt via OpenRouter using description + elements
  const finalImagePrompt = await generateFinalCoverPrompt(productDescription, elements);

  // Extract image_size from elements (default to 'auto' if not specified)
  const imageSize = (elements.image_size as string) || 'auto';

  // Generate cover with Banana using final image_prompt and original image URL
  const taskId = await generateCoverWithNanoBanana(originalImageUrl, finalImagePrompt, imageSize);

  await supabase
    .from('user_history_v2')
    .update({
      cover_task_id: taskId,
      updated_at: new Date().toISOString(),
      last_processed_at: new Date().toISOString()
    })
    .eq('id', itemId);
}
