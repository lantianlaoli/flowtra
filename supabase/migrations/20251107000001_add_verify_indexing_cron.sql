-- Create cron job for verifying actual Google indexing status
-- This job runs daily at 2:00 AM to check if submitted articles are actually indexed

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Ensure pg_net extension is enabled (for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the verification cron job
-- Runs daily at 2:00 AM to verify articles submitted 3+ days ago
SELECT cron.schedule(
  'verify-indexing-status',           -- Job name
  '0 2 * * *',                        -- Cron expression: daily at 2:00 AM
  $$
  SELECT
    net.http_post(
      url := 'https://www.flowtra.store/api/cron/verify-indexing',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the job was created
-- Uncomment to check:
-- SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'verify-indexing-status';
