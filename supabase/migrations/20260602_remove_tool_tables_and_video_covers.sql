-- Schema verified via Supabase REST metadata probe (2026-06-02):
-- tool_daily_usage, tool_generation_jobs, tool_generation_tasks exist.
-- creator_source_videos has cover_url, cover_storage_bucket, cover_storage_path.
-- motion_clone_projects has reference_cover_url.

DROP TABLE IF EXISTS public.tool_generation_tasks;
DROP TABLE IF EXISTS public.tool_generation_jobs;
DROP TABLE IF EXISTS public.tool_daily_usage;

ALTER TABLE public.creator_source_videos
  DROP COLUMN IF EXISTS cover_url,
  DROP COLUMN IF EXISTS cover_storage_bucket,
  DROP COLUMN IF EXISTS cover_storage_path;

ALTER TABLE public.motion_clone_projects
  DROP COLUMN IF EXISTS reference_cover_url;
