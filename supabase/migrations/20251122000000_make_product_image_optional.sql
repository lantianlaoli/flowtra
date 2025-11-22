-- Make product image optional in standard_ads_projects
-- This allows brand-only mode where Text-to-Image is used for product shots

ALTER TABLE standard_ads_projects
ALTER COLUMN original_image_url DROP NOT NULL;

COMMENT ON COLUMN standard_ads_projects.original_image_url IS
'Product image URL - optional when using brand-only mode with Text-to-Image generation';
