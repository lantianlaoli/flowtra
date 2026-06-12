-- Idempotent cleanup: ensure the three tool-prefixed Supabase tables
-- (already replaced by Redis via lib/tools/job-store.ts and localStorage
-- via lib/tools/usage-limits.ts) are fully removed in all environments.
-- 20260602_remove_tool_tables_and_video_covers.sql should have already
-- dropped these; this migration is a safety net.

DROP TABLE IF EXISTS public.tool_generation_tasks;
DROP TABLE IF EXISTS public.tool_generation_jobs;
DROP TABLE IF EXISTS public.tool_daily_usage;
