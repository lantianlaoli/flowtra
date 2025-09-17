import { getSupabaseAdmin } from '@/lib/supabase';
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
            text: 'You are reviewing a product packaging photo to establish non-negotiable visual anchors for a unified ad campaign. Extract the fixed brand cues (logo, typography, palette), product angle, lighting, and background styling. Identify any printed mascot on the packaging so future prompts can introduce a different live hero. Return JSON that follows the provided schema exactly; fill every required field and use "none" when a value is not present.'
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
    max_tokens: 700,
    temperature: 0.2,
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
            brand_tone: {
              type: 'string',
              description: 'Short description of the brand voice inferred from packaging (e.g., wholesome and joyful, minimalist premium).'
            },
            color_scheme: {
              type: 'array',
              description: 'Three core brand colors in order of dominance. Use hex values from the packaging where possible.',
              minItems: 3,
              items: {
                type: 'object',
                properties: {
                  hex: { type: 'string' },
                  name: { type: 'string' },
                  role: {
                    type: 'string',
                    description: 'How the color is used (primary, secondary, tertiary, accent, neutral).'
                  }
                },
                required: ['hex', 'name', 'role']
              }
            },
            font_style: {
              type: 'string',
              description: 'Font family or typographic feel on the packaging (e.g., bold sans-serif, serif, handwritten).'
            },
            product_anchor: {
              type: 'string',
              description: 'Immutable packaging details that must stay identical (logo placement, key graphics, pack structure).'
            },
            product_angle: {
              type: 'string',
              description: 'Camera angle or orientation of the packaging (e.g., three-quarter front, straight-on eye level).'
            },
            lighting_style: {
              type: 'string',
              description: 'Lighting mood to replicate (e.g., soft studio, high-contrast spotlight).'
            },
            background_style: {
              type: 'string',
              description: 'Describe the background or surface treatment to reuse (e.g., mint-to-cream gradient studio backdrop).'
            },
            packaging_character: {
              type: 'string',
              description: 'Describe any mascot or character printed on the packaging. Return "none" if none is visible.'
            },
            visual_description: {
              type: 'string',
              description: 'One to two sentences summarizing the product appearance and overall vibe without inventing new contexts.'
            }
          },
          required: [
            'type',
            'visual_description',
            'brand_tone',
            'product_anchor',
            'product_angle',
            'lighting_style',
            'background_style',
            'color_scheme',
            'packaging_character'
          ],
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
  brandAnalysis: string,
  userWatermark?: string,
  userWatermarkLocation?: string
): Promise<Record<string, unknown>[]> {
  const systemPrompt = `### Unified Campaign Brief
Create ${count} creative element set${count === 1 ? '' : 's'} for one cohesive advertising campaign.

Shared anchors to preserve in every set:
- Treat the packaged product as the fixed hero. Never alter the logo, typography, packaging structure, or brand colors.
- Mirror the product_angle, lighting_style, and background_style supplied in the analysis.
- Keep product placement identical: hero pack stays in the same position and angle within the frame.

Allowed variation (and only here):
- Vary the live hero described in 'character' (1–3 word descriptor without actions) and the pose/mood captured in 'visual_guide'.
- Each character must be distinct from any packaging mascot noted in the analysis.
- 'visual_guide' must confirm the shared studio/gradient background, consistent lighting, and identical product placement while describing how the new hero interacts with the pack.

Copy and palette requirements:
- 'product' repeats the precise product or line name.
- 'ad_copy' is one concise sentence using the same brand tone keywords from the analysis (e.g., healthy, joyful, premium). Keep voice consistent across all sets.
- Reuse the same primary, secondary, and tertiary colors across every variant by copying the dominant trio from the analysis data.

Category awareness:
- Select hero types that make sense for the product category (pets for pet goods, models for cosmetics, athletes for beverages, families for snacks, professionals for tech, etc.) so the rule set scales beyond pet food.

Return exactly ${count} set${count === 1 ? '' : 's'} and include every required field for each set.`;

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
            text: `Your task: Using the uploaded product image and the structured brand analysis, create exactly ${count} unified element set${count === 1 ? '' : 's'} that obey the shared-anchor rules.`
          },
          {
            type: 'text',
            text: `BRAND_ANALYSIS_JSON:\n${brandAnalysis}`
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
    max_tokens: 2000,
    temperature: 0.6,
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
// Step 3: Combine description + one elements set to generate final cover prompt
async function generateFinalCoverPrompt(
  productDescription: string,
  elements: AdElements
): Promise<string> {
  const systemPrompt = `## SYSTEM PROMPT: 🔍 Image Ad Prompt Generator Agent

### Ask
Create exactly one structured image ad prompt with every required field filled.

The final prompt MUST be written exactly like:
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

### Role
Creative ad prompt engineer responsible for preserving brand anchors.

### Campaign Consistency Rules (CRITICAL)
- The packaged product from the reference image is the sole visual anchor. Never alter logos, typography, packaging structure, pack copy, or brand colors.
- Mirror the product_angle, lighting_style, and background_style from the brand analysis. Background must remain a controlled studio/gradient environment (no scenic locations or unrelated props).
- Keep product placement identical: hero pack holds the same position and angle, with matching light direction and intensity.
- Reuse the provided primary/secondary/tertiary colors verbatim. Do not invent or swap palette values.
- The hero subject described must be a new live character distinct from any packaging mascot noted in the analysis, while interacting with the physical product in the same choreographed manner across the series.

### Sanitization & Normalization
- If visual_guide suggests locations, props, or camera treatments that break the shared anchor, rewrite it to the studio/gradient setup with the consistent camera angle.
- If character text contains actions or long sentences, normalize it to a concise label (1–3 words) and move actions into visual_guide.
- Ensure visual_guide explicitly states the consistent product placement (e.g., "product pack front-left three-quarter angle") and lighting alignment.
- Do not mention being different from the packaging; simply describe the correct setup.
- Always keep color fields identical to the provided elements.
- Maintain concise, production-ready language with no extra commentary.

### Guidance
- Always include all required fields.
- Align ad_copy tone with the brand_tone keywords extracted from the analysis.
- If text_watermark_location is missing, default to "bottom left of screen".
- visual_guide must cover hero pose, interaction with the product, camera framing, lighting, and the shared studio/gradient background.
- CRITICAL: The product must look exactly like the reference. Do not redraw or alter logos, text, proportions, materials, or exact colors.

### Notation
Return JSON with a single field: "image_prompt" (string). Do not include additional keys or explanations.`;

  const userPrompt = `Your task: Create one image prompt that follows the system rules.

BRAND ANALYSIS JSON (Stage 1):
${productDescription}

Remember:
- Treat product_anchor details as immovable.
- Mirror product_angle, lighting_style, and background_style exactly.
- packaging_character describes the on-pack mascot; the live hero you describe must be different while interacting with the product in the same way.
- Use the brand_tone keywords to keep ad_copy voice unified.

ELEMENTS FOR THIS IMAGE (normalize if needed):
product: ${String(elements.product || '')}
character: ${String(elements.character || '')}
ad_copy: ${String(elements.ad_copy || '')}
visual_guide: ${String(elements.visual_guide || '')}
text_watermark: ${String(elements.text_watermark || '')}
text_watermark_location: ${String(elements.text_watermark_location || 'bottom left of screen')}

Primary color of ad: ${String(elements.primary_color || '')}
Secondary color of ad: ${String(elements.secondary_color || '')}
Tertiary color of ad: ${String(elements.tertiary_color || '')}`;

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
  if (process.env.KIE_BANANA_CALLBACK_URL) {
    requestBody.callBackUrl = process.env.KIE_BANANA_CALLBACK_URL;
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
          required: ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'other_details', 'dialogue', 'music', 'ending']
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
  cover_image_size?: string | null;
  video_url?: string;
  watermark_text?: string | null;
  watermark_location?: string | null;
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

    const supabase = getSupabaseAdmin();

    // Generation is free now; only deduct on download

    const description = await describeImage(imageUrl);
    const sanitizedWatermark = textWatermark?.trim() || null;
    const sanitizedWatermarkLocation = textWatermarkLocation?.trim() || (sanitizedWatermark ? 'bottom left' : null);

    const elements = await generateMultipleElements(
      imageUrl,
      elementsCount,
      description,
      sanitizedWatermark || undefined,
      sanitizedWatermarkLocation || undefined
    );

    const itemsPayload = elements.map((element) => ({
      user_id: userId,
      original_image_url: imageUrl,
      product_description: description,
      elements_data: {
        ...element,
        image_size: imageSize
      },
      cover_image_size: imageSize,
      watermark_text: sanitizedWatermark,
      watermark_location: sanitizedWatermarkLocation,
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

export async function getV2ItemsStatus(ids: string[]): Promise<{ success: boolean; items?: WorkflowV2Item[]; error?: string }> {
  try {
    if (!ids?.length) return { success: true, items: [] };
    const supabase = getSupabaseAdmin();
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
  const supabase = getSupabaseAdmin();
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

  const updatePayload: Record<string, unknown> = {
    cover_task_id: taskId,
    updated_at: new Date().toISOString(),
    last_processed_at: new Date().toISOString()
  };

  if (typeof imageSize === 'string' && imageSize.trim().length > 0) {
    updatePayload.cover_image_size = imageSize.trim();
  }

  await supabase
    .from('user_history_v2')
    .update(updatePayload)
    .eq('id', itemId);
}
