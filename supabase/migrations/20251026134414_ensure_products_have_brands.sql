-- Migration: Ensure all products have associated brands
-- For products without a brand, create a default brand for the user

-- Step 1: Create default brands for users who have products without brands
INSERT INTO user_brands (user_id, brand_name, brand_logo_url, brand_slogan)
SELECT DISTINCT
  p.user_id,
  'My Brand' AS brand_name,
  '' AS brand_logo_url,
  'Quality Products' AS brand_slogan
FROM user_products p
LEFT JOIN user_brands b ON p.user_id = b.user_id
WHERE p.brand_id IS NULL
  AND b.id IS NULL
ON CONFLICT DO NOTHING;

-- Step 2: Associate products without brands to their user's default brand
-- (We use the first brand created for each user as the default)
UPDATE user_products p
SET brand_id = (
  SELECT id
  FROM user_brands b
  WHERE b.user_id = p.user_id
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE p.brand_id IS NULL;

-- Step 3: Add index for performance (if not already exists)
CREATE INDEX IF NOT EXISTS idx_user_products_brand_id ON user_products(brand_id);

-- Step 4: Add comment to document the brand requirement
COMMENT ON COLUMN user_products.brand_id IS 'Brand ID - All products must be associated with a brand. Default brands are created automatically for existing products.';
