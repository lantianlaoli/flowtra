-- Add video_generation_approved column to track user approval for video generation
ALTER TABLE IF EXISTS public.competitor_ugc_replication_segments
  ADD COLUMN IF NOT EXISTS video_generation_approved boolean DEFAULT false;
