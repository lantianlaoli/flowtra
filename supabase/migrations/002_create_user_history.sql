-- Create user_history table for tracking video generation history
CREATE TABLE IF NOT EXISTS user_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_image_url TEXT NOT NULL,
    cover_image_url TEXT,
    video_url TEXT,
    product_description TEXT,
    creative_prompts JSONB,
    video_model TEXT NOT NULL DEFAULT 'veo3_fast',
    credits_used INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_created_at ON user_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_history_status ON user_history(status);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_history_updated_at 
    BEFORE UPDATE ON user_history 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE user_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own history
CREATE POLICY "Users can view own history" ON user_history
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can only insert their own history records
CREATE POLICY "Users can insert own history" ON user_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Users can only update their own history records
CREATE POLICY "Users can update own history" ON user_history
    FOR UPDATE USING (auth.uid()::text = user_id);

-- Add check constraint for status values
ALTER TABLE user_history ADD CONSTRAINT check_status 
    CHECK (status IN ('processing', 'completed', 'failed', 'upload_complete', 'description_complete', 'prompts_complete', 'cover_complete'));

-- Add check constraint for video_model values
ALTER TABLE user_history ADD CONSTRAINT check_video_model 
    CHECK (video_model IN ('veo3', 'veo3_fast'));