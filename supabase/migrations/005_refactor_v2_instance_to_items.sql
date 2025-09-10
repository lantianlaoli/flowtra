-- Refactor V2 schema: remove batch table, fold data into item table, and rename
-- This migration preserves existing instance data and augments it with fields
-- previously stored at the batch level.

-- 1) Add missing columns on workflow_instance_v2 to hold batch-level data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'original_image_url'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN original_image_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'product_description'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN product_description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'video_model'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN video_model TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'last_processed_at'
  ) THEN
    ALTER TABLE workflow_instance_v2 ADD COLUMN last_processed_at TIMESTAMPTZ;
  END IF;
END $$;

-- 2) Backfill newly added columns from workflow_batch_v2 (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_batch_v2'
  ) THEN
    UPDATE workflow_instance_v2 i
      SET original_image_url = COALESCE(i.original_image_url, b.original_image_url),
          product_description = COALESCE(i.product_description, b.product_description),
          updated_at = NOW()
    FROM workflow_batch_v2 b
    WHERE i.batch_id = b.id;
  END IF;
END $$;

-- 3) Drop FK/constraints referencing batch_id if any, then drop batch_id and rename table
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Try to drop any foreign key constraint on batch_id dynamically
  FOR constraint_name IN (
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'workflow_instance_v2'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'batch_id'
  ) LOOP
    EXECUTE format('ALTER TABLE workflow_instance_v2 DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  -- Drop batch_id column if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'workflow_instance_v2' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE workflow_instance_v2 DROP COLUMN batch_id;
  END IF;

  -- Add simple check constraints if missing
  BEGIN
    ALTER TABLE workflow_instance_v2
      ADD CONSTRAINT workflow_instance_v2_status_check
      CHECK (instance_status IN ('pending','generating_cover','generating_video','completed','failed'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE workflow_instance_v2
      ADD CONSTRAINT workflow_instance_v2_step_check
      CHECK (current_step IN ('waiting','generating_cover','generating_video','completed'));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- Rename the table to the new V2 table: user_history_v2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'user_history_v2'
  ) THEN
    ALTER TABLE workflow_instance_v2 RENAME TO user_history_v2;
  END IF;
END $$;

-- 4) Drop the batch table entirely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_batch_v2'
  ) THEN
    DROP TABLE workflow_batch_v2;
  END IF;
END $$;

-- 5) Optional: document columns
COMMENT ON TABLE user_history_v2 IS 'V2 workflow records; each generated variation is a separate record.';
COMMENT ON COLUMN user_history_v2.original_image_url IS 'Original image URL this item was generated from';
COMMENT ON COLUMN user_history_v2.product_description IS 'AI-generated description of the product';
