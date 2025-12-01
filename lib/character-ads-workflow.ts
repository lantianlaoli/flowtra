import { getSupabaseAdmin } from '@/lib/supabase';
import { IMAGE_MODELS, getLanguagePromptName, getLanguageVoiceStyle, type LanguageCode } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { mergeVideosWithFal, checkFalTaskStatus } from '@/lib/video-merge';
// Events table removed: no tracking imports

interface CharacterAdsProject {
  id: string;
  user_id: string;
  person_image_urls: string[];
  product_image_urls: string[];
  video_duration_seconds: number;
  image_model: string;
  image_size?: string;
  image_prompt?: string; // Prompt used for cover image generation
  video_model: string;
  video_aspect_ratio?: string;
  custom_dialogue?: string;
  language?: string;
  status: string;
  current_step: string;
  progress_percentage: number;
  image_analysis_result?: Record<string, unknown>;
  generated_prompts?: Record<string, unknown>;
  generated_image_url?: string;
  generated_video_urls?: string[];
  merged_video_url?: string;
  kie_image_task_id?: string;
  kie_video_task_ids?: string[];
  fal_merge_task_id?: string;
  error_message?: string;
  last_processed_at?: string;
}

interface ProcessResult {
  project: CharacterAdsProject;
  message: string;
  nextStep?: string;
}

// Fallback product analysis for temporary products (no database record)
async function analyzeProductImageOnly(imageUrl: string): Promise<string> {
  const systemText = `Analyze this product image and describe:
1. Product type and category
2. Key visual features (color, design, materials)
3. Likely use case or target audience

Provide a concise 2-3 sentence description.`;

  const messages = [
    {
      role: 'system',
      content: systemText
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this product:' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];

  const requestedModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: JSON.stringify({
      model: requestedModel,
      messages,
      max_tokens: 200,
      temperature: 0.2
    })
  }, 3, 30000); // 3 retries, 30 second timeout

  if (!response.ok) {
    throw new Error(`Product analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Product description unavailable';
}

// Generate prompts based on product context and character description
async function generatePrompts(
  productContext: {
    product_details: string;
    brand_name?: string;
    brand_slogan?: string;
    brand_details?: string;
  },
  personImageUrl: string,
  productImageUrl: string,
  videoDurationSeconds: number,
  videoModel: 'veo3' | 'veo3_fast' | 'sora2',
  language?: string,
  userDialogue?: string
): Promise<Record<string, unknown>> {
  const unitSeconds = videoModel === 'sora2' ? 10 : 8;
  const videoScenes = videoDurationSeconds / unitSeconds;

  // Get language name for prompts
  const languageCode = (language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode);

  const systemPrompt = `
UGC Image + Video Prompt Generator 🎥🖼️

Generate a complete JSON structure with ${videoScenes} video scene(s) for a character-based product advertisement.

You will receive TWO images:
1. A PERSON image (the character/influencer)
2. A PRODUCT image

Your task:
1. Analyze the PERSON image: Determine their ACTUAL GENDER (male/female), age, style, and appearance
2. Analyze the PRODUCT image: Identify what it is and key visual features
3. Generate ${videoScenes} video scene prompt(s) with CORRECT gender-specific voice
4. Generate 1 cover image prompt

${productContext && (productContext.product_details || productContext.brand_name) ? `
Product & Brand Context from Database:
${productContext.product_details ? `Product: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Details: ${productContext.brand_details}\n` : ''}
IMPORTANT: Use this authentic product and brand context to enhance the video prompts.
` : ''}

CRITICAL RULES FOR GENDER:
- Analyze the person's ACTUAL GENDER from the image - do NOT guess or assume
- For MALE characters: Use "${languageName} accent, warm male voice"
- For FEMALE characters: Use "${languageName} accent, warm female voice"
- The gender MUST match what you see in the person image

UGC STYLE PRINCIPLES:
- Amateur iPhone selfie video aesthetic
- Natural, casual environments
- Slightly imperfect framing and lighting
- Genuine, relatable expressions
- The character must SHOW the product to camera naturally

VIDEO SCENE REQUIREMENTS:
- Each scene is ${unitSeconds} seconds long
- Write ALL dialogue in ENGLISH (regardless of target language)
- The 'language' field is metadata - actual dialogue text is always English
- Keep dialogue concise (under 150 characters) and conversational
- Prefix all video_prompt with: "dialogue, the character in the video says:"
- Camera movement: always "fixed"
- Emotion: "excited, genuine" or similar positive emotions
${userDialogue ? `- Scene 1 MUST use this EXACT dialogue: "${userDialogue.replace(/"/g, '\\"')}"` : ''}

IMAGE PROMPT REQUIREMENTS:
- Start with: "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible."
- Describe the character with CORRECT GENDER matching the person image
- Include product description
- Amateur iPhone selfie aesthetic
- This image serves as cover AND first frame reference for ALL videos

OUTPUT FORMAT (JSON):
{
  "scenes": [
    {
      "scene": 1,
      "prompt": {
        "camera": "amateur iPhone selfie video",
        "emotion": "excited, genuine",
        "setting": "[appropriate casual setting]",
        "voice_type": "${languageName} accent, warm [male/female] voice",
        "video_prompt": "dialogue, the character in the video says: [natural product pitch in English]",
        "camera_movement": "fixed"
      }
    }
  ],
  "language": "${languageName}",
  "image_prompt": "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible. [Detailed character description with CORRECT GENDER + product + setting + camera style]"
}

CRITICAL: Ensure voice_type gender matches the person in the image!`;

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Generate prompts for this character and product:\n\nPERSON IMAGE: Analyze for gender, age, style\nPRODUCT IMAGE: Identify the product\n\n${productContext.product_details ? `Product Details: ${productContext.product_details}` : ''}`
        },
        { type: 'image_url', image_url: { url: personImageUrl } },
        { type: 'image_url', image_url: { url: productImageUrl } }
      ]
    }
  ];

  const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Flowtra'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3
    })
  }, 3, 30000);

  if (!response.ok) {
    throw new Error(`Gemini prompt generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    const parsed: {
      image_prompt?: string;
      scenes?: Array<{ scene?: number | string; prompt?: Record<string, unknown> }>;
      language?: string;
    } = JSON.parse(content);

    // Validate structure
    if (!parsed.image_prompt) {
      throw new Error('AI did not return image_prompt');
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('AI did not return scenes array');
    }

    // Ensure no scene 0 (scenes start from 1)
    const hasScene0 = parsed.scenes.some((s) => s && Number(s.scene) === 0);
    if (hasScene0) {
      console.warn('⚠️ AI returned scene 0 - filtering it out');
      parsed.scenes = parsed.scenes.filter((s) => s && Number(s.scene) !== 0);
    }

    // Enforce exact user dialogue for Scene 1 if provided
    if (userDialogue && Array.isArray(parsed.scenes)) {
      const scenes: Array<{ scene?: number | string; prompt?: Record<string, unknown> }> = parsed.scenes;
      let s1 = scenes.find((s) => s && (Number(s.scene) === 1));
      if (!s1 && scenes.length >= 1) {
        s1 = scenes[0];
      }
      if (s1) {
        const exact = `dialogue, the character in the video says: ${userDialogue.replace(/"/g, '\\"')}`;
        if (!s1.prompt || typeof s1.prompt === 'string') {
          s1.prompt = { video_prompt: exact } as Record<string, unknown>;
        } else {
          (s1.prompt as Record<string, unknown>)["video_prompt"] = exact;
        }
      }
    }

    // Ensure language field is set
    if (!parsed.language) {
      (parsed as Record<string, unknown>)['language'] = languageName;
    }

    console.log(`✅ Generated prompts with direct Gemini image analysis: ${parsed.scenes.length} scenes`);
    console.log(`✅ Language: ${parsed.language || languageName}`);

    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemini response:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse generated prompts from Gemini');
  }
}

// Helper function to get correct parameters for different image models
function getImageModelParameters(model: string, customImageSize?: string, videoAspectRatio?: string): Record<string, unknown> {
  // Handle both short names and full model names
  if (model === IMAGE_MODELS.nano_banana || model === 'nano_banana' || model.includes('nano-banana')) {
    // Nano Banana parameters (google/nano-banana-edit)
    // Supports image_size in ratio strings like '1:1', '16:9', '9:16', '3:4', '4:3', '3:2', '2:3', '21:9'
    const imageSize = customImageSize;
    // Map UI-friendly sizes to Banana ratios
    const mapUiToRatio = (val?: string, fallbackAspect?: string) => {
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
        case undefined:
        case '':
          // Choose based on video aspect ratio if provided
          if (fallbackAspect === '9:16') return '9:16';
          if (fallbackAspect === '16:9') return '16:9';
          return undefined;
        default:
          return undefined;
      }
    };

    const ratio = mapUiToRatio(imageSize as string | undefined, videoAspectRatio);
    return {
      output_format: "png",
      ...(ratio ? { image_size: ratio } : {})
    };
  } else if (model === IMAGE_MODELS.seedream || model === 'seedream' || model.includes('seedream')) {
    // Seedream V4 parameters (bytedance/seedream-v4-edit)
    let imageSize = customImageSize;
    
    // If no custom size or auto, determine based on video aspect ratio
    if (!imageSize || imageSize === 'auto') {
      if (videoAspectRatio === '9:16') {
        imageSize = 'portrait_16_9';
      } else {
        imageSize = 'landscape_16_9'; // Default for 16:9 or unknown
      }
    }
    
    return {
      image_size: imageSize,
      image_resolution: "1K",
      max_images: 1
    };
  } else {
    // Default to Nano Banana format for unknown models
    return {
      output_format: "png"
    };
  }
}

// KIE Platform API integration
async function generateImageWithKIE(
  prompt: Record<string, unknown>,
  imageModel: string,
  referenceImages: string[],
  customImageSize?: string,
  videoAspectRatio?: string
): Promise<{ taskId: string }> {
  // Get the correct parameters for this model
  const modelParams = getImageModelParameters(imageModel, customImageSize, videoAspectRatio);

  // Debug logging for image model parameters
  console.log('Character Ads - Image model:', imageModel);
  console.log('Character Ads - Model params:', JSON.stringify(modelParams, null, 2));

  const payload = {
    model: imageModel,
    input: {
      prompt: JSON.stringify(prompt),
      image_urls: referenceImages,
      ...modelParams  // Spread the model-specific parameters
    }
  };

  console.log('KIE API request payload:', JSON.stringify(payload, null, 2));

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  }, 5, 30000);

  console.log('KIE API response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('KIE API error response:', errorText);
    throw new Error(`KIE image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  console.log('KIE API response data:', JSON.stringify(data, null, 2));

  if (data.code !== 200) {
    console.error('KIE API returned error code:', data.code, 'message:', data.msg);
    throw new Error(`KIE image generation failed: ${data.msg}`);
  }

  return { taskId: data.data.taskId };
}

async function generateVideoWithKIE(
  prompt: Record<string, unknown>,
  videoModel: string,
  referenceImageUrl: string,
  videoAspectRatio?: '16:9' | '9:16',
  language?: string
): Promise<{ taskId: string }> {
  console.log('===================generateVideoWithKIE called:=====================');
  console.log('Input parameters:', {
    promptType: typeof prompt,
    promptKeys: prompt ? Object.keys(prompt) : 'null',
    videoModel,
    referenceImageUrl: referenceImageUrl?.substring(0, 50) + '...',
    videoAspectRatio,
    language
  });

  // ✅ Validate prompt parameter
  if (!prompt || typeof prompt !== 'object') {
    console.error('❌ Invalid prompt:', prompt);
    throw new Error(`Invalid prompt: expected object, got ${typeof prompt}`);
  }

  // ✅ Extract video_prompt text from prompt object AND all metadata
  let videoPromptText: string;

  if (typeof prompt === 'string') {
    // If already a string, use it directly
    videoPromptText = prompt;
  } else if (prompt && typeof prompt === 'object') {
    // Extract all fields from the scene prompt object
    const promptObj = prompt as {
      video_prompt?: string;
      voice_type?: string;
      camera?: string;
      emotion?: string;
      setting?: string;
      camera_movement?: string;
      [key: string]: unknown;
    };

    // Extract each field
    const videoPrompt = promptObj.video_prompt || '';
    const voiceType = promptObj.voice_type || '';
    const camera = promptObj.camera || '';
    const emotion = promptObj.emotion || '';
    const setting = promptObj.setting || '';
    const cameraMovement = promptObj.camera_movement || '';

    // Build structured prompt string with metadata
    const promptParts: string[] = [];

    // 1. Main dialogue content (required)
    if (videoPrompt) {
      promptParts.push(videoPrompt);
    }

    // 2. Add metadata guidance (if exists)
    const metadataParts: string[] = [];

    if (voiceType) {
      metadataParts.push(`Voice: ${voiceType}`);
    }
    if (emotion) {
      metadataParts.push(`Emotion: ${emotion}`);
    }
    if (setting) {
      metadataParts.push(`Setting: ${setting}`);
    }
    if (camera) {
      metadataParts.push(`Camera: ${camera}`);
    }
    if (cameraMovement && cameraMovement !== 'fixed') {
      metadataParts.push(`Movement: ${cameraMovement}`);
    }

    if (metadataParts.length > 0) {
      promptParts.push('\n\n' + metadataParts.join(', '));
    }

    videoPromptText = promptParts.join('');

    // Defensive check: if still empty
    if (!videoPromptText || videoPromptText.trim() === '') {
      console.error('❌ Failed to extract video prompt text from prompt object:', prompt);
      throw new Error('Invalid prompt: video_prompt field is missing or empty');
    }
  } else {
    throw new Error(`Invalid prompt format: ${typeof prompt}`);
  }

  const basePrompt = videoPromptText;

  // Add language metadata if not English (simple format for VEO3 API)
  const lang = (language || 'en') as LanguageCode;

  const languageName = getLanguagePromptName(lang);

  // Defensive check: ensure languageName is valid
  if (!languageName) {
    throw new Error(`Invalid language code: ${lang}`);
  }

  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  const finalPrompt = `${languagePrefix}${basePrompt}`;

  console.log('===================Final prompt:=====================');
  console.log(finalPrompt);
  console.log('Prompt metadata:', {
    length: finalPrompt.length,
    containsDialogue: finalPrompt.includes('dialogue'),
    containsVoice: finalPrompt.includes('Voice:'),
    containsEmotion: finalPrompt.includes('Emotion:'),
    containsSetting: finalPrompt.includes('Setting:'),
    containsCamera: finalPrompt.includes('Camera:'),
    language: language || 'en',
    languagePrefix: languagePrefix || 'none'
  });

  let requestBody: Record<string, unknown>;
  let apiEndpoint: string;

  if (videoModel === 'sora2') {
    // Sora2 API structure
    requestBody = {
      model: 'sora-2-image-to-video',
      input: {
        prompt: finalPrompt,
        image_urls: [referenceImageUrl],
        aspect_ratio: videoAspectRatio === '9:16' ? 'portrait' : 'landscape'
      }
    };
    apiEndpoint = 'https://api.kie.ai/api/v1/jobs/createTask';
  } else {
    // VEO3 API structure (veo3_fast, veo3)
    requestBody = {
      prompt: finalPrompt,
      model: videoModel, // e.g., 'veo3_fast' or 'veo3'
      aspectRatio: videoAspectRatio || "16:9",
      imageUrls: [referenceImageUrl], // Correct parameter name and format
      enableAudio: true,
      audioEnabled: true,
      generateVoiceover: false,
      includeDialogue: true, // ✅ Enable dialogue generation for character ads
      enableTranslation: false
    };
    apiEndpoint = 'https://api.kie.ai/api/v1/veo/generate';
  }

  console.log('Video API request body:', JSON.stringify(requestBody, null, 2));
  console.log('Video API endpoint:', apiEndpoint);

  // ✅ FINAL STRICT VALIDATION before calling KIE API
  const promptInBody = videoModel === 'sora2'
    ? (requestBody.input as any)?.prompt
    : requestBody.prompt;

  console.log('🚨 FINAL PROMPT VALIDATION BEFORE KIE API CALL:');
  console.log('Prompt value:', promptInBody);
  console.log('Prompt type:', typeof promptInBody);
  console.log('Prompt length:', typeof promptInBody === 'string' ? promptInBody.length : 'N/A');

  if (!promptInBody || typeof promptInBody !== 'string' || promptInBody.trim() === '' || promptInBody === '{}') {
    console.error('❌❌❌ CRITICAL: Attempting to call KIE API with empty/invalid prompt!');
    console.error('Request body:', JSON.stringify(requestBody, null, 2));
    throw new Error(`STOPPING WORKFLOW: Cannot call KIE API with empty prompt "${promptInBody}"`);
  }

  if (!promptInBody.includes('dialogue')) {
    console.warn('⚠️ WARNING: Prompt does not contain "dialogue" keyword!');
  }

  console.log('✅ Final prompt validation passed, calling KIE API...');

  console.log('Calling KIE API...');
  const response = await fetchWithRetry(apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  console.log('KIE API response status:', response.status);

  if (!response.ok) {
    const errorData = await response.text();
    console.error('❌ KIE API error response:', errorData);
    throw new Error(`KIE video generation failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();
  console.log('KIE API response data:', JSON.stringify(data, null, 2));

  if (data.code !== 200) {
    console.error('❌ KIE API returned error code:', data.code, data.message);
    throw new Error(`KIE video generation failed: ${data.message || 'Unknown error'}`);
  }

  console.log('✅ Video task created successfully:', data.data.taskId);
  return { taskId: data.data.taskId };
}

async function checkKIEImageTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    }
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE image task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE image task status check failed: ${data.msg}`);
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'processing' };
  }

  // Normalize state flags and extract URL robustly (same logic as other features)
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

  let resultJson: Record<string, unknown> = {};
  try {
    resultJson = JSON.parse(taskData.resultJson || '{}');
  } catch {
    resultJson = {};
  }

  const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
    ? (resultJson as { resultUrls?: string[] }).resultUrls
    : undefined;
  const responseUrls = Array.isArray(taskData.response?.resultUrls)
    ? (taskData.response.resultUrls as string[])
    : undefined;
  const flatUrls = Array.isArray(taskData.resultUrls)
    ? (taskData.resultUrls as string[])
    : undefined;
  const result_url = (directUrls || responseUrls || flatUrls)?.[0];

  const stateLower = state?.toLowerCase();
  const isSuccess = (stateLower === 'success') || successFlag === 1 || (!!result_url && (stateLower === undefined));
  const isFailed = (stateLower === 'failed' || stateLower === 'fail' || stateLower === 'error') || successFlag === 2 || successFlag === 3;

  if (isSuccess) {
    return { 
      status: 'completed', 
      result_url,
      error: undefined
    };
  }
  if (isFailed) {
    return { 
      status: 'failed', 
      result_url: undefined,
      error: taskData.failMsg || taskData.errorMessage || 'Image generation failed'
    };
  }

  // Still processing
  return { status: 'processing' };
}

async function checkKIEVideoTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    }
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE video task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE video task status check failed: ${data.msg || 'Unknown error'}`);
  }

  const taskData = data.data;
  if (!taskData) {
  return { status: 'processing' };
}

 

  // Use the same robust logic as other features - prioritize successFlag
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;

  // Extract video URL from multiple possible locations
  let result_url: string | undefined;
  if (taskData.outputUrl) {
    result_url = taskData.outputUrl;
  } else if (taskData.response?.resultUrls?.[0]) {
    result_url = taskData.response.resultUrls[0];
  }

  if (successFlag === 1) {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (successFlag === 2 || successFlag === 3) {
    return {
      status: 'failed',
      result_url: undefined,
      error: taskData.errorMessage || taskData.failureReason || 'Video generation failed'
    };
  } else if (state === 'success' || state === 'SUCCESS') {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (state === 'failed' || state === 'fail' || state === 'error') {
    return {
      status: 'failed',
      result_url: undefined,
      error: taskData.errorMessage || taskData.failureReason || 'Video generation failed'
    };
  } else {
    // Still processing (waiting, running, or other states)
    return { status: 'processing' };
  }
}

// Model-aware video task status checker
// - For 'sora2', query the generic jobs endpoint (same as image tasks)
// - For VEO models, fall back to the existing VEO status endpoint
async function checkKIEVideoTaskStatusByModel(taskId: string, videoModel: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  try {
    if (videoModel === 'sora2') {
      // Sora2 tasks are created via jobs/createTask and polled via jobs/recordInfo
      const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        }
      }, 5, 30000);

      if (!response.ok) {
        throw new Error(`KIE Sora2 task status check failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(`KIE Sora2 task status check failed: ${data.msg || 'Unknown error'}`);
      }

      const taskData = data.data;
      if (!taskData) return { status: 'processing' };

      // Reuse robust extraction logic similar to image status
      const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
      const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

      let resultJson: Record<string, unknown> = {};
      try {
        resultJson = JSON.parse(taskData.resultJson || '{}');
      } catch {
        resultJson = {};
      }

      const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
        ? (resultJson as { resultUrls?: string[] }).resultUrls
        : undefined;
      const responseUrls = Array.isArray(taskData.response?.resultUrls)
        ? (taskData.response.resultUrls as string[])
        : undefined;
      const flatUrls = Array.isArray(taskData.resultUrls)
        ? (taskData.resultUrls as string[])
        : undefined;
      const result_url = (directUrls || responseUrls || flatUrls)?.[0];

      const stateLower2 = state?.toLowerCase();
      const isSuccess = (stateLower2 === 'success') || successFlag === 1 || (!!result_url && (stateLower2 === undefined));
      const isFailed = (stateLower2 === 'failed' || stateLower2 === 'fail' || stateLower2 === 'error') || successFlag === 2 || successFlag === 3;

      if (isSuccess) return { status: 'completed', result_url };
      if (isFailed) return { status: 'failed', error: taskData.failMsg || taskData.errorMessage || 'Video generation failed' };
      return { status: 'processing' };
    }

    // Default path for VEO models
    return await checkKIEVideoTaskStatus(taskId);
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

export async function processCharacterAdsProject(
  project: CharacterAdsProject,
  step: string,
  options?: { customDialogue?: string }
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin();

  try {
    switch (step) {
      case 'generate_prompts': {
        // Step 2: Generate prompts for all scenes
        console.log('Generating prompts for project:', project.id);
        console.log('Project person_image_urls:', project.person_image_urls);
        console.log('Project product_image_urls:', project.product_image_urls);

        // Extract product context from project (typed safely)
        const projectData = project as CharacterAdsProject & { product_context?: { product_details?: string; brand_name?: string; brand_slogan?: string; brand_details?: string } };
        let productContext = projectData.product_context;
        console.log('Product context from project:', JSON.stringify(productContext, null, 2));

        // Fallback: analyze temp product if no context
        if (!productContext && project.product_image_urls?.length > 0) {
          console.log('Temporary product - running fallback analysis');

          const productAnalysis = await analyzeProductImageOnly(project.product_image_urls[0]);
          productContext = {
            product_details: productAnalysis,
            brand_name: 'Unknown Brand'
          };

          await supabase.from('character_ads_projects')
            .update({ product_context: productContext })
            .eq('id', project.id);
        }

        if (!productContext || !productContext.product_details) {
          throw new Error(`Product context validation failed: ${JSON.stringify({
            hasContext: !!productContext,
            hasProductDetails: !!productContext?.product_details,
            productContext
          })}`);
        }

        // Validate person image URLs
        if (!project.person_image_urls || project.person_image_urls.length === 0) {
          throw new Error('Person image URLs are required but not found in project');
        }

        const personImageUrl = project.person_image_urls[0];
        if (!personImageUrl || typeof personImageUrl !== 'string') {
          throw new Error(`Invalid person image URL: ${JSON.stringify(personImageUrl)}`);
        }

        // Validate product image URLs
        if (!project.product_image_urls || project.product_image_urls.length === 0) {
          throw new Error('Product image URLs are required but not found in project');
        }

        const productImageUrl = project.product_image_urls[0];
        if (!productImageUrl || typeof productImageUrl !== 'string') {
          throw new Error(`Invalid product image URL: ${JSON.stringify(productImageUrl)}`);
        }

        console.log('Generating prompts with direct Gemini analysis...');
        console.log('Person image:', personImageUrl);
        console.log('Product image:', productImageUrl);

        // ✅ Fix Bug 2: Direct Gemini analysis - no separate person analysis or gender detection
        const prompts = await generatePrompts(
          productContext as { product_details: string; brand_name?: string; brand_slogan?: string; brand_details?: string },
          personImageUrl,
          productImageUrl,
          project.video_duration_seconds,
          (project.video_model as 'veo3' | 'veo3_fast' | 'sora2'),
          project.language,
          project.custom_dialogue || undefined
        );

        // Create scene records (video scenes only, starting from 1)
        const unitSeconds = (project.video_model === 'sora2') ? 10 : 8;
        const videoScenes = project.video_duration_seconds / unitSeconds;
        const sceneRecords = [];

        // Only create video scenes (no scene 0 anymore)
        const scenes = prompts.scenes as Array<{ scene?: number; prompt: unknown }>;
        for (let i = 0; i < scenes.length; i++) {
          sceneRecords.push({
            project_id: project.id,
            scene_number: i + 1, // Start from 1, not 0
            scene_prompt: scenes[i].prompt,
            status: 'pending'
            // scene_type removed (all scenes are videos now)
          });
        }

        // Insert scene records
        const { error: sceneError } = await supabase
          .from('character_ads_scenes')
          .insert(sceneRecords);

        if (sceneError) throw sceneError;

        // Update project with prompts AND image_prompt
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            generated_prompts: prompts,
            image_prompt: (prompts as { image_prompt?: string }).image_prompt, // Store project-level image prompt
            status: 'generating_image',
            current_step: 'generating_image',
            progress_percentage: 40,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Prompts generated successfully',
          nextStep: 'generate_image'
        };
      }

      case 'generate_image': {
        // Step 3: Generate project-level cover image using KIE (not scene-specific anymore)
        console.log('Generating cover image for project:', project.id);

        if (!project.image_prompt) {
          throw new Error('Image prompt not found in project');
        }

        if (project.generated_image_url) {
          // Already generated, skip to next step
          console.log('Cover image already exists, skipping to video generation');
          return {
            project,
            message: 'Cover image already generated',
            nextStep: 'generate_videos'
          };
        }

        const referenceImages = [...project.person_image_urls, ...project.product_image_urls];

        // Map short model name to full KIE model name
        const fullModelName = IMAGE_MODELS[project.image_model as keyof typeof IMAGE_MODELS] || project.image_model;

        // Legacy projects may have stored sora2 as veo3_fast with an error_message flag
        const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
        const actualVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;

        console.log(`🎬 Video model detection: stored=${project.video_model}, resolved=${actualVideoModel}, legacyFlag=${project.error_message}`);

        // Use project-level image_prompt instead of scene 0 prompt
        const { taskId } = await generateImageWithKIE(
          { prompt: project.image_prompt } as Record<string, unknown>,
          fullModelName,
          referenceImages,
          project.image_size,
          project.video_aspect_ratio
        );

        // Update project only (no scene updates since scene 0 doesn't exist)
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            kie_image_task_id: taskId,
            status: 'generating_image',
            progress_percentage: 50,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Cover image generation started',
          nextStep: 'check_image_status'
        };
      }

      case 'check_image_status': {
        // Check KIE image generation status
        if (!project.kie_image_task_id) {
          throw new Error('Image task ID not found');
        }

        const status = await checkKIEImageTaskStatus(project.kie_image_task_id);

        if (status.status === 'completed' && status.result_url) {
          // Image generation completed
          const { data: updatedProject, error } = await supabase
            .from('character_ads_projects')
            .update({
              generated_image_url: status.result_url,
              status: 'generating_videos',
              current_step: 'generating_videos',
              progress_percentage: 60,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (error) throw error;

          // No scene 0 to update anymore - cover image is project-level

          // No event recording

          return {
            project: updatedProject,
            message: 'Cover image generation completed',
            nextStep: 'generate_videos'
          };
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Image generation failed');
        }

        // Still processing
        return {
          project,
          message: 'Cover image generation in progress'
        };
      }

      case 'generate_videos': {
        console.log('📹 === GENERATE_VIDEOS STEP STARTED ===', {
          projectId: project.id,
          hasGeneratedImage: !!project.generated_image_url,
          videoModel: project.video_model,
          videoDuration: project.video_duration_seconds
        });

        // Step 4: Generate video scenes using KIE
        if (!project.generated_image_url) {
          throw new Error('Generated image not found - required for video generation');
        }

        // Legacy projects may have stored sora2 as veo3_fast with an error_message flag
        const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
        const actualVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;

        const unitSeconds = (project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : (project.video_model as 'veo3'|'veo3_fast'|'sora2')) === 'sora2' ? 10 : 8;
        const videoScenes = project.video_duration_seconds / unitSeconds;

        const existingTaskIds = Array.isArray(project.kie_video_task_ids)
          ? project.kie_video_task_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];

        console.log('🔍 Checking existing video tasks:', {
          projectId: project.id,
          existingTaskIds: existingTaskIds.length,
          requiredScenes: videoScenes,
          willSkipGeneration: existingTaskIds.length === videoScenes
        });

        if (existingTaskIds.length === videoScenes) {
          console.log('⏭️ Skipping video generation - tasks already exist, moving to status checks');
          const progress = Math.max(project.progress_percentage ?? 0, 70);
          const { data: updatedProject, error: skipUpdateError } = await supabase
            .from('character_ads_projects')
            .update({
              kie_video_task_ids: existingTaskIds,
              status: 'generating_videos',
              current_step: 'generating_videos',
              progress_percentage: progress,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (skipUpdateError) throw skipUpdateError;

          return {
            project: updatedProject,
            message: 'Video tasks already exist, moving to status checks',
            nextStep: 'check_videos_status'
          };
        }

        console.log('🎬 Starting video generation loop for', videoScenes, 'scenes');
        const videoTaskIds = [];

        // Start video generation for each scene
        for (let i = 1; i <= videoScenes; i++) {
          // ✅ Fix: Array index is 0-based, loop counter is 1-based
          console.log(`\n🔍 DEBUG Scene ${i}: Extracting prompt from generated_prompts`);
          console.log('generated_prompts type:', typeof project.generated_prompts);
          console.log('generated_prompts.scenes type:', typeof project.generated_prompts?.scenes);
          console.log('generated_prompts.scenes is Array:', Array.isArray(project.generated_prompts?.scenes));

          const scenes = project.generated_prompts?.scenes as Array<{prompt: unknown}>;
          console.log('scenes.length:', scenes?.length);
          console.log(`scenes[${i-1}]:`, JSON.stringify(scenes?.[i-1], null, 2));

          const videoPrompt = scenes?.[i - 1]?.prompt;
          console.log(`videoPrompt extracted:`, JSON.stringify(videoPrompt, null, 2));
          console.log('videoPrompt type:', typeof videoPrompt);
          console.log('videoPrompt is empty object:', JSON.stringify(videoPrompt) === '{}');
          console.log('Extracted fields:', {
            hasVideoPrompt: !!(videoPrompt as any)?.video_prompt,
            hasVoiceType: !!(videoPrompt as any)?.voice_type,
            hasCamera: !!(videoPrompt as any)?.camera,
            hasEmotion: !!(videoPrompt as any)?.emotion,
            hasSetting: !!(videoPrompt as any)?.setting,
            hasCameraMovement: !!(videoPrompt as any)?.camera_movement,
            language: project.language
          });

          // ✅ STRICT VALIDATION: Ensure videoPrompt exists and is not empty object
          if (!videoPrompt || typeof videoPrompt !== 'object') {
            console.error(`❌❌❌ Scene ${i}: videoPrompt is ${!videoPrompt ? 'undefined/null' : 'not an object'}!`);
            console.error('Full generated_prompts:', JSON.stringify(project.generated_prompts, null, 2));
            throw new Error(`Scene ${i} prompt not found in generated_prompts - STOPPING WORKFLOW`);
          }

          // ✅ STRICT VALIDATION: Check if videoPrompt is empty object {}
          const videoPromptObj = videoPrompt as any;
          if (!videoPromptObj.video_prompt || typeof videoPromptObj.video_prompt !== 'string' || videoPromptObj.video_prompt.trim() === '') {
            console.error(`❌❌❌ Scene ${i}: video_prompt field is missing or empty!`);
            console.error('videoPrompt object:', JSON.stringify(videoPrompt, null, 2));
            throw new Error(`Scene ${i} video_prompt is empty - STOPPING WORKFLOW`);
          }

          console.log(`✅ Scene ${i} prompt validation passed, video_prompt length: ${videoPromptObj.video_prompt.length}`);

          console.log(`🎬 Generating video for scene ${i}/${videoScenes}:`, {
            sceneNumber: i,
            promptKeys: Object.keys(videoPrompt),
            hasVideoPrompt: 'video_prompt' in videoPrompt,
            videoPromptValue: (videoPrompt as any).video_prompt?.substring(0, 100) + '...'
          });

          const { taskId } = await generateVideoWithKIE(
            videoPrompt as Record<string, unknown>,
            actualVideoModel, // Use actual video model (sora2 if detected)
            project.generated_image_url, // Use generated image as reference
            project.video_aspect_ratio as '16:9' | '9:16' | undefined,
            project.language // Pass language for video prompt
          );

          console.log(`✅ Scene ${i} video task created: ${taskId}`);

          videoTaskIds.push(taskId);

          // Update scene status
          await supabase
            .from('character_ads_scenes')
            .update({
              kie_video_task_id: taskId,  // Renamed from kie_task_id
              status: 'generating'
            })
            .eq('project_id', project.id)
            .eq('scene_number', i);
        }

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            kie_video_task_ids: videoTaskIds,
            status: 'generating_videos',
            progress_percentage: 70,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Video generation started for all scenes',
          nextStep: 'check_videos_status'
        };
      }

      case 'check_videos_status': {
        // Check all video generation status
        if (!project.kie_video_task_ids || project.kie_video_task_ids.length === 0) {
          throw new Error('Video task IDs not found');
        }

        const videoUrls: string[] = [];
        let allCompleted = true;

        // Resolve actual video model (handle legacy sora2 storage)
        const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
        const actualVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;

        for (let i = 0; i < project.kie_video_task_ids.length; i++) {
          const taskId = project.kie_video_task_ids[i];
          const status = await checkKIEVideoTaskStatusByModel(taskId, actualVideoModel);

          if (status.status === 'completed' && status.result_url) {
            // Collect video URL
            videoUrls.push(status.result_url);

            // Update scene status in database
            await supabase
              .from('character_ads_scenes')
              .update({
                video_url: status.result_url,
                status: 'completed'
              })
              .eq('project_id', project.id)
              .eq('scene_number', i + 1);

          } else if (status.status === 'failed') {
            throw new Error(`Video ${i + 1} generation failed: ${status.error}`);
          } else {
            allCompleted = false;
          }
        }

        if (allCompleted) {
          // All videos completed
          console.log(`✅ All ${videoUrls.length} videos completed for project ${project.id}`);

          if (videoUrls.length === 0) {
            throw new Error('No video URLs collected despite all tasks completed');
          }

          // Check if we need to merge videos (single-scene vs multi-scene)
          const unitSecondsCheck = actualVideoModel === 'sora2' ? 10 : 8;
          const videoScenes = project.video_duration_seconds / unitSecondsCheck;
          if (videoScenes === 1) {
            // For 8-second videos, use the single generated video directly
            const { data: updatedProject, error } = await supabase
              .from('character_ads_projects')
              .update({
                merged_video_url: videoUrls[0], // Use the single video directly
                status: 'completed',
                current_step: 'completed',
                progress_percentage: 100,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            // No event recording

            return {
              project: updatedProject,
              message: 'Video generation completed (no merge needed for 8s)'
            };
          } else {
            // For longer videos, proceed with merging
            const { data: updatedProject, error } = await supabase
              .from('character_ads_projects')
              .update({
                status: 'merging_videos',
                current_step: 'merging_videos',
                progress_percentage: 85,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            // No event recording

            return {
              project: updatedProject,
              message: 'All videos generated, starting merge',
              nextStep: 'merge_videos'
            };
          }
        }

        // Still processing
        return {
          project,
          message: 'Video generation in progress'
        };
      }

      case 'merge_videos': {
        // Step 5: Merge videos using fal.ai
        console.log('Merging videos for project:', project.id);

        // Query video URLs from scenes table
        const { data: scenes } = await supabase
          .from('character_ads_scenes')
          .select('video_url, scene_number')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('scene_number', { ascending: true });

        const videoUrls = scenes?.map(s => s.video_url).filter(Boolean) || [];

        if (videoUrls.length === 0) {
          throw new Error('No video URLs available for merging');
        }

        const { taskId } = await mergeVideosWithFal(
          videoUrls,
          project.video_aspect_ratio as '16:9' | '9:16'
        );

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('character_ads_projects')
          .update({
            fal_merge_task_id: taskId,
            status: 'merging_videos',
            progress_percentage: 90,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Video merging started',
          nextStep: 'check_merge_status'
        };
      }

      case 'check_merge_status': {
        // Check fal.ai video merge status
        if (!project.fal_merge_task_id) {
          throw new Error('fal.ai merge task ID not found');
        }

        console.log('Checking fal.ai merge status for project:', project.id);

        const status = await checkFalTaskStatus(project.fal_merge_task_id);

        if (status.status === 'COMPLETED' && status.resultUrl) {
          // Merge completed successfully
          const { data: updatedProject, error } = await supabase
            .from('character_ads_projects')
            .update({
              merged_video_url: status.resultUrl,
              status: 'completed',
              current_step: 'completed',
              progress_percentage: 100,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (error) throw error;

          // No event recording

          return {
            project: updatedProject,
            message: 'Video merging completed successfully'
          };
        } else if (status.status === 'NETWORK_ERROR') {
          // Network error - continue monitoring without failing the project
          console.warn(`Network error checking merge status for project ${project.id}, will retry later`);
          return {
            project,
            message: 'Network connectivity issue, retrying merge status check...'
          };
        } else if (status.status === 'FAILED' || status.error) {
          throw new Error(status.error || 'Video merging failed');
        }

        // Still processing
        return {
          project,
          message: 'Video merging in progress'
        };
      }

      default: {
        throw new Error(`Unknown step: ${step}`);
      }
    }

  } catch (error) {
    console.error(`Error processing step ${step}:`, error);

    // Update project with error
    await supabase
      .from('character_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id);

    // No event recording on error

    throw error;
  }
}
