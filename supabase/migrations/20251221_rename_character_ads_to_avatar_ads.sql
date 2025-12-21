-- Migration: Rename Character Ads to Avatar Ads
-- Created: 2025-12-21
-- Description: Rename database tables and indexes from character_ads to avatar_ads

-- Step 1: Rename tables
ALTER TABLE character_ads_projects RENAME TO avatar_ads_projects;
ALTER TABLE character_ads_scenes RENAME TO avatar_ads_scenes;

-- Step 2: Rename primary key constraints
ALTER INDEX IF EXISTS character_ads_projects_pkey RENAME TO avatar_ads_projects_pkey;
ALTER INDEX IF EXISTS character_ads_scenes_pkey RENAME TO avatar_ads_scenes_pkey;

-- Step 3: Rename other indexes (if they exist)
ALTER INDEX IF EXISTS character_ads_projects_user_id_idx RENAME TO avatar_ads_projects_user_id_idx;
ALTER INDEX IF EXISTS character_ads_projects_created_at_idx RENAME TO avatar_ads_projects_created_at_idx;
ALTER INDEX IF EXISTS character_ads_scenes_project_id_idx RENAME TO avatar_ads_scenes_project_id_idx;

-- Step 4: Add migration metadata comments
COMMENT ON TABLE avatar_ads_projects IS 'Renamed from character_ads_projects on 2025-12-21';
COMMENT ON TABLE avatar_ads_scenes IS 'Renamed from character_ads_scenes on 2025-12-21';

-- Note: PostgreSQL automatically updates foreign key references when renaming tables
