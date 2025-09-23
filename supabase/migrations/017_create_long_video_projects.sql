-- Create long video projects table for multi-scene ad generation
CREATE TABLE IF NOT EXISTS long_video_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR NOT NULL,

    -- Input data
    person_image_urls JSONB NOT NULL, -- Array of uploaded person photo URLs
    product_image_urls JSONB NOT NULL, -- Array of uploaded product photo URLs
    video_duration_seconds INTEGER NOT NULL CHECK (video_duration_seconds IN (8, 16, 24)),
    image_model VARCHAR NOT NULL CHECK (image_model IN ('nano_banana', 'seedream')),
    video_model VARCHAR NOT NULL CHECK (video_model IN ('veo3', 'veo3_fast')),

    -- Analysis results (Step 1)
    image_analysis_result JSONB, -- Reuse Multi-Variant image analysis results

    -- Generated prompts (Step 2)
    generated_prompts JSONB, -- Contains Scene 0 (image) and Scene 1+ (video) prompts

    -- Generated content (Steps 3-4)
    generated_image_url TEXT, -- Scene 0 generated image URL
    generated_video_urls JSONB, -- Array of Scene 1+ generated video URLs

    -- Final output (Step 5)
    merged_video_url TEXT, -- Final merged video URL from fal.ai
    fal_merge_task_id TEXT, -- fal.ai merge task ID for polling

    -- Status management
    status VARCHAR DEFAULT 'pending' CHECK (status IN (
        'pending', 'analyzing_images', 'generating_prompts',
        'generating_image', 'generating_videos', 'merging_videos',
        'completed', 'failed'
    )),
    current_step VARCHAR DEFAULT 'analyzing_images' CHECK (current_step IN (
        'analyzing_images', 'generating_prompts', 'generating_image',
        'generating_videos', 'merging_videos', 'completed'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

    -- Task tracking
    kie_image_task_id TEXT, -- KIE image generation task ID
    kie_video_task_ids JSONB, -- Array of KIE video generation task IDs

    -- Credits and downloads
    credits_cost INTEGER NOT NULL,
    downloaded BOOLEAN DEFAULT false,
    download_credits_used INTEGER DEFAULT 0,

    -- Error handling
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create long video scenes table to track individual scene details
CREATE TABLE IF NOT EXISTS long_video_scenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES long_video_projects(id) ON DELETE CASCADE,

    scene_number INTEGER NOT NULL, -- 0=image, 1,2,3=video scenes
    scene_type VARCHAR NOT NULL CHECK (scene_type IN ('image', 'video')),

    -- Prompts
    scene_prompt JSONB NOT NULL,

    -- Generation results
    generated_url TEXT, -- Generated image or video URL
    kie_task_id TEXT, -- Corresponding KIE task ID

    -- Status
    status VARCHAR DEFAULT 'pending' CHECK (status IN (
        'pending', 'generating', 'completed', 'failed'
    )),
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique scene numbers per project
    UNIQUE(project_id, scene_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_long_video_projects_user_id ON long_video_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_long_video_projects_created_at ON long_video_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_long_video_projects_status ON long_video_projects(status);
CREATE INDEX IF NOT EXISTS idx_long_video_projects_current_step ON long_video_projects(current_step);

CREATE INDEX IF NOT EXISTS idx_long_video_scenes_project_id ON long_video_scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_long_video_scenes_scene_number ON long_video_scenes(project_id, scene_number);
CREATE INDEX IF NOT EXISTS idx_long_video_scenes_status ON long_video_scenes(status);

-- Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_long_video_projects_updated_at
    BEFORE UPDATE ON long_video_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_long_video_scenes_updated_at
    BEFORE UPDATE ON long_video_scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE long_video_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_video_scenes ENABLE ROW LEVEL SECURITY;

-- RLS policies for long_video_projects
CREATE POLICY "Users can view own long video projects" ON long_video_projects
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own long video projects" ON long_video_projects
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own long video projects" ON long_video_projects
    FOR UPDATE USING (auth.uid()::text = user_id);

-- RLS policies for long_video_scenes
CREATE POLICY "Users can view own long video scenes" ON long_video_scenes
    FOR SELECT USING (
        auth.uid()::text = (
            SELECT user_id FROM long_video_projects WHERE id = project_id
        )
    );

CREATE POLICY "Users can insert own long video scenes" ON long_video_scenes
    FOR INSERT WITH CHECK (
        auth.uid()::text = (
            SELECT user_id FROM long_video_projects WHERE id = project_id
        )
    );

CREATE POLICY "Users can update own long video scenes" ON long_video_scenes
    FOR UPDATE USING (
        auth.uid()::text = (
            SELECT user_id FROM long_video_projects WHERE id = project_id
        )
    );

-- Add comments for documentation
COMMENT ON TABLE long_video_projects IS 'Long video ad generation projects with multi-scene support';
COMMENT ON COLUMN long_video_projects.person_image_urls IS 'Array of uploaded person photo URLs (JSONB)';
COMMENT ON COLUMN long_video_projects.product_image_urls IS 'Array of uploaded product photo URLs (JSONB)';
COMMENT ON COLUMN long_video_projects.video_duration_seconds IS 'Total video duration: 8s, 16s, or 24s';
COMMENT ON COLUMN long_video_projects.image_analysis_result IS 'AI analysis results from Multi-Variant workflow (JSONB)';
COMMENT ON COLUMN long_video_projects.generated_prompts IS 'All scene prompts: Scene 0 (image) + Scene 1+ (videos) (JSONB)';
COMMENT ON COLUMN long_video_projects.generated_image_url IS 'Scene 0 generated image URL used as reference for videos';
COMMENT ON COLUMN long_video_projects.generated_video_urls IS 'Array of Scene 1+ generated video URLs (JSONB)';
COMMENT ON COLUMN long_video_projects.fal_merge_task_id IS 'fal.ai merge task ID for polling merge status';

COMMENT ON TABLE long_video_scenes IS 'Individual scenes within long video projects';
COMMENT ON COLUMN long_video_scenes.scene_number IS '0=image scene, 1,2,3=video scenes';
COMMENT ON COLUMN long_video_scenes.scene_type IS 'image or video scene type';
COMMENT ON COLUMN long_video_scenes.scene_prompt IS 'Individual scene prompt (JSONB)';