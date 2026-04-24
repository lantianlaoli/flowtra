import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { buildKieGptImageTaskPayload, createKieGptImageTask } from '@/lib/kie-image-generation';
import type { KlingElement } from '@/lib/kling-elements';
import {
  buildMotionClonePreviewPrompt,
  buildMotionCloneVideoPrompt,
} from '@/lib/motion-clone-prompts';
export {
  buildMotionClonePreviewPrompt,
  buildMotionCloneVideoPrompt,
} from '@/lib/motion-clone-prompts';

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_FILE_URL_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-url-upload';

export const MOTION_CLONE_MODE = '720p' as const;

export interface MotionClonePreviewInput {
  coverUrl: string;
  avatarUrl?: string | null;
  productUrl?: string | null;
  aspectRatio?: string;
  prompt?: string;
  moderationExternalId?: string;
}

export interface MotionCloneVideoInput {
  previewImageUrl: string;
  referenceVideoUrl: string;
  mode?: '720p' | '1080p';
  prompt?: string;
  elements?: KlingElement[];
  moderationExternalId?: string;
}

const isKieHostedUrl = (url: string) => {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname.endsWith('tempfile.redpandaai.co') ||
      hostname.endsWith('tempfile.aiquickdraw.com') ||
      hostname.endsWith('static.aiquickdraw.com')
    );
  } catch {
    return false;
  }
};

const getFileExtension = (url: string, fallback: string) => {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop();
    return ext && ext.length <= 5 ? ext : fallback;
  } catch {
    return fallback;
  }
};

const uploadKieFileFromUrl = async (fileUrl: string, uploadPath: string, fileType: 'image' | 'video') => {
  if (isKieHostedUrl(fileUrl)) {
    return fileUrl;
  }

  const extension = getFileExtension(fileUrl, fileType === 'video' ? 'mp4' : 'png');
  const fileName = `${fileType}-${Date.now()}.${extension}`;

  const response = await fetchWithRetry(KIE_FILE_URL_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileUrl,
      uploadPath,
      fileName
    })
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE file URL upload failed: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.success || !data?.data?.downloadUrl) {
    throw new Error(data?.msg || 'KIE file URL upload failed');
  }

  return data.data.downloadUrl as string;
};

export const createMotionClonePreviewTask = async (
  input: MotionClonePreviewInput,
  callbackUrl: string
): Promise<string> => {
  const prompt = input.prompt || buildMotionClonePreviewPrompt({
    hasAvatar: Boolean(input.avatarUrl),
    hasProduct: Boolean(input.productUrl)
  });
  const referenceImageUrls = [input.coverUrl, input.avatarUrl, input.productUrl].filter(Boolean) as string[];
  const requestBody = buildKieGptImageTaskPayload({
    prompt,
    referenceImageUrls,
    aspectRatio: input.aspectRatio || '9:16',
    callBackUrl: callbackUrl
  });
  console.log('[Motion Clone] GPT Image 2 preview payload:', {
    model: requestBody.model,
    inputFields: Object.keys(requestBody.input)
  });

  return createKieGptImageTask({
    prompt,
    referenceImageUrls,
    aspectRatio: input.aspectRatio || '9:16',
    callBackUrl: callbackUrl,
    moderationExternalId: input.moderationExternalId
  });
};

export const createMotionCloneVideoTask = async (
  input: MotionCloneVideoInput,
  callbackUrl: string
): Promise<string> => {
  const previewImageUrl = await uploadKieFileFromUrl(
    input.previewImageUrl,
    'motion-clone/preview-images',
    'image'
  );
  const referenceVideoUrl = await uploadKieFileFromUrl(
    input.referenceVideoUrl,
    'motion-clone/reference-videos',
    'video'
  );

  const requestBody = buildMotionCloneVideoRequestBody({
    previewImageUrl,
    referenceVideoUrl,
    mode: input.mode,
    prompt: input.prompt,
    elements: input.elements,
    callbackUrl
  });
  const { moderatePromptBeforeGeneration } = await import('@/lib/creem-moderation');
  await moderatePromptBeforeGeneration(String((requestBody.input as { prompt?: unknown }).prompt || ''), {
    externalId: input.moderationExternalId,
  });

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Motion Clone video task failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start Motion Clone video task');
  }

  return data.data.taskId as string;
};

export const buildMotionCloneVideoRequestBody = ({
  previewImageUrl,
  referenceVideoUrl,
  mode,
  prompt,
  elements,
  callbackUrl
}: {
  previewImageUrl: string;
  referenceVideoUrl: string;
  mode?: '720p' | '1080p';
  prompt?: string;
  elements?: KlingElement[];
  callbackUrl: string;
}) => {
  const requestBody: Record<string, unknown> = {
    model: 'kling-3.0/motion-control',
    input: {
      prompt: prompt || buildMotionCloneVideoPrompt(),
      input_urls: [previewImageUrl],
      video_urls: [referenceVideoUrl],
      character_orientation: 'video',
      mode: mode || MOTION_CLONE_MODE
    },
    callBackUrl: callbackUrl
  };

  // Motion control shares the same Kling elements capability used by clone video.
  // KIE's motion-control doc does not list the field explicitly, so we follow the
  // repository's existing Kling 3 integration contract when mentions are present.
  if (Array.isArray(elements) && elements.length > 0) {
    (requestBody.input as Record<string, unknown>).kling_elements = elements;
  }

  return requestBody;
};

export const __test__ = {
  buildMotionCloneVideoRequestBody
};
