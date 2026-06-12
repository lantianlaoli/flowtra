-- Enable RLS on user_pets and add standard ownership policies
-- following the same pattern as user_avatars and user_products:
-- auth.jwt() ->> 'sub' = user_id

ALTER TABLE public.user_pets ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can read only their own pets
CREATE POLICY "user_pets_select_own" ON public.user_pets
  FOR SELECT
  USING ((SELECT auth.jwt() ->> 'sub') = user_id);

-- INSERT: Users can create pets for themselves (with_check enforces user_id matches)
CREATE POLICY "user_pets_insert_own" ON public.user_pets
  FOR INSERT
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- UPDATE: Users can update only their own pets
CREATE POLICY "user_pets_update_own" ON public.user_pets
  FOR UPDATE
  USING ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- DELETE: Users can delete only their own pets
CREATE POLICY "user_pets_delete_own" ON public.user_pets
  FOR DELETE
  USING ((SELECT auth.jwt() ->> 'sub') = user_id);
