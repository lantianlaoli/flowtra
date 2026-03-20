import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { NON_AGENT_IMAGE_MODEL, NON_AGENT_IMAGE_OUTPUT_FORMAT, NON_AGENT_IMAGE_RESOLUTION } from '@/lib/constants';
import type { KlingElement } from '@/lib/kling-elements';

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_FILE_URL_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-url-upload';

export const MOTION_CLONE_MODE = '720p' as const;

export interface MotionClonePreviewInput {
  coverUrl: string;
  avatarUrl?: string | null;
  productUrl?: string | null;
  aspectRatio?: string;
  prompt?: string;
}

export interface MotionCloneVideoInput {
  previewImageUrl: string;
  referenceVideoUrl: string;
  mode?: '720p' | '1080p';
  prompt?: string;
  elements?: KlingElement[];
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

export const buildMotionClonePreviewPrompt = (options?: { hasAvatar: boolean; hasProduct: boolean }) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const hasProduct = options?.hasProduct ?? true;
  const replacementLine = hasAvatar && hasProduct
    ? 'Use image 1 as the base frame. Replace the on-screen person with image 2 and replace every visible product or bottle with image 3.'
    : hasAvatar
      ? 'Use image 1 as the base frame. Replace the on-screen person with image 2.'
      : 'Use image 1 as the base frame. Replace every visible product or bottle with image 2.';
  return [
    'Motion Clone preview: keep the exact composition, lighting, and background from image 1.',
    replacementLine,
    'Keep the same pose, hand placement, camera angle, framing, and color grading.',
    'Do not keep the original person or original product. Do not change anything else.'
  ].join(' ');
};

export const buildMotionCloneVideoPrompt = (options?: { hasAvatar: boolean; hasProduct: boolean }) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const hasProduct = options?.hasProduct ?? true;
  const guidance = hasAvatar && hasProduct
    ? 'Use the swapped preview image as the appearance guide for the person and the product.'
    : hasAvatar
      ? 'Use the swapped preview image as the appearance guide for the person.'
      : 'Use the swapped preview image as the appearance guide for the product.';
  return [
    'Motion Clone video:',
    guidance,
    'Do not alter the background, lighting, framing, or scene composition.'
  ].join(' ');
};

export const createMotionClonePreviewTask = async (
  input: MotionClonePreviewInput,
  callbackUrl: string
): Promise<string> => {
  const requestBody = {
    model: NON_AGENT_IMAGE_MODEL,
    input: {
      prompt: input.prompt || buildMotionClonePreviewPrompt({ hasAvatar: Boolean(input.avatarUrl), hasProduct: Boolean(input.productUrl) }),
      image_input: [input.coverUrl, input.avatarUrl, input.productUrl].filter(Boolean).slice(0, 8),
      aspect_ratio: input.aspectRatio || '9:16',
      resolution: NON_AGENT_IMAGE_RESOLUTION,
      output_format: NON_AGENT_IMAGE_OUTPUT_FORMAT
    },
    callBackUrl: callbackUrl
  };

  const response = await fetchWithRetry(KIE_CREATE_TASK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`Motion Clone preview task failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start Motion Clone preview task');
  }

  return data.data.taskId as string;
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
