---
name: manual-refund
description: Manually refund credits for failed projects. Use when the user says refund credits, manual refund, or give credits back, or when automated refunds fail.
---

# Manual Credit Refund

Use this to issue a safe, auditable refund.

## Pre-checks

1) Verify project and status:

```sql
SELECT id, user_id, status, credits_cost, video_model, video_duration
FROM competitor_ugc_replication_projects
WHERE id = '[PROJECT_ID]';
```

Or for Avatar Ads:

```sql
SELECT id, user_id, status, credits_cost
FROM avatar_ads_projects
WHERE id = '[PROJECT_ID]';
```

2) Check existing refunds:

```sql
SELECT id, amount, description, created_at
FROM credit_transactions
WHERE user_id = '[USER_ID]'
  AND type = 'refund'
  AND history_id = '[PROJECT_ID]'::uuid
ORDER BY created_at DESC;
```

3) Verify current balance:

```sql
SELECT credits_remaining, subscription_credits, purchased_credits
FROM user_credits
WHERE user_id = '[USER_ID]';
```

## Refund transaction

Always refund the full `credits_cost` for the project.

```sql
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

## Post-check

```sql
SELECT user_id, credits_remaining AS new_balance, subscription_credits, updated_at
FROM user_credits
WHERE user_id = '[USER_ID]';
```

## Reporting format

```
✅ REFUND COMPLETED
💰 Amount: {refund_amount} credits
👤 User: {user_id}
🆔 Project: {project_id}
📝 Reason: {failure_reason}
💳 New Balance: {new_balance} credits
📋 Transaction ID: {transaction_id}
```

## Safety rules

- Never refund twice; stop if a prior refund exists.
- Verify project belongs to the user.
- Use `history_id` for auditability.
- Refund to `subscription_credits` only.
