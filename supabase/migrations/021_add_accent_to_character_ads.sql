-- Add accent field to character_ads_projects table
-- This migration adds a voice accent selection field for character-based advertisements

-- Add accent column to character_ads_projects
ALTER TABLE character_ads_projects
ADD COLUMN accent VARCHAR(20) DEFAULT 'australian'
CHECK (accent IN ('australian', 'american', 'british', 'canadian', 'irish', 'south_african'));

-- Update existing records to have the default accent
UPDATE character_ads_projects
SET accent = 'australian'
WHERE accent IS NULL;

-- Make accent column NOT NULL now that all records have a value
ALTER TABLE character_ads_projects
ALTER COLUMN accent SET NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN character_ads_projects.accent IS 'Voice accent for character speech generation (australian, american, british, canadian, irish, south_african)';

-- Log the migration
INSERT INTO _supabase_migrations (version, name)
VALUES ('021', 'add_accent_to_character_ads')
ON CONFLICT (version) DO NOTHING;