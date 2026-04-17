-- Enable Realtime for Avatar Ads tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'avatar_ads_projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.avatar_ads_projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'avatar_ads_scenes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.avatar_ads_scenes;
  END IF;
END $$;

-- Enable Realtime for Video Clone tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'video_clone_projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_clone_projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'video_clone_segments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.video_clone_segments;
  END IF;
END $$;

-- Enable Realtime for other tables that have realtime subscriptions in the frontend
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'motion_clone_projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.motion_clone_projects;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'creator_source_videos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_source_videos;
  END IF;
END $$;
