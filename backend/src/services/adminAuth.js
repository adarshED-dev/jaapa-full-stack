// Admin authentication primitives: password hashing, JWT access tokens,
// refresh sessions, lockout policy and the refresh cookie.
//
// Token model
// -----------
// Access token  — JWT, 15 minutes, sent as `Authorization: Bearer <token>`,
//                 held only in memory by the browser (never localStorage, so
//                 an XSS bug can't walk away with a long-lived credential).
// Refresh token — 64 random bytes, 7 days, delivered as an httpOnly cookie
//                 scoped to /api/admin/auth. Only its SHA-256 lives in the
//                 database, and it is rotated on every use.

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const pool = require("../config/db");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_DAYS = 7;
const BCRYPT_ROUNDS = 12;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const JWT_ISSUER = "jaapa-api";
const JWT_AUDIENCE = "jaapa-admin";

const REFRESH_COOKIE = "jaapa_admin_refresh";
const REFRESH_COOKIE_PATH = "/api/admin/auth";

class AuthError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function requireSecret() {
    const secret = process.env.JWT_SECRET;
    // A signing key that isn't set (or is a leftover placeholder) would mean
    // anyone could mint their own admin token. Fail loudly instead.
    if (!secret || secret.length < 16) {
        throw new AuthError(500, "Server auth is misconfigured", "NO_SECRET");
    }
    return secret;
}

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

const PASSWORD_MIN = 10;

/** Returns an error string, or "" when the password is acceptable. */
function validatePasswordStrength(password) {
    const value = String(password || "");
    if (value.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
    if (!/[a-z]/.test(value)) return "Include at least one lowercase letter.";
    if (!/[A-Z]/.test(value)) return "Include at least one uppercase letter.";
    if (!/\d/.test(value)) return "Include at least one number.";
    if (!/[^A-Za-z0-9]/.test(value)) return "Include at least one symbol.";
    if (/^\s|\s$/.test(value)) return "Remove the leading or trailing space.";
    return "";
}

function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// A real hash of a random string, computed once. Login compares against this
// when the email doesn't exist so that a missing account costs the same time
// as a wrong password — otherwise response timing leaks which emails are real.
let dummyHashPromise = null;
function dummyHash() {
    if (!dummyHashPromise) {
        dummyHashPromise = bcrypt.hash(crypto.randomBytes(24).toString("hex"), BCRYPT_ROUNDS);
    }
    return dummyHashPromise;
}

/* ------------------------------------------------------------------ */
/* Access tokens                                                       */
/* ------------------------------------------------------------------ */

function signAccessToken(admin) {
    return jwt.sign(
        {
            sub: admin.id,
            email: admin.email,
            role: admin.role,
            ver: admin.token_version, // checked on every request — see requireAdmin
        },
        requireSecret(),
        {
            expiresIn: ACCESS_TOKEN_TTL,
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }
    );
}

function verifyAccessToken(token) {
    try {
        return jwt.verify(token, requireSecret(), {
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
            algorithms: ["HS256"], // pinned: never let the token pick "none"
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new AuthError(401, "Your session expired", "TOKEN_EXPIRED");
        }
        throw new AuthError(401, "Not authenticated", "INVALID_TOKEN");
    }
}

/* ------------------------------------------------------------------ */
/* Refresh sessions                                                    */
/* ------------------------------------------------------------------ */

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(adminId, { userAgent, ip } = {}) {
    const token = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO admin_sessions (id, admin_id, token_hash, user_agent, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), adminId, hashRefreshToken(token), userAgent || null, ip || null, expiresAt]
    );

    return { token, expiresAt };
}

async function findLiveSession(token) {
    if (!token) return null;
    const result = await pool.query(
        `SELECT * FROM admin_sessions
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [hashRefreshToken(token)]
    );
    return result.rows[0] || null;
}

async function revokeSession(token) {
    if (!token) return;
    await pool.query(
        "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL",
        [hashRefreshToken(token)]
    );
}

async function revokeAllSessions(adminId) {
    await pool.query(
        "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = $1 AND revoked_at IS NULL",
        [adminId]
    );
}

/**
 * Every device currently holding a live sign-in, newest first. The token hash
 * never leaves this function — the caller gets an id it can revoke by, and
 * enough context (device, IP, when) to recognise a session it doesn't expect.
 */
async function listSessions(adminId, currentToken) {
    const result = await pool.query(
        `SELECT id, token_hash, user_agent, ip_address, created_at, expires_at
         FROM admin_sessions
         WHERE admin_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
         ORDER BY created_at DESC`,
        [adminId]
    );

    const currentHash = currentToken ? hashRefreshToken(currentToken) : null;
    return result.rows.map((row) => ({
        id: row.id,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        current: currentHash !== null && row.token_hash === currentHash,
    }));
}

/** Scoped by admin_id so an id from somewhere else can't revoke a stranger. */
async function revokeSessionById(adminId, sessionId) {
    const result = await pool.query(
        `UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND admin_id = $2 AND revoked_at IS NULL`,
        [sessionId, adminId]
    );
    return result.rowCount > 0;
}

/* ------------------------------------------------------------------ */
/* Lockout                                                             */
/* ------------------------------------------------------------------ */

function lockRemainingMinutes(admin) {
    if (!admin.locked_until) return 0;
    const remaining = new Date(admin.locked_until).getTime() - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
}

async function registerFailedAttempt(admin) {
    const attempts = admin.failed_attempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;

    await pool.query(
        `UPDATE admin_users
         SET failed_attempts = $2,
             locked_until = CASE WHEN $3 THEN $4 ELSE locked_until END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [admin.id, shouldLock ? 0 : attempts, shouldLock, lockedUntil]
    );

    return { locked: shouldLock, remaining: Math.max(0, MAX_FAILED_ATTEMPTS - attempts) };
}

async function registerSuccessfulLogin(adminId, ip) {
    await pool.query(
        `UPDATE admin_users
         SET failed_attempts = 0,
             locked_until = NULL,
             last_login_at = CURRENT_TIMESTAMP,
             last_login_ip = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [adminId, ip || null]
    );
}

/* ------------------------------------------------------------------ */
/* Cookies                                                             */
/* ------------------------------------------------------------------ */

// Hand-rolled rather than pulling in cookie-parser for one header.
function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) return null;

    for (const part of header.split(";")) {
        const index = part.indexOf("=");
        if (index === -1) continue;
        if (part.slice(0, index).trim() === name) {
            return decodeURIComponent(part.slice(index + 1).trim());
        }
    }
    return null;
}

function refreshCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,                                  // unreachable from JavaScript
        secure: isProduction,                            // HTTPS only once deployed
        sameSite: isProduction ? "none" : "lax",         // "none" needs secure:true
        path: REFRESH_COOKIE_PATH,                       // sent to the auth routes only
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    };
}

function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

async function findAdminByEmail(email) {
    const result = await pool.query(
        "SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)",
        [String(email || "").trim()]
    );
    return result.rows[0] || null;
}

async function findAdminById(id) {
    const result = await pool.query("SELECT * FROM admin_users WHERE id = $1", [id]);
    return result.rows[0] || null;
}

/** The only shape of an admin that ever reaches the browser. */
function toPublicAdmin(admin) {
    return {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        initials: String(admin.full_name || admin.email)
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        lastLoginAt: admin.last_login_at,
    };
}

module.exports = {
    AuthError,
    ACCESS_TOKEN_TTL,
    MAX_FAILED_ATTEMPTS,
    LOCK_MINUTES,
    REFRESH_COOKIE,
    validatePasswordStrength,
    hashPassword,
    verifyPassword,
    dummyHash,
    signAccessToken,
    verifyAccessToken,
    createSession,
    findLiveSession,
    revokeSession,
    revokeAllSessions,
    listSessions,
    revokeSessionById,
    lockRemainingMinutes,
    registerFailedAttempt,
    registerSuccessfulLogin,
    readCookie,
    setRefreshCookie,
    clearRefreshCookie,
    findAdminByEmail,
    findAdminById,
    toPublicAdmin,
};
