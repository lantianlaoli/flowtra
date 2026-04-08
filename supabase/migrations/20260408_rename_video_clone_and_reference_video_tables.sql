-- Schema verified via Supabase MCP (2026-04-08):
-- public.competitor_ugc_replication_projects
-- public.competitor_ugc_replication_segments
-- public.competitor_ads

alter table public.competitor_ads rename to reference_videos;
alter table public.reference_videos
  rename constraint competitor_ads_pkey to reference_videos_pkey;
alter table public.reference_videos
  rename column competitor_name to reference_name;

alter table public.competitor_ugc_replication_projects rename to video_clone_projects;
alter table public.video_clone_projects
  rename constraint competitor_ugc_replication_projects_pkey to video_clone_projects_pkey;
alter table public.video_clone_projects
  rename column competitor_ad_id to reference_video_id;

alter table public.competitor_ugc_replication_segments rename to video_clone_segments;
alter table public.video_clone_segments
  rename constraint competitor_ugc_replication_segments_pkey to video_clone_segments_pkey;
alter table public.video_clone_segments
  rename constraint competitor_ugc_replication_segments_project_id_fkey to video_clone_segments_project_id_fkey;

do $$
begin
  if exists (
    select 1
    from pg_class
    where relkind = 'i'
      and relname = 'competitor_ugc_replication_projects_user_id_idx'
  ) then
    alter index public.competitor_ugc_replication_projects_user_id_idx
      rename to video_clone_projects_user_id_idx;
  end if;

  if exists (
    select 1
    from pg_class
    where relkind = 'i'
      and relname = 'competitor_ads_user_id_idx'
  ) then
    alter index public.competitor_ads_user_id_idx
      rename to reference_videos_user_id_idx;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_videos'
      and policyname = 'competitor_ads_select_own'
  ) then
    alter policy "competitor_ads_select_own" on public.reference_videos
      rename to "reference_videos_select_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_videos'
      and policyname = 'competitor_ads_insert_own'
  ) then
    alter policy "competitor_ads_insert_own" on public.reference_videos
      rename to "reference_videos_insert_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_videos'
      and policyname = 'competitor_ads_update_own'
  ) then
    alter policy "competitor_ads_update_own" on public.reference_videos
      rename to "reference_videos_update_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reference_videos'
      and policyname = 'competitor_ads_delete_own'
  ) then
    alter policy "competitor_ads_delete_own" on public.reference_videos
      rename to "reference_videos_delete_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_projects'
      and policyname = 'competitor_ugc_replication_projects_select_own'
  ) then
    alter policy "competitor_ugc_replication_projects_select_own" on public.video_clone_projects
      rename to "video_clone_projects_select_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_projects'
      and policyname = 'competitor_ugc_replication_projects_insert_own'
  ) then
    alter policy "competitor_ugc_replication_projects_insert_own" on public.video_clone_projects
      rename to "video_clone_projects_insert_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_projects'
      and policyname = 'competitor_ugc_replication_projects_update_own'
  ) then
    alter policy "competitor_ugc_replication_projects_update_own" on public.video_clone_projects
      rename to "video_clone_projects_update_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_projects'
      and policyname = 'competitor_ugc_replication_projects_delete_own'
  ) then
    alter policy "competitor_ugc_replication_projects_delete_own" on public.video_clone_projects
      rename to "video_clone_projects_delete_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_segments'
      and policyname = 'competitor_ugc_replication_segments_select_own'
  ) then
    alter policy "competitor_ugc_replication_segments_select_own" on public.video_clone_segments
      rename to "video_clone_segments_select_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_segments'
      and policyname = 'competitor_ugc_replication_segments_insert_own'
  ) then
    alter policy "competitor_ugc_replication_segments_insert_own" on public.video_clone_segments
      rename to "video_clone_segments_insert_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_segments'
      and policyname = 'competitor_ugc_replication_segments_update_own'
  ) then
    alter policy "competitor_ugc_replication_segments_update_own" on public.video_clone_segments
      rename to "video_clone_segments_update_own";
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'video_clone_segments'
      and policyname = 'competitor_ugc_replication_segments_delete_own'
  ) then
    alter policy "competitor_ugc_replication_segments_delete_own" on public.video_clone_segments
      rename to "video_clone_segments_delete_own";
  end if;
end $$;
