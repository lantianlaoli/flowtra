-- Create user_brands table for brand management
CREATE TABLE user_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  brand_name VARCHAR NOT NULL,
  brand_logo_url TEXT NOT NULL,
  brand_slogan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies for user_brands
ALTER TABLE user_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brands"
  ON user_brands FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own brands"
  ON user_brands FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own brands"
  ON user_brands FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own brands"
  ON user_brands FOR DELETE
  USING (auth.uid()::text = user_id);

-- Add brand_id to user_products table
ALTER TABLE user_products
ADD COLUMN brand_id UUID REFERENCES user_brands(id) ON DELETE SET NULL;

-- Add brand-related fields to standard_ads_projects table
ALTER TABLE standard_ads_projects
ADD COLUMN selected_brand_id UUID REFERENCES user_brands(id) ON DELETE SET NULL,
ADD COLUMN brand_ending_frame_url TEXT,
ADD COLUMN brand_ending_task_id TEXT;

-- Add index for performance
CREATE INDEX idx_user_brands_user_id ON user_brands(user_id);
CREATE INDEX idx_user_products_brand_id ON user_products(brand_id);
CREATE INDEX idx_standard_ads_projects_brand_id ON standard_ads_projects(selected_brand_id);
