-- Add watermark-related fields to user_history table
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS video_url_watermarked TEXT;
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS video_url_clean TEXT;
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS watermark_removed BOOLEAN DEFAULT FALSE;
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS watermark_credits_used INTEGER DEFAULT 0;

-- Update existing records to use the current video_url as watermarked version
UPDATE user_history 
SET video_url_watermarked = video_url 
WHERE video_url IS NOT NULL AND video_url_watermarked IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN user_history.video_url_watermarked IS 'URL for video with watermark (default version)';
COMMENT ON COLUMN user_history.video_url_clean IS 'URL for video without watermark (premium version)';
COMMENT ON COLUMN user_history.watermark_removed IS 'Whether user has paid to remove watermark';
COMMENT ON COLUMN user_history.watermark_credits_used IS 'Credits spent on watermark removal';