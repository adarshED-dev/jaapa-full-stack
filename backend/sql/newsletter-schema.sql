-- Brochure / newsletter leads.
--
-- Run after orders-schema.sql (which creates `customers`):
--   psql -d <your-db> -f sql/newsletter-schema.sql
--
-- These leads live in `customers` rather than a table of their own, so the
-- admin Customers tab shows one list of everyone the store knows about. The
-- flags below are what tell a brochure lead apart from someone who has
-- actually ordered — a lead has no phone, no orders and is_brochure_lead=TRUE
-- until the day they buy something, at which point the same row gains an
-- order history instead of becoming a duplicate person.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_brochure_lead BOOLEAN NOT NULL DEFAULT FALSE;

-- Where the row came from: 'brochure', 'checkout', 'otp-login'.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source VARCHAR(32);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS brochure_downloaded_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS brochure_download_count INTEGER NOT NULL DEFAULT 0;

-- The admin list filters on this, and it stays cheap as the list grows.
CREATE INDEX IF NOT EXISTS customers_brochure_lead_idx
    ON customers (is_brochure_lead) WHERE is_brochure_lead = TRUE;
