'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToolGenerationJob, ToolGenerationTask } from '@/lib/tools/job-store';

export interface ToolGenerationState {
  job: ToolGenerationJob | null;
  tasks: ToolGenerationTask[];
  isLoading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 5_000;

function isTerminalJob(job: ToolGenerationJob | null) {
  return job?.status === 'completed' || job?.status === 'failed';
}

export function useToolGenerationRealtime(jobId: string | null): ToolGenerationState {
  const [job, setJob] = useState<ToolGenerationJob | null>(null);
  const [tasks, setTasks] = useState<ToolGenerationTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestJobRef = useRef<ToolGenerationJob | null>(null);

  const hydrate = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tools/jobs/${id}`, { cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 404) {
          setError('Job not found');
          setJob(null);
          setTasks([]);
          return null;
        }
        throw new Error(`Failed to fetch job: ${response.status}`);
      }
      const data = await response.json();
      const nextJob = data.job as ToolGenerationJob | null;
      setJob(nextJob);
      setTasks((data.tasks || []) as ToolGenerationTask[]);
      latestJobRef.current = nextJob;
      return nextJob;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setTasks([]);
      setError(null);
      latestJobRef.current = null;
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      const nextJob = await hydrate(jobId);
      if (cancelled || isTerminalJob(nextJob ?? latestJobRef.current)) return;
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    void poll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [jobId, hydrate]);

  return { job, tasks, isLoading, error };
}
