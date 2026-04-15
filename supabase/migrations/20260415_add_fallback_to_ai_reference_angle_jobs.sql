ALTER TABLE public.ai_reference_angle_jobs
ADD COLUMN IF NOT EXISTS fallback_kie_task_id text,
ADD COLUMN IF NOT EXISTS fallback_model text;
