-- Migrate image_prompt columns to JSONB for structured storage
-- user_history.image_prompt: TEXT -> JSONB (store existing text as JSON string)
ALTER TABLE user_history
  ALTER COLUMN image_prompt TYPE JSONB
  USING CASE
    WHEN image_prompt IS NULL THEN NULL
    ELSE to_jsonb(image_prompt)
  END;

-- user_history_v2.image_prompt: TEXT -> JSONB (store existing text as JSON string)
ALTER TABLE user_history_v2
  ALTER COLUMN image_prompt TYPE JSONB
  USING CASE
    WHEN image_prompt IS NULL THEN NULL
    ELSE to_jsonb(image_prompt)
  END;

COMMENT ON COLUMN user_history.image_prompt IS 'Prompt sent to Banana cover generation for auditing (JSONB).';
COMMENT ON COLUMN user_history_v2.image_prompt IS 'Prompt sent to Banana cover generation for auditing (V2, JSONB).';

