alter table public.competitor_ugc_replication_segments
  add column if not exists contains_brand boolean not null default false,
  add column if not exists contains_product boolean not null default false;
