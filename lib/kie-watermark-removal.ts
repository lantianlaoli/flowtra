import { fetchWithRetry } from '@/lib/fetchWithRetry';

export interface WatermarkRemovalTaskRequest {
  video_url: string;
  callBackUrl?: string;
}

export interface WatermarkRemovalTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export interface WatermarkRemovalStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: 'waiting' | 'success' | 'fail';
    param: string; // JSON string
    resultJson: string | null; // JSON string with { resultUrls: string[] }
    failCode: string | null;
    failMsg: string | null;
    costTime: number | null; // milliseconds
    completeTime: number | null; // timestamp
    createTime: number; // timestamp
  };
}

/**
 * Create a watermark removal task using KIE API
 * @param request - Video URL and optional callback URL
 * @returns Task ID for polling status
 */
export async function createWatermarkRemovalTask(
  request: WatermarkRemovalTaskRequest
): Promise<WatermarkRemovalTaskResponse> {
  const requestBody = {
    model: 'sora-watermark-remover',
    input: {
      video_url: request.video_url,
    },
    ...(request.callBackUrl && { callBackUrl: request.callBackUrl }),
  };

  const response = await fetchWithRetry(
    'https://api.kie.ai/api/v1/jobs/createTask',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    },
    5, // 5 retries
    30000 // 30 second timeout
  );

  if (!response.ok) {
    throw new Error(`KIE API request failed: ${response.status} ${response.statusText}`);
  }

  const data: WatermarkRemovalTaskResponse = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to create watermark removal task');
  }

  return data;
}

/**
 * Query the status of a watermark removal task
 * @param taskId - The task ID returned from createWatermarkRemovalTask
 * @returns Current task status and result
 */
export async function queryWatermarkRemovalStatus(
  taskId: string
): Promise<WatermarkRemovalStatusResponse> {
  const response = await fetchWithRetry(
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      },
    },
    3, // 3 retries
    15000 // 15 second timeout
  );

  if (!response.ok) {
    throw new Error(`KIE API status query failed: ${response.status} ${response.statusText}`);
  }

  const data: WatermarkRemovalStatusResponse = await response.json();

  if (data.code !== 200) {
    throw new Error(data.msg || 'Failed to query watermark removal status');
  }

  return data;
}

/**
 * Extract the result video URL from the result JSON
 * @param resultJson - The resultJson string from status response
 * @returns The first video URL or null if not available
 */
export function extractResultVideoUrl(resultJson: string | null): string | null {
  if (!resultJson) return null;

  try {
    const result = JSON.parse(resultJson);
    if (result.resultUrls && Array.isArray(result.resultUrls) && result.resultUrls.length > 0) {
      return result.resultUrls[0];
    }
  } catch (error) {
    console.error('Failed to parse result JSON:', error);
  }

  return null;
}

/**
 * Validate if a URL is a valid Sora ChatGPT video URL
 * @param url - The URL to validate
 * @returns True if valid, false otherwise
 */
export function isValidSoraVideoUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'sora.chatgpt.com' && parsedUrl.pathname.startsWith('/p/');
  } catch {
    return false;
  }
}
