-- Rename legacy Standard Ads tables to Competitor UGC Replication
ALTER TABLE IF EXISTS public.standard_ads_segments
  RENAME TO competitor_ugc_replication_segments;

ALTER TABLE IF EXISTS public.standard_ads_projects
  RENAME TO competitor_ugc_replication_projects;
