-- Add columns to distinguish subscription credits from purchased credits
ALTER TABLE user_credits
ADD COLUMN subscription_credits INTEGER NOT NULL DEFAULT 0,
ADD COLUMN purchased_credits INTEGER NOT NULL DEFAULT 0;

-- Migrate all existing credits to purchased_credits (grandfather existing users)
-- This ensures all current users keep their credits as permanent purchased credits
UPDATE user_credits
SET purchased_credits = credits_remaining,
    subscription_credits = 0;

-- Create function to automatically compute total credits
CREATE OR REPLACE FUNCTION compute_total_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically sum subscription_credits + purchased_credits into credits_remaining
  -- This maintains backward compatibility with existing code
  NEW.credits_remaining := NEW.subscription_credits + NEW.purchased_credits;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update credits_remaining on any credit change
CREATE TRIGGER update_credits_remaining
BEFORE INSERT OR UPDATE OF subscription_credits, purchased_credits ON user_credits
FOR EACH ROW
EXECUTE FUNCTION compute_total_credits();

-- Add comments explaining the new columns
COMMENT ON COLUMN user_credits.subscription_credits IS 'Monthly subscription credits that reset each billing cycle';
COMMENT ON COLUMN user_credits.purchased_credits IS 'One-time purchased credits that never expire';
COMMENT ON COLUMN user_credits.credits_remaining IS 'Auto-computed total: subscription_credits + purchased_credits';
