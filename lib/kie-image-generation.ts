import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL,
  GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL,
} from '@/lib/constants';

const KIE_IMAGE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';

export type KieGptImageAspectRatio =
  | 'auto'
  | '1:1'
  | '5:4'
  | '9:16'
  | '21:9'
  | '16:9'
  | '4:3'
  | '3:2'
  | '4:5'
  | '3:4'
  | '2:3';

type CreateKieImageTaskInput = {
  prompt: string;
  referenceImageUrls?: Array<string | null | undefined> | null;
  aspectRatio?: string | null;
  nsfwChecker?: boolean;
  callBackUrl?: string;
  moderationExternalId?: string;
};

export type KieGptImageTaskPayload = {
  model: typeof GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL | typeof GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL;
  input: {
    prompt: string;
    aspect_ratio?: KieGptImageAspectRatio;
    nsfw_checker?: boolean;
    input_urls?: string[];
  };
  callBackUrl?: string;
};

export function normalizeKieGptImageAspectRatio(
  aspectRatio?: string | null
): KieGptImageAspectRatio | undefined {
  const allowed = new Set([
    'auto',
    '1:1',
    '5:4',
    '9:16',
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '4:5',
    '3:4',
    '2:3',
  ]);
  return aspectRatio && allowed.has(aspectRatio)
    ? (aspectRatio as KieGptImageAspectRatio)
    : undefined;
}

export function buildKieGptImageTaskPayload({
  prompt,
  referenceImageUrls,
  aspectRatio,
  nsfwChecker = true,
  callBackUrl,
}: CreateKieImageTaskInput): KieGptImageTaskPayload {
  const inputUrls = Array.from(
    new Set(
      (referenceImageUrls || [])
        .filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
        .map((url) => url.trim())
    )
  ).slice(0, 16);
  const normalizedAspectRatio = normalizeKieGptImageAspectRatio(aspectRatio);

  return {
    model: inputUrls.length > 0
      ? GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL
      : GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL,
    input: {
      prompt,
      ...(inputUrls.length > 0 ? { input_urls: inputUrls } : {}),
      ...(normalizedAspectRatio ? { aspect_ratio: normalizedAspectRatio } : {}),
      nsfw_checker: nsfwChecker,
    },
    ...(callBackUrl ? { callBackUrl } : {}),
  };
}

export async function createKieGptImageTask(
  input: CreateKieImageTaskInput,
  retries = 5,
  timeoutMs = 30000
): Promise<string> {
  const { moderatePromptBeforeGeneration } = await import('@/lib/creem-moderation');
  await moderatePromptBeforeGeneration(input.prompt, {
    externalId: input.moderationExternalId,
  });

  const payload = buildKieGptImageTaskPayload(input);
  const response = await fetchWithRetry(KIE_IMAGE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, retries, timeoutMs);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KIE GPT Image 2 task creation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start KIE GPT Image 2 task');
  }

  return data.data.taskId as string;
}
