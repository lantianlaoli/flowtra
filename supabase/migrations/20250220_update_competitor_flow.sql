-- Remove deprecated product + watermark fields and add manual video trigger flag
ALTER TABLE IF EXISTS public.competitor_ugc_replication_projects
  DROP COLUMN IF EXISTS selected_product_id,
  DROP COLUMN IF EXISTS watermark_text,
  DROP COLUMN IF EXISTS watermark_location;

ALTER TABLE IF EXISTS public.competitor_ugc_replication_projects
  ADD COLUMN IF NOT EXISTS video_generation_requested boolean DEFAULT false;
