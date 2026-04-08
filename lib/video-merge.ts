
type FalClient = (typeof import('@fal-ai/client'))['fal'];

type FalAspectRatio = '16:9' | '9:16';
type FalMergeResolution =
  | 'square'
  | 'square_hd'
  | 'portrait_4_3'
  | 'portrait_16_9'
  | 'landscape_4_3'
  | 'landscape_16_9';

const RESOLUTION_MAP: Record<FalAspectRatio, FalMergeResolution> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9'
};

const MERGE_SUBMIT_MAX_ATTEMPTS = 4;
const MERGE_SUBMIT_BASE_DELAY_MS = 1500;

async function getFalClient(): Promise<FalClient> {
  const { fal } = await import('@fal-ai/client');
  fal.config({
    credentials: process.env.FAL_KEY
  });
  return fal;
}

function isRetryableFalMergeSubmitError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    message.includes('503') ||
    message.includes('service temporarily unavailable') ||
    message.includes('connect timeout') ||
    message.includes('und_err_connect_timeout') ||
    message.includes('fetch failed') ||
    message.includes('econnreset') ||
    message.includes('eai_again') ||
    message.includes('enotfound') ||
    message.includes('timeout')
  );
}

async function submitFalMergeWithRetry(input: {
  fal: FalClient;
  videoUrls: string[];
  resolution: FalMergeResolution;
  webhookUrl?: string;
}) {
  const { fal, videoUrls, resolution, webhookUrl } = input;

  for (let attempt = 1; attempt <= MERGE_SUBMIT_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fal.queue.submit('fal-ai/ffmpeg-api/merge-videos', {
        input: {
          video_urls: videoUrls,
          target_fps: 30,
          resolution
        },
        webhookUrl
      });
    } catch (error) {
      const isRetryable = isRetryableFalMergeSubmitError(error);
      const isLastAttempt = attempt === MERGE_SUBMIT_MAX_ATTEMPTS;

      console.error(`❌ fal.ai merge submit failed (attempt ${attempt}/${MERGE_SUBMIT_MAX_ATTEMPTS}):`, error);

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      const delayMs = MERGE_SUBMIT_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`⚠️ Retrying fal.ai merge submit in ${delayMs}ms due to transient upstream failure...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('fal.ai merge submit failed after retries.');
}

export async function mergeVideosWithFal(
  videoUrls: string[],
  videoAspectRatio: FalAspectRatio = '16:9',
  webhookEndpoint?: string // Optional: Custom webhook endpoint (e.g., '/api/video-clone/webhooks/merge')
): Promise<{ taskId: string }> {
  const fal = await getFalClient();

  const resolution = RESOLUTION_MAP[videoAspectRatio] || RESOLUTION_MAP['16:9'];

  console.log(`🎬 Starting fal.ai video merge for ${videoUrls.length} videos with resolution ${resolution}`);

  try {
    // ✅ Event-Driven: Use queue.submit with webhook instead of subscribe
    // Webhook will be called when merge completes (success or failure)
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!siteUrl) {
      console.warn('⚠️ NEXT_PUBLIC_SITE_URL not set, fal.ai merge will not send webhook callback');
    }

    // Use provided webhook endpoint or default to Avatar Ads
    const defaultEndpoint = '/api/avatar-ads/webhooks/merge';
    const webhookUrl = siteUrl ? `${siteUrl}${webhookEndpoint || defaultEndpoint}` : undefined;

    console.log(`📡 Submitting merge task with webhook URL: ${webhookUrl || 'none (local dev mode)'}`);

    const { request_id } = await submitFalMergeWithRetry({
      fal,
      videoUrls,
      resolution,
      webhookUrl
    });

    console.log(`✅ Video merge task submitted successfully: ${request_id}`);
    if (webhookUrl) {
      console.log(`🔔 Webhook will be called at: ${webhookUrl} when merge completes`);
    } else {
      console.log(`⚠️ No webhook configured - merge completion will need manual polling`);
    }

    return { taskId: request_id };
  } catch (error) {
    console.error('❌ fal.ai merge videos error:', error);

    // Check if it's a connection timeout error
    const isConnectionTimeout = error instanceof Error &&
      (error.message.includes('Connect Timeout') || error.message.includes('UND_ERR_CONNECT_TIMEOUT'));

    if (isConnectionTimeout) {
      throw new Error('Video merging connection timeout - fal.ai service may be slow. Please retry in a moment.');
    }

    throw new Error(`Video merging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function checkFalTaskStatus(
  taskId: string,
  retryCount = 0
): Promise<{ status: string; resultUrl?: string; error?: string }> {
  const fal = await getFalClient();
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  try {
    const status = await fal.queue.status('fal-ai/ffmpeg-api/merge-videos', { requestId: taskId });

    if (status.status === 'COMPLETED') {
      const result = await fal.queue.result('fal-ai/ffmpeg-api/merge-videos', { requestId: taskId });
      const resultUrl = (((result as Record<string, unknown>)?.data as Record<string, unknown>)?.video as Record<string, unknown>)?.url as string;

      return { status: status.status, resultUrl };
    }

    return {
      status: status.status,
      error: (status as unknown as Record<string, unknown>).error as string
    };
  } catch (error) {
    console.error(`fal.ai status check error (attempt ${retryCount + 1}):`, error);

    const isNetworkError =
      error instanceof Error &&
      (error.message.includes('fetch failed') ||
        error.message.includes('EAI_AGAIN') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('timeout'));

    if (isNetworkError && retryCount < MAX_RETRIES) {
      console.log(`Network error detected, retrying in ${RETRY_DELAY}ms... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return checkFalTaskStatus(taskId, retryCount + 1);
    }

    if (isNetworkError) {
      console.warn(`Network error persists after ${MAX_RETRIES} retries, marking as network_error`);
      return {
        status: 'NETWORK_ERROR',
        error: `Network connectivity issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    throw new Error(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
