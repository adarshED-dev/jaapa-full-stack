#!/usr/bin/env node
//
// Creates (or updates) THE owner account. This is the ONLY way an account
// comes into existence — there is no public sign-up route.
//
// This store has exactly one admin. Once the owner exists, this script will
// not create a second one, and the database refuses it as well (see the
// admin_users_single_owner index in sql/admin-auth-schema.sql).
//
//   node src/scripts/createAdmin.js care@jaapa.in 'Str0ng!Passphrase' 'Adarsh Nigam'
//   node src/scripts/createAdmin.js care@jaapa.in 'New!Passphrase1' --reset-password
//
// Flags:
//   --reset-password   update the password of the owner account
//   --deactivate       disable the account without deleting it

require("dotenv").config();

const { randomUUID } = require("crypto");
const pool = require("../config/db");
const { hashPassword, validatePasswordStrength } = require("../services/adminAuth");

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

function fail(message) {
    console.error(`\n  ✗ ${message}\n`);
    process.exit(1);
}

async function main() {
    const args = process.argv.slice(2);
    const flags = args.filter((arg) => arg.startsWith("--"));
    const [email, password, fullName] = args.filter((arg) => !arg.startsWith("--"));

    const resetPassword = flags.includes("--reset-password");
    const deactivate = flags.includes("--deactivate");

    if (!email || !EMAIL_RE.test(email)) {
        fail("Pass a valid email address as the first argument.");
    }

    const existing = await pool.query("SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)", [email]);

    // One store, one owner. If an account already exists under a different
    // email, this script will not quietly add a second one — the panel is
    // meant to be reachable by exactly one person.
    const owner = await pool.query("SELECT email FROM admin_users LIMIT 1");
    if (existing.rows.length === 0 && owner.rows.length > 0) {
        fail(
            `An owner account already exists (${owner.rows[0].email}).\n` +
            `    Only one admin can exist for this store.\n\n` +
            `    To change its password:  node src/scripts/createAdmin.js ${owner.rows[0].email} '<new password>' --reset-password\n` +
            `    To hand the store over:  delete that row in psql first, then re-run this script.`
        );
    }

    if (deactivate) {
        if (existing.rows.length === 0) fail(`No admin account found for ${email}.`);
        await pool.query(
            `UPDATE admin_users
             SET is_active = FALSE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [existing.rows[0].id]
        );
        await pool.query(
            "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = $1 AND revoked_at IS NULL",
            [existing.rows[0].id]
        );
        console.log(`\n  ✓ ${email} deactivated and signed out everywhere.\n`);
        return;
    }

    if (!password) fail("Pass a password as the second argument.");

    const weakness = validatePasswordStrength(password);
    if (weakness) fail(`Password rejected: ${weakness}`);

    const passwordHash = await hashPassword(password);

    if (existing.rows.length > 0) {
        if (!resetPassword) {
            fail(`${email} already exists. Re-run with --reset-password to change its password.`);
        }
        // Bumping token_version and revoking sessions means a password reset
        // immediately logs out whoever was using the old one.
        await pool.query(
            `UPDATE admin_users
             SET password_hash = $2,
                 password_changed_at = CURRENT_TIMESTAMP,
                 token_version = token_version + 1,
                 failed_attempts = 0,
                 locked_until = NULL,
                 is_active = TRUE,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [existing.rows[0].id, passwordHash]
        );
        await pool.query(
            "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = $1 AND revoked_at IS NULL",
            [existing.rows[0].id]
        );
        console.log(`\n  ✓ Password updated for ${email}. All existing sessions signed out.\n`);
        return;
    }

    if (!fullName) fail("Pass the admin's full name as the third argument.");

    await pool.query(
        `INSERT INTO admin_users (id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, 'owner')`,
        [randomUUID(), email.toLowerCase(), passwordHash, fullName]
    );

    console.log(`\n  ✓ Owner account created\n    email: ${email.toLowerCase()}\n    role:  owner\n`);
    console.log("    This is the only account that can sign into /admin.\n");
}

main()
    .catch((error) => {
        if (error.code === "42P01") {
            fail("The admin_users table doesn't exist yet. Run sql/admin-auth-schema.sql first.");
        }
        // The single-row index rejected a second account.
        if (error.code === "23505" && error.constraint === "admin_users_single_owner") {
            fail("An owner account already exists. Only one admin can exist for this store.");
        }
        console.error(error);
        process.exit(1);
    })
    .finally(() => pool.end());
