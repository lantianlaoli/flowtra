import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadImageForClone } from '@/lib/image-clone';
import { buildImageClonePrompt } from '@/lib/image-clone-prompt';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  createToolGenerationJob,
  createToolGenerationTask,
  getToolGenerationJob,
  getToolGenerationTasksByJobId,
} from '@/lib/tools/job-store';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_MODEL = 'gpt-image-2-image-to-image';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

async function createKieImageTask(params: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: string;
  resolution: string;
  callBackUrl: string;
}): Promise<string> {
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
        model: KIE_MODEL,
        input: {
          prompt: params.prompt,
          input_urls: params.inputUrls.slice(0, 16),
          aspect_ratio: params.aspectRatio,
          resolution: params.resolution,
        },
        callBackUrl: params.callBackUrl,
      }),
    },
    5,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE task creation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (payload?.code !== 200 || typeof taskId !== 'string') {
    throw new Error(payload?.msg || 'KIE task creation did not return a taskId.');
  }

  return taskId;
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
    const callBackUrl = `${siteUrl}/api/tools/webhooks/kie`;

    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'regenerate') {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { jobId, refinementText } = data;
      if (!jobId || !refinementText) {
        return NextResponse.json({ error: 'Missing jobId or refinementText' }, { status: 400 });
      }

      const originalJob = await getToolGenerationJob(jobId);
      if (!originalJob || originalJob.user_id !== userId) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      const metadata = originalJob.metadata as Record<string, unknown>;
      const originalPrompt = (metadata?.prompt as string) || '';
      const referenceUrls = (metadata?.reference_image_urls as string[]) || [];
      const aspectRatio = (metadata?.aspect_ratio as string) || '1:1';
      const resolution = (metadata?.resolution as string) || '1K';

      const charge = await chargeToolGenerationCredits({
        userId,
        amount: IMAGE_GENERATION_CREDIT_COST,
        description: 'Image Clone - regeneration',
        historyId: jobId,
      });
      if (!charge.success) {
        return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
      }

      try {
        const refinedPrompt = `${originalPrompt}\n\n---\nRefinement request:\n${refinementText}\n`;
        const inputUrls = originalJob.result_url
          ? [originalJob.result_url, ...referenceUrls]
          : referenceUrls;

        const kieTaskId = await createKieImageTask({
          prompt: refinedPrompt,
          inputUrls,
          aspectRatio,
          resolution,
          callBackUrl,
        });

        const newJob = await createToolGenerationJob({
          userId,
          toolKey: 'image-clone',
          status: 'processing',
          metadata: {
            prompt: refinedPrompt,
            reference_image_urls: inputUrls,
            aspect_ratio: aspectRatio,
            resolution,
            regenerated_from: jobId,
          },
          billedCredits: charge.chargedCredits,
        });

        await createToolGenerationTask({
          jobId: newJob.id,
          kieTaskId,
          toolKey: 'image-clone',
        });

        return NextResponse.json({ success: true, jobId: newJob.id, kieTaskId, status: 'processing' });
      } catch (error) {
        await refundToolGenerationCredits({
          userId,
          amount: charge.chargedCredits,
          reason: 'Image Clone regeneration failed to start',
          historyId: jobId,
        });
        throw error;
      }
    }

    // Default: create new image clone job
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      productPhotoDataUrl,
      referencePhotoDataUrls,
      userRequirement,
      copyText,
      styleDirection,
      aspectRatio,
      resolution,
    } = data;

    if (!productPhotoDataUrl) {
      return NextResponse.json({ error: 'Missing productPhotoDataUrl' }, { status: 400 });
    }
    if (!aspectRatio || !['1:1', '9:16', '16:9', '4:3', '3:4'].includes(aspectRatio)) {
      return NextResponse.json({ error: 'Invalid aspectRatio' }, { status: 400 });
    }
    if (!resolution || !['1K', '2K', '4K'].includes(resolution)) {
      return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: IMAGE_GENERATION_CREDIT_COST,
      description: 'Image Clone - image generation',
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }

    try {
      // Upload images
      const productImageUrl = await uploadImageForClone(productPhotoDataUrl, `product_${Date.now()}.jpg`);

      const referenceImageUrls: string[] = [];
      if (referencePhotoDataUrls && referencePhotoDataUrls.length > 0) {
        for (let i = 0; i < referencePhotoDataUrls.length; i++) {
          const refUrl = await uploadImageForClone(referencePhotoDataUrls[i], `ref_${i}_${Date.now()}.jpg`);
          referenceImageUrls.push(refUrl);
        }
      }

      // Build prompt
      const prompt = buildImageClonePrompt({
        userRequirement: userRequirement || '',
        copyText: copyText || '',
        styleDirection: styleDirection || '',
        aspectRatio,
        resolution,
      });

      const allInputUrls = [productImageUrl, ...referenceImageUrls];

      const kieTaskId = await createKieImageTask({
        prompt,
        inputUrls: allInputUrls,
        aspectRatio,
        resolution,
        callBackUrl,
      });

      const job = await createToolGenerationJob({
        userId,
        toolKey: 'image-clone',
        status: 'processing',
        metadata: {
          prompt,
          product_image_url: productImageUrl,
          reference_image_urls: referenceImageUrls,
          aspect_ratio: aspectRatio,
          resolution,
        },
        billedCredits: charge.chargedCredits,
      });

      await createToolGenerationTask({
        jobId: job.id,
        kieTaskId,
        toolKey: 'image-clone',
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        kieTaskId,
        status: 'processing',
      });
    } catch (error) {
      await refundToolGenerationCredits({
        userId,
        amount: charge.chargedCredits,
        reason: 'Image Clone generation failed to start',
      });
      throw error;
    }
  } catch (error) {
    console.error('[tools/image-clone] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      resultImageUrl: job.result_url,
      errorMessage: job.error_message,
      tasks,
    });
  } catch (error) {
    console.error('[tools/image-clone] GET Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
