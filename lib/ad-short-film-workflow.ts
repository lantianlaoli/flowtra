import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { sendOpenRouterChat, extractOpenRouterTextContent, extractOpenRouterJsonContent } from '@/lib/openrouter';
import {
  addJob,
  generateJobId,
  type AdShortFilmJob,
  type AdShortFilmJobStatus,
  updateJob,
  getJob,
} from './ad-short-film-job-store';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_RECORD_INFO_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');
  return apiKey;
}

export type CreateAdShortFilmInput = {
  productPhotoDataUrl: string;
  userId: string;
};

export type CreateAdShortFilmResult = {
  jobId: string;
  status: AdShortFilmJobStatus;
};

export async function createAdShortFilmJob(
  input: CreateAdShortFilmInput
): Promise<CreateAdShortFilmResult> {
  const jobId = generateJobId();

  const job: AdShortFilmJob = {
    id: jobId,
    userId: input.userId,
    status: 'idle',
    productImageUrl: null,
    storyboardPrompt: '',
    storyboardImageUrl: null,
    storyboardImageTaskId: null,
    videoUrl: null,
    videoTaskId: null,
    errorMessage: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  addJob(job);

  return {
    jobId,
    status: 'idle',
  };
}

export async function executeWorkflow(
  jobId: string,
  productPhotoDataUrl: string,
  _userId: string
): Promise<void> {
  try {
    // Step 1: Upload product photo
    updateJob(jobId, { status: 'uploading' });

    const productImageUrl = await uploadImageForAdShortFilm(
      productPhotoDataUrl,
      `ad_short_film_product_${jobId}.jpg`
    );
    updateJob(jobId, { productImageUrl });

    // Step 2: Generate storyboard prompt via OpenRouter
    updateJob(jobId, { status: 'generating_storyboard' });
    const storyboardPrompt = await generateStoryboardPrompt(jobId, productImageUrl);
    updateJob(jobId, { storyboardPrompt });

    // Step 3: Generate storyboard image via KIE GPT Image 2
    updateJob(jobId, { status: 'generating_storyboard_image' });
    const storyboardImageUrl = await generateStoryboardImage(jobId, productImageUrl, storyboardPrompt);
    updateJob(jobId, { storyboardImageUrl });

    // Step 4: Generate video via KIE Seedance 2 Fast
    updateJob(jobId, { status: 'generating_video' });
    await generateVideo(jobId, productImageUrl, storyboardImageUrl, storyboardPrompt);

    updateJob(jobId, { status: 'completed' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ad-short-film] Workflow error for job ${jobId}:`, errorMessage);
    updateJob(jobId, { status: 'failed', errorMessage });
  }
}

// ─── Step 1: Upload ────────────────────────────────────────────────────────────

async function uploadImageForAdShortFilm(
  dataUrl: string,
  fileName: string,
  uploadPath = 'flowtra/ad-short-film'
): Promise<string> {
  const response = await fetchWithRetry(
    KIE_UPLOAD_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data: dataUrl,
        uploadPath,
        fileName,
      }),
    },
    3,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE upload failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const downloadUrl = payload?.data?.downloadUrl;
  if (!payload?.success || typeof downloadUrl !== 'string') {
    throw new Error(payload?.msg || 'KIE upload did not return a download URL.');
  }

  return downloadUrl;
}

// ─── Step 2: OpenRouter Storyboard Prompt Generation ────────────────────────────

interface StoryboardPromptResponse {
  prompt?: string;
  storyboard_prompt?: string;
  storyboardPrompt?: string;
  narration?: string;
  camera?: string;
}

function resolveStoryboardPrompt(data: StoryboardPromptResponse | null, rawText: string): string | null {
  const structuredPrompt = data?.prompt || data?.storyboard_prompt || data?.storyboardPrompt;
  if (typeof structuredPrompt === 'string' && structuredPrompt.trim().length > 24) {
    return structuredPrompt.trim();
  }

  const trimmedText = rawText.trim();
  if (trimmedText.length > 80 && !trimmedText.startsWith('{')) {
    return trimmedText;
  }

  return null;
}

async function generateStoryboardPrompt(
  jobId: string,
  productImageUrl: string
): Promise<string> {
  const model = process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash';

  const response = await sendOpenRouterChat(
    {
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze the uploaded product photo and generate an image-generation prompt for a clean 15-second advertising storyboard image that is tailored to the exact product.

The output prompt must adapt this reference structure to the uploaded product, not copy the boxing mitt example literally:

Create a clean 15-second storyboard for a [detected product] ad with columns for image, narration, and camera.

Layout:
Grid storyboard with columns: Cut, Image (Reference), Narration/Dialogue, Camera/Audio, Time.
Minimal, high-tech, clean white background.

Content:
Use 7 cuts. Make each cut specific to the detected product category, materials, use case, and visual identity.
The cuts should cover:
1. Product reveal / origin moment.
2. Material or texture detail macro.
3. Craftsmanship, construction, or design feature.
4. Performance / benefit analysis with subtle premium UI overlay.
5. Hero transformation or motion-ready product pose.
6. Macro beauty shot with surface and detail emphasis.
7. Final hero shot with a short premium tagline.

Style:
Realistic product photography, cinematic lighting, premium commercial ad, sharp typography, balanced spacing, clean grid, not overly crowded, not sci-fi, no fake brand logos, preserve the product identity from the uploaded image.

Return only a JSON object with:
- "prompt": the complete image-generation prompt for the storyboard grid image.
- "narration": a concise ad narration direction.
- "camera": concise camera/audio direction for the later video generation.
Do not include markdown, comments, or extra text.`,
            },
            {
              type: 'image_url',
              image_url: { url: productImageUrl },
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ad_short_film_storyboard',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Complete image-generation prompt for a clean 15-second storyboard grid image tailored to the uploaded product.',
              },
              narration: {
                type: 'string',
                description: 'Short narration or dialogue for the ad.',
              },
              camera: {
                type: 'string',
                description: 'Camera movement, shot direction, and audio notes.',
              },
            },
            required: ['prompt', 'narration', 'camera'],
            additionalProperties: false,
          },
        },
      },
      plugins: [{ id: 'response-healing' }],
      max_tokens: 2000,
      temperature: 0.7,
    },
    {
      timeoutMs: 60000,
      maxRetries: 3,
      httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      xTitle: 'Flowtra',
    }
  );

  const textContent = extractOpenRouterTextContent(response.choices?.[0]?.message?.content);
  if (!textContent) {
    throw new Error('OpenRouter returned empty storyboard response');
  }

  const storyboardData = extractOpenRouterJsonContent<StoryboardPromptResponse>(textContent);
  const storyboardPrompt = resolveStoryboardPrompt(storyboardData, textContent);
  if (!storyboardPrompt) {
    console.error('[ad-short-film] Invalid OpenRouter storyboard response:', textContent.slice(0, 1000));
    throw new Error('OpenRouter did not return a valid storyboard prompt');
  }

  return storyboardPrompt;
}

// ─── Step 3: KIE GPT Image 2 Storyboard Image Generation ───────────────────────

async function generateStoryboardImage(
  jobId: string,
  productImageUrl: string,
  storyboardPrompt: string
): Promise<string> {
  const taskId = await createKieGptImageTaskForStoryboard({
    prompt: storyboardPrompt,
    referenceImageUrls: [productImageUrl],
    aspectRatio: '9:16',
  });

  updateJob(jobId, { storyboardImageTaskId: taskId });

  // Poll until complete
  const resultUrl = await pollStoryboardImageTask(jobId, taskId);
  return resultUrl;
}

async function createKieGptImageTaskForStoryboard(input: {
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: string;
}): Promise<string> {
  const normalizedAspectRatio = normalizeKieGptImageAspectRatio(input.aspectRatio);

  const payload = {
    model: GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
    input: {
      prompt: input.prompt,
      input_urls: input.referenceImageUrls.filter(Boolean),
      aspect_ratio: normalizedAspectRatio || '9:16',
      nsfw_checker: false,
    },
  };

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE GPT Image task creation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start KIE GPT Image task');
  }

  return data.data.taskId as string;
}

function normalizeKieGptImageAspectRatio(aspectRatio: string): string | undefined {
  const allowed = new Set(['auto', '1:1', '5:4', '9:16', '21:9', '16:9', '4:3', '3:2', '4:5', '3:4', '2:3']);
  return allowed.has(aspectRatio) ? aspectRatio : undefined;
}

function extractKieResultUrl(resultJson: unknown): string | null {
  if (typeof resultJson !== 'string' || !resultJson.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(resultJson);
    if (Array.isArray(parsed?.resultUrls) && typeof parsed.resultUrls[0] === 'string') {
      return parsed.resultUrls[0];
    }
    if (typeof parsed?.video_url === 'string') {
      return parsed.video_url;
    }
    if (typeof parsed?.url === 'string') {
      return parsed.url;
    }
    if (Array.isArray(parsed?.videos) && typeof parsed.videos[0] === 'string') {
      return parsed.videos[0];
    }
  } catch (error) {
    console.error('[ad-short-film] Failed to parse KIE resultJson:', error, String(resultJson).slice(0, 1000));
  }

  return null;
}

type KieImageTaskStatus =
  | { status: 'processing'; resultUrl?: undefined; error?: undefined }
  | { status: 'success'; resultUrl: string; error?: undefined }
  | { status: 'failed'; resultUrl?: undefined; error: string };

async function getKieImageTaskStatus(taskId: string): Promise<KieImageTaskStatus> {
  const response = await fetchWithRetry(
    `${KIE_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
      },
    },
    3,
    15000
  );

  if (!response.ok) {
    throw new Error(`KIE image status check failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.code !== 200) {
    throw new Error(payload.msg || 'KIE image status check failed.');
  }

  const state = payload.data?.state?.toLowerCase() ?? 'processing';

  if (state === 'success') {
    const resultUrl = extractKieResultUrl(payload.data?.resultJson);
    if (!resultUrl) {
      return { status: 'failed', error: 'Image generation succeeded but did not return a result URL' };
    }
    return { status: 'success', resultUrl };
  }

  if (state === 'fail') {
    return { status: 'failed', error: payload.data?.failMsg || payload.data?.failCode || 'Image generation failed' };
  }

  return { status: 'processing' };
}

async function pollStoryboardImageTask(jobId: string, taskId: string): Promise<string> {
  const MAX_POLL_ATTEMPTS = 180;
  const POLL_INTERVAL_MS = 2000;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getKieImageTaskStatus(taskId);

    if (status.status === 'success' && status.resultUrl) {
      return status.resultUrl;
    }

    if (status.status === 'failed') {
      throw new Error(`Storyboard image generation failed: ${status.error}`);
    }
  }

  throw new Error('Storyboard image generation timed out');
}

// ─── Step 4: KIE Seedance 2 Fast Video Generation ───────────────────────────────

function buildSeedanceVideoPrompt(storyboardPrompt: string): string {
  const prompt = `Create a 15-second vertical product advertisement based on the provided storyboard image and product photo. Use the storyboard as the creative plan and the product photo as the identity reference. Preserve the exact product appearance, materials, proportions, color, and details. Animate through the storyboard beats with premium product-ad pacing: reveal, macro detail, craftsmanship/design feature, performance benefit, hero motion, beauty detail, final hero tagline. Use realistic product photography, cinematic lighting, clean white or premium studio backgrounds, subtle UI overlays only where appropriate, sharp commercial typography, smooth camera motion, and polished audio. Do not invent a different product, logo, or brand. Storyboard prompt: ${storyboardPrompt}`;

  return prompt.length > 1500 ? `${prompt.slice(0, 1497)}...` : prompt;
}

async function generateVideo(
  jobId: string,
  productImageUrl: string,
  storyboardImageUrl: string,
  storyboardPrompt: string
): Promise<void> {
  const videoTaskId = await createSeedanceVideoTask({
    prompt: buildSeedanceVideoPrompt(storyboardPrompt),
    referenceImageUrls: [productImageUrl, storyboardImageUrl],
  });

  updateJob(jobId, { videoTaskId });

  // Poll video task
  await pollVideoTask(jobId, videoTaskId);
}

async function createSeedanceVideoTask(input: {
  prompt: string;
  referenceImageUrls: string[];
}): Promise<string> {
  const requestBody = {
    model: 'bytedance/seedance-2-fast',
    input: {
      prompt: input.prompt,
      reference_image_urls: input.referenceImageUrls,
      reference_video_urls: [''],
      reference_audio_urls: [''],
      resolution: '480p',
      aspect_ratio: '9:16',
      duration: 15,
      generate_audio: true,
      web_search: false,
      nsfw_checker: true,
    },
  };

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE Seedance task creation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start KIE Seedance task');
  }

  return data.data.taskId as string;
}

type KieVideoTaskStatus =
  | { status: 'processing'; resultUrl?: undefined; error?: undefined }
  | { status: 'success'; resultUrl: string; error?: undefined }
  | { status: 'failed'; resultUrl?: undefined; error: string };

async function getKieVideoTaskStatus(taskId: string): Promise<KieVideoTaskStatus> {
  const response = await fetchWithRetry(
    `${KIE_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
      },
    },
    3,
    15000
  );

  if (!response.ok) {
    throw new Error(`KIE video status check failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.code !== 200) {
    throw new Error(payload.msg || 'KIE video status check failed.');
  }

  const state = payload.data?.state?.toLowerCase() ?? 'processing';

  if (state === 'success') {
    const resultUrl = extractKieResultUrl(payload.data?.resultJson);
    if (!resultUrl) {
      return { status: 'failed', error: 'Video generation succeeded but did not return a result URL' };
    }
    return { status: 'success', resultUrl };
  }

  if (state === 'fail') {
    return { status: 'failed', error: payload.data?.failMsg || payload.data?.failCode || 'Video generation failed' };
  }

  return { status: 'processing' };
}

async function pollVideoTask(jobId: string, taskId: string): Promise<void> {
  const MAX_POLL_ATTEMPTS = 360;
  const POLL_INTERVAL_MS = 2000;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const status = await getKieVideoTaskStatus(taskId);

    if (status.status === 'success' && status.resultUrl) {
      updateJob(jobId, { videoUrl: status.resultUrl });
      return;
    }

    if (status.status === 'failed') {
      throw new Error(`Video generation failed: ${status.error}`);
    }
  }

  throw new Error('Video generation timed out');
}

// ─── Polling ───────────────────────────────────────────────────────────────────

export async function pollAdShortFilmJobStatus(jobId: string): Promise<{
  status: AdShortFilmJobStatus;
  storyboardPrompt: string;
  storyboardImageUrl: string | null;
  videoUrl: string | null;
  errorMessage: string | null;
}> {
  const job = getJob(jobId);

  if (!job) {
    return {
      status: 'failed',
      storyboardPrompt: '',
      storyboardImageUrl: null,
      videoUrl: null,
      errorMessage: 'Job not found'
    };
  }

  // If still processing storyboard image, check its status
  if (job.status === 'generating_storyboard_image' && job.storyboardImageTaskId && !job.storyboardImageUrl) {
    const status = await getKieImageTaskStatus(job.storyboardImageTaskId);
    if (status.status === 'success' && status.resultUrl) {
      updateJob(jobId, { storyboardImageUrl: status.resultUrl });
    } else if (status.status === 'failed') {
      updateJob(jobId, { status: 'failed', errorMessage: status.error || 'Storyboard image generation failed' });
    }
  }

  // If still processing video, check its status
  if (job.status === 'generating_video' && job.videoTaskId && !job.videoUrl) {
    const status = await getKieVideoTaskStatus(job.videoTaskId);
    if (status.status === 'success' && status.resultUrl) {
      updateJob(jobId, { status: 'completed', videoUrl: status.resultUrl });
    } else if (status.status === 'failed') {
      updateJob(jobId, { status: 'failed', errorMessage: status.error || 'Video generation failed' });
    }
  }

  // Re-fetch job after potential updates
  const updatedJob = getJob(jobId)!;
  return {
    status: updatedJob.status,
    storyboardPrompt: updatedJob.storyboardPrompt,
    storyboardImageUrl: updatedJob.storyboardImageUrl,
    videoUrl: updatedJob.videoUrl,
    errorMessage: updatedJob.errorMessage,
  };
}
