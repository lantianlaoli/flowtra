import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  calculateEcommerceListingProgress,
  normalizeImageAspectRatio,
  normalizeImageResolution,
  type EcommerceListingImageSlot,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';
import {
  createToolGenerationTask,
  getToolGenerationJob,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';

export const runtime = 'nodejs';
export const maxDuration = 300;

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const MAX_LOCAL_IMAGES = 4;
const MAX_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024;
const LOCAL_IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/;

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

function decodedBase64ByteLength(value: string) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function uploadLocalImage(dataUrl: string, fileName: string) {
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
        uploadPath: 'flowtra/ecommerce-listing-studio/edit-uploads',
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

async function uploadLocalImages(localImages: Array<{ fileName?: string; dataUrl?: string }> | undefined) {
  if (!localImages?.length) return [];
  if (localImages.length > MAX_LOCAL_IMAGES) {
    throw new Error(`Upload up to ${MAX_LOCAL_IMAGES} reference images.`);
  }

  return Promise.all(
    localImages.map((image, index) => {
      const dataUrl = image.dataUrl?.trim() ?? '';
      const match = dataUrl.match(LOCAL_IMAGE_DATA_URL_PATTERN);
      if (!match) throw new Error('Reference images must be PNG, JPG, or WEBP data URLs.');
      if (decodedBase64ByteLength(match[2]) > MAX_LOCAL_IMAGE_BYTES) {
        throw new Error('Each reference image must be 10MB or smaller.');
      }
      return uploadLocalImage(dataUrl, image.fileName ?? `reference-${index + 1}.png`);
    })
  );
}

async function createKieRegenerationTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}) {
  const response = await fetchWithRetry(
    KIE_CREATE_TASK_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
        input: {
          prompt: input.prompt,
          input_urls: input.inputUrls.slice(0, 16),
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
          nsfw_checker: true,
        },
        callBackUrl: input.callBackUrl,
      }),
    },
    5,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE image task creation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (payload?.code !== 200 || typeof taskId !== 'string') {
    throw new Error(payload?.msg || 'KIE image task creation did not return a taskId.');
  }
  return taskId;
}

function findSlot(metadata: EcommerceListingMetadata, slotId: string) {
  return [...(metadata.carousel_images ?? []), ...(metadata.detail_images ?? [])].find((slot) => slot.id === slotId);
}

function updateSlot(
  slots: EcommerceListingImageSlot[] | undefined,
  slotId: string,
  updates: Partial<EcommerceListingImageSlot>
) {
  return (slots ?? []).map((slot) => (slot.id === slotId ? { ...slot, ...updates } : slot));
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL not configured' }, { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      jobId?: string;
      slotId?: string;
      resultUrl?: string;
      refinement?: string;
      localImages?: Array<{ fileName?: string; dataUrl?: string }>;
    };

    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    const slotId = typeof body.slotId === 'string' ? body.slotId : '';
    const refinement = typeof body.refinement === 'string' ? body.refinement.trim().slice(0, 1200) : '';

    if (!jobId || !slotId) {
      return NextResponse.json({ error: 'Job and image slot are required.' }, { status: 400 });
    }
    if (!isHttpUrl(body.resultUrl)) {
      return NextResponse.json({ error: 'A valid current image URL is required.' }, { status: 400 });
    }
    if (!refinement && !body.localImages?.length) {
      return NextResponse.json({ error: 'Describe the edit or upload a reference image.' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.tool_key !== 'ecommerce-listing-studio' || job.user_id !== userId) {
      return NextResponse.json({ error: 'Generation job not found.' }, { status: 404 });
    }

    const metadata = (job.metadata ?? {}) as EcommerceListingMetadata;
    const slot = findSlot(metadata, slotId);
    if (!slot || !slot.resultUrl) {
      return NextResponse.json({ error: 'Only completed image slots can be edited.' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: IMAGE_GENERATION_CREDIT_COST,
      description: 'Ecommerce Listing Studio - image edit',
      historyId: job.id,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      const localImageUrls = await uploadLocalImages(body.localImages);
      const prompt = [
        slot.prompt,
        '',
        'Image edit request:',
        refinement || 'Use the uploaded reference image(s) as visual guidance for the requested image-to-image edit.',
        '',
        'Use the current generated image as the primary visual base.',
        'Preserve the exact product identity, proportions, material, color, logo placement if present, and recognizable details.',
        'Update only what is needed to satisfy the edit request. Keep the same ecommerce listing quality and clean product-led composition.',
        localImageUrls.length ? 'Use the uploaded reference image(s) as additional visual guidance for the requested changes.' : '',
      ].filter(Boolean).join('\n');

      const imageAspectRatio = normalizeImageAspectRatio(metadata.image_aspect_ratio);
      const imageResolution = normalizeImageResolution(metadata.image_resolution);
      const taskId = await createKieRegenerationTask({
        prompt,
        inputUrls: [body.resultUrl, ...localImageUrls],
        aspectRatio: imageAspectRatio,
        resolution: imageResolution,
        callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
      });

      await createToolGenerationTask({
        jobId: job.id,
        kieTaskId: taskId,
        toolKey: 'ecommerce-listing-studio',
        metadata: {
          stage: 'image',
          slot_id: slot.id,
          kind: slot.kind,
          index: slot.index,
          regeneration: true,
        },
      });

      const nextMetadata: EcommerceListingMetadata = {
        ...metadata,
        carousel_images: updateSlot(metadata.carousel_images, slot.id, {
          taskId,
          status: 'processing',
          resultUrl: undefined,
          error: undefined,
        }),
        detail_images: updateSlot(metadata.detail_images, slot.id, {
          taskId,
          status: 'processing',
          resultUrl: undefined,
          error: undefined,
        }),
      };
      const progress = calculateEcommerceListingProgress(nextMetadata);
      nextMetadata.completed_outputs = progress.completed;
      nextMetadata.total_outputs = progress.total;

      const nextJob = await updateToolGenerationJob(job.id, {
        status: 'processing',
        metadata: nextMetadata,
        error_message: null,
      });

      return NextResponse.json({ success: true, jobId: job.id, taskId, job: nextJob }, { status: 202 });
    } catch (error) {
      await refundToolGenerationCredits({
        userId,
        amount: charge.chargedCredits,
        reason: 'Ecommerce Listing Studio image edit failed to start',
        historyId: job.id,
      });
      throw error;
    }
  } catch (error) {
    console.error('[tools/ecommerce-listing-studio/regenerate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start image edit.' },
      { status: 500 }
    );
  }
}
