import { fetchWithRetry } from '@/lib/fetchWithRetry';

const KIE_API_BASE_URL = 'https://api.kie.ai';

interface KieUpgradeResult {
  taskId: string;
  resultUrl?: string | null;
}

const getResultUrl = (data: Record<string, unknown> | null | undefined): string | null => {
  if (!data) return null;
  const resultUrl = data.resultUrl as string | undefined;
  if (resultUrl) return resultUrl;
  const resultUrlSnake = data.result_url as string | undefined;
  if (resultUrlSnake) return resultUrlSnake;
  const resultUrls = data.resultUrls as string[] | undefined;
  if (Array.isArray(resultUrls) && resultUrls.length > 0) return resultUrls[0];
  const info = data.info as Record<string, unknown> | undefined;
  const infoResultUrls = info?.resultUrls as string[] | undefined;
  if (Array.isArray(infoResultUrls) && infoResultUrls.length > 0) return infoResultUrls[0];
  return null;
};

async function requestKieUpgrade(
  endpoint: string,
  taskId: string,
  callBackUrl: string | undefined,
  method: 'GET' | 'POST'
): Promise<KieUpgradeResult> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) {
    throw new Error('KIE_API_KEY is not configured');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`
  };
  let url = `${KIE_API_BASE_URL}${endpoint}`;
  let body: string | undefined;

  if (method === 'GET') {
    const params = new URLSearchParams({ taskId, index: '0' });
    if (callBackUrl) {
      params.set('callBackUrl', callBackUrl);
    }
    url = `${url}?${params.toString()}`;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      taskId,
      index: 0,
      ...(callBackUrl ? { callBackUrl } : {})
    });
  }

  const response = await fetchWithRetry(url, {
    method,
    headers,
    body
  }, 3, 30000);

  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok && ![400, 422].includes(response.status)) {
    throw new Error(`KIE request failed: ${response.status}`);
  }

  const data = payload?.data as Record<string, unknown> | undefined;
  const resolvedTaskId = (data?.taskId as string | undefined) || taskId;
  const resultUrl = getResultUrl(data);

  return {
    taskId: resolvedTaskId,
    resultUrl
  };
}

export async function requestKie1080pVideo(taskId: string, callBackUrl?: string): Promise<KieUpgradeResult> {
  return requestKieUpgrade('/api/v1/veo/get-1080p-video', taskId, callBackUrl, 'GET');
}

export async function requestKie4kVideo(taskId: string, callBackUrl?: string): Promise<KieUpgradeResult> {
  return requestKieUpgrade('/api/v1/veo/get-4k-video', taskId, callBackUrl, 'POST');
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function pollKie1080pVideo(
  taskId: string,
  { attempts = 6, delayMs = 10000 }: { attempts?: number; delayMs?: number } = {}
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { resultUrl } = await requestKie1080pVideo(taskId);
    if (resultUrl) return resultUrl;
    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }
  return null;
}
