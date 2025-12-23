-- Create subscription_events table for audit trail of subscription lifecycle events
CREATE TABLE subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  creem_event_id TEXT, -- For deduplication of Creem webhook events
  metadata JSONB, -- Full webhook payload for debugging

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX idx_subscription_events_creem_event_id ON subscription_events(creem_event_id);
CREATE INDEX idx_subscription_events_created_at ON subscription_events(created_at DESC);

-- Add comment explaining the table
COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription lifecycle events (active, paid, canceled, etc.)';
COMMENT ON COLUMN subscription_events.creem_event_id IS 'Creem webhook event ID for deduplication';
