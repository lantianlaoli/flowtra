'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToolGenerationJob, ToolGenerationTask } from '@/lib/tools/job-store';

export interface ToolGenerationState {
  job: ToolGenerationJob | null;
  tasks: ToolGenerationTask[];
  isLoading: boolean;
  error: string | null;
}

interface SSEData {
  job?: ToolGenerationJob;
  tasks?: ToolGenerationTask[];
  error?: string;
  message?: string;
}

export function useToolGenerationRealtime(jobId: string | null): ToolGenerationState {
  const [job, setJob] = useState<ToolGenerationJob | null>(null);
  const [tasks, setTasks] = useState<ToolGenerationTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setTasks([]);
      setError(null);
      disconnect();
      return;
    }

    setIsLoading(true);
    setError(null);
    disconnect();

    const es = new EventSource(`/api/tools/jobs/${jobId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('snapshot', (event: MessageEvent) => {
      try {
        const data: SSEData = JSON.parse(event.data);
        setJob(data.job ?? null);
        setTasks(data.tasks ?? []);
        setIsLoading(false);
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener('update', (event: MessageEvent) => {
      try {
        const data: SSEData = JSON.parse(event.data);
        if (data.job) setJob(data.job);
        if (data.tasks) setTasks(data.tasks);
      } catch {
        // Ignore parse errors
      }
    });

    es.addEventListener('terminal', (event: MessageEvent) => {
      try {
        const data: SSEData = JSON.parse(event.data);
        if (data.job) setJob(data.job);
        if (data.tasks) setTasks(data.tasks);
        setIsLoading(false);
      } catch {
        // Ignore parse errors
      }
      es.close();
    });

    es.addEventListener('error', (event: MessageEvent) => {
      try {
        const data: SSEData = JSON.parse(event.data);
        setError(data.error ?? 'Stream error');
      } catch {
        setError('Connection error');
      }
      setIsLoading(false);
      es.close();
    });

    es.addEventListener('timeout', () => {
      setError('Stream timed out. Please refresh.');
      setIsLoading(false);
      es.close();
    });

    // Handle connection errors (EventSource fires 'error' event with no data)
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setError('Connection lost');
        setIsLoading(false);
      }
    };

    return () => {
      es.close();
    };
  }, [jobId, disconnect]);

  return { job, tasks, isLoading, error };
}
