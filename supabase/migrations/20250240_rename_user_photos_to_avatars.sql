-- Rename user_photos table to user_avatars and add avatar_name column
-- This migration supports the new avatar management feature in dashboard/assets

-- Step 1: Rename the table
ALTER TABLE IF EXISTS public.user_photos RENAME TO user_avatars;

-- Step 2: Add avatar_name column
ALTER TABLE public.user_avatars ADD COLUMN IF NOT EXISTS avatar_name VARCHAR(255);

-- Step 3: Set default names for existing records (format: "Avatar 1", "Avatar 2", etc.)
UPDATE public.user_avatars
SET avatar_name = 'Avatar ' || ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at)
WHERE avatar_name IS NULL;

-- Step 4: Make avatar_name NOT NULL after setting defaults
ALTER TABLE public.user_avatars ALTER COLUMN avatar_name SET NOT NULL;

-- Step 5: Update RLS policies
-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own photos" ON public.user_avatars;
DROP POLICY IF EXISTS "Users can insert their own photos" ON public.user_avatars;
DROP POLICY IF EXISTS "Users can update their own photos" ON public.user_avatars;
DROP POLICY IF EXISTS "Users can delete their own photos" ON public.user_avatars;

-- Recreate policies with new names
CREATE POLICY "Users can view their own avatars"
  ON public.user_avatars FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own avatars"
  ON public.user_avatars FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own avatars"
  ON public.user_avatars FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own avatars"
  ON public.user_avatars FOR DELETE
  USING (auth.uid()::text = user_id);
