-- Add avatar_gender column to avatar_ads_projects for storing the selected avatar's gender
-- This is used for correct voice type generation (male/female voice)
ALTER TABLE public.avatar_ads_projects
ADD COLUMN IF NOT EXISTS avatar_gender TEXT CHECK (avatar_gender IN ('male', 'female'));
