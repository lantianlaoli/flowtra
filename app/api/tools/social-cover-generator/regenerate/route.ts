import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  buildSocialCoverRegenerationPrompt,
  calculateSocialCoverProgress,
  updateSocialCoverSlot,
  type SocialCoverMetadata,
} from '@/lib/tools/social-cover-generator';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  createToolGenerationTask,
  getToolGenerationJob,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';

export const runtime = 'nodejs';
export const maxDuration = 180;

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const MAX_LOCAL_IMAGES = 4;
const MAX_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024;
const LOCAL_IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i;

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
        uploadPath: 'flowtra/social-cover-generator/edit-uploads',
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
      return uploadLocalImage(dataUrl, image.fileName ?? `social-cover-ref-${index + 1}.png`);
    })
  );
}

async function createKieImageTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}) {
  await assertKieCreditsAvailable();
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

export async function POST(request: NextRequest) {
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SITE_URL not configured' }, { status: 500 });
    }

    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as {
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
      return NextResponse.json({ error: 'Job and cover slot are required.' }, { status: 400 });
    }
    if (!isHttpUrl(body.resultUrl)) {
      return NextResponse.json({ error: 'A valid current cover URL is required.' }, { status: 400 });
    }
    if (!refinement && !body.localImages?.length) {
      return NextResponse.json({ error: 'Describe the edit or upload a reference image.' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.tool_key !== 'social-cover-generator' || job.user_id !== userId) {
      return NextResponse.json({ error: 'Generation job not found.' }, { status: 404 });
    }

    const metadata = (job.metadata ?? {}) as SocialCoverMetadata;
    const slot = (metadata.slots ?? []).find((candidate) => candidate.id === slotId);
    if (!slot || !slot.resultUrl) {
      return NextResponse.json({ error: 'Only completed cover slots can be edited.' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: IMAGE_GENERATION_CREDIT_COST,
      description: 'Social Cover Generator - cover edit',
      historyId: job.id,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      const localImageUrls = await uploadLocalImages(body.localImages);
      const prompt = buildSocialCoverRegenerationPrompt({
        slot,
        refinement: refinement || 'Use the uploaded reference image(s) as visual guidance for the requested cover edit.',
      });
      const taskId = await createKieImageTask({
        prompt,
        inputUrls: [body.resultUrl, ...localImageUrls],
        aspectRatio: slot.aspectRatio,
        resolution: metadata.resolution || '1K',
        callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
      });
      await createToolGenerationTask({
        jobId: job.id,
        kieTaskId: taskId,
        toolKey: 'social-cover-generator',
        metadata: { stage: 'image', slot_id: slot.id, language: slot.language, aspect_ratio: slot.aspectRatio, regeneration: true },
      });

      const nextMetadata: SocialCoverMetadata = {
        ...metadata,
        slots: updateSocialCoverSlot(metadata.slots, slot.id, {
          taskId,
          prompt,
          status: 'processing',
          resultUrl: undefined,
          error: undefined,
        }),
      };
      const progress = calculateSocialCoverProgress(nextMetadata);
      nextMetadata.completed_outputs = progress.completed;
      nextMetadata.total_outputs = progress.total;

      const nextJob = await updateToolGenerationJob(job.id, {
        status: 'processing',
        error_message: null,
        metadata: nextMetadata,
        billed_credits: job.billed_credits + charge.chargedCredits,
      });

      return NextResponse.json({ success: true, jobId: job.id, taskId, job: nextJob }, { status: 202 });
    } catch (error) {
      await refundToolGenerationCredits({
        userId,
        amount: charge.chargedCredits,
        reason: 'Social Cover Generator edit failed to start',
        historyId: job.id,
      });
      throw error;
    }
  } catch (error) {
    console.error('[tools/social-cover-generator/regenerate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to edit social cover.' },
      { status: 500 }
    );
  }
}
