import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getCreditCost } from '@/lib/constants';

export interface StartBatchWorkflowRequest {
  imageUrl: string;
  userId: string;
  videoModel?: 'veo3' | 'veo3_fast';
  elementsCount?: number;
  // Optional user-provided ad copy to override generated ad_copy
  adCopy?: string;
  textWatermark?: string;
  textWatermarkLocation?: string;
  imageSize?: string;
  generateVideo?: boolean;
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

export type DescribeImageResult = Record<string, unknown>;

async function describeImage(imageUrl: string): Promise<DescribeImageResult> {
  const systemText = `Analyze the given image and determine if it primarily depicts a product or a character, or BOTH.

- If the image is of a product, return the analysis in JSON format with the following fields:

{\n  "type": "product",\n  "brand_name": "(Name of the brand shown in the image, if visible or inferable)",\n  "color_scheme": [\n    {\n      "hex": "(Hex code of each prominent color used)",\n      "name": "(Descriptive name of the color)"\n    }\n  ],\n  "font_style": "(Describe the font family or style used: serif/sans-serif, bold/thin, etc.)",\n  "visual_description": "(A full sentence or two summarizing what is seen in the image, ignoring the background)"\n}

- If the image is of a character, return the analysis in JSON format with the following fields:

{\n  "type": "character",\n  "outfit_style": "(Description of clothing style, accessories, or notable features)",\n  "visual_description": "(A full sentence or two summarizing what the character looks like, ignoring the background)"\n}

- If it is BOTH, return both descriptions in JSON format:

{\n  "type": "both",\n  "product": {\n    "brand_name": "...",\n    "color_scheme": [...],\n    "font_style": "...",\n    "visual_description": "..."\n  },\n  "character": {\n    "outfit_style": "...",\n    "visual_description": "..."\n  }\n}`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
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
      type: 'json_schema',
      json_schema: {
        name: 'image_analysis',
        strict: true,
        schema: {
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['product'] },
                brand_name: { type: 'string' },
                color_scheme: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      hex: { type: 'string' },
                      name: { type: 'string' }
                    },
                    required: ['hex', 'name'],
                    additionalProperties: false
                  }
                },
                font_style: { type: 'string' },
                visual_description: { type: 'string' }
              },
              required: ['type', 'brand_name', 'color_scheme', 'font_style', 'visual_description'],
              additionalProperties: false
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['character'] },
                outfit_style: { type: 'string' },
                visual_description: { type: 'string' }
              },
              required: ['type', 'outfit_style', 'visual_description'],
              additionalProperties: false
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['both'] },
                product: {
                  type: 'object',
                  properties: {
                    brand_name: { type: 'string' },
                    color_scheme: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          hex: { type: 'string' },
                          name: { type: 'string' }
                        },
                        required: ['hex', 'name'],
                        additionalProperties: false
                      }
                    },
                    font_style: { type: 'string' },
                    visual_description: { type: 'string' }
                  },
                  required: ['brand_name', 'color_scheme', 'font_style', 'visual_description'],
                  additionalProperties: false
                },
                character: {
                  type: 'object',
                  properties: {
                    outfit_style: { type: 'string' },
                    visual_description: { type: 'string' }
                  },
                  required: ['outfit_style', 'visual_description'],
                  additionalProperties: false
                }
              },
              required: ['type', 'product', 'character'],
              additionalProperties: false
            }
          ]
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
  const content = data.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(content) as DescribeImageResult;
  } catch (e) {
    throw new Error(`Failed to parse image analysis JSON: ${e}`);
  }
}

async function generateMultipleElements(
  imageUrl: string,
  count: number,
  userWatermark?: string,
  userWatermarkLocation?: string,
  adCopyOverride?: string
): Promise<Record<string, unknown>[]> {
  const systemPrompt = `### A - Ask:
Create exactly ${count} different sets of ELEMENTS for the uploaded ad image.
Each set must include all required fields and differ in tone, mood, or creative angle.

### G - Guidance:
role: Creative ad concept generator

definition:
- character → Must be a specific, product-linked identity: a concrete person, IP/character name, or a specific animal/breed that is clearly relevant to the product category or brand. Never output abstract, generic, or non-specific entities (e.g., "Abstract Shapes", "Robot Character", "Generic Mascot").

selection_rules:
- If a recognizable brand or franchise is visible/inferable, prefer iconic characters/IPs from that brand’s ecosystem.
- If the image is primarily gaming (console/handheld/controller/game), choose classic game characters/IPs tied to the platform or popular titles (e.g., "Mario", "Pikachu", "Link", "Sonic", "Kratos").
- If the image is a pet-related product (dog/cat), choose a specific breed aligned with the brand/packaging style (e.g., "Shiba Inu", "Golden Retriever", "British Shorthair", "Siamese"). Vary breeds across sets.
- If the image is toys/anime/collectibles, pick named characters from the relevant franchise (e.g., "Doraemon", "Hello Kitty", "Luffy").
- If no IP is appropriate, create a concrete, non-generic persona strongly tied to the product context (e.g., "Italian pizzaiolo in white chef jacket", "marathon runner wearing racing bib #21"). Avoid vague categories.

constraints:
- product → Product or line name
- character → As defined above; must be specific and product-linked
- ad_copy → Short, catchy slogan
- visual_guide → Describe the character’s pose/action, product placement/visibility, background mood, and style cues consistent with the brand/category
- primary_color → Main color (from packaging/ad)
- secondary_color → Supporting color
- tertiary_color → Accent color

Return JSON only with an 'elements' array. Use snake_case keys exactly as listed above.

### E - Examples (for a gaming console image):
{
  "elements": [
    {
      "product": "Nintendo Switch (OLED Model)",
      "character": "Mario",
      "ad_copy": "Play the icons. Anywhere.",
      "visual_guide": "Mario jumps with a cheerful pose next to the docked console; product front-facing and well-lit; background uses bright red accents with subtle motion streaks to imply speed.",
      "primary_color": "#E60012",
      "secondary_color": "#000000",
      "tertiary_color": "#FFFFFF"
    },
    {
      "product": "Nintendo Switch (OLED Model)",
      "character": "Link",
      "ad_copy": "Adventure unlocked.",
      "visual_guide": "Link stands heroically beside the handheld console; product angled to show screen; background features soft green-blue gradient with light particles for fantasy atmosphere.",
      "primary_color": "#1A5E3B",
      "secondary_color": "#2C3E50",
      "tertiary_color": "#F1C40F"
    }
  ]
}`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [ { type: 'image_url', image_url: { url: imageUrl } } ] }
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

    // Add user-provided watermark data to each element only if provided
    return elements.map((element: Record<string, unknown>) => ({
      ...element,
      // If user provided an ad copy, override the generated one for consistency
      ...(adCopyOverride ? { ad_copy: adCopyOverride } : {}),
      ...(userWatermark ? { text_watermark: userWatermark } : {}),
      ...(userWatermark ? { text_watermark_location: userWatermarkLocation || 'bottom left' } : {})
    }));
  } catch (parseError) {
    throw new Error(`Failed to parse generated elements: ${parseError}`);
  }
}

// Step 3: Combine description + one elements set to generate final cover prompt
// Change: return parsed JSON object directly instead of assembling a string
export type FinalCoverPrompt = Record<string, unknown>;

async function generateFinalCoverPrompt(
  productDescription: string | Record<string, unknown>,
  elements: AdElements
): Promise<FinalCoverPrompt> {
  const systemPrompt = `### A - Ask:
Create a structured image ad prompt with all required fields filled, based on the given description and elements.

### G - Guidance:
role: Creative ad prompt engineer

constraints:
- Always include all required fields.
- Integrate the user's provided description and elements as faithfully as possible.
- If any input is missing, apply smart defaults:
  - text_watermark_location → "bottom left of screen"
  - primary_color / secondary_color / tertiary_color → derive from the provided image or elements
  - font_style → decide based on the reference image
  - ad_copy → short, punchy, action-oriented
  - visual_guide → describe placement, pose, product visibility, background, and style; respect the given palette
  - text_watermark → if none provided by user, omit any watermark entirely and DO NOT invent or add one.

### E - Example:
{
  "product": "Happy Dog Sensible Neuseeland",
  "character": "Corgi",
  "ad_copy": "Healthy mode, happy life.",
  "visual_guide": "The corgi stretches playfully on a mat, product pack placed to the side, background is a bright green gradient with clean lighting, style is playful and dynamic.",
  // Note: If user did not provide a watermark, omit text_watermark and text_watermark_location fields entirely.
  "Primary color of ad": "#3E6B4D",
  "Secondary color of ad": "#FFD966",
  "Tertiary color of ad": "#FFFFFF"
}`;

  const pd = typeof productDescription === 'string' ? productDescription : JSON.stringify(productDescription);
  const userPrompt = `Your task: Create an image prompt as guided by your system guidelines.

Description of the reference image: ${pd}

ELEMENTS FOR THIS IMAGE:

product: ${String(elements.product || '')}
character: ${String(elements.character || '')}
ad_copy: ${String(elements.ad_copy || '')}
visual_guide: ${String(elements.visual_guide || '')}
${elements.text_watermark ? `text_watermark: ${String(elements.text_watermark)}` : ''}
${elements.text_watermark_location ? `text_watermark_location: ${String(elements.text_watermark_location)}` : ''}

Primary color: ${String(elements.primary_color || '')}
Secondary color: ${String(elements.secondary_color || '')}
Tertiary color: ${String(elements.tertiary_color || '')}`;

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
            product: { type: 'string' },
            character: { type: 'string' },
            ad_copy: { type: 'string' },
            visual_guide: { type: 'string' },
            // Watermark fields are optional; omit when not provided
            text_watermark: { type: 'string' },
            text_watermark_location: { type: 'string' },
            "Primary color of ad": { type: 'string' },
            "Secondary color of ad": { type: 'string' },
            "Tertiary color of ad": { type: 'string' }
          },
          required: [
            'product',
            'character',
            'ad_copy',
            'visual_guide',
            'Primary color of ad',
            'Secondary color of ad',
            'Tertiary color of ad'
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
  const content = data.choices?.[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(content) as FinalCoverPrompt;
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse final cover prompt JSON: ${e}`);
  }
}


async function generateCoverWithNanoBanana(originalImageUrl: string, imagePrompt: string | Record<string, unknown>, imageSize = 'auto'): Promise<string> {
  // Helper to call KIE
  const callKIE = async (promptPayload: unknown) => {
    const requestBody: Record<string, unknown> = {
      model: 'google/nano-banana-edit',
      input: {
        prompt: promptPayload,
        image_urls: [originalImageUrl],
        output_format: 'png',
        image_size: imageSize
      }
    };

    if (process.env.KIE_ADS_IMAGE_CALLBACK_URL) {
      requestBody.callBackUrl = process.env.KIE_ADS_IMAGE_CALLBACK_URL;
    }

    const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    }, 3, 30000);

    const text = await response.text();
    // Narrowly typed KIE response shape to avoid `any`.
    let json: { code?: number; message?: string; data?: { taskId?: string } } | null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    if (!response.ok) {
      const msg = json?.message || text;
      throw new Error(`KIE nano-banana API error: ${response.status} ${msg}`);
    }

    if (!json || json.code !== 200) {
      const errMsg = json?.message || 'Unknown KIE error';
      throw new Error(errMsg);
    }

    if (!json.data || !json.data.taskId) {
      throw new Error('KIE response missing taskId');
    }

    return json.data.taskId as string;
  };

  // First attempt: pass JSON/object as-is if provided
  try {
    return await callKIE(imagePrompt);
  } catch (err) {
    // Fallback: if prompt is object, retry with a string prompt to maximize compatibility
    const shouldFallback = typeof imagePrompt !== 'string';
    if (!shouldFallback) throw new Error(`Failed to generate cover with nano-banana: ${(err as Error).message}`);

    // Minimal conversion: stringify structured prompt
    const fallbackPrompt = JSON.stringify(imagePrompt);
    try {
      return await callKIE(fallbackPrompt);
    } catch (err2) {
      throw new Error(`Failed to generate cover with nano-banana: ${(err2 as Error).message}`);
    }
  }
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
  productDescription?: string | Record<string, unknown>
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
            text: `Context:\nproduct_description: ${typeof productDescription === 'string' ? (productDescription || '') : JSON.stringify(productDescription || {})}\nelements: ${JSON.stringify(elements || {})}\n\nUse the attached image input to ground the design. Return ONLY the JSON object for video_prompt.`
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
  photo_only?: boolean | null;
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
  videoModel = 'veo3_fast',
  elementsCount = 2,
  adCopy,
  textWatermark,
  textWatermarkLocation,
  imageSize = 'auto',
  generateVideo = true
}: StartBatchWorkflowRequest): Promise<{ success: boolean; itemIds?: string[]; message?: string; error?: string }> {
  try {
    if (!imageUrl || !userId) {
      return { success: false, error: 'Image URL and User ID are required' };
    }

    const shouldGenerateVideo = generateVideo !== false;
    const resolvedVideoModel = videoModel || 'veo3_fast';

    const supabase = getSupabaseAdmin();

    // Generation is free now; only deduct on download

    const description = await describeImage(imageUrl);
    const sanitizedWatermark = textWatermark?.trim() || null;
    const sanitizedWatermarkLocation = textWatermarkLocation?.trim() || (sanitizedWatermark ? 'bottom left' : null);

    const elements = await generateMultipleElements(
      imageUrl,
      elementsCount,
      sanitizedWatermark || undefined,
      sanitizedWatermarkLocation || undefined,
      adCopy?.trim() ? adCopy.trim() : undefined
    );

    const itemsPayload = elements.map((element) => ({
      user_id: userId,
      original_image_url: imageUrl,
      product_description: description,
      elements_data: {
        ...element,
        image_size: imageSize,
        generate_video: shouldGenerateVideo
      },
      photo_only: !shouldGenerateVideo,
      cover_image_size: imageSize,
      watermark_text: sanitizedWatermark,
      watermark_location: sanitizedWatermarkLocation,
      video_model: shouldGenerateVideo ? resolvedVideoModel : null,
      credits_cost: shouldGenerateVideo ? getCreditCost(resolvedVideoModel) : 0,
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
  productDescription: string | Record<string, unknown>,
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

  // Persist the exact image prompt to DB before sending to nano-banana for auditing
  try {
    await supabase
      .from('user_history_v2')
      .update({
        // Persist as JSONB (object) for audit/storage
        image_prompt: finalImagePrompt as Record<string, unknown>,
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', itemId);
  } catch (e) {
    // Non-fatal: continue even if audit field write fails
    console.warn('Failed to persist image_prompt for V2 item', { itemId, error: e });
  }

  // Extract image_size from elements (default to 'auto' if not specified)
  const imageSize = (elements.image_size as string) || 'auto';

  // Generate cover with Banana using final image_prompt and original image URL
  const taskId = await generateCoverWithNanoBanana(originalImageUrl, finalImagePrompt as Record<string, unknown>, imageSize);

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
