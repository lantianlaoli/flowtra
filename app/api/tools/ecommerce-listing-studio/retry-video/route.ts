import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  calculateEcommerceListingProgress,
  ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';
import {
  createToolGenerationTask,
  getToolGenerationJob,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import { requireActiveToolSubscription, toolBillingErrorPayload } from '@/lib/tools/billing';
import { validateKieCredits } from '@/lib/kie-credits-check';

export const runtime = 'nodejs';
export const maxDuration = 300;

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const SEEDANCE_MODEL = 'bytedance/seedance-2-fast';
const SEEDANCE_2_MODEL = 'bytedance/seedance-2';
const SEEDANCE_2_MINI_MODEL = 'bytedance/seedance-2-mini';
const GEMINI_OMNI_VIDEO_MODEL = 'gemini-omni-video';

const getSeedanceModelId = (videoModel: 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini') => {
  if (videoModel === 'seedance_2') return SEEDANCE_2_MODEL;
  if (videoModel === 'seedance_2_mini') return SEEDANCE_2_MINI_MODEL;
  return SEEDANCE_MODEL;
};

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
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

    const body = (await request.json()) as { jobId?: string };
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required.' }, { status: 400 });
    }

    const job = await getToolGenerationJob(jobId);
    if (!job || job.tool_key !== 'ecommerce-listing-studio' || job.user_id !== userId) {
      return NextResponse.json({ error: 'Generation job not found.' }, { status: 404 });
    }

    const metadata = (job.metadata ?? {}) as EcommerceListingMetadata;
    if (!metadata.video) {
      return NextResponse.json({ error: 'This job does not include video generation.' }, { status: 400 });
    }
    if (metadata.video.status !== 'fail') {
      return NextResponse.json({ error: 'Only failed videos can be retried.' }, { status: 400 });
    }

    const subscriptionAccess = await requireActiveToolSubscription(userId);
    if (!subscriptionAccess.success) {
      return NextResponse.json(toolBillingErrorPayload(subscriptionAccess), { status: subscriptionAccess.status });
    }

    const kieValidation = await validateKieCredits();
    if (kieValidation) {
      return kieValidation;
    }

    const productImageUrls = Array.isArray(metadata.product_image_urls)
      ? metadata.product_image_urls.filter((url): url is string => typeof url === 'string')
      : [];
    const prompt = metadata.video.prompt || 'Create a 10-second ecommerce marketplace product ad video.';
    const storyboardUrl = metadata.video.storyboardUrl;
    const videoModel =
      metadata.video_model === 'seedance_2' || metadata.video_model === 'seedance_2_fast' || metadata.video_model === 'seedance_2_mini'
        ? metadata.video_model
        : 'gemini_omni_video';

    const videoResolution =
      videoModel === 'gemini_omni_video'
        ? metadata.video_resolution === '1080p' || metadata.video_resolution === '4k'
          ? metadata.video_resolution
          : '720p'
        : videoModel === 'seedance_2'
        ? metadata.video_resolution === '480p' || metadata.video_resolution === '1080p'
          ? metadata.video_resolution
          : '720p'
        : videoModel === 'seedance_2_mini'
        ? metadata.video_resolution === '480p'
          ? '480p'
          : '720p'
        : metadata.video_resolution === '480p'
        ? '480p'
        : '720p';

    const aspectRatio =
      videoModel === 'gemini_omni_video'
        ? metadata.video_aspect_ratio === '16:9'
          ? '16:9'
          : '9:16'
        : metadata.video_aspect_ratio === '4:3' ||
          metadata.video_aspect_ratio === '3:4' ||
          metadata.video_aspect_ratio === '16:9' ||
          metadata.video_aspect_ratio === '9:16'
        ? metadata.video_aspect_ratio
        : '1:1';

    const requestBody = videoModel === 'gemini_omni_video'
      ? {
          model: GEMINI_OMNI_VIDEO_MODEL,
          input: {
            prompt,
            image_urls: [...productImageUrls, storyboardUrl].filter(Boolean).slice(0, 7),
            duration: String(ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS),
            aspect_ratio: aspectRatio,
            resolution: videoResolution,
          },
          callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
        }
      : {
          model: getSeedanceModelId(videoModel),
          input: {
            prompt,
            reference_image_urls: [...productImageUrls, storyboardUrl].filter(Boolean).slice(0, 9),
            reference_video_urls: [''],
            reference_audio_urls: [''],
            resolution: videoResolution,
            aspect_ratio: aspectRatio,
            duration: ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS,
            generate_audio: true,
            web_search: false,
            nsfw_checker: true,
          },
          callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
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
      throw new Error(`KIE video task creation failed: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    if (data.code !== 200 || !data.data?.taskId) {
      throw new Error(data.msg || 'Failed to start KIE video task');
    }

    const videoTaskId = data.data.taskId as string;
    await createToolGenerationTask({
      jobId: job.id,
      kieTaskId: videoTaskId,
      toolKey: 'ecommerce-listing-studio',
      metadata: { stage: 'video', storyboard_image_url: storyboardUrl },
    });

    const nextMetadata: EcommerceListingMetadata = {
      ...metadata,
      video: {
        ...metadata.video,
        status: 'processing',
        error: undefined,
        taskId: videoTaskId,
      },
    };
    const progress = calculateEcommerceListingProgress(nextMetadata);
    nextMetadata.completed_outputs = progress.completed;
    nextMetadata.total_outputs = progress.total;

    const nextJob = await updateToolGenerationJob(job.id, {
      status: 'generating_video',
      metadata: nextMetadata,
      error_message: null,
    });

    return NextResponse.json({ success: true, jobId: job.id, job: nextJob }, { status: 202 });
  } catch (error) {
    console.error('[tools/ecommerce-listing-studio/retry-video] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry video generation.' },
      { status: 500 }
    );
  }
}
