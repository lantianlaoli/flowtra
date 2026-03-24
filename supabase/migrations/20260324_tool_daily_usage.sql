CREATE TABLE IF NOT EXISTS tool_daily_usage (
  user_id    text NOT NULL,
  tool_key   text NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tool_key, usage_date)
);
