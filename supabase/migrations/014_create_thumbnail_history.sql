-- Create thumbnail_history table for YouTube thumbnail generation
CREATE TABLE IF NOT EXISTS thumbnail_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL UNIQUE,
    identity_image_url TEXT NOT NULL,
    title TEXT NOT NULL,
    thumbnail_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    credits_cost INTEGER NOT NULL DEFAULT 5,
    downloaded BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_user_id ON thumbnail_history(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_task_id ON thumbnail_history(task_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_created_at ON thumbnail_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thumbnail_history_status ON thumbnail_history(status);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_thumbnail_history_updated_at
    BEFORE UPDATE ON thumbnail_history
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE thumbnail_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own thumbnail history
CREATE POLICY "Users can view own thumbnail history" ON thumbnail_history
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can only insert their own thumbnail records
CREATE POLICY "Users can insert own thumbnail records" ON thumbnail_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own thumbnail records
CREATE POLICY "Users can update own thumbnail records" ON thumbnail_history
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Add check constraint for status values
ALTER TABLE thumbnail_history ADD CONSTRAINT check_thumbnail_status
    CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Add comment for documentation
COMMENT ON TABLE thumbnail_history IS 'YouTube thumbnail generation history for users';
COMMENT ON COLUMN thumbnail_history.task_id IS 'KIE API task ID returned from seedream generation request';
COMMENT ON COLUMN thumbnail_history.identity_image_url IS 'User uploaded identity photo URL in images/identity folder';
COMMENT ON COLUMN thumbnail_history.thumbnail_url IS 'Generated thumbnail URL in images/thumbnails folder';
COMMENT ON COLUMN thumbnail_history.credits_cost IS 'Credits consumed for thumbnail generation (default: 5)';