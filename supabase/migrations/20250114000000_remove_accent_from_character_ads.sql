-- Migration: Remove accent field from character_ads_projects table
-- Date: 2025-01-14
-- Description: Complete removal of voice accent configuration in favor of language-based voice styling
-- Related: Character Ads workflow refactoring - Language-only system

-- Remove the accent column from character_ads_projects table
-- This is a breaking change - all historical accent data will be permanently lost
ALTER TABLE character_ads_projects
DROP COLUMN IF EXISTS accent;

-- Add comment to table to document the change
COMMENT ON TABLE character_ads_projects IS
'Character-based advertisement projects (Voice accent removed 2025-01-14, replaced with language-based voice styling)';

-- Add comment to language column to clarify its expanded role
COMMENT ON COLUMN character_ads_projects.language IS
'Language code for video voiceover and voice styling (e.g. en, es, fr, de, it, pt, etc.). Voice accent is automatically determined based on language.';
