-- Add video_aspect_ratio column to all video generation tables
-- Supports 16:9 (landscape) and 9:16 (portrait) formats

-- Add to standard_ads_projects table
ALTER TABLE standard_ads_projects
ADD COLUMN IF NOT EXISTS video_aspect_ratio VARCHAR(10) DEFAULT '16:9';

-- Add to multi_variant_ads_projects table
ALTER TABLE multi_variant_ads_projects
ADD COLUMN IF NOT EXISTS video_aspect_ratio VARCHAR(10) DEFAULT '16:9';

-- Add to character_ads_projects table
ALTER TABLE character_ads_projects
ADD COLUMN IF NOT EXISTS video_aspect_ratio VARCHAR(10) DEFAULT '16:9';

-- Add check constraint to ensure valid values
ALTER TABLE standard_ads_projects
ADD CONSTRAINT IF NOT EXISTS standard_ads_video_aspect_ratio_check
CHECK (video_aspect_ratio IN ('16:9', '9:16'));

ALTER TABLE multi_variant_ads_projects
ADD CONSTRAINT IF NOT EXISTS multi_variant_ads_video_aspect_ratio_check
CHECK (video_aspect_ratio IN ('16:9', '9:16'));

ALTER TABLE character_ads_projects
ADD CONSTRAINT IF NOT EXISTS character_ads_video_aspect_ratio_check
CHECK (video_aspect_ratio IN ('16:9', '9:16'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_standard_ads_video_aspect_ratio ON standard_ads_projects(video_aspect_ratio);
CREATE INDEX IF NOT EXISTS idx_multi_variant_ads_video_aspect_ratio ON multi_variant_ads_projects(video_aspect_ratio);
CREATE INDEX IF NOT EXISTS idx_character_ads_video_aspect_ratio ON character_ads_projects(video_aspect_ratio);