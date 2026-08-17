-- Single-owner lock.
--
-- This store has exactly one person who can sign into the admin panel. The
-- application already refuses to create a second account (see
-- src/scripts/createAdmin.js), but application checks can be bypassed by
-- anyone with a psql prompt — so the rule is enforced by the database too.
--
-- Run once, AFTER admin-auth-schema.sql:
--   psql -d <your-db> -f sql/admin-owner-lock.sql
--
-- A unique index on a constant expression can only ever be satisfied by one
-- row, so a second INSERT into admin_users fails at the database level with
-- "duplicate key value violates unique constraint".
--
-- If this file errors with a duplicate-key message, the table already holds
-- more than one admin. Decide which row is the owner and delete the rest
-- (their sessions cascade away), then run this again.

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_single_owner ON admin_users ((TRUE));

-- The one account that exists is the owner, not a plain admin.
UPDATE admin_users SET role = 'owner' WHERE role <> 'owner';

ALTER TABLE admin_users ALTER COLUMN role SET DEFAULT 'owner';
