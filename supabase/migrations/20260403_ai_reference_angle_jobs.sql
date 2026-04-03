CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_reference_angle_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('product', 'avatar', 'universal')),
  source_image_url text NOT NULL,
  preset_key text NOT NULL,
  preset_label text NOT NULL,
  kie_task_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_image_url text,
  error_message text,
  webhook_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_reference_angle_jobs_user_id_created_at_idx
  ON ai_reference_angle_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_reference_angle_jobs_user_id_status_idx
  ON ai_reference_angle_jobs (user_id, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_reference_angle_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ai_reference_angle_jobs;
  END IF;
END
$$;
