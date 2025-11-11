-- Create user onboarding status table
CREATE TABLE IF NOT EXISTS user_onboarding_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  completed BOOLEAN DEFAULT FALSE,
  current_step INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding_status(user_id);

-- Add RLS policies
ALTER TABLE user_onboarding_status ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own onboarding status
CREATE POLICY "Users can read their own onboarding status"
  ON user_onboarding_status
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Policy: Users can insert their own onboarding status
CREATE POLICY "Users can insert their own onboarding status"
  ON user_onboarding_status
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Policy: Users can update their own onboarding status
CREATE POLICY "Users can update their own onboarding status"
  ON user_onboarding_status
  FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
