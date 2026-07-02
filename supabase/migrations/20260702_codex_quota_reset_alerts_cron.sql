-- Schedule hourly polling for Codex Quota Reset Alerts.
-- Calls /api/tools/codex-quota-reset-alerts/poll every hour using
-- pg_net. The poll URL and bearer secret come from (in order):
--   1. Database GUCs (app.codex_alert_poll_url, app.codex_alert_poll_secret)
--   2. The constants below. To override after deployment, edit the constants
--      and re-run this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.schedule_codex_quota_reset_alert_poll(
  fallback_url text DEFAULT 'https://b99c-173-224-219-157.ngrok-free.app/api/tools/codex-quota-reset-alerts/poll',
  fallback_secret text DEFAULT '24788d3f5db45a1ff6235c798accadfdee49313a26350f9dcdf563d0001584cf'
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  poll_url text;
  cron_secret text;
  job_name text := 'codex_quota_reset_alert_poll';
BEGIN
  poll_url := COALESCE(NULLIF(current_setting('app.codex_alert_poll_url', true), ''), fallback_url);
  cron_secret := COALESCE(NULLIF(current_setting('app.codex_alert_poll_secret', true), ''), fallback_secret);

  IF poll_url IS NULL OR poll_url = '' OR cron_secret IS NULL OR cron_secret = '' THEN
    RETURN 'skipped: app.codex_alert_poll_url or app.codex_alert_poll_secret is not configured';
  END IF;

  -- Drop existing job idempotently (unschedule errors if missing).
  BEGIN
    PERFORM cron.unschedule(job_name);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  PERFORM cron.schedule(
    job_name,
    '0 * * * *',
    format(
      $cron$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || %L
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 50000
        );
      $cron$,
      poll_url,
      cron_secret
    )
  );

  RETURN 'scheduled: ' || job_name || ' -> ' || poll_url;
END
$$;

REVOKE ALL ON FUNCTION public.schedule_codex_quota_reset_alert_poll(text, text) FROM PUBLIC, anon, authenticated;

SELECT public.schedule_codex_quota_reset_alert_poll();

COMMENT ON EXTENSION pg_cron IS 'Hourly Codex Quota Reset Alerts polling';
COMMENT ON EXTENSION pg_net IS 'Used by pg_cron to call /api/tools/codex-quota-reset-alerts/poll';