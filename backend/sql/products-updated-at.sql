-- products was created without an updated_at column (it has no schema file
-- of its own in this directory — it predates one). Stock writes need it: the
-- low-stock alert panel shows "3 hours ago" from this column, same as every
-- other mutable table in this app already does explicitly on every UPDATE
-- (no triggers are used anywhere here — see customers, orders, carts).
--
--   psql -d <your-db> -f sql/products-updated-at.sql

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
