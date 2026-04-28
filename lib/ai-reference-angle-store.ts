import { randomUUID } from 'crypto';
import type { AiReferenceAngleAssetType, AiReferenceAngleJobStatus } from './ai-reference-angle-jobs';

export interface AiReferenceAngleJob {
  id: string;
  user_id: string;
  asset_type: AiReferenceAngleAssetType;
  source_image_url: string;
  preset_key: string;
  preset_label: string;
  kie_task_id: string;
  status: AiReferenceAngleJobStatus;
  result_image_url: string | null;
  error_message: string | null;
  webhook_received_at: string | null;
  created_at: string;
  updated_at: string;
  aspect_ratio: string | null;
}

// In-memory job store: kieTaskId -> JobState
const jobStore = new Map<string, AiReferenceAngleJob>();

// SSE emitter registry: jobId -> Set of controllers
const sseEmitters = new Map<string, Set<ReadableStreamDefaultController>>();

export function createJob(params: {
  userId: string;
  assetType: AiReferenceAngleAssetType;
  sourceImageUrl: string;
  presetKey: string;
  presetLabel: string;
  kieTaskId: string;
  aspectRatio: string;
}): AiReferenceAngleJob {
  const now = new Date().toISOString();
  const job: AiReferenceAngleJob = {
    id: randomUUID(),
    user_id: params.userId,
    asset_type: params.assetType,
    source_image_url: params.sourceImageUrl,
    preset_key: params.presetKey,
    preset_label: params.presetLabel,
    kie_task_id: params.kieTaskId,
    status: 'processing',
    result_image_url: null,
    error_message: null,
    webhook_received_at: null,
    created_at: now,
    updated_at: now,
    aspect_ratio: params.aspectRatio,
  };
  jobStore.set(params.kieTaskId, job);
  return job;
}

export function getJobByKieTaskId(kieTaskId: string): AiReferenceAngleJob | undefined {
  return jobStore.get(kieTaskId);
}

export function getJobById(id: string): AiReferenceAngleJob | undefined {
  for (const job of jobStore.values()) {
    if (job.id === id) return job;
  }
  return undefined;
}

export function getJobsByIds(ids: string[]): AiReferenceAngleJob[] {
  const idSet = new Set(ids);
  return [...jobStore.values()].filter((job) => idSet.has(job.id));
}

export function getJobsByIdsAndUser(ids: string[], userId: string): AiReferenceAngleJob[] {
  const idSet = new Set(ids);
  return [...jobStore.values()].filter((job) => idSet.has(job.id) && job.user_id === userId);
}

export function updateJob(
  kieTaskId: string,
  params: {
    status?: AiReferenceAngleJobStatus;
    resultImageUrl?: string | null;
    errorMessage?: string | null;
    webhookReceivedAt?: string | null;
  }
): AiReferenceAngleJob | undefined {
  const job = jobStore.get(kieTaskId);
  if (!job) return undefined;

  const now = new Date().toISOString();
  if (params.status !== undefined) job.status = params.status;
  if (params.resultImageUrl !== undefined) job.result_image_url = params.resultImageUrl;
  if (params.errorMessage !== undefined) job.error_message = params.errorMessage;
  if (params.webhookReceivedAt !== undefined) job.webhook_received_at = params.webhookReceivedAt;
  job.updated_at = now;

  notifySseSubscribers(job);

  return job;
}

export function subscribeToJobSse(jobId: string, controller: ReadableStreamDefaultController): () => void {
  let emitters = sseEmitters.get(jobId);
  if (!emitters) {
    emitters = new Set();
    sseEmitters.set(jobId, emitters);
  }
  emitters.add(controller);

  return () => {
    emitters!.delete(controller);
    if (emitters!.size === 0) {
      sseEmitters.delete(jobId);
    }
  };
}

export function notifySseSubscribers(job: AiReferenceAngleJob): void {
  const emitters = sseEmitters.get(job.id);
  if (!emitters || emitters.size === 0) return;

  const data = JSON.stringify(job);
  const message = `data: ${data}\n\n`;

  for (const controller of emitters) {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch {
      // Controller closed, remove it
      emitters.delete(controller);
    }
  }
}
