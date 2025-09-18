import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { httpRequestWithRetry } from '@/lib/httpRequest';
import { getCreditCost, CREDIT_COSTS } from '@/lib/constants';
import { getUserCredits } from '@/lib/credits';

export interface StartWorkflowRequest {
  imageUrl: string;
  userId?: string;
  videoModel?: 'veo3' | 'veo3_fast' | 'auto';
  watermark?: string;
  watermarkLocation?: string;
  imageSize?: string;
  elementsCount?: number;
  generateVideo?: boolean;
}

export interface StartWorkflowResult {
  success: boolean;
  historyId?: string;
  historyIds?: string[];
  message: string;
  coverTaskId?: string;
  error?: string;
  details?: string;
  remainingCredits?: number;
  creditsUsed?: number;
}

export async function startWorkflowProcess({
  imageUrl,
  userId,
  videoModel = 'veo3_fast',
  watermark,
  watermarkLocation = 'bottom left',
  imageSize = 'auto',
  elementsCount = 1,
  generateVideo
}: StartWorkflowRequest): Promise<StartWorkflowResult> {
  try {
    console.log('🔍 startWorkflowProcess started with:', {
      imageUrl,
      userId,
      videoModel,
      watermark,
      watermarkLocation,
      imageSize,
      elementsCount
    });

    if (!imageUrl) {
      return { success: false, error: 'Image URL is required', message: 'Image URL is required' };
    }

  // Generation is free now; only deduct on download
    let actualModel: 'veo3' | 'veo3_fast';
    
    // Resolve auto mode to actual model
    if (videoModel === 'auto') {
      // For auto mode, we need to determine the actual model based on user credits
      // This will be resolved later when we have user context
      actualModel = 'veo3_fast'; // Default fallback
    } else {
      actualModel = videoModel;
    }
    
    // For auto mode we still choose a model based on credits visibility, but we do not deduct now.
    if (userId && videoModel === 'auto') {
      const userCreditsResult = await getUserCredits(userId);
      if (userCreditsResult.success && userCreditsResult.credits) {
        const userCredits = userCreditsResult.credits.credits_remaining;
        if (userCredits >= CREDIT_COSTS.veo3) {
          actualModel = 'veo3';
        } else if (userCredits >= CREDIT_COSTS.veo3_fast) {
          actualModel = 'veo3_fast';
        } else {
          // If the user cannot afford any model, fallback to veo3_fast for generation preview
          actualModel = 'veo3_fast';
        }
      }
    }

    const shouldGenerateVideo = generateVideo !== false;

    // Create history records (no credit deduction at generation)
    let historyRecords = [];
    if (userId) {
      const supabase = getSupabaseAdmin();

      // Create multiple records for independent processing
      const recordsToInsert = Array.from({ length: elementsCount }, () => ({
        user_id: userId,
        original_image_url: imageUrl,
        video_model: actualModel,
        photo_only: !shouldGenerateVideo,
        credits_cost: getCreditCost(actualModel),
        status: 'started',
        current_step: 'describing',
        progress_percentage: 5,
        last_processed_at: new Date().toISOString(),
        image_prompt: null,
        watermark_text: watermark || null,
        watermark_location: watermarkLocation,
        cover_image_size: imageSize,
      }));

      const { data, error } = await supabase
        .from('user_history')
        .insert(recordsToInsert)
        .select();

      if (error) {
        console.error('Failed to create history records:', error);
        return { success: false, error: 'Failed to create workflow records', message: 'Failed to create workflow records' };
      }

      historyRecords = data || [];
    }

    console.log(`Starting workflow for user ${userId}, ${historyRecords.length} history records created`);

    // Start the complete workflow process - handle each record
    try {
      // Step 1: Describe the image (shared across all records)
      console.log('Step 1: Describing image...');

      // Update all records to describing state
      for (const record of historyRecords) {
        await updateWorkflowProgress(record.id, 'describing', 10, 'in_progress');
      }

      const description = await describeImage(imageUrl);

      // Step 2: Generate creative prompts for each record (different variations)
      console.log('Step 2: Generating prompts...');

      const promptsArray = await Promise.all(
        historyRecords.map(async (record, index) => {
          await updateWorkflowProgress(record.id, 'generating_prompts', 40, 'in_progress');

          // Generate slightly different prompts for variety
          const prompts = await generatePrompts(description + (index > 0 ? ` - Variation ${index + 1}` : ''), watermark, watermarkLocation);
          const preparedImagePrompt = prepareImagePrompt(prompts.image_prompt, watermark, watermarkLocation);
          if (preparedImagePrompt !== prompts.image_prompt) {
            console.warn('Adjusted image prompt to enforce exact watermark text', {
              recordId: record.id,
              watermark,
              originalPrompt: prompts.image_prompt,
              preparedPrompt: preparedImagePrompt
            });
          } else if (watermark && !prompts.image_prompt.includes(watermark)) {
            console.warn('Image prompt missing exact watermark text even after preparation', {
              recordId: record.id,
              watermark,
              prompt: prompts.image_prompt
            });
          }
          prompts.image_prompt = preparedImagePrompt;

          // Update record with prompts
          const supabase = getSupabaseAdmin();
          await supabase
            .from('user_history')
            .update({
              product_description: description,
              video_prompts: prompts.video_prompt,
              image_prompt: prompts.image_prompt,
              current_step: 'generating_cover',
              progress_percentage: 55,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id);

          return { recordId: record.id, prompts };
        })
      );

      console.log(`Prompts generated for ${promptsArray.length} records`);

      // Step 3: Generate cover images
      console.log('Step 3: Generating covers...');

      const coverResults = await Promise.all(
        promptsArray.map(async ({ recordId, prompts }) => {
          await updateWorkflowProgress(recordId, 'generating_cover', 70, 'in_progress');

          const coverTaskId = await generateCoverWithBanana(imageUrl, prompts.image_prompt, imageSize);

          // Update record with cover task ID
          const supabase = getSupabaseAdmin();
          await supabase
            .from('user_history')
            .update({
              cover_task_id: coverTaskId,
              current_step: 'generating_cover',
              progress_percentage: 75,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', recordId);

          return { recordId, coverTaskId };
        })
      );

      console.log(`Cover generation started for ${coverResults.length} records`);

      // Return success immediately - monitoring will handle the rest
      const finalCreditsResult = userId ? await getUserCredits(userId) : null;
      const finalRemainingCredits = finalCreditsResult?.credits?.credits_remaining;
      return {
        success: true,
        historyId: historyRecords[0]?.id, // Return primary record ID
        historyIds: historyRecords.map(r => r.id), // Return all IDs for batch tracking
        message: `Workflow started successfully. ${elementsCount} ad${elementsCount > 1 ? 's' : ''} being generated.`,
        coverTaskId: coverResults[0]?.coverTaskId,
        remainingCredits: finalRemainingCredits,
        creditsUsed: 0
      };

    } catch (error) {
      console.error('Workflow error:', error);

      // Update all records to failed
      const supabase = getSupabaseAdmin();
      await Promise.all(
        historyRecords.map(record =>
          supabase
            .from('user_history')
            .update({
              status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error occurred',
              last_processed_at: new Date().toISOString()
            })
            .eq('id', record.id)
        )
      );

      return {
        success: false,
        error: 'Workflow failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        message: 'Workflow failed'
      };
    }

  } catch (error) {
    console.error('Start workflow error:', error);
    const errorResponse = getNetworkErrorResponse(error);
    return {
      success: false,
      error: errorResponse.error,
      details: errorResponse.details,
      message: errorResponse.error
    };
  }
}

async function updateWorkflowProgress(historyId: string | undefined, step: string, percentage: number, status: string) {
  if (!historyId) return;
  const supabase = getSupabaseAdmin();
  
  await supabase
    .from('user_history')
    .update({
      current_step: step,
      progress_percentage: percentage,
      status: status,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', historyId);
}

async function describeImage(imageUrl: string): Promise<string> {
  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe the product and brand in this image in full detail. Fully ignore the background. Focus ONLY on the product.'
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
    temperature: 0.7
  });

  let data: { choices: Array<{ message: { content: string } }> };

  try {
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

    data = await response.json();
  } catch (fetchError) {
    console.warn('Fetch failed, trying native HTTPS:', fetchError);
    
    const result = await httpRequestWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Flowtra',
        'User-Agent': 'Flowtra/1.0'
      },
      body: requestBody
    }, 2);

    if (result.status !== 200) {
      throw new Error(`OpenRouter API error (native): ${result.status} ${result.data}`);
    }

    data = JSON.parse(result.data);
  }

  return data.choices[0]?.message?.content || 'No description generated';
}

interface GeneratedPrompts {
  image_prompt: string;
  video_prompt: {
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
  };
  caption: string;
  creative_summary: string;
  aspect_ratio: string;
  video_model: string;
}

async function generatePrompts(productDescription: string, watermark?: string, watermarkLocation?: string): Promise<GeneratedPrompts> {
  const SYSTEM_MESSAGE = `You are a seasoned creative director with deep expertise in visual storytelling, branding, and advertising. Your job is to guide the structured creation of high-quality, compelling, and brand-aligned image and video content for product marketing.

Task
Generate an image prompt and a video prompt (return both as part of a structured JSON output).

Provide a concise caption.

Produce a clear creative summary based on the user's reference and intent.

All video prompts must be a JSON object containing all required fields (see below). CRITICAL: The dialogue field must contain actual voiceover script or spoken narration - never use phrases like "No dialogue", "None", or leave it empty. Write compelling spoken content that a narrator would say to sell the product.

Output Requirements
Respond ONLY with the following structured JSON:

{
  "image_prompt": "...",
  "video_prompt": {
    "description": "...",
    "setting": "...",
    "camera_type": "...",
    "camera_movement": "...",
    "action": "...",
    "lighting": "...",
    "dialogue": "...",    
    "music": "...",       
    "ending": "...",
    "other_details": "..."
  },
  "caption": "...",
  "creative_summary": "...",
  "aspect_ratio": "...",
  "video_model": "..."
}`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content: SYSTEM_MESSAGE
      },
      {
        role: 'user',
        content: `This is the initial creative brief:\nCreate a compelling video advertisement with voiceover and audio\n\nDescription of the product:\n${productDescription}\n\nWATERMARK REQUIREMENTS:\n${watermark ? `- Include text watermark: "${watermark}"\n- Watermark location: ${watermarkLocation || 'bottom left'}\n- Copy the watermark text exactly as defined between the <WATERMARK_TEXT> tags below. Do not change spelling, capitalization, spacing, or character order. This is trademarked content and any alteration (including swapped or duplicated letters) is unacceptable.\n- The image_prompt must explicitly state that the exact lettering "${watermark}" appears at ${watermarkLocation || 'bottom left'} of the image.\n- Before finalizing, self-check every occurrence of the watermark text to ensure it matches "${watermark}" character-for-character.\n<WATERMARK_TEXT>${watermark}</WATERMARK_TEXT>` : '- No watermark needed'}\n\nIMPORTANT: The video must include:\n- Engaging voiceover narration or dialogue that describes the product benefits\n- Background music or sound effects that enhance the mood\n- Clear spoken content that explains why customers should choose this product\n\nFor the image_prompt: Make sure to include watermark specifications if provided above.\n\nMake sure the 'dialogue' field contains actual spoken words, not just \"No dialogue\" or empty content.\n\nIf the watermark text ever deviates from what is inside <WATERMARK_TEXT>, regenerate internally until it is an exact match.\n\nUse the Think tool to double check your output`
      }
    ],
    max_tokens: 1500,
    temperature: 0.8,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'creative_brief',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            image_prompt: {
              type: 'string',
              description: 'Detailed description for the cover image generation'
            },
            video_prompt: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                setting: { type: 'string' },
                camera_type: { type: 'string' },
                camera_movement: { type: 'string' },
                action: { type: 'string' },
                lighting: { type: 'string' },
                dialogue: { type: 'string' },
                music: { type: 'string' },
                ending: { type: 'string' },
                other_details: { type: 'string' }
              },
              required: ['description', 'setting', 'camera_type', 'camera_movement', 'action', 'lighting', 'dialogue', 'music', 'ending', 'other_details']
            },
            caption: { type: 'string' },
            creative_summary: { type: 'string' },
            aspect_ratio: { type: 'string' },
            video_model: { type: 'string' }
          },
          required: ['image_prompt', 'video_prompt', 'caption', 'creative_summary', 'aspect_ratio', 'video_model']
        }
      }
    }
  });

  let response: Response;
  let data: { choices: Array<{ message: { content: string } }> };

  try {
    response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
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

    data = await response.json();
  } catch (fetchError) {
    console.warn('Fetch failed, trying native HTTPS:', fetchError);
    
    const result = await httpRequestWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Flowtra',
        'User-Agent': 'Flowtra/1.0'
      },
      body: requestBody
    }, 2);

    if (result.status !== 200) {
      throw new Error(`OpenRouter API error (native): ${result.status} ${result.data}`);
    }

    data = JSON.parse(result.data);
  }

  const content = data.choices[0]?.message?.content || '';
  
  try {
    return JSON.parse(content);
  } catch (parseError) {
    throw new Error(`Failed to parse generated prompts: ${parseError}`);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/([.*+?^${}()|[\]\\])/g, '\$1');
}

function prepareImagePrompt(imagePrompt: string, watermark?: string, watermarkLocation?: string): string {
  const basePrompt = (imagePrompt || '').trim();
  if (!watermark) {
    return basePrompt;
  }

  const enforcedLocation = watermarkLocation || 'bottom left';
  const exactWatermark = watermark.trim();
  const overrideClause = `OVERRIDE ANY EARLIER WATERMARK INSTRUCTIONS. The watermark text must read exactly "${exactWatermark}" at the ${enforcedLocation}. Do not alter the spelling, capitalization, spacing, or character order of "${exactWatermark}".`;

  const caseInsensitiveRegex = new RegExp(escapeRegExp(exactWatermark), 'gi');
  let sanitizedPrompt = basePrompt.replace(caseInsensitiveRegex, exactWatermark);

  if (!sanitizedPrompt.includes(exactWatermark)) {
    console.warn('Image prompt is missing exact watermark text, appending override clause', {
      watermark: exactWatermark,
      prompt: sanitizedPrompt
    });
  }

  if (!sanitizedPrompt.includes(overrideClause)) {
    sanitizedPrompt = sanitizedPrompt.length > 0 ? `${sanitizedPrompt} ${overrideClause}` : overrideClause;
  }

  return sanitizedPrompt;
}

async function generateCoverWithBanana(originalImageUrl: string, imagePrompt: string, imageSize = 'auto'): Promise<string> {
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

  // Always attach callback URL if provided via env
  if (process.env.KIE_BANANA_CALLBACK_URL) {
    requestBody.callBackUrl = process.env.KIE_BANANA_CALLBACK_URL;
    console.log(`V1 nano-banana request with callback URL: ${process.env.KIE_BANANA_CALLBACK_URL}`);
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
