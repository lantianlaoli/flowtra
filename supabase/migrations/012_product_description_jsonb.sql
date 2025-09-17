-- Migrate product_description columns to JSONB for structured image analysis storage

-- user_history.product_description: TEXT -> JSONB (preserve existing as JSON string)
ALTER TABLE user_history
  ALTER COLUMN product_description TYPE JSONB
  USING CASE
    WHEN product_description IS NULL THEN NULL
    ELSE to_jsonb(product_description)
  END;

-- user_history_v2.product_description: TEXT -> JSONB (preserve existing as JSON string)
ALTER TABLE user_history_v2
  ALTER COLUMN product_description TYPE JSONB
  USING CASE
    WHEN product_description IS NULL THEN NULL
    ELSE to_jsonb(product_description)
  END;

COMMENT ON COLUMN user_history.product_description IS 'AI-generated description of the product (JSONB)';
COMMENT ON COLUMN user_history_v2.product_description IS 'AI-generated description of the product (JSONB, V2)';

