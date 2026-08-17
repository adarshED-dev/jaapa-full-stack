-- Fulfilment tracking. Shiprocket isn't connected yet — see
-- src/services/shiprocket.js — but the "Ship Now" button and its data need
-- somewhere to live, so this lands ahead of that integration rather than
-- with it.
--
--   psql -d <your-db> -f sql/shiprocket-fulfilment.sql

ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilment_status VARCHAR(24) NOT NULL DEFAULT 'unfulfilled';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_order_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shiprocket_shipment_id VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS awb_code VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_name VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- Set when Shiprocket rejects a shipment (bad pincode, pickup location
-- mismatch, etc.) so the admin sees *why* Ship Now failed, not just that it
-- did — visible in the order detail panel, cleared on the next attempt.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfilment_error TEXT;

CREATE INDEX IF NOT EXISTS orders_fulfilment_status_idx ON orders (fulfilment_status);
