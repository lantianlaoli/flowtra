import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { NON_AGENT_IMAGE_MODEL, NON_AGENT_IMAGE_OUTPUT_FORMAT, NON_AGENT_IMAGE_RESOLUTION } from '@/lib/constants';
import type { KlingElement } from '@/lib/kling-elements';

const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_FILE_URL_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-url-upload';

export const MOTION_SWAP_MODE = '720p' as const;

export interface MotionSwapPreviewInput {
  coverUrl: string;
  avatarUrl?: string | null;
  productUrl?: string | null;
  aspectRatio?: string;
  prompt?: string;
}

export interface MotionSwapVideoInput {
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

export const buildMotionSwapPreviewPrompt = (options?: { hasAvatar: boolean; hasProduct: boolean }) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const hasProduct = options?.hasProduct ?? true;
  const replacementLine = hasAvatar && hasProduct
    ? 'Replace the person with the provided avatar reference and replace the product with the provided product reference.'
    : hasAvatar
      ? 'Replace the person with the provided avatar reference.'
      : 'Replace the product with the provided product reference.';
  return [
    'Motion Swap preview: keep the exact composition, lighting, and background from the reference cover image.',
    replacementLine,
    'Do not change camera angle, framing, or color grading.',
    'Match the original pose, clothing silhouette, and environment while swapping only the specified targets.'
  ].join(' ');
};

export const buildMotionSwapVideoPrompt = (options?: { hasAvatar: boolean; hasProduct: boolean }) => {
  const hasAvatar = options?.hasAvatar ?? true;
  const hasProduct = options?.hasProduct ?? true;
  const guidance = hasAvatar && hasProduct
    ? 'Use the swapped preview image as the appearance guide for the person and product.'
    : hasAvatar
      ? 'Use the swapped preview image as the appearance guide for the person.'
      : 'Use the swapped preview image as the appearance guide for the product.';
  return [
    'Motion Swap: preserve the original motion, rhythm, and camera movement from the reference video.',
    guidance,
    'Do not alter the background, lighting, or scene composition.'
  ].join(' ');
};

export const createMotionSwapPreviewTask = async (
  input: MotionSwapPreviewInput,
  callbackUrl: string
): Promise<string> => {
  const requestBody = {
    model: NON_AGENT_IMAGE_MODEL,
    input: {
      prompt: input.prompt || buildMotionSwapPreviewPrompt({ hasAvatar: Boolean(input.avatarUrl), hasProduct: Boolean(input.productUrl) }),
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
    throw new Error(`Motion Swap preview task failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start Motion Swap preview task');
  }

  return data.data.taskId as string;
};

export const createMotionSwapVideoTask = async (
  input: MotionSwapVideoInput,
  callbackUrl: string
): Promise<string> => {
  const previewImageUrl = await uploadKieFileFromUrl(
    input.previewImageUrl,
    'motion-swap/preview-images',
    'image'
  );
  const referenceVideoUrl = await uploadKieFileFromUrl(
    input.referenceVideoUrl,
    'motion-swap/reference-videos',
    'video'
  );

  const requestBody = buildMotionSwapVideoRequestBody({
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
    throw new Error(`Motion Swap video task failed: ${response.status}`);
  }

  const data = await response.json();
  if (data.code !== 200 || !data.data?.taskId) {
    throw new Error(data.msg || 'Failed to start Motion Swap video task');
  }

  return data.data.taskId as string;
};

export const buildMotionSwapVideoRequestBody = ({
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
      prompt: prompt || buildMotionSwapVideoPrompt(),
      input_urls: [previewImageUrl],
      video_urls: [referenceVideoUrl],
      character_orientation: 'video',
      mode: mode || MOTION_SWAP_MODE
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
  buildMotionSwapVideoRequestBody
};
