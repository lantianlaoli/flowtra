-- Create user_subscriptions table to track subscription status and monthly credit allocations
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,

  -- Creem integration fields
  creem_subscription_id TEXT UNIQUE,
  creem_customer_id TEXT,
  creem_product_id TEXT,

  -- Subscription details
  tier TEXT NOT NULL CHECK (tier IN ('lite', 'basic', 'pro')),
  status TEXT NOT NULL DEFAULT 'active',
  monthly_credits INTEGER NOT NULL,
  credits_used_this_cycle INTEGER NOT NULL DEFAULT 0,

  -- Billing cycle tracking
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,

  -- Lifecycle timestamps
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_creem_subscription_id ON user_subscriptions(creem_subscription_id);

-- Add comment explaining the table
COMMENT ON TABLE user_subscriptions IS 'Tracks user subscription status, billing cycles, and monthly credit allocations';
