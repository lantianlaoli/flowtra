'use client';

import type { AiReferenceAngleJob } from '@/lib/ai-reference-angle-jobs';

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
  _supabase: unknown,
  jobIds: string[],
  onJobChange: (job: AiReferenceAngleJob) => void
): () => void {
  if (!jobIds.length) return () => {};

  const params = new URLSearchParams();
  jobIds.forEach((jobId) => params.append('jobId', jobId));

  const eventSource = new EventSource(`/api/assets/ai-reference-angles/sse?${params.toString()}`);

  eventSource.onmessage = (event) => {
    try {
      const job = JSON.parse(event.data) as AiReferenceAngleJob;
      onJobChange(job);
    } catch {
      // Ignore parse errors
    }
  };

  eventSource.onerror = () => {
    // Let polling fallback handle reconnect
    eventSource.close();
  };

  return () => {
    eventSource.close();
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
  const { supabase, jobIds, onJobsUpdated, timeoutMs = 180000, pollIntervalMs = 2000 } = options;
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
    let pollingInFlight = false;

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
      clearInterval(pollingIntervalId);
      unsubscribe();
      callback();
    };

    const unsubscribe = subscribeToAiReferenceAngleJobs(supabase, jobIds, (updatedJob) => {
      const nextJobs = jobs.map((job) => (job.id === updatedJob.id ? updatedJob : job));
      evaluateJobs(nextJobs, updatedJob.status === 'failed' ? updatedJob : undefined);
    });

    const pollingIntervalId = window.setInterval(async () => {
      if (settled || pollingInFlight) return;
      pollingInFlight = true;
      try {
        const latestJobs = await fetchAiReferenceAngleJobs(jobIds);
        evaluateJobs(latestJobs);
      } catch {
        // Ignore transient polling errors and continue waiting.
      } finally {
        pollingInFlight = false;
      }
    }, pollIntervalMs);

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
