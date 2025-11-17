-- Add competitor ad analysis fields
-- This migration adds support for automatic AI analysis of competitor ads with language detection

-- Add analysis result storage (10 Veo elements + scene details)
ALTER TABLE competitor_ads
ADD COLUMN analysis_result JSONB;

-- Add detected language (short code: 'en', 'zh', 'es', etc.)
ALTER TABLE competitor_ads
ADD COLUMN language VARCHAR(10);

-- Add analysis status tracking
ALTER TABLE competitor_ads
ADD COLUMN analysis_status VARCHAR(20) DEFAULT 'pending'
  CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));

-- Add analysis error message storage
ALTER TABLE competitor_ads
ADD COLUMN analysis_error TEXT;

-- Add analysis completion timestamp
ALTER TABLE competitor_ads
ADD COLUMN analyzed_at TIMESTAMPTZ;

-- Add index for filtering by analysis status
CREATE INDEX IF NOT EXISTS idx_competitor_ads_analysis_status
  ON competitor_ads(analysis_status);

-- Add index for filtering by language
CREATE INDEX IF NOT EXISTS idx_competitor_ads_language
  ON competitor_ads(language);

-- Add comment
COMMENT ON COLUMN competitor_ads.analysis_result IS 'AI-generated analysis of the competitor ad (10 Veo elements: subject, context, action, style, camera_motion, composition, ambiance, audio, scene_elements, first_frame_composition)';
COMMENT ON COLUMN competitor_ads.language IS 'Detected language short code (e.g., en, zh, es, fr) matching LanguageCode type';
COMMENT ON COLUMN competitor_ads.analysis_status IS 'Analysis workflow status: pending → analyzing → completed/failed';
COMMENT ON COLUMN competitor_ads.analysis_error IS 'Error message if analysis failed (null if successful)';
COMMENT ON COLUMN competitor_ads.analyzed_at IS 'Timestamp when analysis completed successfully';
