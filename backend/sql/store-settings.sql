-- One row per settings section ("store-details", "gst-settings", ...).
-- The shape of `data` is owned by the admin panel, so a new field on a
-- settings form needs no migration here.
CREATE TABLE IF NOT EXISTS store_settings (
    section VARCHAR(64) PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
