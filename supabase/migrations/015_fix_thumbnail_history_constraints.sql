-- Fix thumbnail_history table constraints for multiple thumbnails per task
-- Remove UNIQUE constraint from task_id to allow multiple thumbnails per task

-- Drop the existing unique constraint on task_id
ALTER TABLE thumbnail_history DROP CONSTRAINT IF EXISTS thumbnail_history_task_id_key;

-- Create a composite index for better query performance
-- This allows multiple records with same task_id but ensures efficient lookups
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_task_user ON thumbnail_history(task_id, user_id);

-- Add comment explaining the change
COMMENT ON TABLE thumbnail_history IS 'YouTube thumbnail generation history for users. Multiple records can share the same task_id when generating multiple thumbnails.';