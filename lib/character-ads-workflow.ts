import { getSupabaseAdmin } from '@/lib/supabase';
import { IMAGE_MODELS, getLanguagePromptName, getLanguageVoiceStyle, type LanguageCode } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { mergeVideosWithFal, checkFalTaskStatus } from '@/lib/video-merge';
// Events table removed: no tracking imports

// Helper function to generate voice type based on language and gender
function generateVoiceTypeFromLanguage(language: string, isMale: boolean): string {
  const languageCode = (language || 'en') as LanguageCode;
  const voiceStyle = getLanguageVoiceStyle(languageCode);
  const voiceGender = isMale ? 'deep male voice' : 'deep female voice';
  return `${voiceStyle}, ${voiceGender}`;
}

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

// Lightweight person-only analysis for Character Ads workflow
async function analyzePersonImage(imageUrl: string): Promise<string> {
  const systemText = `Analyze the person in this image and describe:
1. Gender and approximate age
2. Outfit style and colors
3. Overall visual presentation

Provide a concise 2-3 sentence description.`;

  const messages = [
    {
      role: 'system',
      content: systemText
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this person:' },
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
    throw new Error(`Person analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Person description unavailable';
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
  characterDescription: string,
  videoDurationSeconds: number,
  videoModel: 'veo3' | 'veo3_fast' | 'sora2',
  language?: string,
  userDialogue?: string
): Promise<Record<string, unknown>> {
  const unitSeconds = videoModel === 'sora2' ? 10 : 8;
  const videoScenes = videoDurationSeconds / unitSeconds; // Scene length depends on model

  // Extract character information from description
  const characterInfo = characterDescription;

  // Check for female indicators first (to avoid "woman" being caught by "man" check)
  const isCharacterFemale =
    characterInfo.toLowerCase().includes('woman') ||
    characterInfo.toLowerCase().includes('female') ||
    characterInfo.toLowerCase().includes('girl') ||
    characterInfo.toLowerCase().includes('lady') ||
    characterInfo.toLowerCase().includes(' she ') ||
    characterInfo.toLowerCase().includes(' her ');

  // Check for male indicators with word boundaries to avoid false positives
  const isCharacterMale = !isCharacterFemale && (
    characterInfo.toLowerCase().includes(' man ') ||
    characterInfo.toLowerCase().includes('businessman') ||
    characterInfo.toLowerCase().includes('gentleman') ||
    characterInfo.toLowerCase().includes(' male ') ||
    characterInfo.toLowerCase().includes(' boy ') ||
    characterInfo.toLowerCase().includes(' guy ') ||
    characterInfo.toLowerCase().includes(' he ') ||
    characterInfo.toLowerCase().includes(' his ')
  );

  // Generate voice type based on language and gender
  const voiceType = generateVoiceTypeFromLanguage(language || 'en', isCharacterMale);

  // Get language name for prompts
  const languageCode = (language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode);

  const systemPrompt = `
UGC Image + Video Prompt Generator 🎥🖼️
Create ONE image prompt and ${videoScenes} video prompts

Your task: Generate 1 cover image prompt (at root level) and ${videoScenes} video scene prompts. The image will serve as the cover AND first frame reference for ALL videos.${productContext && (productContext.product_details || productContext.brand_name) ? `\n\nProduct & Brand Context from Database:\n${productContext.product_details ? `Product Details: ${productContext.product_details}\n` : ''}${productContext.brand_name ? `Brand: ${productContext.brand_name}\n` : ''}${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}\n` : ''}${productContext.brand_details ? `Brand Details: ${productContext.brand_details}\n` : ''}\nIMPORTANT: Use this authentic product and brand context to enhance the video prompts. The brand identity and product features should guide the creative direction.` : ''}

Use **UGC - style casual realism** principles:
- Everyday realism with authentic, relatable environments
- Amateur iPhone photo/video style
- Slightly imperfect framing and natural lighting
- Candid poses, genuine expressions

For image_prompt (root level field):
- At the beginning, use this prefix: "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible"
- Use casual, amateur iPhone selfie style
- UGC, unfiltered, realistic
- IMPORTANT: Keep the character consistent with the reference image analysis
- This image will be the cover AND serve as first frame reference for ALL video scenes

For video scenes (numbered 1, 2, 3, etc.):
- Each scene is ${unitSeconds} seconds long
- Include dialogue with casual, spontaneous tone (under 150 characters)
- IMPORTANT: Write ALL dialogue in ENGLISH. The 'language' field is metadata that tells the video generation API what language to use for voiceover. The actual dialogue text should always be in English.
- CRITICAL LANGUAGE NOTE: The character will speak ${languageName} in the final video (handled automatically by the video generation API based on the 'language' field), but you must write the dialogue text in English.
- DO NOT include a "language" field inside individual scene prompts - language is set at the top level only
- Describe accent and voice style consistently
- Prefix video prompts with: "dialogue, the character in the video says:"
- Use ${voiceType}
- Camera movement: fixed
- Avoid mentioning copyrighted characters
- Don't refer back to previous scenes
- CRITICAL: Maintain character consistency - the same person from the reference image should appear in all scenes
- CRITICAL: Maintain product consistency - focus on the same product throughout all scenes
- CRITICAL: Each video should flow naturally from the cover image
- If a user dialogue is provided, you MUST use it EXACTLY as given for Scene 1 without paraphrasing, summarizing, or changing words. Do not add prefixes/suffixes other than the required "dialogue, the character in the video says:". Preserve casing; you may only escape quotes when needed for JSON validity.

Return in JSON format:
{
  "image_prompt": "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible. [full image prompt with character details, product, setting, camera style]",
  "scenes": [
    {
      "scene": 1,
      "prompt": {
        "video_prompt": "dialogue, the character in the video says: ${userDialogue ? userDialogue.replace(/"/g, '\\"') : '[casual dialogue]'}",
        "voice_type": "${voiceType}",
        "emotion": "chill, upbeat",
        "setting": "[casual environment]",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    },
    {
      "scene": 2,
      "prompt": {
        "video_prompt": "dialogue, the character in the video says: [casual dialogue]",
        "voice_type": "${voiceType}",
        "emotion": "chill, upbeat",
        "setting": "[casual environment]",
        "camera": "amateur iPhone selfie video",
        "camera_movement": "fixed"
      }
    }
    // ... additional video scenes (numbered 3, 4, etc.) based on duration
  ]
}

CRITICAL FORMAT RULES:
- Put image_prompt at ROOT LEVEL (same level as scenes array)
- scenes array starts from scene number 1 (NOT 0)
- Do NOT include scene 0 in the scenes array
- The image_prompt generates the cover image that ALL videos will reference

CRITICAL INSTRUCTIONS FOR DIALOGUE:
- Write ALL dialogue text in ENGLISH, regardless of the target language (${languageName})
- The video generation API will automatically convert the English dialogue to ${languageName} voiceover
- Do NOT attempt to translate the dialogue yourself - write it in natural, conversational English
- Keep dialogue concise (under 150 characters) and casual
${userDialogue ? `- For Scene 1, use the exact user-provided dialogue: "${userDialogue.replace(/"/g, '\\"')}"` : ''}`;

  const userPrompt = `🎯 PRODUCT INFORMATION (From Database):
Product: ${productContext.product_details}
${productContext.brand_name ? `Brand: ${productContext.brand_name}` : ''}
${productContext.brand_slogan ? `Brand Slogan: ${productContext.brand_slogan}` : ''}
${productContext.brand_details ? `Brand Details: ${productContext.brand_details}` : ''}

🎭 CHARACTER INFORMATION:
${characterDescription}

IMPORTANT: Use the authentic product details from the database to create prompts.
The character should present the product with accurate brand messaging.

Generate prompts for ${videoScenes} video scenes (${unitSeconds} seconds each) plus 1 image scene.`;

  const requestBody = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 2000,
    temperature: 0.7,
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
  }, 3, 30000); // 3 retries, 30 second timeout

  if (!response.ok) {
    throw new Error(`Prompt generation failed: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  try {
    // Clean up markdown code blocks if present
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('Cleaned prompts content for parsing:', cleanedContent);
    const parsed: { image_prompt?: string; scenes?: Array<{ scene?: number | string; prompt?: Record<string, unknown> }> } = JSON.parse(cleanedContent);

    // Validate new structure
    if (!parsed.image_prompt) {
      throw new Error('AI did not return image_prompt at root level');
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('AI did not return scenes array');
    }

    // Ensure no scene 0 exists (scenes should start from 1)
    const hasScene0 = parsed.scenes.some((s) => s && Number(s.scene) === 0);
    if (hasScene0) {
      console.warn('⚠️ AI incorrectly returned scene 0 - filtering it out');
      parsed.scenes = parsed.scenes.filter((s) => s && Number(s.scene) !== 0);
    }

    // Enforce exact user dialogue for Scene 1 if provided
    if (userDialogue && Array.isArray(parsed.scenes)) {
      const scenes: Array<{ scene?: number | string; prompt?: Record<string, unknown> }> = parsed.scenes;
      let s1 = scenes.find((s) => s && (Number(s.scene) === 1));
      if (!s1 && scenes.length >= 1) {
        s1 = scenes[0]; // First scene if scene numbers not set correctly
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

    // CRITICAL: Ensure language field is set correctly at the top level
    // This is used by generateVideoWithKIE to add language metadata
    const languageCode = (language || 'en') as LanguageCode;
    const languageName = getLanguagePromptName(languageCode);
    (parsed as Record<string, unknown>)['language'] = languageName;

    console.log(`✅ Prompts generated with image_prompt at root level and ${parsed.scenes.length} video scenes`);
    console.log(`✅ Language: ${languageName} (code: ${languageCode})`);

    return parsed;
  } catch (error) {
    console.error('Failed to parse prompts result:', content);
    console.error('Prompts parse error:', error);
    throw new Error('Failed to parse generated prompts');
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
  // Debug logging
  console.log('🎬 generateVideoWithKIE called with:');
  console.log('  - videoModel:', videoModel);
  console.log('  - language parameter:', language);
  console.log('  - language type:', typeof language);

  // DEFENSIVE: Remove any "language" field from prompt object (should only be in prefix)
  const cleanedPrompt = { ...prompt };
  if ('language' in cleanedPrompt) {
    console.warn('⚠️ Removing "language" field from prompt object (it should only be in the prefix)');
    console.warn('  - Removed value:', cleanedPrompt.language);
    delete cleanedPrompt.language;
  }

  // Convert prompt object to string for API
  const basePrompt = typeof cleanedPrompt === 'string' ? cleanedPrompt : JSON.stringify(cleanedPrompt);

  // Add language metadata if not English (simple format for VEO3 API)
  const lang = (language || 'en') as LanguageCode;
  console.log('  - resolved lang:', lang);

  const languageName = getLanguagePromptName(lang);
  console.log('  - languageName from getLanguagePromptName:', languageName);

  // Defensive check: ensure languageName is valid
  if (!languageName) {
    console.error(`❌ getLanguagePromptName returned undefined for language code: "${lang}"`);
    console.error(`Available language codes: en, zh, es, fr, de, nl, ur, pa`);
    throw new Error(`Invalid language code: ${lang}`);
  }

  const languagePrefix = languageName !== 'English'
    ? `"language": "${languageName}"\n\n`
    : '';

  const finalPrompt = `${languagePrefix}${basePrompt}`;

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
      includeDialogue: false,
      enableTranslation: false
    };
    apiEndpoint = 'https://api.kie.ai/api/v1/veo/generate';
  }

  console.log('Video API request body:', JSON.stringify(requestBody, null, 2));
  console.log('Video API endpoint:', apiEndpoint);

  const response = await fetchWithRetry(apiEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`KIE video generation failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE video generation failed: ${data.message || 'Unknown error'}`);
  }

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

        console.log('Starting person image analysis for URL:', personImageUrl);

        // NEW: Lightweight character analysis
        const characterDescription = await analyzePersonImage(personImageUrl);
        console.log('Person analysis completed:', characterDescription);

        const prompts = await generatePrompts(
          productContext as { product_details: string; brand_name?: string; brand_slogan?: string; brand_details?: string },
          characterDescription,
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
        // Step 4: Generate video scenes using KIE
        console.log('Generating videos for project:', project.id);
        console.log('📊 Project language field:', project.language);

        if (!project.generated_image_url) {
          throw new Error('Generated image not found - required for video generation');
        }

        // Legacy projects may have stored sora2 as veo3_fast with an error_message flag
        const storedVideoModel = project.video_model as 'veo3' | 'veo3_fast' | 'sora2';
        const actualVideoModel = project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : storedVideoModel;
        
        console.log(`🎬 Video generation - stored model: ${project.video_model}, resolved model: ${actualVideoModel}`);

        const unitSeconds = (project.error_message === 'SORA2_MODEL_SELECTED' ? 'sora2' : (project.video_model as 'veo3'|'veo3_fast'|'sora2')) === 'sora2' ? 10 : 8;
        const videoScenes = project.video_duration_seconds / unitSeconds;

        const existingTaskIds = Array.isArray(project.kie_video_task_ids)
          ? project.kie_video_task_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];

        if (existingTaskIds.length === videoScenes) {
          console.log(`🎬 Project ${project.id} already has ${existingTaskIds.length} KIE video tasks, skipping duplicate generation.`);

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

        const videoTaskIds = [];

        // Start video generation for each scene
        for (let i = 1; i <= videoScenes; i++) {
          const videoPrompt = (project.generated_prompts?.scenes as Array<{prompt: unknown}>)?.[i]?.prompt;

          console.log(`\n🎬 Generating video for scene ${i}/${videoScenes}:`);
          console.log('  - Project language field:', project.language);
          console.log('  - Video prompt object:', JSON.stringify(videoPrompt, null, 2));

          const { taskId } = await generateVideoWithKIE(
            videoPrompt as Record<string, unknown>,
            actualVideoModel, // Use actual video model (sora2 if detected)
            project.generated_image_url, // Use generated image as reference
            project.video_aspect_ratio as '16:9' | '9:16' | undefined,
            project.language // Pass language for video prompt
          );

          console.log(`  ✅ Scene ${i} video task created: ${taskId}\n`);

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
        console.log(`🎬 Checking video status - stored model: ${project.video_model}, resolved model: ${actualVideoModel}`);

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
