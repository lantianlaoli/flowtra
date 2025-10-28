-- Local TikTok Connection Insert for Testing
-- This inserts the production TikTok connection data for local testing account
-- Production User: user_32XJdpmkWARt66oIoJ99ccgHIQF
-- Local Test User: user_31j68a38A3Q4CDNgdXvWRgiCK7A

-- IMPORTANT: Token expires at 2025-10-29 02:55:34+00 (approximately 24 hours from creation)
-- If token has expired, you need to re-bind in production and export new data

INSERT INTO "public"."user_tiktok_connections" (
  "id",
  "user_id",
  "tiktok_open_id",
  "tiktok_union_id",
  "display_name",
  "avatar_url",
  "access_token",
  "refresh_token",
  "token_expires_at",
  "scope",
  "created_at",
  "updated_at"
) VALUES (
  'f47b8d12-3c4e-4a5f-9d6b-2e8f1c9a7b3d',  -- New UUID for local record
  'user_31j68a38A3Q4CDNgdXvWRgiCK7A',      -- Local test account
  '-000pCBL_u0jCGBfP4qZr8dgxs7GX0vhPYeN', -- TikTok Open ID (same as production)
  'e7531946-27d4-5400-bad0-ce0c00ead7de',  -- TikTok Union ID (same as production)
  'Lantian laoli',                          -- Display name
  'https://p16-sign-sg.tiktokcdn.com/tos-alisg-avt-0068/ced5d199c39efabca552be72a5483b87~tplv-tiktokx-cropcenter:168:168.jpeg?dr=14577&refresh_token=93bd2c0d&x-expires=1761789600&x-signature=2yqaWyJw%2BbGZWmLQhGw4pPtoJOM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=8aecc5ac&idc=maliva',  -- Avatar URL
  'b54a0c0a67378ea55db3950a6c61a329:39107058175f89c52867bec2ee014bc43eede90f157d6c41e8efe2b6a4804059920a760cd5a69eb75730d295ebcaff75bf40655d1a8d9d05d3e0b6520c8d4b7d4abd9ebae0d1874248811022c07b741d',  -- Encrypted access token
  '76f487d1a15eff0333089df14c8ad78f:5b320e6dbc6d96aeee802523181f27ed08078277794d9851a1a414959bc26c5fcd6b29068088f21f2e056614bd37f313d758d68d3cdcaa33a6ff62907fa75642338a712fcd986283975701dcebb4bc7d',  -- Encrypted refresh token
  '2025-10-29 02:55:34.91+00',             -- Token expiration (24 hours from now!)
  'user.info.basic,video.publish',         -- OAuth scopes
  NOW(),                                    -- created_at
  NOW()                                     -- updated_at
);

-- Verify the insert
SELECT
  user_id,
  display_name,
  token_expires_at,
  CASE
    WHEN token_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as token_status
FROM user_tiktok_connections
WHERE user_id = 'user_31j68a38A3Q4CDNgdXvWRgiCK7A';
