-- Create competitor_ads table for storing competitor advertisement references
-- This allows users to reference competitor ads when generating their own advertisements

CREATE TABLE IF NOT EXISTS competitor_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  brand_id UUID NOT NULL REFERENCES user_brands(id) ON DELETE CASCADE,

  -- Basic information
  competitor_name VARCHAR NOT NULL,
  platform VARCHAR NOT NULL, -- 'Facebook', 'Instagram', 'TikTok', 'YouTube', etc.

  -- Advertisement file (image or video)
  ad_file_url TEXT NOT NULL,
  file_type VARCHAR NOT NULL CHECK (file_type IN ('image', 'video')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_competitor_ads_brand_id ON competitor_ads(brand_id);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_user_id ON competitor_ads(user_id);

-- Enable Row Level Security
ALTER TABLE competitor_ads ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own competitor ads"
  ON competitor_ads FOR SELECT
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can insert their own competitor ads"
  ON competitor_ads FOR INSERT
  WITH CHECK (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can update their own competitor ads"
  ON competitor_ads FOR UPDATE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Users can delete their own competitor ads"
  ON competitor_ads FOR DELETE
  USING (user_id = current_setting('request.jwt.claim.sub', true));

-- Add comment to table
COMMENT ON TABLE competitor_ads IS 'Stores competitor advertisement references for each brand, used as templates when generating new ads';
