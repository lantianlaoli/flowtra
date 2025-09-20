-- Add processed_by field to thumbnail_history table to track processing method
-- This prevents webhook and polling conflicts

-- Add the processed_by column
ALTER TABLE thumbnail_history
ADD COLUMN processed_by TEXT;

-- Add check constraint for valid values
ALTER TABLE thumbnail_history
ADD CONSTRAINT check_processed_by
CHECK (processed_by IN ('webhook', 'polling') OR processed_by IS NULL);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_processed_by
ON thumbnail_history(processed_by);

-- Add comment explaining the field
COMMENT ON COLUMN thumbnail_history.processed_by IS 'Tracks whether the record was processed by webhook or polling to prevent conflicts';