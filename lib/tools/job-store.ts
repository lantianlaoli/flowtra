import { getSupabaseAdmin } from '@/lib/supabase';
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

const JOB_CACHE_PREFIX = 'tool:job:';
const TASK_LOOKUP_PREFIX = 'tool:task:';
const WEBHOOK_IDEM_PREFIX = 'tool:webhook:';
const LOCK_PREFIX = 'tool:lock:';
const CACHE_TTL_SECONDS = 300; // 5 minutes
const WEBHOOK_IDEM_TTL_SECONDS = 86400; // 24 hours
const LOCK_TTL_SECONDS = 30;

function jobCacheKey(jobId: string) {
  return `${JOB_CACHE_PREFIX}${jobId}`;
}

function taskLookupKey(kieTaskId: string) {
  return `${TASK_LOOKUP_PREFIX}${kieTaskId}`;
}

function webhookIdemKey(kieTaskId: string, state: string) {
  return `${WEBHOOK_IDEM_PREFIX}${kieTaskId}:${state}`;
}

function lockKey(kieTaskId: string) {
  return `${LOCK_PREFIX}${kieTaskId}`;
}

// ─── Job CRUD ─────────────────────────────────────────────────────────────────

// Schema verified via Supabase MCP (2026-05-21):
// tool_generation_jobs and tool_generation_tasks exist in public schema.
// Source migration 20260522_tool_generation_jobs.sql defines the columns used here.
export async function createToolGenerationJob(params: {
  userId: string;
  toolKey: ToolKey;
  status?: ToolGenerationJobStatus;
  metadata?: Record<string, unknown>;
  billedCredits?: number;
}): Promise<ToolGenerationJob> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_jobs')
    .insert({
      user_id: params.userId,
      tool_key: params.toolKey,
      status: params.status ?? 'processing',
      metadata: params.metadata ?? {},
      billed_credits: params.billedCredits ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create tool generation job: ${error?.message ?? 'unknown'}`);
  }

  const job = data as ToolGenerationJob;
  await cacheJobSnapshot(job.id, job);
  return job;
}

export async function getToolGenerationJob(jobId: string): Promise<ToolGenerationJob | null> {
  // Try cache first
  const cached = await getCachedJobSnapshot(jobId);
  if (cached) return cached;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) return null;

  const job = data as ToolGenerationJob;
  await cacheJobSnapshot(jobId, job);
  return job;
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select()
    .single();

  if (error || !data) return null;

  const job = data as ToolGenerationJob;
  await cacheJobSnapshot(jobId, job);
  return job;
}

export async function getToolGenerationJobsByUser(
  userId: string,
  toolKey?: ToolKey
): Promise<ToolGenerationJob[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('tool_generation_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (toolKey) {
    query = query.eq('tool_key', toolKey);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data as ToolGenerationJob[];
}

// ─── Task CRUD ────────────────────────────────────────────────────────────────

export async function createToolGenerationTask(params: {
  jobId: string;
  kieTaskId: string;
  toolKey: ToolKey;
  provider?: string;
  metadata?: Record<string, unknown>;
}): Promise<ToolGenerationTask> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_tasks')
    .insert({
      job_id: params.jobId,
      kie_task_id: params.kieTaskId,
      tool_key: params.toolKey,
      provider: params.provider ?? 'kie',
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create tool generation task: ${error?.message ?? 'unknown'}`);
  }

  const task = data as ToolGenerationTask;
  await cacheTaskLookup(params.kieTaskId, task);
  return task;
}

export async function getToolGenerationTaskByKieTaskId(
  kieTaskId: string
): Promise<ToolGenerationTask | null> {
  // Try cache first
  const cached = await getCachedTaskLookup(kieTaskId);
  if (cached) return cached;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_tasks')
    .select('*')
    .eq('kie_task_id', kieTaskId)
    .single();

  if (error || !data) return null;

  const task = data as ToolGenerationTask;
  await cacheTaskLookup(kieTaskId, task);
  return task;
}

export async function getToolGenerationTasksByKieTaskIds(
  kieTaskIds: string[]
): Promise<ToolGenerationTask[]> {
  const uniqueTaskIds = Array.from(new Set(kieTaskIds.filter(Boolean)));
  if (uniqueTaskIds.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_tasks')
    .select('*')
    .in('kie_task_id', uniqueTaskIds);

  if (error || !data) return [];

  const tasks = data as ToolGenerationTask[];
  await Promise.all(tasks.map((task) => cacheTaskLookup(task.kie_task_id, task)));
  return tasks;
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
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('kie_task_id', kieTaskId)
    .select()
    .single();

  if (error || !data) return null;

  const task = data as ToolGenerationTask;
  await cacheTaskLookup(kieTaskId, task);
  // Invalidate task list cache for the job
  await redis.del(`${JOB_CACHE_PREFIX}tasks:${task.job_id}`);
  return task;
}

export async function getToolGenerationTasksByJobId(
  jobId: string,
  options: { skipCache?: boolean } = {}
): Promise<ToolGenerationTask[]> {
  const cacheKey = `${JOB_CACHE_PREFIX}tasks:${jobId}`;
  if (!options.skipCache) {
    try {
      const cached = await redis.get<ToolGenerationTask[]>(cacheKey);
      if (cached) return cached;
    } catch {
      // Redis miss, fall through to Supabase
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('tool_generation_tasks')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  const tasks = data as ToolGenerationTask[];
  try {
    await redis.set(cacheKey, tasks, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Cache write failure is non-critical
  }
  return tasks;
}

// ─── Redis caching ────────────────────────────────────────────────────────────

async function cacheJobSnapshot(jobId: string, job: ToolGenerationJob): Promise<void> {
  try {
    await redis.set(jobCacheKey(jobId), job, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Cache write failure is non-critical
  }
}

async function getCachedJobSnapshot(jobId: string): Promise<ToolGenerationJob | null> {
  try {
    return await redis.get<ToolGenerationJob>(jobCacheKey(jobId));
  } catch {
    return null;
  }
}

async function cacheTaskLookup(kieTaskId: string, task: ToolGenerationTask): Promise<void> {
  try {
    await redis.set(taskLookupKey(kieTaskId), task, { ex: CACHE_TTL_SECONDS });
  } catch {
    // Cache write failure is non-critical
  }
}

async function getCachedTaskLookup(kieTaskId: string): Promise<ToolGenerationTask | null> {
  try {
    return await redis.get<ToolGenerationTask>(taskLookupKey(kieTaskId));
  } catch {
    return null;
  }
}

// ─── Webhook idempotency ──────────────────────────────────────────────────────

export async function acquireWebhookIdempotencyKey(
  kieTaskId: string,
  state: string
): Promise<boolean> {
  try {
    const result = await redis.set(webhookIdemKey(kieTaskId, state), '1', {
      ex: WEBHOOK_IDEM_TTL_SECONDS,
      nx: true,
    });
    return result === 'OK';
  } catch {
    // If Redis is down, allow the webhook through (idempotency is best-effort)
    return true;
  }
}

export async function acquireWebhookLock(kieTaskId: string): Promise<boolean> {
  try {
    const result = await redis.set(lockKey(kieTaskId), '1', {
      ex: LOCK_TTL_SECONDS,
      nx: true,
    });
    return result === 'OK';
  } catch {
    return true; // Allow through if Redis is unavailable
  }
}

export async function releaseWebhookLock(kieTaskId: string): Promise<void> {
  try {
    await redis.del(lockKey(kieTaskId));
  } catch {
    // Best effort
  }
}

// ─── Cache invalidation ───────────────────────────────────────────────────────

export async function invalidateJobCache(jobId: string): Promise<void> {
  try {
    await redis.del(jobCacheKey(jobId));
  } catch {
    // Best effort
  }
}
