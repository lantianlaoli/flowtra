-- Remove creem_id field from user_credits table
-- This field is no longer needed as we only use email for payment system association

ALTER TABLE user_credits DROP COLUMN IF EXISTS creem_id;