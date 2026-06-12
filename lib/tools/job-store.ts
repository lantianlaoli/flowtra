import { randomUUID } from 'crypto';
import { redis } from '@/lib/redis';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolGenerationJobStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'generating_storyboard'
  | 'generating_storyboard_image'
  | 'generating_video'
  | 'completed'
  | 'failed';

export type ToolGenerationTaskStatus = 'processing' | 'completed' | 'failed';

export type ToolKey =
  | 'ai-reference-angle'
  | 'image-clone'
  | 'image-clone-bulk'
  | 'ad-short-film'
  | 'ecommerce-listing-studio';

export interface ToolGenerationJob {
  id: string;
  user_id: string;
  tool_key: ToolKey;
  status: ToolGenerationJobStatus;
  metadata: Record<string, unknown>;
  result_url: string | null;
  error_message: string | null;
  billed_credits: number;
  billing_refunded_at: string | null;
  webhook_received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolGenerationTask {
  id: string;
  job_id: string;
  kie_task_id: string;
  provider: string;
  tool_key: ToolKey;
  status: ToolGenerationTaskStatus;
  result_url: string | null;
  error_message: string | null;
  webhook_received_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

const JOB_PREFIX = 'tool:job:';
const TASK_PREFIX = 'tool:task:';
const USER_LATEST_PREFIX = 'tool:user:';
const WEBHOOK_IDEM_PREFIX = 'tool:webhook:';
const LOCK_PREFIX = 'tool:lock:';

const ACTIVE_JOB_TTL_SECONDS = 86400; // Active jobs are temporary but should survive long provider runs.
const TERMINAL_JOB_TTL_SECONDS = 1800; // 30 minutes after completed/failed.
const WEBHOOK_IDEM_TTL_SECONDS = 86400; // 24 hours.
const LOCK_TTL_SECONDS = 30;
const PING_PREFIX = "tool:job:";
const PING_SUFFIX = ":ping";
const PING_TTL_SECONDS = 30;

const TOOL_KEYS: ToolKey[] = [
  'ai-reference-angle',
  'image-clone',
  'image-clone-bulk',
  'ad-short-film',
  'ecommerce-listing-studio',
];

function jobKey(jobId: string) {
  return `${JOB_PREFIX}${jobId}`;
}

function jobTasksKey(jobId: string) {
  return `${JOB_PREFIX}${jobId}:tasks`;
}

function taskKey(kieTaskId: string) {
  return `${TASK_PREFIX}${kieTaskId}`;
}

function userLatestKey(userId: string, toolKey: ToolKey) {
  return `${USER_LATEST_PREFIX}${userId}:${toolKey}:latest`;
}

function webhookIdemKey(kieTaskId: string, state: string) {
  return `${WEBHOOK_IDEM_PREFIX}${kieTaskId}:${state}`;
}

function lockKey(kieTaskId: string) {
  return `${LOCK_PREFIX}${kieTaskId}`;
}

function pingKey(jobId: string) {
  return `${PING_PREFIX}${jobId}${PING_SUFFIX}`;
}

function isTerminalStatus(status: ToolGenerationJobStatus) {
  return status === 'completed' || status === 'failed';
}

function ttlForJob(job: Pick<ToolGenerationJob, 'status'>) {
  return isTerminalStatus(job.status) ? TERMINAL_JOB_TTL_SECONDS : ACTIVE_JOB_TTL_SECONDS;
}

async function setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  await redis.set(key, value, { ex: ttlSeconds });
}

async function refreshJobRelatedTtls(job: ToolGenerationJob): Promise<void> {
  const ttl = ttlForJob(job);
  const tasks = await getToolGenerationTasksByJobId(job.id);

  await Promise.all([
    setJson(jobKey(job.id), job, ttl),
    setJson(userLatestKey(job.user_id, job.tool_key), job.id, ttl),
    setJson(jobTasksKey(job.id), tasks.map((task) => task.kie_task_id), ttl),
    ...tasks.map((task) => setJson(taskKey(task.kie_task_id), task, ttl)),
  ]);
}

async function publishJobUpdate(jobId: string): Promise<void> {
  await redis.set(pingKey(jobId), Date.now().toString(), { ex: PING_TTL_SECONDS });
}

// ─── Job CRUD ─────────────────────────────────────────────────────────────────

export async function createToolGenerationJob(params: {
  userId: string;
  toolKey: ToolKey;
  status?: ToolGenerationJobStatus;
  metadata?: Record<string, unknown>;
  billedCredits?: number;
}): Promise<ToolGenerationJob> {
  const now = new Date().toISOString();
  const job: ToolGenerationJob = {
    id: randomUUID(),
    user_id: params.userId,
    tool_key: params.toolKey,
    status: params.status ?? 'processing',
    metadata: params.metadata ?? {},
    result_url: null,
    error_message: null,
    billed_credits: params.billedCredits ?? 0,
    billing_refunded_at: null,
    webhook_received_at: null,
    created_at: now,
    updated_at: now,
  };

  const ttl = ttlForJob(job);
  await Promise.all([
    setJson(jobKey(job.id), job, ttl),
    setJson(jobTasksKey(job.id), [], ttl),
    setJson(userLatestKey(job.user_id, job.tool_key), job.id, ttl),
    publishJobUpdate(job.id),
  ]);

  return job;
}

export async function getToolGenerationJob(jobId: string): Promise<ToolGenerationJob | null> {
  return await redis.get<ToolGenerationJob>(jobKey(jobId));
}

export async function updateToolGenerationJob(
  jobId: string,
  updates: {
    status?: ToolGenerationJobStatus;
    result_url?: string | null;
    error_message?: string | null;
    metadata?: Record<string, unknown>;
    billed_credits?: number;
    billing_refunded_at?: string | null;
    webhook_received_at?: string | null;
  }
): Promise<ToolGenerationJob | null> {
  const current = await getToolGenerationJob(jobId);
  if (!current) return null;

  const job: ToolGenerationJob = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await refreshJobRelatedTtls(job);
  await publishJobUpdate(job.id);
  return job;
}

export async function getToolGenerationJobsByUser(
  userId: string,
  toolKey?: ToolKey
): Promise<ToolGenerationJob[]> {
  const toolKeys = toolKey ? [toolKey] : TOOL_KEYS;
  const latestJobIds = await Promise.all(
    toolKeys.map((key) => redis.get<string>(userLatestKey(userId, key)))
  );
  const jobs = await Promise.all(
    latestJobIds.filter((id): id is string => Boolean(id)).map((id) => getToolGenerationJob(id))
  );

  return jobs
    .filter((job): job is ToolGenerationJob => job !== null && job.user_id === userId)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function createToolGenerationTask(params: {
  jobId: string;
  kieTaskId: string;
  toolKey: ToolKey;
  provider?: string;
  metadata?: Record<string, unknown>;
}): Promise<ToolGenerationTask> {
  const job = await getToolGenerationJob(params.jobId);
  if (!job) {
    throw new Error(`Failed to create tool generation task: job ${params.jobId} was not found in Redis`);
  }

  const now = new Date().toISOString();
  const task: ToolGenerationTask = {
    id: randomUUID(),
    job_id: params.jobId,
    kie_task_id: params.kieTaskId,
    provider: params.provider ?? 'kie',
    tool_key: params.toolKey,
    status: 'processing',
    result_url: null,
    error_message: null,
    webhook_received_at: null,
    metadata: params.metadata ?? {},
    created_at: now,
    updated_at: now,
  };

  const taskIds = await redis.get<string[]>(jobTasksKey(params.jobId)) ?? [];
  const nextTaskIds = Array.from(new Set([...taskIds, params.kieTaskId]));
  const ttl = ttlForJob(job);

  await Promise.all([
    setJson(taskKey(params.kieTaskId), task, ttl),
    setJson(jobTasksKey(params.jobId), nextTaskIds, ttl),
    setJson(jobKey(job.id), { ...job, updated_at: now }, ttl),
    setJson(userLatestKey(job.user_id, job.tool_key), job.id, ttl),
    publishJobUpdate(job.id),
  ]);

  return task;
}

export async function getToolGenerationTaskByKieTaskId(
  kieTaskId: string
): Promise<ToolGenerationTask | null> {
  return await redis.get<ToolGenerationTask>(taskKey(kieTaskId));
}

export async function getToolGenerationTasksByKieTaskIds(
  kieTaskIds: string[]
): Promise<ToolGenerationTask[]> {
  const uniqueTaskIds = Array.from(new Set(kieTaskIds.filter(Boolean)));
  if (uniqueTaskIds.length === 0) return [];

  const tasks = await Promise.all(uniqueTaskIds.map((id) => getToolGenerationTaskByKieTaskId(id)));
  return tasks.filter((task): task is ToolGenerationTask => Boolean(task));
}

export async function updateToolGenerationTask(
  kieTaskId: string,
  updates: {
    status?: ToolGenerationTaskStatus;
    result_url?: string | null;
    error_message?: string | null;
    webhook_received_at?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<ToolGenerationTask | null> {
  const current = await getToolGenerationTaskByKieTaskId(kieTaskId);
  if (!current) return null;

  const job = await getToolGenerationJob(current.job_id);
  const ttl = job ? ttlForJob(job) : TERMINAL_JOB_TTL_SECONDS;
  const task: ToolGenerationTask = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await setJson(taskKey(kieTaskId), task, ttl);
  if (job) {
    await refreshJobRelatedTtls(job);
    await publishJobUpdate(job.id);
  }

  return task;
}

export async function getToolGenerationTasksByJobId(
  jobId: string,
  _options: { skipCache?: boolean } = {}
): Promise<ToolGenerationTask[]> {
  const taskIds = await redis.get<string[]>(jobTasksKey(jobId)) ?? [];
  if (taskIds.length === 0) return [];

  const tasks = await Promise.all(taskIds.map((id) => getToolGenerationTaskByKieTaskId(id)));
  return tasks
    .filter((task): task is ToolGenerationTask => Boolean(task))
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

// ─── Webhook idempotency ──────────────────────────────────────────────────────

export async function acquireWebhookIdempotencyKey(
  kieTaskId: string,
  state: string
): Promise<boolean> {
  const result = await redis.set(webhookIdemKey(kieTaskId, state), '1', {
    ex: WEBHOOK_IDEM_TTL_SECONDS,
    nx: true,
  });
  return result === 'OK';
}

export async function acquireWebhookLock(kieTaskId: string): Promise<boolean> {
  const result = await redis.set(lockKey(kieTaskId), '1', {
    ex: LOCK_TTL_SECONDS,
    nx: true,
  });
  return result === 'OK';
}

export async function releaseWebhookLock(kieTaskId: string): Promise<void> {
  await redis.del(lockKey(kieTaskId));
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

export async function invalidateJobCache(jobId: string): Promise<void> {
  const job = await getToolGenerationJob(jobId);
  const tasks = await getToolGenerationTasksByJobId(jobId);

  await Promise.all([
    redis.del(jobKey(jobId)),
    redis.del(jobTasksKey(jobId)),
    ...(job ? [redis.del(userLatestKey(job.user_id, job.tool_key))] : []),
    ...tasks.map((task) => redis.del(taskKey(task.kie_task_id))),
  ]);
}
