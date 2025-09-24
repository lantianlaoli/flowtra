-- Add missing fields to multi_variant_ads_projects table
ALTER TABLE multi_variant_ads_projects 
ADD COLUMN IF NOT EXISTS image_analysis_result JSONB,
ADD COLUMN IF NOT EXISTS elements_data JSONB,
ADD COLUMN IF NOT EXISTS cover_prompt JSONB;

-- Update comment to reflect the new fields
COMMENT ON TABLE multi_variant_ads_projects IS 'Multi-variant advertisement projects with customizable elements based on user assets, including image analysis, elements data, and cover prompt';