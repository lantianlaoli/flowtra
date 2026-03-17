begin;

alter table public.motion_swap_projects rename to motion_clone_projects;

alter table public.motion_clone_projects
  rename constraint motion_swap_projects_pkey to motion_clone_projects_pkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_avatar_id_fkey to motion_clone_projects_avatar_id_fkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_creator_source_id_fkey to motion_clone_projects_creator_source_id_fkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_creator_source_video_id_fkey to motion_clone_projects_creator_source_video_id_fkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_product_id_fkey to motion_clone_projects_product_id_fkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_product_photo_id_fkey to motion_clone_projects_product_photo_id_fkey;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_mode_check to motion_clone_projects_mode_check;
alter table public.motion_clone_projects
  rename constraint motion_swap_projects_status_check to motion_clone_projects_status_check;

alter index public.motion_swap_projects_user_id_idx
  rename to motion_clone_projects_user_id_idx;

drop policy if exists "motion_swap_projects_select_own" on public.motion_clone_projects;
drop policy if exists "motion_swap_projects_insert_own" on public.motion_clone_projects;
drop policy if exists "motion_swap_projects_update_own" on public.motion_clone_projects;
drop policy if exists "motion_swap_projects_delete_own" on public.motion_clone_projects;

create policy "motion_clone_projects_select_own"
on public.motion_clone_projects
for select
to authenticated
using ((select auth.jwt()->>'sub') = user_id::text);

create policy "motion_clone_projects_insert_own"
on public.motion_clone_projects
for insert
to authenticated
with check ((select auth.jwt()->>'sub') = user_id::text);

create policy "motion_clone_projects_update_own"
on public.motion_clone_projects
for update
to authenticated
using ((select auth.jwt()->>'sub') = user_id::text)
with check ((select auth.jwt()->>'sub') = user_id::text);

create policy "motion_clone_projects_delete_own"
on public.motion_clone_projects
for delete
to authenticated
using ((select auth.jwt()->>'sub') = user_id::text);

commit;
