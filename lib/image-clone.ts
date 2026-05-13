import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  addJob,
  generateJobId,
  type ImageCloneJob,
  type ImageCloneJobStatus,
} from './image-clone-job-store';
import { buildImageClonePrompt } from './image-clone-prompt';
import { refundToolGenerationCredits } from '@/lib/tools/billing';

const KIE_UPLOAD_URL = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_RECORD_INFO_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';
const KIE_MODEL = 'gpt-image-2-image-to-image';

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY is not configured.');
  return apiKey;
}

export type ImageCloneInput = {
  productPhotoDataUrl: string;
  referencePhotoDataUrls?: string[];
  userRequirement?: string;
  copyText?: string;
  styleDirection?: string;
  aspectRatio: string;
  resolution: string;
  userId: string;
  billedCredits?: number;
};

export type ImageCloneResult = {
  jobId: string;
  kieTaskId: string;
  status: ImageCloneJobStatus;
};

export async function uploadImageForClone(
  dataUrl: string,
  fileName: string,
  uploadPath = 'flowtra/image-clone'
): Promise<string> {
  const response = await fetchWithRetry(
    KIE_UPLOAD_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data: dataUrl,
        uploadPath,
        fileName,
      }),
    },
    3,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE upload failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const downloadUrl = payload?.data?.downloadUrl;
  if (!payload?.success || typeof downloadUrl !== 'string') {
    throw new Error(payload?.msg || 'KIE upload did not return a download URL.');
  }

  return downloadUrl;
}

export async function createImageCloneTask(
  input: ImageCloneInput
): Promise<ImageCloneResult> {
  const jobId = generateJobId();

  // Create initial job in store
  const job: ImageCloneJob = {
    id: jobId,
    userId: input.userId,
    status: 'pending',
    productImageUrl: null,
    referenceImageUrls: [],
    prompt: '',
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    kieTaskId: null,
    resultImageUrl: null,
    errorMessage: null,
    billedCredits: input.billedCredits ?? 0,
    billingRefundedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  addJob(job);

  // Upload images
  const productImageUrl = await uploadImageForClone(
    input.productPhotoDataUrl,
    `product_${jobId}.jpg`
  );

  const referenceImageUrls: string[] = [];
  if (input.referencePhotoDataUrls && input.referencePhotoDataUrls.length > 0) {
    for (let i = 0; i < input.referencePhotoDataUrls.length; i++) {
      const refUrl = await uploadImageForClone(
        input.referencePhotoDataUrls[i],
        `ref_${i}_${jobId}.jpg`
      );
      referenceImageUrls.push(refUrl);
    }
  }

  // Build prompt
  const prompt = buildImageClonePrompt({
    userRequirement: input.userRequirement,
    copyText: input.copyText,
    styleDirection: input.styleDirection,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
  });

  // Create KIE task
  const allInputUrls = [productImageUrl, ...referenceImageUrls];
  const kieTaskId = await createKieImageGenerationTask({
    prompt,
    inputUrls: allInputUrls,
    aspectRatio: input.aspectRatio as '1:1' | '9:16' | '16:9' | '4:3' | '3:4',
    resolution: input.resolution as '1K' | '2K' | '4K',
  });

  // Update job with KIE task ID
  job.productImageUrl = productImageUrl;
  job.referenceImageUrls = referenceImageUrls;
  job.prompt = prompt;
  job.kieTaskId = kieTaskId;
  job.status = 'processing';
  job.updatedAt = Date.now();

  return {
    jobId,
    kieTaskId,
    status: 'processing',
  };
}

async function createKieImageGenerationTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: '1:1' | '9:16' | '16:9' | '4:3' | '3:4';
  resolution: '1K' | '2K' | '4K';
}): Promise<string> {
  const response = await fetchWithRetry(
    KIE_CREATE_TASK_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: KIE_MODEL,
        input: {
          prompt: input.prompt,
          input_urls: input.inputUrls.slice(0, 16),
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
        },
      }),
    },
    5,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE task creation failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  const taskId = payload?.data?.taskId;
  if (payload?.code !== 200 || typeof taskId !== 'string') {
    throw new Error(payload?.msg || 'KIE task creation did not return a taskId.');
  }

  return taskId;
}

export async function pollImageCloneJobStatus(
  jobId: string
): Promise<{ status: ImageCloneJobStatus; resultImageUrl: string | null; errorMessage: string | null }> {
  const { getJob, updateJob } = await import('./image-clone-job-store');
  const job = getJob(jobId);

  if (!job) {
    return { status: 'failed', resultImageUrl: null, errorMessage: 'Job not found' };
  }

  if (job.status === 'completed' || job.status === 'failed') {
    return { status: job.status, resultImageUrl: job.resultImageUrl, errorMessage: job.errorMessage };
  }

  if (!job.kieTaskId) {
    return { status: job.status, resultImageUrl: null, errorMessage: job.errorMessage };
  }

  // Poll KIE status
  const kieStatus = await getKieTaskStatus(job.kieTaskId);

  if (kieStatus.status === 'success') {
    updateJob(jobId, {
      status: 'completed',
      resultImageUrl: kieStatus.resultUrl ?? null,
    });
    return { status: 'completed', resultImageUrl: kieStatus.resultUrl ?? null, errorMessage: null };
  }

  if (kieStatus.status === 'failed') {
    if (job.billedCredits > 0 && !job.billingRefundedAt) {
      await refundToolGenerationCredits({
        userId: job.userId,
        amount: job.billedCredits,
        reason: 'Image Clone generation failed',
        historyId: job.id,
      });
    }
    updateJob(jobId, {
      status: 'failed',
      errorMessage: kieStatus.error ?? 'Generation failed',
      billingRefundedAt: new Date().toISOString(),
    });
    return { status: 'failed', resultImageUrl: null, errorMessage: kieStatus.error ?? 'Generation failed' };
  }

  return { status: 'processing', resultImageUrl: null, errorMessage: null };
}

type KieTaskStatus =
  | { status: 'processing'; resultUrl?: undefined; error?: undefined }
  | { status: 'success'; resultUrl: string; error?: undefined }
  | { status: 'failed'; resultUrl?: undefined; error: string };

async function getKieTaskStatus(taskId: string): Promise<KieTaskStatus> {
  const response = await fetchWithRetry(
    `${KIE_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
      },
    },
    3,
    15000
  );

  if (!response.ok) {
    throw new Error(`KIE status check failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.code !== 200) {
    throw new Error(payload.msg || 'KIE status check failed.');
  }

  const state = payload.data?.state?.toLowerCase() ?? 'processing';

  if (state === 'success') {
    let resultUrl: string | undefined;
    if (payload.data?.resultJson) {
      const parsed = JSON.parse(payload.data.resultJson);
      if (Array.isArray(parsed?.resultUrls) && typeof parsed.resultUrls[0] === 'string') {
        resultUrl = parsed.resultUrls[0];
      }
    }
    return { status: 'success', resultUrl: resultUrl ?? '' };
  }

  if (state === 'fail') {
    return { status: 'failed', error: payload.data?.failMsg || payload.data?.failCode || 'Generation failed' };
  }

  return { status: 'processing' };
}

export async function regenerateImageClone(
  jobId: string,
  refinementText: string,
  billedCredits = 0
): Promise<ImageCloneResult> {
  const { getJob, updateJob, addJob: addJobFn, generateJobId: generateNewJobId } = await import('./image-clone-job-store');
  const originalJob = getJob(jobId);

  if (!originalJob) {
    throw new Error('Original job not found');
  }

  const newJobId = generateNewJobId();

  // Create new job based on original
  const newJob: ImageCloneJob = {
    id: newJobId,
    userId: originalJob.userId,
    status: 'pending',
    productImageUrl: originalJob.productImageUrl,
    referenceImageUrls: originalJob.referenceImageUrls,
    prompt: originalJob.prompt,
    aspectRatio: originalJob.aspectRatio,
    resolution: originalJob.resolution,
    kieTaskId: null,
    resultImageUrl: null,
    errorMessage: null,
    billedCredits,
    billingRefundedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  addJobFn(newJob);

  // Build refined prompt
  const refinedPrompt = `${originalJob.prompt}

---
Refinement request:
${refinementText}
`;

  // Use the previous result as the first input URL
  const inputUrls = originalJob.resultImageUrl
    ? [originalJob.resultImageUrl, ...(originalJob.referenceImageUrls || [])]
    : originalJob.referenceImageUrls || [];

  if (inputUrls.length === 0) {
    throw new Error('No reference images available for regeneration');
  }

  // Create KIE task
  const kieTaskId = await createKieImageGenerationTask({
    prompt: refinedPrompt,
    inputUrls,
    aspectRatio: originalJob.aspectRatio as '1:1' | '9:16' | '16:9' | '4:3' | '3:4',
    resolution: originalJob.resolution as '1K' | '2K' | '4K',
  });

  updateJob(newJobId, {
    status: 'processing',
    kieTaskId,
    prompt: refinedPrompt,
  });

  return {
    jobId: newJobId,
    kieTaskId,
    status: 'processing',
  };
}
