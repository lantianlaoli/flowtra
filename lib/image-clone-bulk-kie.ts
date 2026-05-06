import { fetchWithRetry } from "@/lib/fetchWithRetry";
import type {
  ImageCloneBulkAspectRatio,
  ImageCloneBulkJobStatus,
  ImageCloneBulkResolution,
} from "@/lib/image-clone-bulk-types";

const KIE_CREATE_TASK_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_RECORD_INFO_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const KIE_MODEL = "gpt-image-2-image-to-image";
const CREATE_TASK_MAX_ATTEMPTS = 3;

type KieRecordInfo = {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    state?: string;
    resultJson?: string;
    failMsg?: string;
    failCode?: string;
  };
};

function getKieApiKey() {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error("KIE_API_KEY is not configured.");
  return apiKey;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableImageCloneBulkKieError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\binternal error\b|please try again later|temporar|timeout|timed out|5\d\d|bad gateway|service unavailable|gateway timeout/i.test(message);
}

export async function createImageCloneBulkKieTask(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= CREATE_TASK_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await createImageCloneBulkKieTaskOnce(input);
    } catch (error) {
      lastError = error;
      if (attempt >= CREATE_TASK_MAX_ATTEMPTS || !isRetryableImageCloneBulkKieError(error)) {
        throw error;
      }
      const delay = Math.min(1000 * 2 ** (attempt - 1), 4000);
      console.warn(`[image-clone-bulk] KIE createTask failed, retrying ${attempt}/${CREATE_TASK_MAX_ATTEMPTS}`, error);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("KIE task creation failed.");
}

async function createImageCloneBulkKieTaskOnce(input: {
  prompt: string;
  inputUrls: string[];
  aspectRatio: ImageCloneBulkAspectRatio;
  resolution: ImageCloneBulkResolution;
}) {
  const response = await fetchWithRetry(
    KIE_CREATE_TASK_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKieApiKey()}`,
        "Content-Type": "application/json",
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
  if (payload?.code !== 200 || typeof taskId !== "string") {
    throw new Error(payload?.msg || "KIE task creation did not return a taskId.");
  }
  return taskId;
}

export function normalizeImageCloneBulkKieRecord(payload: KieRecordInfo): {
  taskId?: string;
  status: ImageCloneBulkJobStatus;
  resultUrl?: string;
  error?: string;
} {
  const state = payload.data?.state?.toLowerCase() ?? "processing";
  const status: ImageCloneBulkJobStatus =
    state === "success" || state === "fail" || state === "waiting" ? state : "processing";
  let resultUrl: string | undefined;

  if (state === "success" && payload.data?.resultJson) {
    const parsed = JSON.parse(payload.data.resultJson);
    if (Array.isArray(parsed?.resultUrls) && typeof parsed.resultUrls[0] === "string") {
      resultUrl = parsed.resultUrls[0];
    }
  }

  return {
    taskId: payload.data?.taskId,
    status,
    resultUrl,
    error: payload.data?.failMsg || payload.data?.failCode,
  };
}

export async function getImageCloneBulkKieStatus(taskId: string) {
  const response = await fetchWithRetry(
    `${KIE_RECORD_INFO_URL}?taskId=${encodeURIComponent(taskId)}`,
    {
      method: "GET",
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

  const payload = (await response.json()) as KieRecordInfo;
  if (payload.code !== 200) throw new Error(payload.msg || "KIE status check failed.");
  return normalizeImageCloneBulkKieRecord(payload);
}
