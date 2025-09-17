-- Remove watermark guard notes columns from user history tables
ALTER TABLE IF EXISTS user_history
  DROP COLUMN IF EXISTS watermark_guard_notes;

ALTER TABLE IF EXISTS user_history_v2
  DROP COLUMN IF EXISTS watermark_guard_notes;
