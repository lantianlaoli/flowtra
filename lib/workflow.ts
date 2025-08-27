import { getSupabase } from '@/lib/supabase';
import { fetchWithRetry, getNetworkErrorResponse } from '@/lib/fetchWithRetry';
import { httpRequestWithRetry } from '@/lib/httpRequest';
import { getCreditCost } from '@/lib/constants';

export interface StartWorkflowRequest {
  imageUrl: string;
  userId?: string;
  videoModel?: 'veo3' | 'veo3_fast';
}

export interface StartWorkflowResult {
  success: boolean;
  historyId?: string;
  message: string;
  coverTaskId?: string;
  error?: string;
  details?: string;
}

export async function startWorkflowProcess({ 
  imageUrl, 
  userId, 
  videoModel = 'veo3_fast' 
}: StartWorkflowRequest): Promise<StartWorkflowResult> {
  try {
    if (!imageUrl) {
      return { success: false, error: 'Image URL is required', message: 'Image URL is required' };
    }

    // Create history record first
    let historyRecord = null;
    if (userId) {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('user_history')
        .insert({
          user_id: userId,
          original_image_url: imageUrl,
          video_model: videoModel,
          credits_used: getCreditCost(videoModel),
          workflow_status: 'started',
          current_step: 'describing',
          progress_percentage: 5,
          last_processed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create history record:', error);
        return { success: false, error: 'Failed to create workflow record', message: 'Failed to create workflow record' };
      }
      
      historyRecord = data;
    }

    console.log(`Starting workflow for user ${userId}, history ${historyRecord?.id}`);

    // Start the complete workflow process
    try {
      // Step 1: Describe the image
      console.log('Step 1: Describing image...');
      await updateWorkflowProgress(historyRecord?.id, 'describing', 10, 'in_progress');
      
      const description = await describeImage(imageUrl);
      
      if (historyRecord) {
        const supabase = getSupabase();
        await supabase
          .from('user_history')
          .update({
            product_description: description,
            current_step: 'generating_prompts',
            progress_percentage: 25,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', historyRecord.id);
      }

      console.log(`Image described for history ${historyRecord?.id}`);

      // Step 2: Generate creative prompts
      console.log('Step 2: Generating prompts...');
      await updateWorkflowProgress(historyRecord?.id, 'generating_prompts', 40, 'in_progress');
      
      const prompts = await generatePrompts(description);
      
      if (historyRecord) {
        const supabase = getSupabase();
        await supabase
          .from('user_history')
          .update({
            creative_prompts: prompts.video_prompt,
            current_step: 'generating_cover',
            progress_percentage: 55,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', historyRecord.id);
      }

      console.log(`Prompts generated for history ${historyRecord?.id}`);

      // Step 3: Generate cover image
      console.log('Step 3: Generating cover...');
      await updateWorkflowProgress(historyRecord?.id, 'generating_cover', 70, 'in_progress');
      
      const coverTaskId = await generateCover(imageUrl, prompts.image_prompt);
      
      if (historyRecord) {
        const supabase = getSupabase();
        await supabase
          .from('user_history')
          .update({
            cover_task_id: coverTaskId,
            current_step: 'generating_cover',
            progress_percentage: 75,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', historyRecord.id);
      }

      console.log(`Cover generation started for history ${historyRecord?.id}, taskId: ${coverTaskId}`);

      // Return success immediately - monitoring will handle the rest
      return {
        success: true,
        historyId: historyRecord?.id,
        message: 'Workflow started successfully. Cover and video generation in progress.',
        coverTaskId: coverTaskId
      };

    } catch (error) {
      console.error('Workflow error:', error);
      
      // Update status to failed
      if (historyRecord) {
        const supabase = getSupabase();
        await supabase
          .from('user_history')
          .update({
            workflow_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error occurred',
            last_processed_at: new Date().toISOString()
          })
          .eq('id', historyRecord.id);
      }

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
  const supabase = getSupabase();
  
  await supabase
    .from('user_history')
    .update({
      current_step: step,
      progress_percentage: percentage,
      workflow_status: status,
      last_processed_at: new Date().toISOString()
    })
    .eq('id', historyId);
}

async function describeImage(imageUrl: string): Promise<string> {
  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-lite-001',
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
    }, 2, 10000);

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

async function generatePrompts(productDescription: string): Promise<GeneratedPrompts> {
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
    model: process.env.OPENROUTER_TEXT_MODEL || 'openai/gpt-4o',
    messages: [
      {
        role: 'system',
        content: SYSTEM_MESSAGE
      },
      {
        role: 'user',
        content: `This is the initial creative brief:\nCreate a compelling video advertisement with voiceover and audio\n\nDescription of the product:\n${productDescription}\n\nIMPORTANT: The video must include:\n- Engaging voiceover narration or dialogue that describes the product benefits\n- Background music or sound effects that enhance the mood\n- Clear spoken content that explains why customers should choose this product\n\nMake sure the 'dialogue' field contains actual spoken words, not just \"No dialogue\" or empty content.\n\nUse the Think tool to double check your output`
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
    }, 2, 10000);

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

async function generateCover(originalImageUrl: string, imagePrompt: string): Promise<string> {
  const response = await fetchWithRetry('https://api.kie.ai/api/v1/gpt4o-image/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filesUrl: [originalImageUrl],
      prompt: `Take the product in the image and place it in this scenario: ${imagePrompt}`,
      size: "3:2"
    })
  }, 8, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Failed to generate cover: ${response.status} ${errorData}`);
  }

  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to generate cover image');
  }
  
  return data.data.taskId;
}