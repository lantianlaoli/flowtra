-- Set REPLICA IDENTITY FULL on tool generation tables so Supabase Realtime
-- delivers complete row data in UPDATE events. Without this, payload.new only
-- contains the primary key and the frontend realtime hook receives incomplete
-- job/task state.

DO $$
BEGIN
  ALTER TABLE public.tool_generation_jobs REPLICA IDENTITY FULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'tool_generation_jobs REPLICA IDENTITY already set or failed: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.tool_generation_tasks REPLICA IDENTITY FULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'tool_generation_tasks REPLICA IDENTITY already set or failed: %', SQLERRM;
END $$;
