-- Create credit_transactions table for tracking credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('usage', 'purchase', 'refund')),
    amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    history_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- Create index for faster time-based queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid()::text = user_id);

-- Users can only insert their own transactions
CREATE POLICY "Users can insert own transactions" ON credit_transactions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);