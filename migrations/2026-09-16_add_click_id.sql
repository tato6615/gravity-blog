-- Run manually via Cloudflare D1 Console (dash.cloudflare.com -> D1 ->
-- gravity_affiliate -> Console). wrangler CLI is not used in this project.

ALTER TABLE clicks ADD COLUMN click_id TEXT;
CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON clicks(click_id);

ALTER TABLE conversions ADD COLUMN click_id TEXT;
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
