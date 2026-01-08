---
name: manual-refund
description: Manually refund credits to users for failed projects or other exceptional cases. Use when a user encounters a bug that causes generation failure, or when manual credit adjustment is needed. Triggers on "refund credits", "manual refund", or "give credits back".
allowed-tools: mcp__supabase__execute_sql
---

# Manual Credit Refund

This Skill provides a safe, auditable process for manually refunding credits to users when automated refunds fail or exceptional cases occur.

## When to Use

Use this skill when:
- A project failed due to a bug (e.g., invalid prompts, API errors)
- Automated retry mechanism exhausted all attempts
- User deserves full project refund (not just failed segments)
- Manual credit adjustment needed for customer support

## Pre-Refund Checklist

Before issuing a refund, verify:

1. **Project exists and failed**:
   ```sql
   SELECT id, user_id, status, credits_cost, video_model, video_duration
   FROM competitor_ugc_replication_projects
   WHERE id = '[PROJECT_ID]';
   ```
   OR for Avatar Ads:
   ```sql
   SELECT id, user_id, status, credits_cost
   FROM avatar_ads_projects
   WHERE id = '[PROJECT_ID]';
   ```

2. **Check existing refunds** (avoid double refunds):
   ```sql
   SELECT id, amount, description, created_at
   FROM credit_transactions
   WHERE user_id = '[USER_ID]'
     AND type = 'refund'
     AND history_id = '[PROJECT_ID]'::uuid
   ORDER BY created_at DESC;
   ```

3. **Verify user's current balance**:
   ```sql
   SELECT credits_remaining, subscription_credits, purchased_credits
   FROM user_credits
   WHERE user_id = '[USER_ID]';
   ```

## Refund Process

### Step 1: Determine Refund Amount

**For UGC Clone Projects**:
- Always refund the FULL project cost (not just failed segments)
- Cost = `credits_cost` from project table
- Example: 48s veo3_fast video = 6 segments × 20 = 120 credits

**For Avatar Ads Projects**:
- Refund the full generation cost
- Cost = `credits_cost` from project table

### Step 2: Issue Refund

Execute the refund transaction:

```sql
-- Refund credits (use FULL project cost)
WITH credit_update AS (
  UPDATE user_credits
  SET
    subscription_credits = subscription_credits + [REFUND_AMOUNT],
    credits_remaining = credits_remaining + [REFUND_AMOUNT],
    updated_at = NOW()
  WHERE user_id = '[USER_ID]'
  RETURNING user_id, credits_remaining, subscription_credits
),
transaction_insert AS (
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    history_id,
    created_at
  )
  VALUES (
    '[USER_ID]',
    'refund',
    [REFUND_AMOUNT],
    '[PRODUCT_NAME] - Refund for project [PROJECT_ID]. Reason: [FAILURE_REASON]',
    '[PROJECT_ID]'::uuid,
    NOW()
  )
  RETURNING id, amount, description
)
SELECT
  cu.user_id,
  cu.credits_remaining AS new_balance,
  cu.subscription_credits,
  ti.id AS transaction_id,
  ti.amount AS refunded_amount,
  ti.description
FROM credit_update cu, transaction_insert ti;
```

**Template Variables**:
- `[REFUND_AMOUNT]`: Full project cost (from `credits_cost` field)
- `[USER_ID]`: User's Clerk ID
- `[PRODUCT_NAME]`: "Competitor UGC Replication" or "Avatar Ads"
- `[PROJECT_ID]`: Project UUID
- `[FAILURE_REASON]`: Brief explanation (e.g., "invalid brand name", "KIE API timeout", "segment generation failed")

### Step 3: Verify Refund

Confirm the refund succeeded:
```sql
SELECT
  user_id,
  credits_remaining AS new_balance,
  subscription_credits,
  updated_at
FROM user_credits
WHERE user_id = '[USER_ID]';
```

Expected: `new_balance` increased by refund amount

### Step 4: Report to User

Log the completed refund:
```
✅ REFUND COMPLETED
💰 Amount: {refund_amount} credits
👤 User: {user_id}
🆔 Project: {project_id}
📝 Reason: {failure_reason}
💳 New Balance: {new_balance} credits
📋 Transaction ID: {transaction_id}
```

## Examples

### Example 1: UGC Clone Project - Full Refund (120 Credits)

**Context**: User's 48s video failed due to invalid brand name "."

```sql
-- Refund full project cost (6 segments × 20 = 120 credits)
WITH credit_update AS (
  UPDATE user_credits
  SET
    subscription_credits = subscription_credits + 120,
    credits_remaining = credits_remaining + 120,
    updated_at = NOW()
  WHERE user_id = 'user_37t3Ly2J8jWWNUWS1RaTBvGtSaD'
  RETURNING user_id, credits_remaining, subscription_credits
),
transaction_insert AS (
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    history_id,
    created_at
  )
  VALUES (
    'user_37t3Ly2J8jWWNUWS1RaTBvGtSaD',
    'refund',
    120,
    'Competitor UGC Replication - Refund for project 4029c8ec. Reason: invalid brand name caused prompt generation failure',
    '4029c8ec-2fc8-49c7-ac41-7949d1941a6e'::uuid,
    NOW()
  )
  RETURNING id, amount, description
)
SELECT
  cu.user_id,
  cu.credits_remaining AS new_balance,
  cu.subscription_credits,
  ti.id AS transaction_id,
  ti.amount AS refunded_amount,
  ti.description
FROM credit_update cu, transaction_insert ti;
```

### Example 2: Avatar Ads Project - Partial Failure Refund

**Context**: Video generation failed after successful frame generation

```sql
-- Check project cost first
SELECT credits_cost
FROM avatar_ads_projects
WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
-- Result: 80 credits

-- Issue refund
WITH credit_update AS (
  UPDATE user_credits
  SET
    subscription_credits = subscription_credits + 80,
    credits_remaining = credits_remaining + 80,
    updated_at = NOW()
  WHERE user_id = 'user_xxxxxxxxxxxxxxxxxx'
  RETURNING user_id, credits_remaining, subscription_credits
),
transaction_insert AS (
  INSERT INTO credit_transactions (
    user_id,
    type,
    amount,
    description,
    history_id,
    created_at
  )
  VALUES (
    'user_xxxxxxxxxxxxxxxxxx',
    'refund',
    80,
    'Avatar Ads - Refund for project xxxxxxxx. Reason: video generation timeout after max retries',
    'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid,
    NOW()
  )
  RETURNING id, amount, description
)
SELECT
  cu.user_id,
  cu.credits_remaining AS new_balance,
  cu.subscription_credits,
  ti.id AS transaction_id,
  ti.amount AS refunded_amount,
  ti.description
FROM credit_update cu, transaction_insert ti;
```

## Safety Rules

1. **Never refund twice**: Always check existing refund transactions first
2. **Verify project ownership**: Ensure project belongs to the user
3. **Document reason**: Always include clear failure reason in description
4. **Full project refunds**: Always refund full `credits_cost`, not partial
5. **Audit trail**: Use `history_id` to link refund to original project

## Common Failure Reasons

- Invalid brand name (e.g., single character, empty string)
- KIE API errors (422, 500, 503)
- Timeout after max retries
- Prompt generation failure
- Video merge failure
- Database errors during generation

## Error Handling

If the refund query fails:

1. Check if user exists in `user_credits` table
2. Verify `history_id` is a valid UUID
3. Ensure `credits_remaining` won't overflow (PostgreSQL integer limit)
4. Check database connection and permissions

If double-refund detected:
```
⚠️ REFUND ALREADY EXISTS
User has already been refunded for this project.
Existing refund: {amount} credits on {date}
Transaction ID: {transaction_id}
```

## Notes

- Refunds go to `subscription_credits` (not `purchased_credits`)
- Transaction type must be exactly 'refund' (lowercase)
- `history_id` links to original project for audit trail
- All monetary operations are atomic (credit update + transaction insert)
- Refund descriptions are searchable for support analysis
