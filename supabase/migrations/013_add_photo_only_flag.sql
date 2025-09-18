-- Add a unified flag to indicate image-only generation (skip video)
-- Applies to both V1 (user_history) and V2 (user_history_v2)

-- user_history.photo_only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_history' AND column_name = 'photo_only'
  ) THEN
    ALTER TABLE user_history ADD COLUMN photo_only BOOLEAN NOT NULL DEFAULT FALSE;
    COMMENT ON COLUMN user_history.photo_only IS 'If true, workflow skips video generation and only produces a cover image.';
  END IF;
END $$;

-- user_history_v2.photo_only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_history_v2' AND column_name = 'photo_only'
  ) THEN
    ALTER TABLE user_history_v2 ADD COLUMN photo_only BOOLEAN NOT NULL DEFAULT FALSE;
    COMMENT ON COLUMN user_history_v2.photo_only IS 'If true, workflow skips video generation and only produces a cover image.';
  END IF;
END $$;

