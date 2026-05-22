'use client';

import type { AiReferenceAngleJob } from '@/lib/ai-reference-angle-jobs';
import type { ToolGenerationTask } from '@/lib/tools/job-store';

type FetchJobsResponse = {
  jobs: AiReferenceAngleJob[];
};

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export async function fetchAiReferenceAngleJobs(jobIds: string[]): Promise<AiReferenceAngleJob[]> {
  if (!jobIds.length) return [];

  const params = new URLSearchParams();
  jobIds.forEach((jobId) => params.append('jobId', jobId));

  const response = await fetch(`/api/assets/ai-reference-angles?${params.toString()}`, {
    method: 'GET'
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !Array.isArray((payload as FetchJobsResponse)?.jobs)) {
    throw new Error((payload as { error?: string })?.error || 'Failed to load AI reference angle jobs.');
  }

  const jobs = (payload as FetchJobsResponse).jobs;
  const order = new Map(jobIds.map((jobId, index) => [jobId, index]));

  return [...jobs].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

export function subscribeToAiReferenceAngleJobs(
  supabase: unknown,
  jobIds: string[],
  onJobChange: (job: AiReferenceAngleJob) => void
): () => void {
  if (!jobIds.length) return () => {};

  const client = supabase as {
    channel?: (name: string) => {
      on: (
        event: 'postgres_changes',
        config: Record<string, unknown>,
        callback: (payload: { new: ToolGenerationTask }) => void
      ) => unknown;
      subscribe: () => unknown;
    };
    removeChannel?: (channel: unknown) => unknown;
  };

  if (typeof client.channel !== 'function') return () => {};

  let channel = client.channel(`ai-reference-angle-jobs-${jobIds.join('-')}`);
  for (const jobId of jobIds) {
    const nextChannel = channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tool_generation_tasks',
        filter: `kie_task_id=eq.${jobId}`,
      },
      (payload) => {
        onJobChange(mapTaskToAiReferenceJob(payload.new));
      }
    );
    channel = nextChannel as typeof channel;
  }

  channel.subscribe();

  return () => {
    client.removeChannel?.(channel);
  };
}

function hasFailedJob(jobs: AiReferenceAngleJob[]) {
  return jobs.find((job) => job.status === 'failed');
}

function allJobsCompleted(jobs: AiReferenceAngleJob[]) {
  return jobs.length > 0 && jobs.every((job) => job.status === 'completed');
}

export async function waitForAiReferenceAngleJobs(options: {
  supabase: unknown;
  jobIds: string[];
  onJobsUpdated?: (jobs: AiReferenceAngleJob[]) => void;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<AiReferenceAngleJob[]> {
  const { supabase, jobIds, onJobsUpdated, timeoutMs = 180000 } = options;
  const initialJobs = await fetchAiReferenceAngleJobs(jobIds);
  onJobsUpdated?.(initialJobs);

  const failedInitialJob = hasFailedJob(initialJobs);
  if (failedInitialJob) {
    throw new Error(failedInitialJob.error_message || 'AI reference generation failed.');
  }

  if (allJobsCompleted(initialJobs)) {
    return initialJobs;
  }

  return new Promise<AiReferenceAngleJob[]>((resolve, reject) => {
    let settled = false;
    let jobs = initialJobs;
    const evaluateJobs = (nextJobs: AiReferenceAngleJob[], failedJobOverride?: AiReferenceAngleJob) => {
      jobs = nextJobs;
      onJobsUpdated?.(jobs);

      const failedJob = failedJobOverride || hasFailedJob(jobs);
      if (failedJob) {
        finish(() => reject(new Error(failedJob.error_message || 'AI reference generation failed.')));
        return true;
      }

      if (allJobsCompleted(jobs)) {
        finish(() => resolve(jobs));
        return true;
      }

      return false;
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      callback();
    };

    const unsubscribe = subscribeToAiReferenceAngleJobs(supabase, jobIds, (updatedJob) => {
      const nextJobs = jobs.map((job) => (job.id === updatedJob.id ? updatedJob : job));
      evaluateJobs(nextJobs, updatedJob.status === 'failed' ? updatedJob : undefined);
    });

    const timeoutId = window.setTimeout(async () => {
      try {
        const latestJobs = await fetchAiReferenceAngleJobs(jobIds);
        if (evaluateJobs(latestJobs)) {
          return;
        }
        finish(() => reject(new Error('AI reference generation is still in progress. Reopen this view to resume.')));
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error('Failed to refresh AI reference angle jobs.')));
      }
    }, timeoutMs);
  });
}

function mapTaskToAiReferenceJob(task: ToolGenerationTask): AiReferenceAngleJob {
  const metadata = task.metadata ?? {};
  return {
    id: task.kie_task_id,
    user_id: '',
    asset_type: (metadata.asset_type as AiReferenceAngleJob['asset_type']) || 'universal',
    source_image_url: '',
    preset_key: (metadata.preset_key as string) || '',
    preset_label: (metadata.preset_label as string) || '',
    kie_task_id: task.kie_task_id,
    status: task.status,
    result_image_url: task.result_url,
    error_message: task.error_message,
    webhook_received_at: task.webhook_received_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
    aspect_ratio: (metadata.aspect_ratio as string) || null,
  };
}
