-- Add avatar_name column to avatar_ads_projects for storing the selected avatar's name
-- This is used for @mention token replacement in image prompts
ALTER TABLE public.avatar_ads_projects
ADD COLUMN IF NOT EXISTS avatar_name TEXT;
