-- Customer sign-in by mobile/email OTP.
--
-- Run after orders-schema.sql, which creates the `customers` table these
-- sessions point at:
--   psql -d <your-db> -f sql/customer-auth-schema.sql
--
-- Customers have no password. Proving they can receive a code on their phone
-- or email IS the credential, so the security lives in this table: codes are stored
-- hashed, expire in minutes, and are counted so a 4-digit code can't be
-- brute-forced.

CREATE TABLE IF NOT EXISTS customer_otp_codes (
    id UUID PRIMARY KEY,

    -- Canonical 10-digit form, so 9876543210 / +919876543210 / 09876543210
    -- are one person and can't each hold their own code.
    phone VARCHAR(10),
    email VARCHAR(255),

    -- SHA-256 of the code, peppered with JWT_SECRET. A database dump must not
    -- hand out live login codes. (SHA-256 rather than bcrypt on purpose: the
    -- attempt counter below is what stops guessing, and OTP verification sits
    -- on the hot path of every login.)
    code_hash TEXT NOT NULL,

    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Every lookup is "the newest live code for this phone/email".
CREATE INDEX IF NOT EXISTS customer_otp_phone_idx ON customer_otp_codes (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_otp_email_idx ON customer_otp_codes (email, created_at DESC);
CREATE INDEX IF NOT EXISTS customer_otp_expires_idx ON customer_otp_codes (expires_at);

-- One row per signed-in device, same model as admin_sessions: only the
-- SHA-256 of the refresh token is stored and it is rotated on every use.
CREATE TABLE IF NOT EXISTS customer_sessions (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_sessions_token_hash_key ON customer_sessions (token_hash);
CREATE INDEX IF NOT EXISTS customer_sessions_customer_id_idx ON customer_sessions (customer_id);
CREATE INDEX IF NOT EXISTS customer_sessions_expires_at_idx ON customer_sessions (expires_at);

-- Lets "sign out of all devices" invalidate access tokens that haven't
-- expired yet, the same way admin_users.token_version does.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
