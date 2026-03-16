begin;

alter function public.compute_total_credits() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;
alter function public.update_workflow_tasks_updated_at() set search_path = public;

update storage.buckets
set public = false
where id in ('temp-uploads', 'user-images', 'user-videos');

alter table public.articles enable row level security;
revoke all on table public.articles from anon, authenticated;
grant select on table public.articles to anon, authenticated;
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read"
on public.articles
for select
to anon, authenticated
using (true);

alter table public.user_tiktok_connections enable row level security;
revoke all on table public.user_tiktok_connections from anon, authenticated;
grant select, insert, update, delete on table public.user_tiktok_connections to authenticated;
drop policy if exists "user_tiktok_connections_select_own" on public.user_tiktok_connections;
drop policy if exists "user_tiktok_connections_insert_own" on public.user_tiktok_connections;
drop policy if exists "user_tiktok_connections_update_own" on public.user_tiktok_connections;
drop policy if exists "user_tiktok_connections_delete_own" on public.user_tiktok_connections;
create policy "user_tiktok_connections_select_own" on public.user_tiktok_connections for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_tiktok_connections_insert_own" on public.user_tiktok_connections for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_tiktok_connections_update_own" on public.user_tiktok_connections for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_tiktok_connections_delete_own" on public.user_tiktok_connections for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.user_credits enable row level security;
revoke all on table public.user_credits from anon, authenticated;
grant select, insert, update, delete on table public.user_credits to authenticated;
drop policy if exists "user_credits_select_own" on public.user_credits;
drop policy if exists "user_credits_insert_own" on public.user_credits;
drop policy if exists "user_credits_update_own" on public.user_credits;
drop policy if exists "user_credits_delete_own" on public.user_credits;
create policy "user_credits_select_own" on public.user_credits for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_credits_insert_own" on public.user_credits for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_credits_update_own" on public.user_credits for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_credits_delete_own" on public.user_credits for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.credit_transactions enable row level security;
revoke all on table public.credit_transactions from anon, authenticated;
grant select, insert, update, delete on table public.credit_transactions to authenticated;
drop policy if exists "credit_transactions_select_own" on public.credit_transactions;
drop policy if exists "credit_transactions_insert_own" on public.credit_transactions;
drop policy if exists "credit_transactions_update_own" on public.credit_transactions;
drop policy if exists "credit_transactions_delete_own" on public.credit_transactions;
create policy "credit_transactions_select_own" on public.credit_transactions for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "credit_transactions_insert_own" on public.credit_transactions for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "credit_transactions_update_own" on public.credit_transactions for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "credit_transactions_delete_own" on public.credit_transactions for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.user_subscriptions enable row level security;
revoke all on table public.user_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.user_subscriptions to authenticated;
drop policy if exists "user_subscriptions_select_own" on public.user_subscriptions;
drop policy if exists "user_subscriptions_insert_own" on public.user_subscriptions;
drop policy if exists "user_subscriptions_update_own" on public.user_subscriptions;
drop policy if exists "user_subscriptions_delete_own" on public.user_subscriptions;
create policy "user_subscriptions_select_own" on public.user_subscriptions for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_subscriptions_insert_own" on public.user_subscriptions for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_subscriptions_update_own" on public.user_subscriptions for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_subscriptions_delete_own" on public.user_subscriptions for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.subscription_events enable row level security;
revoke all on table public.subscription_events from anon, authenticated;
grant select, insert, update, delete on table public.subscription_events to authenticated;
drop policy if exists "subscription_events_select_own" on public.subscription_events;
drop policy if exists "subscription_events_insert_own" on public.subscription_events;
drop policy if exists "subscription_events_update_own" on public.subscription_events;
drop policy if exists "subscription_events_delete_own" on public.subscription_events;
create policy "subscription_events_select_own" on public.subscription_events for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "subscription_events_insert_own" on public.subscription_events for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "subscription_events_update_own" on public.subscription_events for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "subscription_events_delete_own" on public.subscription_events for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.project_agent_sessions enable row level security;
revoke all on table public.project_agent_sessions from anon, authenticated;
grant select, insert, update, delete on table public.project_agent_sessions to authenticated;
drop policy if exists "project_agent_sessions_select_own" on public.project_agent_sessions;
drop policy if exists "project_agent_sessions_insert_own" on public.project_agent_sessions;
drop policy if exists "project_agent_sessions_update_own" on public.project_agent_sessions;
drop policy if exists "project_agent_sessions_delete_own" on public.project_agent_sessions;
create policy "project_agent_sessions_select_own" on public.project_agent_sessions for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "project_agent_sessions_insert_own" on public.project_agent_sessions for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "project_agent_sessions_update_own" on public.project_agent_sessions for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "project_agent_sessions_delete_own" on public.project_agent_sessions for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.user_products enable row level security;
revoke all on table public.user_products from anon, authenticated;
grant select, insert, update, delete on table public.user_products to authenticated;
drop policy if exists "user_products_select_own" on public.user_products;
drop policy if exists "user_products_insert_own" on public.user_products;
drop policy if exists "user_products_update_own" on public.user_products;
drop policy if exists "user_products_delete_own" on public.user_products;
create policy "user_products_select_own" on public.user_products for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_products_insert_own" on public.user_products for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_products_update_own" on public.user_products for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_products_delete_own" on public.user_products for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.user_product_photos enable row level security;
revoke all on table public.user_product_photos from anon, authenticated;
grant select, insert, update, delete on table public.user_product_photos to authenticated;
drop policy if exists "user_product_photos_select_own" on public.user_product_photos;
drop policy if exists "user_product_photos_insert_own" on public.user_product_photos;
drop policy if exists "user_product_photos_update_own" on public.user_product_photos;
drop policy if exists "user_product_photos_delete_own" on public.user_product_photos;
create policy "user_product_photos_select_own" on public.user_product_photos for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_product_photos_insert_own" on public.user_product_photos for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_product_photos_update_own" on public.user_product_photos for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_product_photos_delete_own" on public.user_product_photos for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.user_avatars enable row level security;
revoke all on table public.user_avatars from anon, authenticated;
grant select, insert, update, delete on table public.user_avatars to authenticated;
drop policy if exists "user_avatars_select_own" on public.user_avatars;
drop policy if exists "user_avatars_insert_own" on public.user_avatars;
drop policy if exists "user_avatars_update_own" on public.user_avatars;
drop policy if exists "user_avatars_delete_own" on public.user_avatars;
create policy "user_avatars_select_own" on public.user_avatars for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_avatars_insert_own" on public.user_avatars for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_avatars_update_own" on public.user_avatars for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "user_avatars_delete_own" on public.user_avatars for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.competitor_ads enable row level security;
revoke all on table public.competitor_ads from anon, authenticated;
grant select, insert, update, delete on table public.competitor_ads to authenticated;
drop policy if exists "competitor_ads_select_own" on public.competitor_ads;
drop policy if exists "competitor_ads_insert_own" on public.competitor_ads;
drop policy if exists "competitor_ads_update_own" on public.competitor_ads;
drop policy if exists "competitor_ads_delete_own" on public.competitor_ads;
create policy "competitor_ads_select_own" on public.competitor_ads for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ads_insert_own" on public.competitor_ads for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ads_update_own" on public.competitor_ads for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ads_delete_own" on public.competitor_ads for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.creator_sources enable row level security;
revoke all on table public.creator_sources from anon, authenticated;
grant select, insert, update, delete on table public.creator_sources to authenticated;
drop policy if exists "creator_sources_select_own" on public.creator_sources;
drop policy if exists "creator_sources_insert_own" on public.creator_sources;
drop policy if exists "creator_sources_update_own" on public.creator_sources;
drop policy if exists "creator_sources_delete_own" on public.creator_sources;
create policy "creator_sources_select_own" on public.creator_sources for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_sources_insert_own" on public.creator_sources for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_sources_update_own" on public.creator_sources for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_sources_delete_own" on public.creator_sources for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.creator_source_platforms enable row level security;
revoke all on table public.creator_source_platforms from anon, authenticated;
grant select, insert, update, delete on table public.creator_source_platforms to authenticated;
drop policy if exists "creator_source_platforms_select_own" on public.creator_source_platforms;
drop policy if exists "creator_source_platforms_insert_own" on public.creator_source_platforms;
drop policy if exists "creator_source_platforms_update_own" on public.creator_source_platforms;
drop policy if exists "creator_source_platforms_delete_own" on public.creator_source_platforms;
create policy "creator_source_platforms_select_own" on public.creator_source_platforms for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_platforms_insert_own" on public.creator_source_platforms for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_platforms_update_own" on public.creator_source_platforms for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_platforms_delete_own" on public.creator_source_platforms for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.creator_source_videos enable row level security;
revoke all on table public.creator_source_videos from anon, authenticated;
grant select, insert, update, delete on table public.creator_source_videos to authenticated;
drop policy if exists "creator_source_videos_select_own" on public.creator_source_videos;
drop policy if exists "creator_source_videos_insert_own" on public.creator_source_videos;
drop policy if exists "creator_source_videos_update_own" on public.creator_source_videos;
drop policy if exists "creator_source_videos_delete_own" on public.creator_source_videos;
create policy "creator_source_videos_select_own" on public.creator_source_videos for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_videos_insert_own" on public.creator_source_videos for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_videos_update_own" on public.creator_source_videos for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "creator_source_videos_delete_own" on public.creator_source_videos for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.avatar_ads_projects enable row level security;
revoke all on table public.avatar_ads_projects from anon, authenticated;
grant select, insert, update, delete on table public.avatar_ads_projects to authenticated;
drop policy if exists "avatar_ads_projects_select_own" on public.avatar_ads_projects;
drop policy if exists "avatar_ads_projects_insert_own" on public.avatar_ads_projects;
drop policy if exists "avatar_ads_projects_update_own" on public.avatar_ads_projects;
drop policy if exists "avatar_ads_projects_delete_own" on public.avatar_ads_projects;
create policy "avatar_ads_projects_select_own" on public.avatar_ads_projects for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "avatar_ads_projects_insert_own" on public.avatar_ads_projects for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "avatar_ads_projects_update_own" on public.avatar_ads_projects for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "avatar_ads_projects_delete_own" on public.avatar_ads_projects for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.avatar_ads_scenes enable row level security;
revoke all on table public.avatar_ads_scenes from anon, authenticated;
grant select, insert, update, delete on table public.avatar_ads_scenes to authenticated;
drop policy if exists "avatar_ads_scenes_select_own" on public.avatar_ads_scenes;
drop policy if exists "avatar_ads_scenes_insert_own" on public.avatar_ads_scenes;
drop policy if exists "avatar_ads_scenes_update_own" on public.avatar_ads_scenes;
drop policy if exists "avatar_ads_scenes_delete_own" on public.avatar_ads_scenes;
create policy "avatar_ads_scenes_select_own"
on public.avatar_ads_scenes
for select
to authenticated
using (exists (select 1 from public.avatar_ads_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "avatar_ads_scenes_insert_own"
on public.avatar_ads_scenes
for insert
to authenticated
with check (exists (select 1 from public.avatar_ads_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "avatar_ads_scenes_update_own"
on public.avatar_ads_scenes
for update
to authenticated
using (exists (select 1 from public.avatar_ads_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text))
with check (exists (select 1 from public.avatar_ads_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "avatar_ads_scenes_delete_own"
on public.avatar_ads_scenes
for delete
to authenticated
using (exists (select 1 from public.avatar_ads_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));

alter table public.competitor_ugc_replication_projects enable row level security;
revoke all on table public.competitor_ugc_replication_projects from anon, authenticated;
grant select, insert, update, delete on table public.competitor_ugc_replication_projects to authenticated;
drop policy if exists "anyone" on public.competitor_ugc_replication_projects;
drop policy if exists "competitor_ugc_replication_projects_select_own" on public.competitor_ugc_replication_projects;
drop policy if exists "competitor_ugc_replication_projects_insert_own" on public.competitor_ugc_replication_projects;
drop policy if exists "competitor_ugc_replication_projects_update_own" on public.competitor_ugc_replication_projects;
drop policy if exists "competitor_ugc_replication_projects_delete_own" on public.competitor_ugc_replication_projects;
create policy "competitor_ugc_replication_projects_select_own" on public.competitor_ugc_replication_projects for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ugc_replication_projects_insert_own" on public.competitor_ugc_replication_projects for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ugc_replication_projects_update_own" on public.competitor_ugc_replication_projects for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "competitor_ugc_replication_projects_delete_own" on public.competitor_ugc_replication_projects for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

alter table public.competitor_ugc_replication_segments enable row level security;
revoke all on table public.competitor_ugc_replication_segments from anon, authenticated;
grant select, insert, update, delete on table public.competitor_ugc_replication_segments to authenticated;
drop policy if exists "competitor_ugc_replication_segments_select_own" on public.competitor_ugc_replication_segments;
drop policy if exists "competitor_ugc_replication_segments_insert_own" on public.competitor_ugc_replication_segments;
drop policy if exists "competitor_ugc_replication_segments_update_own" on public.competitor_ugc_replication_segments;
drop policy if exists "competitor_ugc_replication_segments_delete_own" on public.competitor_ugc_replication_segments;
create policy "competitor_ugc_replication_segments_select_own"
on public.competitor_ugc_replication_segments
for select
to authenticated
using (exists (select 1 from public.competitor_ugc_replication_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "competitor_ugc_replication_segments_insert_own"
on public.competitor_ugc_replication_segments
for insert
to authenticated
with check (exists (select 1 from public.competitor_ugc_replication_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "competitor_ugc_replication_segments_update_own"
on public.competitor_ugc_replication_segments
for update
to authenticated
using (exists (select 1 from public.competitor_ugc_replication_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text))
with check (exists (select 1 from public.competitor_ugc_replication_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));
create policy "competitor_ugc_replication_segments_delete_own"
on public.competitor_ugc_replication_segments
for delete
to authenticated
using (exists (select 1 from public.competitor_ugc_replication_projects p where p.id = project_id and (select auth.jwt()->>'sub') = p.user_id::text));

alter table public.motion_swap_projects enable row level security;
revoke all on table public.motion_swap_projects from anon, authenticated;
grant select, insert, update, delete on table public.motion_swap_projects to authenticated;
drop policy if exists "motion_swap_projects_select_own" on public.motion_swap_projects;
drop policy if exists "motion_swap_projects_insert_own" on public.motion_swap_projects;
drop policy if exists "motion_swap_projects_update_own" on public.motion_swap_projects;
drop policy if exists "motion_swap_projects_delete_own" on public.motion_swap_projects;
create policy "motion_swap_projects_select_own" on public.motion_swap_projects for select to authenticated using ((select auth.jwt()->>'sub') = user_id::text);
create policy "motion_swap_projects_insert_own" on public.motion_swap_projects for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "motion_swap_projects_update_own" on public.motion_swap_projects for update to authenticated using ((select auth.jwt()->>'sub') = user_id::text) with check ((select auth.jwt()->>'sub') = user_id::text);
create policy "motion_swap_projects_delete_own" on public.motion_swap_projects for delete to authenticated using ((select auth.jwt()->>'sub') = user_id::text);

commit;
