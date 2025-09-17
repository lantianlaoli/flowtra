-- Add image_prompt column to store Banana prompt for auditing
ALTER TABLE user_history ADD COLUMN IF NOT EXISTS image_prompt TEXT;
COMMENT ON COLUMN user_history.image_prompt IS 'Prompt sent to Banana cover generation for auditing';
