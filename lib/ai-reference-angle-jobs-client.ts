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
    method: 'GET',
    cache: 'no-store',
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok || !Array.isArray((payload as FetchJobsResponse)?.jobs)) {
    throw new Error((payload as { error?: string })?.error || 'Failed to load AI reference angle jobs.');
  }

  const jobs = (payload as FetchJobsResponse).jobs;
  const order = new Map(jobIds.map((jobId, index) => [jobId, index]));

  return [...jobs].sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
}

function hasFailedJob(jobs: AiReferenceAngleJob[]) {
  return jobs.find((job) => job.status === 'failed');
}

function allJobsCompleted(jobs: AiReferenceAngleJob[]) {
  return jobs.length > 0 && jobs.every((job) => job.status === 'completed');
}

export async function waitForAiReferenceAngleJobs(options: {
  supabase?: unknown;
  jobIds: string[];
  onJobsUpdated?: (jobs: AiReferenceAngleJob[]) => void;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<AiReferenceAngleJob[]> {
  const {
    jobIds,
    onJobsUpdated,
    timeoutMs = 180000,
    pollIntervalMs = 5000,
  } = options;

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const jobs = await fetchAiReferenceAngleJobs(jobIds);
    onJobsUpdated?.(jobs);

    const failedJob = hasFailedJob(jobs);
    if (failedJob) {
      throw new Error(failedJob.error_message || 'AI reference generation failed.');
    }

    if (allJobsCompleted(jobs)) {
      return jobs;
    }

    await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
  }

  const latestJobs = await fetchAiReferenceAngleJobs(jobIds);
  onJobsUpdated?.(latestJobs);

  const failedJob = hasFailedJob(latestJobs);
  if (failedJob) {
    throw new Error(failedJob.error_message || 'AI reference generation failed.');
  }

  if (allJobsCompleted(latestJobs)) {
    return latestJobs;
  }

  throw new Error('AI reference generation is still in progress. Reopen this view to resume.');
}
