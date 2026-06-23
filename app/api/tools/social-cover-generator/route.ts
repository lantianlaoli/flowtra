import { after, NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  buildSocialCoverSlots,
  buildSocialCoverTitleSet,
  calculateSocialCoverProgress,
  normalizeSocialCoverOptions,
  SOCIAL_COVER_LANGUAGE_OPTIONS,
  type SocialCoverMetadata,
  type SocialCoverTitleSet,
} from '@/lib/tools/social-cover-generator';
import {
  IMAGE_GENERATION_CREDIT_COST,
  chargeToolGenerationCredits,
  refundToolGenerationCredits,
  toolBillingErrorPayload,
} from '@/lib/tools/billing';
import {
  createToolGenerationJob,
  createToolGenerationTask,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import { assertKieCreditsAvailable } from '@/lib/kie-credits-check';

export const runtime = 'nodejs';
export const maxDuration = 300;

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpe?g|webp);base64,/i;

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && IMAGE_DATA_URL_PATTERN.test(value.trim());
}

async function uploadKieImage(dataUrl: string, fileName: string, uploadPath = 'flowtra/social-cover-generator') {
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

function buildFallbackTitleSet(title: string): SocialCoverTitleSet {
  return Object.fromEntries(
    SOCIAL_COVER_LANGUAGE_OPTIONS.map((option) => [option.value, title])
  ) as SocialCoverTitleSet;
}

async function startSocialCoverTasksInBackground(input: {
  jobId: string;
  userId: string;
  personImageDataUrl: string;
  productOrLogoImageDataUrl: string;
  title: string;
  styleGuide?: string;
  options: ReturnType<typeof normalizeSocialCoverOptions>;
  billedCredits: number;
  siteUrl: string;
}) {
  try {
    const timestamp = Date.now();
    const [personImageUrl, productOrLogoImageUrl] = await Promise.all([
      uploadKieImage(input.personImageDataUrl, `person-${timestamp}.jpg`),
      uploadKieImage(input.productOrLogoImageDataUrl, `product-logo-${timestamp}.png`),
    ]);
    const titleResult = await buildSocialCoverTitleSet(input.title, input.options.languages);
    const slotCount = input.options.languages.reduce(
      (count, language) => count + input.options.aspectRatiosByLanguage[language].length * input.options.variantsPerGroup,
      0
    );
    const slots = buildSocialCoverSlots({
      options: input.options,
      titles: titleResult.titles,
      sourceTitle: input.title,
      styleGuide: input.styleGuide,
      taskIds: new Array(slotCount).fill(''),
    }).map((slot) => ({ ...slot, status: 'processing' as const }));
    const progress = calculateSocialCoverProgress({ slots });

    let nextSlots = slots;
    let nextMetadata: SocialCoverMetadata = {
      source_title: input.title,
      titles: titleResult.titles,
      title_fallback: titleResult.fallback,
      style_guide: input.styleGuide,
      options: input.options,
      person_image_url: personImageUrl,
      product_or_logo_image_url: productOrLogoImageUrl,
      slots: nextSlots,
      completed_outputs: progress.completed,
      total_outputs: progress.total,
      resolution: input.options.resolution,
    };

    await updateToolGenerationJob(input.jobId, {
      status: 'processing',
      error_message: null,
      metadata: nextMetadata,
    });

    for (const slot of slots) {
      const taskId = await createKieImageTask({
        prompt: slot.prompt,
        inputUrls: [personImageUrl, productOrLogoImageUrl],
        aspectRatio: slot.aspectRatio,
        resolution: input.options.resolution,
        callBackUrl: `${input.siteUrl}/api/tools/webhooks/kie`,
      });
      await createToolGenerationTask({
        jobId: input.jobId,
        kieTaskId: taskId,
        toolKey: 'social-cover-generator',
        metadata: {
          stage: 'image',
          slot_id: slot.id,
          language: slot.language,
          aspect_ratio: slot.aspectRatio,
        },
      });

      nextSlots = nextSlots.map((candidate) =>
        candidate.id === slot.id ? { ...candidate, taskId, status: 'processing' as const } : candidate
      );
      nextMetadata = {
        ...nextMetadata,
        slots: nextSlots,
      };
      await updateToolGenerationJob(input.jobId, { metadata: nextMetadata });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to start social cover generation.';
    console.error('[tools/social-cover-generator] Background generation failed:', error);
    await refundToolGenerationCredits({
      userId: input.userId,
      amount: input.billedCredits,
      reason: 'Social Cover Generator failed to start',
      historyId: input.jobId,
    });
    await updateToolGenerationJob(input.jobId, {
      status: 'failed',
      error_message: errorMessage,
      billing_refunded_at: new Date().toISOString(),
    });
  }
}

export async function POST(request: NextRequest) {
  let jobIdForRollback: string | null = null;
  let chargedCredits = 0;
  let userIdForRollback: string | null = null;

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
    userIdForRollback = userId;

    const body = await request.json();
    if (!isImageDataUrl(body.personImageDataUrl)) {
      return NextResponse.json({ error: 'A portrait image is required.' }, { status: 400 });
    }
    if (!isImageDataUrl(body.productOrLogoImageDataUrl)) {
      return NextResponse.json({ error: 'A product or logo image is required.' }, { status: 400 });
    }
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    if (!title) {
      return NextResponse.json({ error: 'A cover title is required.' }, { status: 400 });
    }

    const options = normalizeSocialCoverOptions(body);
    const slotCount = options.languages.reduce(
      (count, language) => count + options.aspectRatiosByLanguage[language].length * options.variantsPerGroup,
      0
    );
    if (slotCount < 1) {
      return NextResponse.json({ error: 'Select at least one cover output.' }, { status: 400 });
    }

    const charge = await chargeToolGenerationCredits({
      userId,
      amount: slotCount * IMAGE_GENERATION_CREDIT_COST,
      description: `Social Cover Generator - ${slotCount} cover${slotCount === 1 ? '' : 's'}`,
    });
    if (!charge.success) {
      return NextResponse.json(toolBillingErrorPayload(charge), { status: charge.status });
    }
    chargedCredits = charge.chargedCredits;

    const styleGuide = typeof body.styleGuide === 'string' ? body.styleGuide.trim().slice(0, 2000) : undefined;
    const fallbackTitles = buildFallbackTitleSet(title);
    const optimisticSlots = buildSocialCoverSlots({
      options,
      titles: fallbackTitles,
      sourceTitle: title,
      styleGuide,
      taskIds: new Array(slotCount).fill(''),
    }).map((slot) => ({ ...slot, status: 'processing' as const }));
    const progress = calculateSocialCoverProgress({ slots: optimisticSlots });
    const metadata: SocialCoverMetadata = {
      source_title: title,
      titles: fallbackTitles,
      title_fallback: true,
      style_guide: styleGuide,
      options,
      slots: optimisticSlots,
      completed_outputs: progress.completed,
      total_outputs: progress.total,
      resolution: options.resolution,
    };

    const job = await createToolGenerationJob({
      userId,
      toolKey: 'social-cover-generator',
      status: 'processing',
      metadata,
      billedCredits: charge.chargedCredits,
    });
    jobIdForRollback = job.id;

    after(() => startSocialCoverTasksInBackground({
      jobId: job.id,
      userId,
      personImageDataUrl: body.personImageDataUrl,
      productOrLogoImageDataUrl: body.productOrLogoImageDataUrl,
      title,
      styleGuide,
      options,
      billedCredits: charge.chargedCredits,
      siteUrl,
    }));

    return NextResponse.json({ success: true, jobId: job.id, job }, { status: 202 });
  } catch (error) {
    if (chargedCredits > 0 && userIdForRollback && !jobIdForRollback) {
      await refundToolGenerationCredits({
        userId: userIdForRollback,
        amount: chargedCredits,
        reason: 'Social Cover Generator failed before job creation',
      });
    }
    console.error('[tools/social-cover-generator] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start social cover generation.' },
      { status: 500 }
    );
  }
}
