import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { sendOpenRouterChat, extractOpenRouterTextContent, extractOpenRouterJsonContent } from '@/lib/openrouter';
import { AD_SHORT_FILM_TOTAL_CREDIT_COST, chargeToolGenerationCredits, refundToolGenerationCredits, toolBillingErrorPayload } from '@/lib/tools/billing';
import { createToolGenerationJob, createToolGenerationTask, getToolGenerationJob, getToolGenerationTasksByJobId, updateToolGenerationJob } from '@/lib/tools/job-store';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function uploadImage(dataUrl: string, fileName: string): Promise<string> {
  const response = await fetchWithRetry(KIE_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data: dataUrl, uploadPath: 'flowtra/ad-short-film', fileName }),
  }, 3, 30000);

  if (!response.ok) throw new Error(`KIE upload failed: ${response.status}`);
  const payload = await response.json();
  const downloadUrl = payload?.data?.downloadUrl;
  if (!payload?.success || !downloadUrl) throw new Error(payload?.msg || 'Upload failed');
  return downloadUrl;
}

// ─── Storyboard prompt generation ─────────────────────────────────────────────

async function generateStoryboardPrompt(productImageUrl: string): Promise<string> {
  const model = process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash';

  const response = await sendOpenRouterChat(
    {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Analyze the uploaded product photo and generate an image-generation prompt for a clean 15-second advertising storyboard image. Return only a JSON object with "prompt", "narration", and "camera" fields.` },
          { type: 'image_url', image_url: { url: productImageUrl } },
        ],
      }],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ad_short_film_storyboard',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              narration: { type: 'string' },
              camera: { type: 'string' },
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
    { timeoutMs: 60000, maxRetries: 3, httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', xTitle: 'Flowtra' }
  );

  const textContent = extractOpenRouterTextContent(response.choices?.[0]?.message?.content);
  if (!textContent) throw new Error('OpenRouter returned empty storyboard response');

  const storyboardData = extractOpenRouterJsonContent<{ prompt?: string }>(textContent);
  const storyboardPrompt = storyboardData?.prompt || textContent;
  if (!storyboardPrompt || storyboardPrompt.length < 24) {
    throw new Error('OpenRouter did not return a valid storyboard prompt');
  }
  return storyboardPrompt;
}

// ─── KIE image task ───────────────────────────────────────────────────────────

async function createKieImageTask(params: {
  prompt: string;
  referenceImageUrls: string[];
  aspectRatio: string;
  callBackUrl: string;
}): Promise<string> {
  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKieApiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
      input: {
        prompt: params.prompt,
        input_urls: params.referenceImageUrls.filter(Boolean),
        aspect_ratio: params.aspectRatio,
        nsfw_checker: false,
      },
      callBackUrl: params.callBackUrl,
    }),
  }, 5, 30000);

  if (!response.ok) throw new Error(`KIE image task creation failed: ${response.status}`);
  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) throw new Error(data.msg || 'Failed to start KIE image task');
  return data.data.taskId;
}

// ─── POST: Create job ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'OPENROUTER API key not configured' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL not configured' }, { status: 500 });
    }

    const body = await request.json();

    // Default: create new ad short film job
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { productPhotoDataUrl } = body;
    if (!productPhotoDataUrl) {
      return NextResponse.json({ error: 'Missing productPhotoDataUrl' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: AD_SHORT_FILM_TOTAL_CREDIT_COST,
      description: 'AI Ad Short Film - 15s video generation',
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    let job;
    try {
      // Create job
      job = await createToolGenerationJob({
        userId,
        toolKey: 'ad-short-film',
        status: 'uploading',
        billedCredits: charge.chargedCredits,
      });

      // Step 1: Upload product photo
      const productImageUrl = await uploadImage(productPhotoDataUrl, `ad_short_film_product_${job.id}.jpg`);

      await updateToolGenerationJob(job.id, {
        status: 'generating_storyboard',
        metadata: { product_image_url: productImageUrl },
      });

      // Step 2: Generate storyboard prompt
      const storyboardPrompt = await generateStoryboardPrompt(productImageUrl);

      await updateToolGenerationJob(job.id, {
        status: 'generating_storyboard_image',
        metadata: { product_image_url: productImageUrl, storyboard_prompt: storyboardPrompt },
      });

      // Step 3: Create KIE storyboard image task with webhook
      const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;
      const storyboardImageTaskId = await createKieImageTask({
        prompt: storyboardPrompt,
        referenceImageUrls: [productImageUrl],
        aspectRatio: '9:16',
        callBackUrl,
      });

      await createToolGenerationTask({
        jobId: job.id,
        kieTaskId: storyboardImageTaskId,
        toolKey: 'ad-short-film',
        metadata: { stage: 'storyboard_image' },
      });

      await updateToolGenerationJob(job.id, {
        metadata: {
          product_image_url: productImageUrl,
          storyboard_prompt: storyboardPrompt,
          storyboard_image_task_id: storyboardImageTaskId,
        },
      });

      return NextResponse.json(
        { success: true, jobId: job.id, status: 'generating_storyboard_image' },
        { status: 202 }
      );
    } catch (error) {
      if (job) {
        await refundToolGenerationCredits({
          userId,
          amount: charge.chargedCredits,
          reason: 'AI Ad Short Film failed to start',
          historyId: job.id,
        });
        await updateToolGenerationJob(job.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Failed to start',
          billing_refunded_at: new Date().toISOString(),
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('[tools/ad-short-film] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ─── GET: Hydration only (no polling) ─────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const tasks = await getToolGenerationTasksByJobId(jobId);
    const metadata = job.metadata as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      storyboardPrompt: metadata?.storyboard_prompt || '',
      storyboardImageUrl: metadata?.storyboard_image_url || null,
      videoUrl: job.result_url,
      errorMessage: job.error_message,
      tasks,
    });
  } catch (error) {
    console.error('[tools/ad-short-film] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
