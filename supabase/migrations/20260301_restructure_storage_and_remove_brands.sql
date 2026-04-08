begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('site-assets', 'site-assets', true, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4']),
  ('user-images', 'user-images', true, 20971520, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('user-videos', 'user-videos', true, 524288000, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('temp-uploads', 'temp-uploads', true, 524288000, array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.user_avatars
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

alter table public.user_product_photos
  add column if not exists storage_bucket text,
  add column if not exists storage_path text;

alter table public.creator_source_videos
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists cover_storage_bucket text,
  add column if not exists cover_storage_path text;

alter table public.reference_videos
  add column if not exists source_storage_bucket text,
  add column if not exists source_storage_path text;

update public.user_avatars
set
  storage_bucket = coalesce(
    storage_bucket,
    nullif(regexp_replace(photo_url, '^.*?/storage/v1/object/public/([^/]+)/.*$', '\1'), photo_url)
  ),
  storage_path = coalesce(
    storage_path,
    nullif(regexp_replace(photo_url, '^.*?/storage/v1/object/public/[^/]+/(.*)$', '\1'), photo_url)
  )
where photo_url like '%/storage/v1/object/public/%';

update public.user_product_photos
set
  storage_bucket = coalesce(
    storage_bucket,
    nullif(regexp_replace(photo_url, '^.*?/storage/v1/object/public/([^/]+)/.*$', '\1'), photo_url)
  ),
  storage_path = coalesce(
    storage_path,
    nullif(regexp_replace(photo_url, '^.*?/storage/v1/object/public/[^/]+/(.*)$', '\1'), photo_url)
  )
where photo_url like '%/storage/v1/object/public/%';

update public.creator_source_videos
set
  storage_bucket = coalesce(
    storage_bucket,
    nullif(regexp_replace(video_url, '^.*?/storage/v1/object/public/([^/]+)/.*$', '\1'), video_url)
  ),
  storage_path = coalesce(
    storage_path,
    nullif(regexp_replace(video_url, '^.*?/storage/v1/object/public/[^/]+/(.*)$', '\1'), video_url)
  ),
  cover_storage_bucket = coalesce(
    cover_storage_bucket,
    case
      when cover_url like '%/storage/v1/object/public/%'
        then nullif(regexp_replace(cover_url, '^.*?/storage/v1/object/public/([^/]+)/.*$', '\1'), cover_url)
      else null
    end
  ),
  cover_storage_path = coalesce(
    cover_storage_path,
    case
      when cover_url like '%/storage/v1/object/public/%'
        then nullif(regexp_replace(cover_url, '^.*?/storage/v1/object/public/[^/]+/(.*)$', '\1'), cover_url)
      else null
    end
  )
where video_url like '%/storage/v1/object/public/%'
   or cover_url like '%/storage/v1/object/public/%';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'reference_videos'
      and constraint_name = 'reference_videos_brand_id_fkey'
  ) then
    alter table public.reference_videos drop constraint reference_videos_brand_id_fkey;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'video_clone_projects'
      and constraint_name = 'standard_ads_projects_selected_brand_id_fkey'
  ) then
    alter table public.video_clone_projects drop constraint standard_ads_projects_selected_brand_id_fkey;
  end if;

  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'user_products'
      and constraint_name = 'user_products_brand_id_fkey'
  ) then
    alter table public.user_products drop constraint user_products_brand_id_fkey;
  end if;
end $$;

drop index if exists public.idx_reference_videos_brand_id;
drop index if exists public.idx_standard_ads_projects_brand_id;
drop index if exists public.idx_user_products_brand_id;

alter table public.reference_videos
  drop column if exists brand_id;

alter table public.video_clone_projects
  drop column if exists selected_brand_id;

alter table public.user_products
  drop column if exists brand_id;

drop table if exists public.user_brands;

commit;
