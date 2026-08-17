-- Admin accounts and refresh sessions.
--
-- There is deliberately no sign-up route: the account is created from the CLI
-- (node src/scripts/createAdmin.js), so nobody can register themselves into
-- your dashboard.
--
-- This store has exactly ONE admin — the owner. See the single-row unique
-- index below.

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'owner',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Bumped on password change / "sign out everywhere". Access tokens carry
    -- this number, so raising it invalidates every token already issued
    -- without waiting for them to expire.
    token_version INTEGER NOT NULL DEFAULT 0,

    -- Brute-force protection: too many failures locks the account for a while.
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,

    last_login_at TIMESTAMPTZ,
    last_login_ip VARCHAR(64),
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Case-insensitive: Admin@jaapa.in and admin@jaapa.in are one account.
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users (LOWER(email));

-- Only the owner may ever exist. A unique index on a constant expression can
-- be satisfied by exactly one row, so a second INSERT — from the CLI script,
-- from a psql prompt, from anywhere — is rejected by the database itself.
-- (Also shipped standalone as sql/admin-owner-lock.sql for existing installs.)
CREATE UNIQUE INDEX IF NOT EXISTS admin_users_single_owner ON admin_users ((TRUE));

-- One row per active refresh token. Only the SHA-256 of the token is stored,
-- so a leaked database dump can't be replayed as a login.
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(64),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_token_hash_key ON admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_id_idx ON admin_sessions (admin_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);
