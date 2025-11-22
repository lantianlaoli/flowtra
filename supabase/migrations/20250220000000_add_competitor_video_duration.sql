-- Add video duration metadata to competitor ads so multi-shot analysis can surface runtime info
ALTER TABLE competitor_ads
ADD COLUMN IF NOT EXISTS video_duration_seconds INTEGER;

COMMENT ON COLUMN competitor_ads.video_duration_seconds IS 'Total duration of the analyzed competitor video in seconds';
