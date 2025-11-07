-- Add URL Inspection API verification fields to articles table
-- This migration adds fields for tracking actual Google indexing status verification

-- 1. Add new verification fields
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS indexing_verified_at timestamptz,
ADD COLUMN IF NOT EXISTS actual_indexing_state text;

-- 2. Update constraint to include new verification statuses
ALTER TABLE articles
DROP CONSTRAINT IF EXISTS articles_indexing_status_check;

ALTER TABLE articles
ADD CONSTRAINT articles_indexing_status_check
CHECK (indexing_status IN ('pending', 'submitted', 'failed', 'verified_indexed', 'verified_not_indexed'));

-- 3. Update any existing 'success' status to 'submitted' (if any remain)
UPDATE articles
SET indexing_status = 'submitted'
WHERE indexing_status = 'success';

-- 4. Create index for efficient verification queries
CREATE INDEX IF NOT EXISTS idx_articles_verification_lookup
ON articles(indexing_status, indexing_verified_at, indexed_at)
WHERE indexing_status = 'submitted' AND indexing_verified_at IS NULL;

-- 5. Add comments for documentation
COMMENT ON COLUMN articles.indexing_verified_at IS 'Timestamp when indexing was verified via URL Inspection API';
COMMENT ON COLUMN articles.actual_indexing_state IS 'Actual indexing state from Google Search Console (coverageState)';
