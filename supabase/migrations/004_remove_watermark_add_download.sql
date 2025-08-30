-- Remove watermark-related fields and add download-related fields
ALTER TABLE user_history DROP COLUMN IF EXISTS video_url_watermarked;
ALTER TABLE user_history DROP COLUMN IF EXISTS video_url_clean;
ALTER TABLE user_history DROP COLUMN IF EXISTS watermark_removed;
ALTER TABLE user_history DROP COLUMN IF EXISTS watermark_credits_used;

-- Add download-related fields
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS downloaded BOOLEAN DEFAULT FALSE;
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS download_credits_used INTEGER DEFAULT 0;
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS generation_credits_used INTEGER DEFAULT 0;

-- Update existing records: split credits into generation (40%) and download (60%)
UPDATE user_history 
SET generation_credits_used = ROUND(credits_used * 0.4),
    download_credits_used = 0
WHERE generation_credits_used = 0;

-- Add comments for clarity
COMMENT ON COLUMN user_history.downloaded IS 'Whether user has downloaded the video';
COMMENT ON COLUMN user_history.download_credits_used IS 'Credits used for downloading (60% of total)';
COMMENT ON COLUMN user_history.generation_credits_used IS 'Credits used for generation (40% of total)';