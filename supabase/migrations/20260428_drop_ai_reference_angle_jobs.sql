-- Drop RLS policies for ai_reference_angle_jobs
DROP POLICY IF EXISTS "ai_reference_angle_jobs_select_own" ON public.ai_reference_angle_jobs;
DROP POLICY IF EXISTS "ai_reference_angle_jobs_insert_own" ON public.ai_reference_angle_jobs;
DROP POLICY IF EXISTS "ai_reference_angle_jobs_update_own" ON public.ai_reference_angle_jobs;
DROP POLICY IF EXISTS "ai_reference_angle_jobs_delete_own" ON public.ai_reference_angle_jobs;

-- Drop ai_reference_angle_jobs table (feature migrated to in-memory store)
DROP TABLE IF EXISTS public.ai_reference_angle_jobs;
