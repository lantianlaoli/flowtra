-- Allow codex_quota_reset_posts.excerpt to hold the full tweet text so legacy
-- rows (and any future row) are never silently truncated.

ALTER TABLE public.codex_quota_reset_posts
  ALTER COLUMN excerpt TYPE text USING excerpt::text;