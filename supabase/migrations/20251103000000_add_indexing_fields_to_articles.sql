-- Add Google Indexing API tracking fields to articles table

-- Add indexed_at field to track when article was last successfully indexed
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

-- Add indexing_status field to track current indexing state
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS indexing_status text DEFAULT 'pending';

-- Add indexing_error field to store error messages if indexing fails
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS indexing_error text;

-- Add indexing_attempts field to track retry attempts
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS indexing_attempts integer DEFAULT 0;

-- Add check constraint for valid status values
ALTER TABLE articles
ADD CONSTRAINT articles_indexing_status_check
CHECK (indexing_status IN ('pending', 'success', 'failed'));

-- Add comments for documentation
COMMENT ON COLUMN articles.indexed_at IS 'Timestamp when article was last successfully indexed by Google';
COMMENT ON COLUMN articles.indexing_status IS 'Current indexing status: pending, success, or failed';
COMMENT ON COLUMN articles.indexing_error IS 'Error message if indexing failed';
COMMENT ON COLUMN articles.indexing_attempts IS 'Number of indexing attempts (max 3 retries)';

-- Create index for efficient querying of unindexed articles
CREATE INDEX IF NOT EXISTS idx_articles_indexing_status
ON articles(indexing_status, indexing_attempts)
WHERE indexing_status IN ('pending', 'failed') AND indexing_attempts < 3;
