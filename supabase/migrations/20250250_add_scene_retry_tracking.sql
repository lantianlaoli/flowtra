-- Add retry tracking columns to character_ads_scenes table for handling server errors
-- Migration: 20250250_add_scene_retry_tracking
-- Purpose: Enable scene-level retry mechanism with exponential backoff for server errors (failCode: 500)

ALTER TABLE public.character_ads_scenes
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_code TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.character_ads_scenes.retry_count IS 'Number of automatic retries for server errors (failCode: 500, successFlag: 3). Max 3 retries.';
COMMENT ON COLUMN public.character_ads_scenes.last_retry_at IS 'Timestamp of last retry attempt for exponential backoff calculation';
COMMENT ON COLUMN public.character_ads_scenes.error_code IS 'KIE API error code (e.g., 500) for debugging';
COMMENT ON COLUMN public.character_ads_scenes.error_message IS 'Last error message from KIE API';

-- Create index for efficient querying of retry candidates
CREATE INDEX IF NOT EXISTS idx_character_ads_scenes_retry_lookup
ON public.character_ads_scenes(project_id, status, retry_count)
WHERE status = 'generating';
