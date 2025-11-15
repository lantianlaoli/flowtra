-- Add competitor_ad_id field to standard_ads_projects table
-- This allows tracking which competitor ad was used as reference for generation

ALTER TABLE standard_ads_projects
ADD COLUMN IF NOT EXISTS competitor_ad_id UUID REFERENCES competitor_ads(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_standard_ads_projects_competitor_ad_id
ON standard_ads_projects(competitor_ad_id);

-- Add comment
COMMENT ON COLUMN standard_ads_projects.competitor_ad_id IS 'Reference to the competitor ad used as creative inspiration for this project';
