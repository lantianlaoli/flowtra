ALTER TABLE public.motion_clone_projects
  ADD COLUMN IF NOT EXISTS video_model text;

ALTER TABLE public.motion_clone_projects
  DROP CONSTRAINT IF EXISTS motion_clone_projects_mode_check;

UPDATE public.motion_clone_projects
SET mode = '720p'
WHERE mode NOT IN ('480p', '720p');

ALTER TABLE public.motion_clone_projects
  ADD CONSTRAINT motion_clone_projects_mode_check
  CHECK (mode = ANY (ARRAY['480p'::text, '720p'::text]));

ALTER TABLE public.motion_clone_projects
  DROP CONSTRAINT IF EXISTS motion_clone_projects_video_model_check;

ALTER TABLE public.motion_clone_projects
  ADD CONSTRAINT motion_clone_projects_video_model_check
  CHECK (
    video_model IS NULL OR
    video_model = ANY (ARRAY['seedance_2_mini'::text, 'seedance_2_fast'::text, 'seedance_2'::text])
  );
