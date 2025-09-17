ALTER TABLE user_history
  ADD COLUMN IF NOT EXISTS cover_image_size TEXT;

COMMENT ON COLUMN user_history.cover_image_size IS 'Image size parameter used for cover generation/editing.';

ALTER TABLE user_history_v2
  ADD COLUMN IF NOT EXISTS cover_image_size TEXT;

COMMENT ON COLUMN user_history_v2.cover_image_size IS 'Image size parameter used for cover generation/editing.';
