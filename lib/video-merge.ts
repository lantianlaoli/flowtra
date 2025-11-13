import type { Fal } from '@fal-ai/client';

type FalAspectRatio = '16:9' | '9:16';

const RESOLUTION_MAP: Record<FalAspectRatio, string> = {
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9'
};

async function getFalClient(): Promise<Fal> {
  const { fal } = await import('@fal-ai/client');
  fal.config({
    credentials: process.env.FAL_KEY
  });
  return fal;
}

export async function mergeVideosWithFal(
  videoUrls: string[],
  videoAspectRatio: FalAspectRatio = '16:9'
): Promise<{ taskId: string }> {
  const fal = await getFalClient();

  const resolution = RESOLUTION_MAP[videoAspectRatio] || RESOLUTION_MAP['16:9'];

  try {
    const result = await fal.subscribe('fal-ai/ffmpeg-api/merge-videos', {
      input: {
        video_urls: videoUrls,
        target_fps: 30,
        resolution
      },
      logs: true,
      onQueueUpdate: (update) => {
        console.log(`Merge queue update: ${update.status}`);
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      }
    });

    return { taskId: result.requestId };
  } catch (error) {
    console.error('fal.ai merge videos error:', error);
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
