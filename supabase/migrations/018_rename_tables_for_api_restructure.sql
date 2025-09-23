-- Rename tables to match new API structure
-- This migration renames tables to be consistent with the new REST API design

-- 1. Rename single_video_projects to standard_ads_projects
ALTER TABLE single_video_projects RENAME TO standard_ads_projects;

-- 2. Rename multi_variant_projects to multi_variant_ads_projects
ALTER TABLE multi_variant_projects RENAME TO multi_variant_ads_projects;

-- 3. Rename long_video_projects to character_ads_projects
ALTER TABLE long_video_projects RENAME TO character_ads_projects;

-- 4. Rename long_video_scenes to character_ads_scenes
ALTER TABLE long_video_scenes RENAME TO character_ads_scenes;

-- Update any indexes that reference the old table names
-- Note: PostgreSQL automatically renames indexes when tables are renamed

-- Update any foreign key constraints if they exist
-- Check if there are any foreign key references that need updating
DO $$
BEGIN
    -- Update foreign key constraint in character_ads_scenes if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'long_video_scenes_project_id_fkey'
        AND table_name = 'character_ads_scenes'
    ) THEN
        ALTER TABLE character_ads_scenes
        DROP CONSTRAINT long_video_scenes_project_id_fkey;

        ALTER TABLE character_ads_scenes
        ADD CONSTRAINT character_ads_scenes_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES character_ads_projects(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add comments to document the table purposes
COMMENT ON TABLE standard_ads_projects IS 'AI-generated standard advertisement projects with automated content creation';
COMMENT ON TABLE multi_variant_ads_projects IS 'Multi-variant advertisement projects with customizable elements based on user assets';
COMMENT ON TABLE character_ads_projects IS 'Character-based advertisement projects featuring virtual presenters introducing products';
COMMENT ON TABLE character_ads_scenes IS 'Individual scenes within character advertisement projects';

-- Log the migration
INSERT INTO _supabase_migrations (version, name)
VALUES ('018', 'rename_tables_for_api_restructure')
ON CONFLICT (version) DO NOTHING;