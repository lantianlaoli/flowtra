-- Extend standard_ads_projects for segmented workflows
ALTER TABLE standard_ads_projects
ADD COLUMN IF NOT EXISTS is_segmented boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS segment_count integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS segment_duration_seconds integer,
ADD COLUMN IF NOT EXISTS segment_plan jsonb,
ADD COLUMN IF NOT EXISTS segment_status jsonb,
ADD COLUMN IF NOT EXISTS merged_video_url text,
ADD COLUMN IF NOT EXISTS fal_merge_task_id text;

COMMENT ON COLUMN standard_ads_projects.is_segmented IS 'Whether the Standard Ads project uses multi-segment generation';
COMMENT ON COLUMN standard_ads_projects.segment_count IS 'Total number of 8-second segments targeted for this project';
COMMENT ON COLUMN standard_ads_projects.segment_duration_seconds IS 'Duration per segment in seconds (default 8)';
COMMENT ON COLUMN standard_ads_projects.segment_plan IS 'Serialized per-segment plan generated from AI prompts';
COMMENT ON COLUMN standard_ads_projects.segment_status IS 'Aggregated status payload for each segment';
COMMENT ON COLUMN standard_ads_projects.merged_video_url IS 'Final merged video URL for segmented workflows';
COMMENT ON COLUMN standard_ads_projects.fal_merge_task_id IS 'fal.ai merge job identifier for segmented workflows';

-- Create per-segment tracking table
CREATE TABLE IF NOT EXISTS standard_ads_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES standard_ads_projects(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending_first_frame',
  prompt jsonb,
  first_frame_task_id text,
  first_frame_url text,
  closing_frame_task_id text,
  closing_frame_url text,
  video_task_id text,
  video_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_standard_ads_segments_project_segment
  ON standard_ads_segments(project_id, segment_index);

CREATE INDEX IF NOT EXISTS idx_standard_ads_segments_first_frame_task
  ON standard_ads_segments(first_frame_task_id)
  WHERE first_frame_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_standard_ads_segments_closing_frame_task
  ON standard_ads_segments(closing_frame_task_id)
  WHERE closing_frame_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_standard_ads_segments_video_task
  ON standard_ads_segments(video_task_id)
  WHERE video_task_id IS NOT NULL;

COMMENT ON TABLE standard_ads_segments IS 'Tracks generation state for each 8-second Standard Ads segment';
COMMENT ON COLUMN standard_ads_segments.segment_index IS 'Zero-based index of the segment within the project';
COMMENT ON COLUMN standard_ads_segments.prompt IS 'JSON payload describing this segment''s narrative and visuals';
COMMENT ON COLUMN standard_ads_segments.status IS 'Segment lifecycle status (pending_first_frame, generating_video, completed, etc.)';
