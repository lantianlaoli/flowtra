-- Fix foreign key constraints for selected_product_id across all project tables
-- This migration adds ON DELETE SET NULL behavior to prevent deletion errors
-- when a product is deleted that is referenced by projects

-- 1. Drop existing foreign key constraints
ALTER TABLE standard_ads_projects
DROP CONSTRAINT IF EXISTS standard_ads_projects_selected_product_id_fkey;

ALTER TABLE multi_variant_ads_projects
DROP CONSTRAINT IF EXISTS multi_variant_ads_projects_selected_product_id_fkey;

ALTER TABLE character_ads_projects
DROP CONSTRAINT IF EXISTS character_ads_projects_selected_product_id_fkey;

-- 2. Recreate foreign key constraints with ON DELETE SET NULL
-- This ensures that when a product is deleted, the selected_product_id
-- in all related projects is automatically set to NULL instead of blocking deletion

ALTER TABLE standard_ads_projects
ADD CONSTRAINT standard_ads_projects_selected_product_id_fkey
FOREIGN KEY (selected_product_id)
REFERENCES user_products(id)
ON DELETE SET NULL;

ALTER TABLE multi_variant_ads_projects
ADD CONSTRAINT multi_variant_ads_projects_selected_product_id_fkey
FOREIGN KEY (selected_product_id)
REFERENCES user_products(id)
ON DELETE SET NULL;

ALTER TABLE character_ads_projects
ADD CONSTRAINT character_ads_projects_selected_product_id_fkey
FOREIGN KEY (selected_product_id)
REFERENCES user_products(id)
ON DELETE SET NULL;

-- Add helpful comment documenting the change
COMMENT ON CONSTRAINT standard_ads_projects_selected_product_id_fkey ON standard_ads_projects IS
'Automatically nullifies selected_product_id when referenced product is deleted';

COMMENT ON CONSTRAINT multi_variant_ads_projects_selected_product_id_fkey ON multi_variant_ads_projects IS
'Automatically nullifies selected_product_id when referenced product is deleted';

COMMENT ON CONSTRAINT character_ads_projects_selected_product_id_fkey ON character_ads_projects IS
'Automatically nullifies selected_product_id when referenced product is deleted';
