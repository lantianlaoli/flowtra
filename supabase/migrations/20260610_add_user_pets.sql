CREATE TABLE IF NOT EXISTS public.user_pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  pet_name varchar(255) NOT NULL,
  front_photo_url text NOT NULL,
  front_file_name varchar(255) NOT NULL,
  front_storage_bucket text,
  front_storage_path text,
  side_photo_url text NOT NULL,
  side_file_name varchar(255) NOT NULL,
  side_storage_bucket text,
  side_storage_path text,
  back_photo_url text NOT NULL,
  back_file_name varchar(255) NOT NULL,
  back_storage_bucket text,
  back_storage_path text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_pets_user_active_created
  ON public.user_pets (user_id, is_active, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_user_pets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_pets_updated_at ON public.user_pets;
CREATE TRIGGER trg_user_pets_updated_at
  BEFORE UPDATE ON public.user_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_pets_updated_at();
