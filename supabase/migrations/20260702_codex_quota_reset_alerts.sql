-- Codex Quota Reset Alerts
-- Persisted X posts from OpenAI official/staff accounts about quota/resets,
-- user-owned email subscriptions, and notification history.
-- RLS is enabled without client policies; access is mediated server-side via
-- Clerk and the Supabase service role, matching the rest of this repo.

CREATE TABLE IF NOT EXISTS public.codex_quota_reset_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id varchar(64) NOT NULL UNIQUE,
  author_id varchar(64) NOT NULL,
  author_username varchar(64) NOT NULL,
  author_display_name varchar(255),
  author_verified boolean DEFAULT false,
  category varchar(64) NOT NULL DEFAULT 'general',
  excerpt varchar(560) NOT NULL,
  full_text text,
  url text NOT NULL,
  posted_at timestamptz NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.codex_quota_reset_posts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_posts_posted_at
  ON public.codex_quota_reset_posts (posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_posts_category_posted_at
  ON public.codex_quota_reset_posts (category, posted_at DESC);

CREATE OR REPLACE FUNCTION public.update_codex_quota_reset_posts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_codex_quota_reset_posts_updated_at ON public.codex_quota_reset_posts;
CREATE TRIGGER trg_codex_quota_reset_posts_updated_at
  BEFORE UPDATE ON public.codex_quota_reset_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_codex_quota_reset_posts_updated_at();

CREATE TABLE IF NOT EXISTS public.codex_quota_reset_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL,
  email varchar(320) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  last_notified_post_id varchar(64),
  notifications_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

ALTER TABLE public.codex_quota_reset_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_subscriptions_user_id
  ON public.codex_quota_reset_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_subscriptions_status
  ON public.codex_quota_reset_subscriptions (status);

CREATE OR REPLACE FUNCTION public.update_codex_quota_reset_subscriptions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_codex_quota_reset_subscriptions_updated_at ON public.codex_quota_reset_subscriptions;
CREATE TRIGGER trg_codex_quota_reset_subscriptions_updated_at
  BEFORE UPDATE ON public.codex_quota_reset_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_codex_quota_reset_subscriptions_updated_at();

CREATE TABLE IF NOT EXISTS public.codex_quota_reset_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  user_id varchar NOT NULL,
  post_id uuid NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  credits_charged integer NOT NULL DEFAULT 0,
  provider_id varchar(255),
  error_message text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, post_id)
);

ALTER TABLE public.codex_quota_reset_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_notifications_user_id
  ON public.codex_quota_reset_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_notifications_status
  ON public.codex_quota_reset_notifications (status);

CREATE INDEX IF NOT EXISTS idx_codex_quota_reset_notifications_post_id
  ON public.codex_quota_reset_notifications (post_id);

GRANT SELECT ON TABLE public.codex_quota_reset_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.codex_quota_reset_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.codex_quota_reset_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.codex_quota_reset_notifications TO authenticated;

NOTIFY pgrst, 'reload schema';
