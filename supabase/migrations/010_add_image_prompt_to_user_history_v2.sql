-- Add image_prompt column to V2 table to store the exact prompt sent to Banana
ALTER TABLE IF EXISTS user_history_v2
  ADD COLUMN IF NOT EXISTS image_prompt TEXT;

COMMENT ON COLUMN user_history_v2.image_prompt IS 'Prompt sent to Banana cover generation for auditing (V2).';

