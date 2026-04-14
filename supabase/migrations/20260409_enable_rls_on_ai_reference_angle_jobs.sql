ALTER TABLE public.ai_reference_angle_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_reference_angle_jobs_select_own"
ON public.ai_reference_angle_jobs
FOR SELECT
TO authenticated
USING ((SELECT auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "ai_reference_angle_jobs_insert_own"
ON public.ai_reference_angle_jobs
FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "ai_reference_angle_jobs_update_own"
ON public.ai_reference_angle_jobs
FOR UPDATE
TO authenticated
USING ((SELECT auth.jwt() ->> 'sub') = user_id)
WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "ai_reference_angle_jobs_delete_own"
ON public.ai_reference_angle_jobs
FOR DELETE
TO authenticated
USING ((SELECT auth.jwt() ->> 'sub') = user_id);
