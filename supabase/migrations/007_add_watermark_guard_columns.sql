ALTER TABLE user_history
  ADD COLUMN IF NOT EXISTS watermark_text TEXT,
  ADD COLUMN IF NOT EXISTS watermark_location TEXT,
  ADD COLUMN IF NOT EXISTS watermark_guard_notes TEXT;

COMMENT ON COLUMN user_history.watermark_text IS 'Exact watermark text expected on generated creatives.';
COMMENT ON COLUMN user_history.watermark_location IS 'Preferred placement of the watermark on generated creatives.';
COMMENT ON COLUMN user_history.watermark_guard_notes IS 'Latest notes from watermark verification / repair pipeline.';

ALTER TABLE user_history_v2
  ADD COLUMN IF NOT EXISTS watermark_text TEXT,
  ADD COLUMN IF NOT EXISTS watermark_location TEXT,
  ADD COLUMN IF NOT EXISTS watermark_guard_notes TEXT;

COMMENT ON COLUMN user_history_v2.watermark_text IS 'Exact watermark text expected on generated creatives.';
COMMENT ON COLUMN user_history_v2.watermark_location IS 'Preferred placement of the watermark on generated creatives.';
COMMENT ON COLUMN user_history_v2.watermark_guard_notes IS 'Latest notes from watermark verification / repair pipeline.';
