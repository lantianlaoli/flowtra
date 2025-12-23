-- Migration: Add has_purchased flag to user_credits table
-- Created: 2025-12-23
-- Description: Track users who have made at least one purchase
--              All existing users are grandfathered in (marked as purchased)
--              New users after this migration will start with has_purchased = FALSE

-- Step 1: Add has_purchased column (nullable initially, default FALSE for new records)
ALTER TABLE user_credits
ADD COLUMN has_purchased BOOLEAN DEFAULT FALSE;

-- Step 2: Grandfather ALL existing users (anyone with a credit record before this migration)
-- This ensures existing users can continue using the platform without purchasing
UPDATE user_credits
SET has_purchased = TRUE;

-- Step 3: Add index for fast queries on dashboard access check
CREATE INDEX idx_user_credits_has_purchased ON user_credits(has_purchased);

-- Step 4: Add column comment for documentation
COMMENT ON COLUMN user_credits.has_purchased IS 'Tracks if user has made at least one purchase. Grandfathered users (pre-2025-12-23) are marked TRUE. New users start with FALSE and are marked TRUE after first successful purchase via Creem webhook.';
