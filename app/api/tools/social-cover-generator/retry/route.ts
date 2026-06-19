import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
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
export const maxDuration = 120;

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
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

    const body = await request.json() as { jobId?: string; slotId?: string };
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    const slotId = typeof body.slotId === 'string' ? body.slotId : '';
    if (!jobId || !slotId) {
      return NextResponse.json({ error: 'Job and cover slot are required.' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.tool_key !== 'social-cover-generator' || job.user_id !== userId) {
      return NextResponse.json({ error: 'Generation job not found.' }, { status: 404 });
    }

    const metadata = (job.metadata ?? {}) as SocialCoverMetadata;
    const slot = (metadata.slots ?? []).find((candidate) => candidate.id === slotId);
    if (!slot) {
      return NextResponse.json({ error: 'Cover slot was not found.' }, { status: 404 });
    }
    if (!metadata.person_image_url || !metadata.product_or_logo_image_url) {
      return NextResponse.json({ error: 'Hosted source image URLs are missing.' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: IMAGE_GENERATION_CREDIT_COST,
      description: 'Social Cover Generator - retry',
      historyId: job.id,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      const taskId = await createKieImageTask({
        prompt: slot.prompt,
        inputUrls: [metadata.person_image_url, metadata.product_or_logo_image_url],
        aspectRatio: slot.aspectRatio,
        resolution: metadata.resolution || '1K',
        callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
      });
      await createToolGenerationTask({
        jobId: job.id,
        kieTaskId: taskId,
        toolKey: 'social-cover-generator',
        metadata: { stage: 'image', slot_id: slot.id, language: slot.language, aspect_ratio: slot.aspectRatio, retry: true },
      });

      const nextMetadata: SocialCoverMetadata = {
        ...metadata,
        slots: updateSocialCoverSlot(metadata.slots, slot.id, {
          taskId,
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
        reason: 'Social Cover Generator retry failed to start',
        historyId: job.id,
      });
      throw error;
    }
  } catch (error) {
    console.error('[tools/social-cover-generator/retry] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry social cover.' },
      { status: 500 }
    );
  }
}
