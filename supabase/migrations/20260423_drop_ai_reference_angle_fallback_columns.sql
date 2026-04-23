-- Schema verified via Supabase MCP (2026-04-23):
-- ai_reference_angle_jobs no longer uses fallback_kie_task_id or fallback_model.
ALTER TABLE public.ai_reference_angle_jobs
  DROP COLUMN IF EXISTS fallback_kie_task_id,
  DROP COLUMN IF EXISTS fallback_model;
