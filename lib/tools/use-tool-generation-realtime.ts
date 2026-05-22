'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { ToolGenerationJob, ToolGenerationTask } from '@/lib/tools/job-store';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ToolGenerationState {
  job: ToolGenerationJob | null;
  tasks: ToolGenerationTask[];
  isLoading: boolean;
  error: string | null;
}

export function useToolGenerationRealtime(jobId: string | null): ToolGenerationState {
  const [job, setJob] = useState<ToolGenerationJob | null>(null);
  const [tasks, setTasks] = useState<ToolGenerationTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial hydration fetch
  const hydrate = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/tools/jobs/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Job not found');
          return;
        }
        throw new Error(`Failed to fetch job: ${response.status}`);
      }
      const data = await response.json();
      setJob(data.job);
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to Supabase Realtime
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setTasks([]);
      return;
    }

    // Initial fetch
    hydrate(jobId);

    // Subscribe to job and task changes
    const supabase = getSupabase();
    const channel = supabase
      .channel(`tool-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tool_generation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as ToolGenerationJob);
          void hydrate(jobId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tool_generation_tasks',
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const nextTask = payload.new as ToolGenerationTask;
          setTasks((current) => {
            const index = current.findIndex((task) => task.id === nextTask.id);
            if (index === -1) return [...current, nextTask];
            const next = [...current];
            next[index] = nextTask;
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void hydrate(jobId);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, hydrate]);

  return { job, tasks, isLoading, error };
}
