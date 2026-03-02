import { getSupabaseAdmin } from '@/lib/supabase';
import {
  GENERATION_COSTS,
  IMAGE_MODELS,
  NON_AGENT_IMAGE_MODEL,
  NON_AGENT_IMAGE_OUTPUT_FORMAT,
  NON_AGENT_IMAGE_RESOLUTION,
  getLanguagePromptName,
  getLanguageVoiceStyle,
  type LanguageCode
} from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { mergeVideosWithFal, checkFalTaskStatus } from '@/lib/video-merge';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { generateDialogueLengthGuidance, validateSceneDurations } from '@/lib/dialogue-duration-estimator';
// Events table removed: no tracking imports

// Avatar Ads fixed configuration - only supports veo3_fast
const UNIT_SECONDS = 8;  // veo3_fast unit duration
const VIDEO_MODEL = 'veo3_fast' as const;
const VIDEO_API_ENDPOINT = 'https://api.kie.ai/api/v1/veo/generate';

interface AvatarAdsProject {
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
  webhook_received_at?: string; // NEW: Timestamp when webhook was received from KIE API
  last_webhook_check?: string; // NEW: Timestamp of last fallback polling check
  product_context?: {
    product_name?: string;
    talking_head_script?: string;
  } | null;
}

interface ProcessResult {
  project: AvatarAdsProject;
  message: string;
  nextStep?: string;
}

// Fallback product analysis for temporary products (no database record)
async function analyzeProductImageOnly(imageUrl: string): Promise<string> {
  const systemText = `Analyze this product image and describe:
1. Product type and category
2. Key visual features (color, design, materials)

Provide a concise product name (max 80 characters).`;

  const messages = [
    {
      role: 'system',
      content: systemText
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Name this product:' },
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
  }, 5, 60000); // Increased: 5 retries, 60 second timeout for better reliability

  if (!response.ok) {
    throw new Error(`Product analysis failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Product name unavailable';
}

// Generate prompts without retry logic
async function generatePrompts(
  productContext: {
    product_name?: string;
    talking_head_script?: string;
  } | null,
  personImageUrl: string,
  productImageUrl: string | null,
  videoDurationSeconds: number,
  language?: string,
  userDialogue?: string,
  options?: { talkingHeadMode?: boolean }
): Promise<Record<string, unknown>> {
  const result = await _generatePromptsInternal(
    productContext,
    personImageUrl,
    productImageUrl,
    videoDurationSeconds,
    language,
    userDialogue,
    options
  );
  return result;
}

// Generate prompts based on product context and character description (internal implementation)
async function _generatePromptsInternal(
  productContext: {
    product_name?: string;
    talking_head_script?: string;
  } | null,
  personImageUrl: string,
  productImageUrl: string | null,
  videoDurationSeconds: number,
  language?: string,
  userDialogue?: string,
  options?: { talkingHeadMode?: boolean }
): Promise<Record<string, unknown>> {
  const videoScenes = videoDurationSeconds / UNIT_SECONDS;

  // Get language name for prompts
  const languageCode = (language || 'en') as LanguageCode;
  const languageName = getLanguagePromptName(languageCode);
  const isTalkingHeadMode = options?.talkingHeadMode ?? false;

  // Generate dialogue length guidance based on segment duration and language
  const dialogueLengthGuidance = generateDialogueLengthGuidance(videoScenes, UNIT_SECONDS, languageCode);

  if (!personImageUrl) {
    throw new Error('Person image URL is required for prompt generation');
  }

  if (!isTalkingHeadMode) {
    if (!productImageUrl) {
      throw new Error('Product image URL is required for product-based character ads');
    }
  }

  const talkHeadContext = userDialogue
    ? `The user provided this custom script: "${userDialogue.replace(/"/g, '\\"')}"

CRITICAL SCRIPT SPLITTING RULES:
1. Split the script across ${videoScenes} scene(s)
2. MANDATORY WORD COUNT: Each scene MUST contain 17-20 words of dialogue
   - This is NON-NEGOTIABLE and must be strictly enforced
   - If a natural sentence boundary occurs at <17 words, you MUST combine it with the next sentence
   - Only split at boundaries that result in ≥17 words for the current scene
3. Split at natural phrase/sentence boundaries ONLY when word count minimum is met
4. Preserve complete thoughts - do NOT split mid-concept or mid-solution
   - Example: Keep "problem + solution" together in one scene
   - Do NOT separate "I'm invisible to AI?" from "AI Bot Manager fixes this in ONE CLICK"
5. If total word count is insufficient for ${videoScenes} scenes × 17 words minimum, expand by:
   - Adding natural transitions between sentences
   - Expanding key points with more detail
   - Adding emphasis or clarifying phrases
   - Maintaining the core message and tone
6. Do NOT simply divide words evenly - ensure EACH scene has 17-20 words AND complete thoughts
7. Preserve all key phrases and main ideas from the user's script

EXAMPLES OF CORRECT SPLITTING:
- ✅ Scene 1 (18 words): "ChatGPT can't see my website? I'm invisible to AI? AI Bot Manager fixes this in ONE CLICK."
- ❌ Scene 1 (12 words): "ChatGPT can't see my website? I'm invisible to AI?" [WRONG - incomplete thought]`
    : productContext?.talking_head_script
      ? `Use this talking head context to guide the monologue: ${productContext.talking_head_script}`
      : 'No script provided. Create an authentic, upbeat personal message where the talent shares a helpful insight or story directly to camera.';

  const productSystemPrompt = `
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

${productContext?.product_name ? `
Product Context from Database:
Product: ${productContext.product_name}
IMPORTANT: Use this authentic product context to enhance the video prompts.
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
- Each scene is ${UNIT_SECONDS} seconds long
- Write ALL dialogue in ENGLISH (regardless of target language)
- The 'language' field is metadata - actual dialogue text is always English
- Camera movement: always "fixed"
- Emotion: "excited, genuine" or similar positive emotions
${userDialogue ? `- The user has provided a custom script: "${userDialogue.replace(/"/g, '\\"')}"
- CRITICAL: You MUST split this script across ${videoScenes} scenes following these rules:
  1. MANDATORY WORD COUNT: Each scene MUST have 17-20 words (NON-NEGOTIABLE)
  2. If a sentence boundary occurs at <17 words, COMBINE it with the next sentence
  3. Only split at boundaries that result in ≥17 words for the current scene
  4. Preserve complete thoughts - do NOT split problems from solutions
  5. If total word count is insufficient, expand by adding natural transitions and detail
  6. Ensure EACH scene has 17-20 words AND semantic completeness
  7. Preserve the core message and key phrases from the user's script` : ''}

${dialogueLengthGuidance}

DIALOGUE PACING RULES:
- Each ${UNIT_SECONDS}-second scene needs natural speaking rhythm
- Include brief pauses between phrases
- Avoid cramming too many words - clarity over quantity
- The 'dialog' field should contain the natural product pitch directly

IMAGE PROMPT REQUIREMENTS:
- Analyze the PRODUCT image to determine how it should be presented:
  - IF WEARABLE (e.g., t-shirt, dress, jacket, hat): The character MUST BE WEARING the product. Describe them wearing the item naturally. Do NOT write "holding the product".
  - IF HANDHELD (e.g., cup, bottle, phone, cream): Start with: "Take the product in the image and have the character show it to the camera."
- Place the character at the center of the image with both the product and character visible.
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
        "subject": "A confident [man/woman] in [clothing description]...",
        "context_environment": "A minimalist, upscale interior setting...",
        "action": "The character is standing still... [performing subtle movements]...",
        "style": "Amateur iPhone selfie video style...",
        "camera_motion_positioning": "Fixed Medium Shot (MS). The camera is stable...",
        "composition": "A balanced composition...",
        "ambiance_color_lighting": "Warm color grading...",
        "audio": "Soft background noise...",
        "dialog": "This is more than a suit—it defines my confidence.",
        "voice_type": "${languageName} accent, warm [male/female] voice"
      }
    }
  ],
  "language": "${languageName}",
  "image_prompt": "Take the product in the image and have the character show it to the camera. Place them at the center of the image with both the product and character visible. [Detailed character description with CORRECT GENDER + product + setting + camera style]"
}

CRITICAL: Ensure voice_type gender matches the person in the image!`;

  const talkingHeadSystemPrompt = `
Talking Head Prompt Generator 🎥

Generate a complete JSON structure with ${videoScenes} video scene(s) for a direct-to-camera monologue. There is NO physical product being shown—only the talent speaking sincerely to camera.

You will receive ONE PERSON image (the character/influencer).

Your task:
1. Analyze the PERSON image: Determine their ACTUAL GENDER, age, style, and appearance
2. Generate ${videoScenes} scene prompt(s) with CORRECT gender-specific voice
3. Generate 1 cover image prompt showing the talent speaking to camera without any props

${talkHeadContext}

CRITICAL RULES FOR GENDER:
- Analyze the person's ACTUAL GENDER from the image - do NOT guess or assume
- For MALE characters: Use "${languageName} accent, warm male voice"
- For FEMALE characters: Use "${languageName} accent, warm female voice"
- The gender MUST match what you see in the person image

TALKING HEAD STYLE PRINCIPLES:
- Amateur iPhone selfie video aesthetic
- Character faces camera the entire time
- Natural, casual background (desk, living room, office, etc.)
- Slight hand gestures, natural blinking, subtle movement
- No product props, nothing held in hand

VIDEO SCENE REQUIREMENTS:
- Each scene is ${UNIT_SECONDS} seconds long
- Write ALL dialogue in ENGLISH (regardless of target language)
- The 'language' field is metadata - actual dialogue text is always English
- Camera movement: always "fixed"
- Emotion: "confident, genuine, and helpful"
- The dialog content should follow the provided script/context exactly when supplied.

${dialogueLengthGuidance}

DIALOGUE PACING RULES:
- Each ${UNIT_SECONDS}-second scene needs natural speaking rhythm
- Include brief pauses between phrases for emphasis
- Avoid cramming too many words - clarity and authenticity over quantity
- Natural conversational flow is essential for talking head content

IMAGE PROMPT REQUIREMENTS:
- Describe the character centered in frame, speaking to camera
- Mention outfit, hairstyle, and environment to match the person image
- No props or product references
- Amateur iPhone selfie aesthetic

OUTPUT FORMAT (JSON):
{
  "scenes": [
    {
      "scene": 1,
      "prompt": {
        "subject": "A confident [man/woman] in [clothing description] speaking directly to the camera...",
        "context_environment": "A cozy home office with natural daylight...",
        "action": "The character delivers their point with subtle hand gestures and a warm smile...",
        "style": "Authentic talking head vlog style...",
        "camera_motion_positioning": "Fixed Medium Shot (MS). The camera is stable...",
        "composition": "Centered framing with soft depth of field...",
        "ambiance_color_lighting": "Natural daylight with warm tones...",
        "audio": "Soft room tone...",
        "dialog": "Hey team, I just wrapped up my 5th project of the week...",
        "voice_type": "${languageName} accent, warm [male/female] voice"
      }
    }
  ],
  "language": "${languageName}",
  "image_prompt": "Show the character from the person image speaking directly to camera, centered in frame, no props, authentic vlog lighting."
}

CRITICAL: Keep everything focused on the person speaking directly to the viewer!`;

  const systemPrompt = isTalkingHeadMode ? talkingHeadSystemPrompt : productSystemPrompt;

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
          text: isTalkingHeadMode
            ? `Generate prompts for this character speaking directly to camera.\nPERSON IMAGE: Analyze for gender, age, and style.\n${productContext?.talking_head_script ? `Talking Head Context: ${productContext.talking_head_script}` : ''}`
            : `Generate prompts for this character and product:\n\nPERSON IMAGE: Analyze for gender, age, style\nPRODUCT IMAGE: Identify the product\n\n${productContext?.product_name ? `Product Name: ${productContext.product_name}` : ''}`
        },
        { type: 'image_url', image_url: { url: personImageUrl } },
        ...(!isTalkingHeadMode && productImageUrl ? [{ type: 'image_url', image_url: { url: productImageUrl } }] : [])
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
  }, 5, 60000); // Increased: 5 retries, 60 second timeout for better reliability

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
      parsed.scenes = parsed.scenes.filter((s) => s && Number(s.scene) !== 0);
    }

    // User dialogue is now handled by the LLM system prompt directly to ensure proper distribution across scenes

    // Ensure language field is set
    if (!parsed.language) {
      (parsed as Record<string, unknown>)['language'] = languageName;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemini response:', content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse generated prompts from Gemini');
  }
}

function getImageModelParameters(model: string, customImageSize?: string, videoAspectRatio?: string): Record<string, unknown> {
  // Map UI-friendly sizes to ratio strings.
  const mapUiToRatio = (val?: string, fallbackAspect?: string) => {
    switch (val) {
      case 'square':
      case 'square_hd':
      case '1:1':
        return '1:1';
      case 'portrait_16_9':
      case '9:16':
        return '9:16';
      case 'landscape_16_9':
      case '16:9':
        return '16:9';
      case 'portrait_4_3':
      case '3:4':
        return '3:4';
      case 'landscape_4_3':
      case '4:3':
        return '4:3';
      case 'portrait_3_2':
      case '2:3':
        return '2:3';
      case 'landscape_3_2':
      case '3:2':
        return '3:2';
      case 'portrait_5_4':
      case '4:5':
        return '4:5';
      case 'landscape_5_4':
      case '5:4':
        return '5:4';
      case 'landscape_21_9':
      case '21:9':
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

  if (model === IMAGE_MODELS.nano_banana_2 || model === 'nano_banana_2') {
    const ratio = mapUiToRatio(customImageSize, videoAspectRatio) || '1:1';
    return {
      aspect_ratio: ratio,
      resolution: '1K',
      output_format: 'png',
      google_search: false
    };
  }
  if (model === 'nano-banana-pro' || model === 'nano_banana_pro') {
    const ratio = mapUiToRatio(customImageSize, videoAspectRatio);
    return {
      output_format: "png",
      resolution: "1K",
      ...(ratio ? { aspect_ratio: ratio } : { aspect_ratio: "1:1" })
    };
  }
  if (model === IMAGE_MODELS.nano_banana || model === 'nano_banana' || model.includes('nano-banana')) {
    const imageSize = customImageSize;
    const ratio = mapUiToRatio(imageSize as string | undefined, videoAspectRatio);
    return {
      output_format: "png",
      ...(ratio ? { image_size: ratio } : {})
    };
  }
  if (model === IMAGE_MODELS.seedream_5_lite || model === 'seedream_5_lite') {
    const ratio = mapUiToRatio(customImageSize, videoAspectRatio) || '1:1';
    return {
      aspect_ratio: ratio,
      quality: 'basic'
    };
  }
  if (model === IMAGE_MODELS.seedream || model === 'seedream' || model.includes('seedream')) {
    let imageSize = customImageSize;
    if (!imageSize || imageSize === 'auto') {
      if (videoAspectRatio === '9:16') {
        imageSize = 'portrait_16_9';
      } else {
        imageSize = 'landscape_16_9';
      }
    }
    return {
      image_size: imageSize,
      image_resolution: "1K",
      max_images: 1
    };
  }

  return {
    output_format: "png"
  };
}

// KIE Platform API integration
async function generateImageWithKIE(
  prompt: Record<string, unknown>,
  imageModel: string,
  referenceImages: string[],
  customImageSize?: string,
  videoAspectRatio?: string
): Promise<{ taskId: string }> {
  const limitedReferenceImages = referenceImages.slice(0, 8);
  const modelParams = getImageModelParameters(imageModel, customImageSize, videoAspectRatio);

  const isNanoBanana2 = imageModel === IMAGE_MODELS.nano_banana_2 || imageModel === 'nano_banana_2';
  const isNanoBananaPro = imageModel === 'nano-banana-pro' || imageModel === 'nano_banana_pro';
  const isSeedream5Lite = imageModel === IMAGE_MODELS.seedream_5_lite || imageModel === 'seedream_5_lite';

  let promptValue: string;
  if (isNanoBanana2 || isNanoBananaPro || isSeedream5Lite) {
    if (prompt && typeof prompt.image_prompt === 'string') {
       promptValue = prompt.image_prompt;
    } else if (prompt && typeof prompt.prompt === 'string') {
       promptValue = prompt.prompt;
    } else {
       promptValue = JSON.stringify(prompt);
    }
  } else {
    promptValue = JSON.stringify(prompt);
  }

  // Construct webhook callback URL (webhook-first architecture with polling fallback)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/image` : undefined;

  const payload = {
    model: imageModel,
    input: {
      prompt: promptValue,
      ...((isNanoBanana2 || isNanoBananaPro) ? { image_input: limitedReferenceImages } : { image_urls: limitedReferenceImages }),
      ...modelParams
    },
    ...(callBackUrl && { callBackUrl }) // Add callBackUrl only if NEXT_PUBLIC_SITE_URL is set
  };

  const payloadInput = payload.input as Record<string, unknown>;
  console.log('[generateImageWithKIE] Request payload summary:', {
    model: payload.model,
    inputFields: Object.keys(payloadInput),
    usesImageInput: Object.prototype.hasOwnProperty.call(payloadInput, 'image_input'),
    usesImageUrls: Object.prototype.hasOwnProperty.call(payloadInput, 'image_urls'),
    aspect_ratio: payloadInput.aspect_ratio ?? null,
    resolution: payloadInput.resolution ?? null,
    google_search: payloadInput.google_search ?? null,
    quality: payloadInput.quality ?? null
  });

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('KIE API error response:', errorText);
    throw new Error(`KIE image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    console.error('KIE API returned error code:', data.code, 'message:', data.msg);
    throw new Error(`KIE image generation failed: ${data.msg}`);
  }

  return { taskId: data.data.taskId };
}

export async function generateVideoWithKIE(
  prompt: Record<string, unknown>,
  referenceImageUrls: string[],
  videoAspectRatio?: '16:9' | '9:16',
  language?: string
): Promise<{ taskId: string }> {
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
      voice_type?: string;
      // New structured fields
      subject?: string;
      context_environment?: string;
      action?: string;
      style?: string;
      camera_motion_positioning?: string;
      composition?: string;
      ambiance_color_lighting?: string;
      audio?: string;
      dialog?: string;
      [key: string]: unknown;
    };

    // Check if we have the new structured fields (and if the 'video_prompt' is absent)
    const hasNewStructuredFields = !!(promptObj.subject || promptObj.context_environment || promptObj.action || promptObj.dialog || promptObj.style || promptObj.camera_motion_positioning || promptObj.composition || promptObj.ambiance_color_lighting || promptObj.audio);

    if (hasNewStructuredFields) {
      // Construct prompt from new fields
      const parts = [];
      
      // Main visual description
      if (promptObj.subject) parts.push(`Subject: ${promptObj.subject}`);
      if (promptObj.context_environment) parts.push(`Context: ${promptObj.context_environment}`);
      if (promptObj.action) parts.push(`Action: ${promptObj.action}`);
      if (promptObj.style) parts.push(`Style: ${promptObj.style}`);
      if (promptObj.camera_motion_positioning) parts.push(`Camera: ${promptObj.camera_motion_positioning}`);
      if (promptObj.composition) parts.push(`Composition: ${promptObj.composition}`);
      if (promptObj.ambiance_color_lighting) parts.push(`Lighting: ${promptObj.ambiance_color_lighting}`);
      
      // Audio/Dialogue section
      if (promptObj.audio) parts.push(`Audio: ${promptObj.audio}`);
      
      // Dialogue is special - needs specific prefix for Veo/KIE
      if (promptObj.dialog) {
         // Ensure it starts with standard prefix if not already
         const dialogText = String(promptObj.dialog).replace(/^"|"$/g, ''); // Remove quotes if present
         parts.push(`dialogue, the character in the video says: ${dialogText}`);
      }
      
      // Metadata (voice_type is assumed to be present from initial prompt generation)
      if (promptObj.voice_type) parts.push(`Voice Type: ${promptObj.voice_type}`);
      
      videoPromptText = parts.join('\n\n');
    } else {
      // Fallback to old logic (if the prompt doesn't have the new structured fields)
      // This path is for backwards compatibility and should eventually be phased out.
      // If promptObj is missing expected keys, it implies old format or malformed.
      const oldPromptObj = prompt as {
        video_prompt?: string;
        voice_type?: string;
        camera?: string;
        emotion?: string;
        setting?: string;
        camera_movement?: string;
        [key: string]: unknown;
      };

      const videoPrompt = oldPromptObj.video_prompt || '';
      const voiceType = oldPromptObj.voice_type || '';
      const camera = oldPromptObj.camera || '';
      const emotion = oldPromptObj.emotion || '';
      const setting = oldPromptObj.setting || '';
      const cameraMovement = oldPromptObj.camera_movement || '';

      const promptParts: string[] = [];
      if (videoPrompt) promptParts.push(videoPrompt);

      const metadataParts: string[] = [];
      if (voiceType) metadataParts.push(`Voice: ${voiceType}`);
      if (emotion) metadataParts.push(`Emotion: ${emotion}`);
      if (setting) metadataParts.push(`Setting: ${setting}`);
      if (camera) metadataParts.push(`Camera: ${camera}`);
      if (cameraMovement && cameraMovement !== 'fixed') metadataParts.push(`Movement: ${cameraMovement}`);

      if (metadataParts.length > 0) promptParts.push('\n\n' + metadataParts.join(', '));
      videoPromptText = promptParts.join('');
    }

    // Defensive check: if still empty
    if (!videoPromptText || videoPromptText.trim() === '') {
      console.error('❌ Failed to extract video prompt text from prompt object:', prompt);
      throw new Error('Invalid prompt: constructed video prompt is empty');
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

  // Determine generation mode based on images provided
  let generationType = 'TEXT_2_VIDEO';
  if (referenceImageUrls.length === 1) {
    // Normal image-to-video
    generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO'; // or rely on auto-detection, but manual is safer
  } else if (referenceImageUrls.length === 2) {
    // Start and end frame
    generationType = 'FIRST_AND_LAST_FRAMES_2_VIDEO';
  }

  // Construct webhook callback URL (webhook-first architecture with polling fallback)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/video` : undefined;

  // Avatar Ads only uses VEO3 Fast API
  const requestBody = {
    prompt: finalPrompt,
    model: VIDEO_MODEL, // Fixed: 'veo3_fast'
    aspectRatio: videoAspectRatio || "16:9",
    imageUrls: referenceImageUrls,
    generationType, // Explicitly set generation type
    enableAudio: true,
    audioEnabled: true,
    generateVoiceover: false,
    includeDialogue: true,
    enableTranslation: false,
    ...(callBackUrl && { callBackUrl }) // Add callBackUrl only if NEXT_PUBLIC_SITE_URL is set
  };
  const apiEndpoint = VIDEO_API_ENDPOINT; // Fixed: VEO3 endpoint

  // ✅ FINAL STRICT VALIDATION before calling KIE API
  const promptInBody = requestBody.prompt;

  if (!promptInBody || typeof promptInBody !== 'string' || promptInBody.trim() === '' || promptInBody === '{}') {
    console.error('❌❌❌ CRITICAL: Attempting to call KIE API with empty/invalid prompt!');
    console.error('Request body:', JSON.stringify(requestBody, null, 2));
    throw new Error(`STOPPING WORKFLOW: Cannot call KIE API with empty prompt "${promptInBody}"`);
  }

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
    console.error('❌ KIE API error response:', errorData);
    throw new Error(`KIE video generation failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    console.error('❌ KIE API returned error code:', data.code, data.message);
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

export async function checkKIEVideoTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
  errorCode?: string;  // NEW: Add error code for retry logic
  isRetryable?: boolean; // NEW: Flag for retryable errors
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

  // NEW: Extract failCode for server error detection
  const failCode: string | undefined = typeof taskData.failCode === 'string' ? taskData.failCode : undefined;
  const errorCode: string | undefined = typeof taskData.errorCode === 'number' ? String(taskData.errorCode) : failCode;

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
    const errorMessage = taskData.errorMessage || taskData.failureReason || 'Video generation failed';

    // NEW: Detect server errors (retryable)
    const isServerError = errorCode === '500' || failCode === '500';

    // NEW: Detect content policy errors (already retried by existing logic)
    const isContentPolicyError = errorMessage && (
      errorMessage.toLowerCase().includes('content polic') ||
      errorMessage.toLowerCase().includes('safety check failed') ||
      errorMessage.toLowerCase().includes('violating content policies')
    );

    return {
      status: 'failed',
      result_url: undefined,
      error: errorMessage,
      errorCode: errorCode, // NEW: Pass error code
      isRetryable: isServerError && !isContentPolicyError // NEW: Server errors are retryable
    };
  } else if (state === 'success' || state === 'SUCCESS') {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (state === 'failed' || state === 'fail' || state === 'error') {
    const errorMessage = taskData.errorMessage || taskData.failureReason || 'Video generation failed';
    const isServerError = errorCode === '500' || failCode === '500';
    const isContentPolicyError = errorMessage && (
      errorMessage.toLowerCase().includes('content polic') ||
      errorMessage.toLowerCase().includes('safety check failed') ||
      errorMessage.toLowerCase().includes('violating content policies')
    );

    return {
      status: 'failed',
      result_url: undefined,
      error: errorMessage,
      errorCode: errorCode,
      isRetryable: isServerError && !isContentPolicyError
    };
  } else {
    // Still processing (waiting, running, or other states)
    return { status: 'processing' };
  }
}

export async function processAvatarAdsProject(
  project: AvatarAdsProject,
  step: string,
  options?: { customDialogue?: string }
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin();

  try {
    switch (step) {
      case 'generate_prompts': {
        // Step 2: Generate prompts for all scenes
        // Extract product context from project (typed safely)
        let productContext = project.product_context;

        const hasProductImages = Array.isArray(project.product_image_urls) && project.product_image_urls.length > 0;
        const talkingHeadMode = !hasProductImages;

        // Fallback: analyze temp product if no context
        if (!productContext && hasProductImages) {
          const productName = await analyzeProductImageOnly(project.product_image_urls[0]);
          productContext = {
            product_name: productName.trim()
          };

          await supabase.from('avatar_ads_projects')
            .update({ product_context: productContext })
            .eq('id', project.id);
        }

        if ((!productContext || !productContext.talking_head_script) && talkingHeadMode) {
          const fallbackScript = project.custom_dialogue?.trim();
          productContext = {
            talking_head_script: fallbackScript
              ? `Talking head delivery. Have the character speak directly to camera and read this script verbatim: ${fallbackScript}`
              : 'Talking head delivery. Have the character speak directly to camera about their expertise or story with no props.'
          };
        }

        // Validate person image URLs
        if (!project.person_image_urls || project.person_image_urls.length === 0) {
          throw new Error('Person image URLs are required but not found in project');
        }

        const personImageUrl = project.person_image_urls[0];
        if (!personImageUrl || typeof personImageUrl !== 'string') {
          throw new Error(`Invalid person image URL: ${JSON.stringify(personImageUrl)}`);
        }

        let productImageUrl: string | null = null;
        if (!talkingHeadMode) {
          if (!project.product_image_urls || project.product_image_urls.length === 0) {
            throw new Error('Product image URLs are required but not found in project');
          }

          productImageUrl = project.product_image_urls[0];
          if (!productImageUrl || typeof productImageUrl !== 'string') {
            throw new Error(`Invalid product image URL: ${JSON.stringify(productImageUrl)}`);
          }
        }

        // ✅ Fix Bug 2: Direct Gemini analysis - no separate person analysis or gender detection
        const prompts = await generatePrompts(
          productContext as { product_name?: string; talking_head_script?: string } | null,
          personImageUrl,
          productImageUrl,
          project.video_duration_seconds,
          project.language,
          project.custom_dialogue || undefined,
          { talkingHeadMode }
        );

        // Create scene records (video scenes only, starting from 1)
        const videoScenes = project.video_duration_seconds / UNIT_SECONDS;
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
          .from('avatar_ads_scenes')
          .insert(sceneRecords);

        if (sceneError) throw sceneError;

        // Update project with prompts AND image_prompt
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
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
        if (!project.image_prompt) {
          throw new Error('Image prompt not found in project');
        }

        if (project.generated_image_url) {
          // Already generated, skip to next step
          return {
            project,
            message: 'Cover image already generated',
            nextStep: 'generate_videos'
          };
        }

        const referenceImages = [...project.person_image_urls, ...project.product_image_urls];

        // Use project-level image_prompt instead of scene 0 prompt
        const { taskId } = await generateImageWithKIE(
          { prompt: project.image_prompt } as Record<string, unknown>,
          project.image_model || NON_AGENT_IMAGE_MODEL,
          referenceImages,
          project.image_size,
          project.video_aspect_ratio
        );

        // Update project only (no scene updates since scene 0 doesn't exist)
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
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
            .from('avatar_ads_projects')
            .update({
              generated_image_url: status.result_url,
              status: 'awaiting_review', // Changed from generating_videos to awaiting_review
              current_step: 'reviewing', // Changed from generating_videos to reviewing
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
            message: 'Cover image generation completed, awaiting user review',
            nextStep: undefined // Stop automatic progression
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
        // ===== VERSION 2.0: GENERATION-TIME BILLING =====
        // Calculate video generation cost (veo3_fast: 20 credits per 8s segment)
        const videoScenes = project.video_duration_seconds / UNIT_SECONDS;
        const generationCost = GENERATION_COSTS.veo3_fast * videoScenes; // 20 * number of segments

        // Check if user has enough credits
        const creditCheck = await checkCredits(project.user_id, generationCost);
        if (!creditCheck.success) {
          throw new Error(`Failed to check credits: ${creditCheck.error || 'Credit check failed'}`);
        }

        if (!creditCheck.hasEnoughCredits) {
          throw new Error(
            `Insufficient credits: Need ${generationCost} credits for ${videoScenes} video scenes (veo3_fast), have ${creditCheck.currentCredits || 0}`
          );
        }

        // Deduct credits UPFRONT before video generation
        const deductResult = await deductCredits(project.user_id, generationCost);
        if (!deductResult.success) {
          throw new Error(`Failed to deduct credits: ${deductResult.error || 'Credit deduction failed'}`);
        }

        // Record the transaction
        await recordCreditTransaction(
          project.user_id,
          'usage',
          generationCost,
          `Avatar Ads - Video generation (VEO3_FAST, ${videoScenes} scenes)`,
          project.id,
          true
        );

        // Store generation cost in a variable for potential refund
        const paidGenerationCost = generationCost;

        // Step 4: Generate video scenes using KIE
        if (!project.generated_image_url) {
          throw new Error('Generated image not found - required for video generation');
        }

        // videoScenes already defined above for billing calculation

        const existingTaskIds = Array.isArray(project.kie_video_task_ids)
          ? project.kie_video_task_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];

        if (existingTaskIds.length === videoScenes) {
          const progress = Math.max(project.progress_percentage ?? 0, 70);
          const { data: updatedProject, error: skipUpdateError } = await supabase
            .from('avatar_ads_projects')
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
          // ✅ Fix: Array index is 0-based, loop counter is 1-based
          const scenes = project.generated_prompts?.scenes as Array<{prompt: unknown}>;
          const videoPrompt = scenes?.[i - 1]?.prompt;

          // ✅ STRICT VALIDATION: Ensure videoPrompt exists and is not empty object
          if (!videoPrompt || typeof videoPrompt !== 'object') {
            console.error(`❌❌❌ Scene ${i}: videoPrompt is ${!videoPrompt ? 'undefined/null' : 'not an object'}!`);
            console.error('Full generated_prompts:', JSON.stringify(project.generated_prompts, null, 2));
            throw new Error(`Scene ${i} prompt not found in generated_prompts - STOPPING WORKFLOW`);
          }

          // Check for structured fields or legacy video_prompt
          const videoPromptObj = videoPrompt as any;
          const hasStructuredFields = !!(videoPromptObj.subject || videoPromptObj.action || videoPromptObj.dialog);
          const hasLegacyPrompt = !!(videoPromptObj.video_prompt && typeof videoPromptObj.video_prompt === 'string' && videoPromptObj.video_prompt.trim() !== '');

          if (!hasStructuredFields && !hasLegacyPrompt) {
             console.error(`❌❌❌ Scene ${i}: Missing both structured fields (subject/action/dialog) AND legacy video_prompt!`);
             console.error('videoPrompt object:', JSON.stringify(videoPrompt, null, 2));
             throw new Error(`Scene ${i} prompt is empty/invalid - STOPPING WORKFLOW`);
          }

          const { taskId } = await generateVideoWithKIE(
            videoPrompt as Record<string, unknown>,
            [project.generated_image_url, project.generated_image_url], // Use generated image as start AND end frame for consistency
            project.video_aspect_ratio as '16:9' | '9:16' | undefined,
            project.language // Pass language for video prompt
          );

          videoTaskIds.push(taskId);

          // Update scene status
          await supabase
            .from('avatar_ads_scenes')
            .update({
              kie_video_task_id: taskId,  // Renamed from kie_task_id
              status: 'generating'
            })
            .eq('project_id', project.id)
            .eq('scene_number', i);
        }

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
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
        let hasRetries = false;
        const currentTaskIds = [...project.kie_video_task_ids]; // Copy for mutation

        for (let i = 0; i < currentTaskIds.length; i++) {
          const taskId = currentTaskIds[i];
          const status = await checkKIEVideoTaskStatus(taskId);

          if (status.status === 'completed' && status.result_url) {
            // Collect video URL
            videoUrls.push(status.result_url);

            // Update scene status in database
            await supabase
              .from('avatar_ads_scenes')
              .update({
                video_url: status.result_url,
                status: 'completed'
              })
              .eq('project_id', project.id)
              .eq('scene_number', i + 1);

          } else if (status.status === 'failed') {
            // NEW: Server errors are handled by monitor-tasks, not here
            if (status.isRetryable) {
              allCompleted = false;
              continue; // Don't throw - let monitor-tasks handle retry
            }

            // Check if content policy error (unlimited retry by workflow)
            const isContentPolicy = status.error && (
              status.error.includes('content policy') ||
              status.error.includes('Safety check failed') ||
              status.error.includes('violating content policies')
            );

            if (isContentPolicy) {
              // Retrieve prompt for this scene
              const scenes = project.generated_prompts?.scenes as Array<{prompt: unknown}>;
              const videoPrompt = scenes?.[i]?.prompt;

              if (videoPrompt) {
                // Regenerate video task using updated generation logic (handles both structured and legacy)
                const { taskId: newTaskId } = await generateVideoWithKIE(
                  videoPrompt as Record<string, unknown>,
                  [project.generated_image_url!, project.generated_image_url!],
                  project.video_aspect_ratio as '16:9' | '9:16' | undefined,
                  project.language
                );

                // Update task ID in local array
                currentTaskIds[i] = newTaskId;
                hasRetries = true;
                allCompleted = false;

                // Update scene record immediately
                await supabase
                  .from('avatar_ads_scenes')
                  .update({
                    kie_video_task_id: newTaskId,
                    status: 'generating'
                  })
                  .eq('project_id', project.id)
                  .eq('scene_number', i + 1);
                  
                continue; // Skip error throwing
              }
            }

            throw new Error(`Video ${i + 1} generation failed: ${status.error}`);
          } else {
            allCompleted = false;
          }
        }

        // Save retries if any
        if (hasRetries) {
           await supabase
            .from('avatar_ads_projects')
            .update({
              kie_video_task_ids: currentTaskIds,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);
            
           return {
             project: { ...project, kie_video_task_ids: currentTaskIds },
             message: 'Retrying failed video tasks due to content policy...',
             nextStep: 'check_videos_status' // Stay in this step
           };
        }

        if (allCompleted) {
          // All videos completed
          if (videoUrls.length === 0) {
            throw new Error('No video URLs collected despite all tasks completed');
          }

          // Check if we need to merge videos (single-scene vs multi-scene)
          const videoScenes = project.video_duration_seconds / UNIT_SECONDS;
          if (videoScenes === 1) {
            // For 8-second videos, use the single generated video directly
            const { data: updatedProject, error } = await supabase
              .from('avatar_ads_projects')
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
              .from('avatar_ads_projects')
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
        // Step 5: Merge videos using fal.ai (Event-Driven with Webhook)
        // Query video URLs from scenes table
        const { data: scenes } = await supabase
          .from('avatar_ads_scenes')
          .select('video_url, scene_number')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('scene_number', { ascending: true });

        const videoUrls = scenes?.map(s => s.video_url).filter(Boolean) || [];

        if (videoUrls.length === 0) {
          throw new Error('No video URLs available for merging');
        }

        // ✅ Submit merge task with webhook (non-blocking)
        // Webhook will update project to 'completed' when merge finishes
        const { taskId } = await mergeVideosWithFal(
          videoUrls,
          project.video_aspect_ratio as '16:9' | '9:16'
        );

        // Update project with task ID
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
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

        console.log(`🔔 [Avatar Ads] Merge task submitted, webhook will handle completion: ${taskId}`);

        // No event recording

        return {
          project: updatedProject,
          message: 'Video merging started (webhook mode)',
          // ✅ No nextStep - webhook will handle completion
        };
      }

      // ❌ REMOVED: check_merge_status step
      // No longer needed - fal.ai webhook handles completion automatically
      // See: /api/avatar-ads/webhooks/merge

      default: {
        throw new Error(`Unknown step: ${step}`);
      }
    }

  } catch (error) {
    console.error(`Error processing step ${step}:`, error);

    // ===== VERSION 2.0: SCENE-LEVEL REFUND ON FAILURE =====
    // Determine if we need to refund credits (only if video generation was attempted)
    const videoGenerationSteps = ['generate_videos', 'check_videos_status', 'merge_videos', 'check_merge_status'];
    const shouldRefund = videoGenerationSteps.includes(step);

    if (shouldRefund) {
      try {
        // Fetch scenes to count permanently failed ones (retry_count >= 3)
        const { data: scenes } = await supabase
          .from('avatar_ads_scenes')
          .select('status, retry_count')
          .eq('project_id', project.id);

        const permanentlyFailedScenes = scenes?.filter(
          s => s.status === 'failed' && (s.retry_count || 0) >= 3
        ) || [];

        if (permanentlyFailedScenes.length > 0) {
          const costPerScene = GENERATION_COSTS.veo3_fast; // 20 credits per scene
          const refundAmount = permanentlyFailedScenes.length * costPerScene;

          const { refundCredits } = await import('@/lib/credits');
          const refundResult = await refundCredits(
            project.user_id,
            refundAmount,
            `Avatar Ads - Refund for ${permanentlyFailedScenes.length} failed video scenes after max retries`,
            project.id
          );

          if (!refundResult.success) {
            console.error(`❌ Failed to refund credits:`, refundResult.error);
            // TODO: This should trigger alerting - user paid but didn't get service
          }
        } else {
          // No permanently failed scenes yet - might be a different error before scenes were created
          // Or scenes are still retrying
          // If error occurred before scenes were created or during generation, refund full cost
          if (!scenes || scenes.length === 0 || step === 'generate_videos') {
            const videoScenes = project.video_duration_seconds / UNIT_SECONDS;
            const generationCost = GENERATION_COSTS.veo3_fast * videoScenes;

            if (generationCost > 0) {
              const { refundCredits } = await import('@/lib/credits');
              const refundResult = await refundCredits(
                project.user_id,
                generationCost,
                `Avatar Ads - Refund for failed video generation (step: ${step})`,
                project.id
              );

              if (!refundResult.success) {
                console.error(`❌ Failed to refund credits:`, refundResult.error);
              }
            }
          }
        }
      } catch (refundError) {
        console.error('❌ Error during refund process:', refundError);
        // Don't throw - we still want to mark project as failed
      }
    }

    // Update project with error
    await supabase
      .from('avatar_ads_projects')
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
