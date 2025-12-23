-- Remove platform and file storage fields from competitor_ads table
-- Migration created: 2025-12-24
-- Purpose: Simplify competitor ads to store only analysis data, not video files

-- Drop columns that are no longer needed
ALTER TABLE competitor_ads
DROP COLUMN IF EXISTS platform,
DROP COLUMN IF EXISTS ad_file_url,
DROP COLUMN IF EXISTS file_type;

-- Verify that critical columns are preserved
-- The following columns remain intact:
-- - id, user_id, brand_id, competitor_name
-- - analysis_result (jsonb) - contains all valuable AI analysis data
-- - language, analysis_status, analysis_error, analyzed_at
-- - video_duration_seconds, created_at, updated_at

-- Note: All existing competitor_ads records are preserved
-- Only the removed columns' data will be lost
-- Storage files must be manually deleted using cleanup script
