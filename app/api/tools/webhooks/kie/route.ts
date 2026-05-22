import { NextRequest, NextResponse } from 'next/server';
import {
  acquireWebhookIdempotencyKey,
  acquireWebhookLock,
  releaseWebhookLock,
  getToolGenerationTaskByKieTaskId,
  getToolGenerationJob,
  getToolGenerationTasksByJobId,
  createToolGenerationTask,
  updateToolGenerationTask,
  updateToolGenerationJob,
} from '@/lib/tools/job-store';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  buildWebhookJobUpdate,
  buildEcommerceListingFailureUpdate,
  shouldCreateAdShortFilmVideoTask,
  shouldCreateEcommerceListingVideoTask,
} from '@/lib/tools/kie-webhook-state';
import {
  ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS,
  type EcommerceListingMetadata,
} from '@/lib/tools/ecommerce-listing-studio';
import { getImageCloneBulkJobStatus, setImageCloneBulkJobStatus } from '@/lib/image-clone-bulk-store';
import { refundToolGenerationCredits } from '@/lib/tools/billing';

export const dynamic = 'force-dynamic';

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const SEEDANCE_MODEL = 'bytedance/seedance-2-fast';
const SEEDANCE_2_MODEL = 'bytedance/seedance-2';

interface KIEWebhookPayload {
  code: number;
  msg: string;
  data: {
    taskId: string;
    state: 'success' | 'fail' | 'waiting';
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
    response?: {
      resultUrls?: string[];
    };
    resultUrls?: string[];
  };
}

function parseResultUrl(data: KIEWebhookPayload['data']): string | null {
  if (Array.isArray(data.response?.resultUrls) && data.response.resultUrls[0]) {
    return data.response.resultUrls[0];
  }
  if (Array.isArray(data.resultUrls) && data.resultUrls[0]) {
    return data.resultUrls[0];
  }
  if (typeof data.resultJson === 'string') {
    try {
      const parsed = JSON.parse(data.resultJson) as { resultUrls?: string[]; video_url?: string; url?: string };
      if (Array.isArray(parsed.resultUrls) && parsed.resultUrls[0]) {
        return parsed.resultUrls[0];
      }
      if (typeof parsed.video_url === 'string') return parsed.video_url;
      if (typeof parsed.url === 'string') return parsed.url;
    } catch {
      // Ignore parse errors
    }
  }
  return null;
}

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

function buildSeedanceVideoPrompt(storyboardPrompt: string): string {
  const prompt = `Create a 15-second vertical product advertisement based on the provided storyboard image and product photo. Use the storyboard as the creative plan and the product photo as the identity reference. Preserve the exact product appearance, materials, proportions, color, and details. Animate through the storyboard beats with premium product-ad pacing: reveal, macro detail, craftsmanship/design feature, performance benefit, hero motion, beauty detail, final hero tagline. Use realistic product photography, cinematic lighting, clean white or premium studio backgrounds, subtle UI overlays only where appropriate, sharp commercial typography, smooth camera motion, and polished audio. Do not invent a different product, logo, or brand. Storyboard prompt: ${storyboardPrompt}`;
  return prompt.length > 1500 ? `${prompt.slice(0, 1497)}...` : prompt;
}

export async function POST(request: NextRequest) {
  try {
    const payload: KIEWebhookPayload = await request.json();
    const { code, msg, data } = payload;
    const { taskId, state, failCode, failMsg } = data;

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Missing taskId' }, { status: 200 });
    }

    // ── Acquire short lock for transition ──────────────────────────────
    const locked = await acquireWebhookLock(taskId);
    if (!locked) {
      console.warn(`[KIE Webhook] Lock contention: taskId=${taskId}`);
      return NextResponse.json({ success: true, message: 'Lock contention, retry later' }, { status: 200 });
    }

    try {
      // Lookup task: Redis first, then Supabase
      const task = await getToolGenerationTaskByKieTaskId(taskId);
      if (!task) {
        console.warn(`[KIE Webhook] Task not found yet for kieTaskId: ${taskId}`);
        return NextResponse.json(
          { success: false, error: 'Task not found yet' },
          { status: 503 }
        );
      }

      // Race guard: already completed tasks should not be updated
      if (task.status === 'completed' || task.status === 'failed') {
        return NextResponse.json({ success: true, message: `Task already ${task.status}` }, { status: 200 });
      }

      // ── Duplicate webhook suppression ──────────────────────────────────
      // Acquire this only after the task exists. Otherwise a fast webhook can
      // arrive before createToolGenerationTask() finishes and permanently
      // suppress the provider retry.
      const stateKey = state === 'success' ? 'success' : state === 'fail' ? 'fail' : 'waiting';
      const isFirstDelivery = await acquireWebhookIdempotencyKey(taskId, stateKey);
      if (!isFirstDelivery) {
        console.warn(`[KIE Webhook] Duplicate webhook ignored: taskId=${taskId}, state=${stateKey}`);
        return NextResponse.json({ success: true, message: 'Duplicate webhook ignored' }, { status: 200 });
      }

      const webhookReceivedAt = new Date().toISOString();
      const resultUrl = parseResultUrl(data);

      // ── Success ──────────────────────────────────────────────────────
      if (code === 200 && state === 'success' && resultUrl) {
        await updateToolGenerationTask(taskId, {
          status: 'completed',
          result_url: resultUrl,
          webhook_received_at: webhookReceivedAt,
        });

        // Update parent job
        const job = await getToolGenerationJob(task.job_id);
        if (job) {
          const siblingTasks = await getToolGenerationTasksByJobId(task.job_id);
          const updates = buildWebhookJobUpdate({
            job,
            task,
            resultUrl,
            webhookReceivedAt,
            siblingTasks,
          });

          await updateToolGenerationJob(task.job_id, updates);

          if (
            shouldCreateAdShortFilmVideoTask({
              taskMetadata: task.metadata,
              jobMetadata: job.metadata,
            })
          ) {
            try {
              await createAdShortFilmVideoTask({
                jobId: job.id,
                jobMetadata: { ...(job.metadata ?? {}), ...(updates.metadata ?? {}) },
                storyboardImageUrl: resultUrl,
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Failed to start ad short film video stage';
              console.error('[KIE Webhook] Failed to start ad short film video stage:', error);

              if (job.billed_credits > 0 && !job.billing_refunded_at) {
                await refundToolGenerationCredits({
                  userId: job.user_id,
                  amount: job.billed_credits,
                  reason: 'AI Ad Short Film video stage failed',
                  historyId: job.id,
                });
              }

              await updateToolGenerationJob(job.id, {
                status: 'failed',
                error_message: errorMessage,
                billing_refunded_at: job.billed_credits > 0 ? new Date().toISOString() : job.billing_refunded_at,
              });
            }
          }

          if (
            shouldCreateEcommerceListingVideoTask({
              taskMetadata: task.metadata,
              jobMetadata: updates.metadata ?? job.metadata,
            })
          ) {
            try {
              await createEcommerceListingVideoTask({
                jobId: job.id,
                jobMetadata: { ...(job.metadata ?? {}), ...(updates.metadata ?? {}) },
                storyboardImageUrl: resultUrl,
              });
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Failed to start ecommerce listing video stage';
              console.error('[KIE Webhook] Failed to start ecommerce listing video stage:', error);

              if (job.billed_credits > 0 && !job.billing_refunded_at) {
                await refundToolGenerationCredits({
                  userId: job.user_id,
                  amount: job.billed_credits,
                  reason: 'Ecommerce Listing Studio video stage failed',
                  historyId: job.id,
                });
              }

              await updateToolGenerationJob(job.id, {
                status: 'failed',
                error_message: errorMessage,
                billing_refunded_at: job.billed_credits > 0 ? new Date().toISOString() : job.billing_refunded_at,
              });
            }
          }
        }

        // Update in-memory bulk store for backward compat
        updateBulkStore(taskId, { status: 'success', resultUrl, error: undefined });

        return NextResponse.json({ success: true }, { status: 200 });
      }

      // ── Failure ──────────────────────────────────────────────────────
      const errorMessage = failMsg || msg || (failCode ? `KIE task failed with code ${failCode}` : 'Generation failed');

      if (state === 'fail') {
        await updateToolGenerationTask(taskId, {
          status: 'failed',
          error_message: errorMessage,
          webhook_received_at: webhookReceivedAt,
        });

        const job = await getToolGenerationJob(task.job_id);
        const ecommerceFailureUpdate = job
          ? buildEcommerceListingFailureUpdate({
              job,
              task,
              errorMessage,
              webhookReceivedAt,
            })
          : null;
        if (job && job.billed_credits > 0 && !job.billing_refunded_at) {
          await refundToolGenerationCredits({
            userId: job.user_id,
            amount: job.billed_credits,
            reason: `${job.tool_key} generation failed`,
            historyId: job.id,
          });
          await updateToolGenerationJob(task.job_id, {
            ...(ecommerceFailureUpdate ?? {
              status: 'failed',
              error_message: errorMessage,
              webhook_received_at: webhookReceivedAt,
            }),
            billing_refunded_at: new Date().toISOString(),
          });
        } else if (job) {
          await updateToolGenerationJob(task.job_id, {
            ...(ecommerceFailureUpdate ?? {
              status: 'failed',
              error_message: errorMessage,
              webhook_received_at: webhookReceivedAt,
            }),
          });
        }

        // Update in-memory bulk store for backward compat
        updateBulkStore(taskId, { status: 'fail', resultUrl: undefined, error: errorMessage });
      }

      return NextResponse.json({ success: true }, { status: 200 });
    } finally {
      await releaseWebhookLock(taskId);
    }
  } catch (error) {
    console.error('[KIE Webhook] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 200 });
  }
}

async function createAdShortFilmVideoTask(input: {
  jobId: string;
  jobMetadata: Record<string, unknown>;
  storyboardImageUrl: string;
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required for KIE webhook callbacks.');
  }

  const productImageUrl = input.jobMetadata.product_image_url as string | undefined;
  const storyboardPrompt = (input.jobMetadata.storyboard_prompt as string) || '';

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: SEEDANCE_MODEL,
      input: {
        prompt: buildSeedanceVideoPrompt(storyboardPrompt),
        reference_image_urls: [productImageUrl, input.storyboardImageUrl].filter(Boolean),
        reference_video_urls: [''],
        reference_audio_urls: [''],
        resolution: '480p',
        aspect_ratio: '9:16',
        duration: 15,
        generate_audio: true,
        web_search: false,
        nsfw_checker: true,
      },
      callBackUrl: `${siteUrl}/api/tools/webhooks/kie`,
    }),
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE Seedance task creation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start KIE Seedance task');
  }

  const videoTaskId = data.data.taskId as string;

  await createToolGenerationTask({
    jobId: input.jobId,
    kieTaskId: videoTaskId,
    toolKey: 'ad-short-film',
    metadata: { stage: 'video', storyboard_image_url: input.storyboardImageUrl },
  });

  await updateToolGenerationJob(input.jobId, {
    status: 'generating_video',
    metadata: {
      ...input.jobMetadata,
      video_task_id: videoTaskId,
      storyboard_image_url: input.storyboardImageUrl,
    },
  });
}

async function createEcommerceListingVideoTask(input: {
  jobId: string;
  jobMetadata: Record<string, unknown>;
  storyboardImageUrl: string;
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required for KIE webhook callbacks.');
  }

  const metadata = input.jobMetadata as EcommerceListingMetadata;
  const productImageUrls = Array.isArray(metadata.product_image_urls)
    ? metadata.product_image_urls.filter((url): url is string => typeof url === 'string')
    : [];
  const prompt = metadata.video?.prompt || 'Create a 15-second ecommerce marketplace product ad video.';
  const videoModel = metadata.video_model === 'seedance_2' ? 'seedance_2' : 'seedance_2_fast';
  const videoResolution =
    videoModel === 'seedance_2'
      ? metadata.video_resolution === '480p' || metadata.video_resolution === '1080p'
        ? metadata.video_resolution
        : '720p'
      : metadata.video_resolution === '480p'
        ? '480p'
        : '720p';
  const aspectRatio =
    metadata.video_aspect_ratio === '4:3' ||
    metadata.video_aspect_ratio === '3:4' ||
    metadata.video_aspect_ratio === '16:9' ||
    metadata.video_aspect_ratio === '9:16'
      ? metadata.video_aspect_ratio
      : '1:1';

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: videoModel === 'seedance_2' ? SEEDANCE_2_MODEL : SEEDANCE_MODEL,
      input: {
        prompt,
        reference_image_urls: [...productImageUrls, input.storyboardImageUrl].filter(Boolean).slice(0, 9),
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
    }),
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE Seedance task creation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start KIE Seedance task');
  }

  const videoTaskId = data.data.taskId as string;
  await createToolGenerationTask({
    jobId: input.jobId,
    kieTaskId: videoTaskId,
    toolKey: 'ecommerce-listing-studio',
    metadata: { stage: 'video', storyboard_image_url: input.storyboardImageUrl },
  });

  await updateToolGenerationJob(input.jobId, {
    status: 'generating_video',
    metadata: {
      ...metadata,
      video: {
        ...(metadata.video ?? { status: 'processing', prompt }),
        status: 'processing',
        storyboardUrl: input.storyboardImageUrl,
        taskId: videoTaskId,
      },
    },
  });
}

type BulkStoreStatus = 'success' | 'fail';

function updateBulkStore(
  taskId: string,
  result: { status: BulkStoreStatus; resultUrl?: string; error?: string }
): void {
  try {
    const stored = getImageCloneBulkJobStatus(taskId);
    if (!stored) return; // Not a bulk job

    setImageCloneBulkJobStatus({
      ...stored,
      taskId,
      status: result.status,
      resultUrl: result.resultUrl,
      error: result.error,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Bulk store update is best-effort for backward compat
  }
}
