-- Cleanup script for duplicate thumbnail records
-- This script should be run after applying migration 015

-- First, let's see what duplicate records we have
-- (This is for manual inspection before running the cleanup)

-- Find tasks with multiple records and show counts
SELECT
    task_id,
    user_id,
    COUNT(*) as record_count,
    array_agg(id) as record_ids,
    array_agg(status) as statuses,
    array_agg(credits_cost) as costs
FROM thumbnail_history
GROUP BY task_id, user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- Clean up duplicate records strategy:
-- 1. For each task_id, keep the record with the highest credits_cost (the original)
-- 2. For additional records, keep only completed ones with thumbnail_url
-- 3. Delete failed/processing duplicates that don't have thumbnail_url

-- Step 1: Remove failed/processing duplicates that don't have thumbnails
DELETE FROM thumbnail_history
WHERE id IN (
    SELECT DISTINCT h1.id
    FROM thumbnail_history h1
    WHERE EXISTS (
        SELECT 1
        FROM thumbnail_history h2
        WHERE h2.task_id = h1.task_id
        AND h2.user_id = h1.user_id
        AND h2.id != h1.id
        AND h2.credits_cost > 0  -- Keep the original record with cost
    )
    AND h1.credits_cost = 0  -- Remove duplicates
    AND h1.status IN ('failed', 'processing')  -- Only remove failed/processing
    AND h1.thumbnail_url IS NULL  -- Only remove those without thumbnails
);

-- Step 2: For completed duplicates, ensure they have different thumbnail URLs
-- (We'll keep them if they have valid thumbnails as they represent actual generated images)

-- Optional: Update any remaining duplicate records to have unique identifiers
-- This ensures no future conflicts
UPDATE thumbnail_history
SET updated_at = NOW()
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY task_id, user_id ORDER BY credits_cost DESC, created_at ASC) as rn
        FROM thumbnail_history
    ) ranked
    WHERE rn > 1
);

-- Verify cleanup results
SELECT
    task_id,
    user_id,
    COUNT(*) as remaining_records,
    array_agg(status) as statuses,
    SUM(CASE WHEN thumbnail_url IS NOT NULL THEN 1 ELSE 0 END) as thumbnails_count
FROM thumbnail_history
GROUP BY task_id, user_id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;