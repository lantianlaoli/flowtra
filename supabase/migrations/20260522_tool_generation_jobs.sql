-- Schema verified via Supabase MCP (2026-05-21): tool_generation_jobs and
-- tool_generation_tasks exist in the target project. This migration makes the
-- webhook-only landing tool schema reproducible from source.

CREATE TABLE IF NOT EXISTS public.tool_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  tool_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_url text,
  error_message text,
  billed_credits integer NOT NULL DEFAULT 0,
  billing_refunded_at timestamptz,
  webhook_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tool_generation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.tool_generation_jobs(id) ON DELETE CASCADE,
  kie_task_id text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'kie',
  tool_key text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  result_url text,
  error_message text,
  webhook_received_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tool_generation_jobs_user_tool_created_idx
  ON public.tool_generation_jobs(user_id, tool_key, created_at DESC);

CREATE INDEX IF NOT EXISTS tool_generation_jobs_status_idx
  ON public.tool_generation_jobs(status);

CREATE INDEX IF NOT EXISTS tool_generation_tasks_job_created_idx
  ON public.tool_generation_tasks(job_id, created_at);

CREATE INDEX IF NOT EXISTS tool_generation_tasks_tool_status_idx
  ON public.tool_generation_tasks(tool_key, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tool_generation_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_generation_jobs;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tool_generation_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tool_generation_tasks;
  END IF;
END $$;
