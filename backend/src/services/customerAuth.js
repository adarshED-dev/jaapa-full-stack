// Customer authentication by email OTP.
//
// There is no password. The credential is "can receive a code on this phone
// or email", so everything that makes that safe lives here: codes are hashed,
// short-lived and attempt-limited, and requests are throttled per destination.
//
// Token model — the same shape as the admin side:
//   Access token  — JWT, 15 minutes, Authorization: Bearer, kept in memory.
//   Refresh token — 48 random bytes, 30 days (shoppers shouldn't be asked to
//                   sign in every week), httpOnly cookie scoped to /api/auth,
//                   stored only as a SHA-256 and rotated on every use.
//
// Email OTP uses the existing Gmail SMTP mailer when EMAIL_USER/
// EMAIL_APP_PASSWORD are configured.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");

const pool = require("../config/db");
const mailer = require("./mailer");
const { EMAIL_RE } = require("./validation");

function positiveIntegerEnv(name, fallback, { min = 1, max = 999 } = {}) {
    const value = Number(process.env[name]);
    if (!Number.isInteger(value)) return fallback;
    return Math.min(max, Math.max(min, value));
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_DAYS = 30;

const OTP_LENGTH = 4;
const OTP_TTL_MINUTES = positiveIntegerEnv("OTP_TTL_MINUTES", 10, { min: 1, max: 60 });
const OTP_MAX_ATTEMPTS = positiveIntegerEnv("OTP_MAX_ATTEMPTS", 5, { min: 1, max: 10 }); // wrong guesses before the code dies
const OTP_RESEND_SECONDS = 30;   // cooldown between sends to one destination
const OTP_MAX_PER_HOUR = 5;      // sends per destination per hour

const JWT_ISSUER = "jaapa-api";
const JWT_AUDIENCE = "jaapa-customer";

const REFRESH_COOKIE = "jaapa_customer_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

class AuthError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function requireSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16) {
        throw new AuthError(500, "Server auth is misconfigured", "NO_SECRET");
    }
    return secret;
}

/* ------------------------------------------------------------------ */
/* Login destinations                                                  */
/* ------------------------------------------------------------------ */

/**
 * One canonical form for a number so 9876543210, +91 98765 43210 and
 * 09876543210 are the same customer. Returns null if it isn't a valid Indian
 * mobile number.
 */
function normalisePhone(input) {
    const digits = String(input || "").replace(/\D/g, "");
    const local = digits.length > 10 ? digits.slice(-10) : digits;
    return /^[6-9]\d{9}$/.test(local) ? local : null;
}

function normaliseEmail(input) {
    const email = String(input || "").trim().toLowerCase();
    return EMAIL_RE.test(email) ? email : null;
}

/** 98765 43210 — what the login screen echoes back. */
function formatPhone(phone) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

function formatDestination(destination) {
    if (destination.phone) return `+91 ${formatPhone(destination.phone)}`;
    return destination.email;
}

function destinationColumn(destination) {
    return destination.email ? "email" : "phone";
}

function destinationValue(destination) {
    return destination.email || destination.phone;
}

function destinationKey(destination) {
    // Keep phone hashes compatible with existing unexpired codes. Email gets
    // a prefix so a phone-like local-part can never share the same hash input.
    return destination.email ? `email:${destination.email}` : destination.phone;
}

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

function generateCode() {
    // randomInt is uniform; Math.random() is neither uniform enough nor
    // unpredictable enough for a credential.
    const max = 10 ** OTP_LENGTH;
    return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

// Peppered with JWT_SECRET so the hashes are useless without the server's
// key — a 4-digit code has only 10,000 possibilities, and a bare SHA-256 of
// one is reversible with a lookup table in milliseconds.
function hashCode(destination, code) {
    return crypto
        .createHmac("sha256", requireSecret())
        .update(`${destinationKey(destination)}:${code}`)
        .digest("hex");
}

/** Timing-safe compare so response time doesn't leak how much of a code matched. */
function codeMatches(destination, code, storedHash) {
    const candidate = Buffer.from(hashCode(destination, code));
    const stored = Buffer.from(String(storedHash));
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
}

async function sendPhoneOtp(phone, code) {
    void phone;
    void code;
    throw new AuthError(501, "Mobile OTP is not available right now. Use email OTP.", "PHONE_OTP_DISABLED");
}

async function sendEmailOtp(email, code) {
    const sent = await mailer.sendMail({
        to: email,
        subject: "Your JAAPA sign-in code",
        html: `
            <div style="font-family:Arial,sans-serif;color:#1f1e1a;line-height:1.5">
                <p>Your JAAPA sign-in code is:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;color:#173a2c;">${code}</p>
                <p>This code expires in ${OTP_TTL_MINUTES} minutes. If you did not request it, you can ignore this email.</p>
            </div>
        `,
    });

    if (!sent) {
        throw new AuthError(500, "Unable to email a code right now", "EMAIL_OTP_FAILED");
    }
}

async function sendOtp(destination, code) {
    if (destination.email) {
        await sendEmailOtp(destination.email, code);
        return;
    }

    await sendPhoneOtp(destination.phone, code);
}

/* ------------------------------------------------------------------ */
/* Issuing a code                                                      */
/* ------------------------------------------------------------------ */

async function issueOtp(destination, { ip } = {}) {
    const column = destinationColumn(destination);
    const value = destinationValue(destination);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await pool.query(
        `SELECT created_at FROM customer_otp_codes
         WHERE ${column} = $1 AND created_at > $2
         ORDER BY created_at DESC`,
        [value, oneHourAgo]
    );

    if (recent.rows.length >= OTP_MAX_PER_HOUR) {
        throw new AuthError(
            429,
            `Too many codes requested for this ${column}. Try again in an hour.`,
            "OTP_RATE_LIMITED"
        );
    }

    if (recent.rows.length > 0) {
        const elapsed = (Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000;
        if (elapsed < OTP_RESEND_SECONDS) {
            throw new AuthError(
                429,
                `Please wait ${Math.ceil(OTP_RESEND_SECONDS - elapsed)} seconds before asking for another code.`,
                "OTP_COOLDOWN"
            );
        }
    }

    // Asking for a new code retires the old one, so only the newest is live.
    await pool.query(
        `UPDATE customer_otp_codes SET consumed_at = CURRENT_TIMESTAMP
         WHERE ${column} = $1 AND consumed_at IS NULL`,
        [value]
    );

    const code = generateCode();
    const otpId = randomUUID();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await pool.query(
        `INSERT INTO customer_otp_codes (id, phone, email, code_hash, expires_at, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            otpId,
            destination.phone || null,
            destination.email || null,
            hashCode(destination, code),
            expiresAt,
            ip || null,
        ]
    );

    try {
        await sendOtp(destination, code);
    } catch (error) {
        await pool.query("UPDATE customer_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1", [otpId]);
        throw error;
    }

    return {
        expiresInSeconds: OTP_TTL_MINUTES * 60,
        resendInSeconds: OTP_RESEND_SECONDS,
        otpLength: OTP_LENGTH,
    };
}

/* ------------------------------------------------------------------ */
/* Verifying a code                                                    */
/* ------------------------------------------------------------------ */

async function verifyOtp(destination, code) {
    const column = destinationColumn(destination);
    const value = destinationValue(destination);
    const result = await pool.query(
        `SELECT * FROM customer_otp_codes
         WHERE ${column} = $1 AND consumed_at IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [value]
    );

    const record = result.rows[0];
    if (!record) {
        throw new AuthError(400, "Ask for a code first.", "NO_CODE");
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
        throw new AuthError(410, "That code has expired. Ask for a new one.", "CODE_EXPIRED");
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
        throw new AuthError(429, "Too many wrong attempts. Ask for a new code.", "TOO_MANY_ATTEMPTS");
    }

    if (!codeMatches(destination, String(code || ""), record.code_hash)) {
        await pool.query(
            "UPDATE customer_otp_codes SET attempts = attempts + 1 WHERE id = $1",
            [record.id]
        );
        const updated = await pool.query("SELECT attempts FROM customer_otp_codes WHERE id = $1", [record.id]);
        const left = OTP_MAX_ATTEMPTS - updated.rows[0].attempts;

        if (left <= 0) {
            // Burn the code rather than leaving a dead row that would keep
            // answering "too many attempts" instead of "ask for a new one".
            await pool.query(
                "UPDATE customer_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1",
                [record.id]
            );
            throw new AuthError(429, "Too many wrong attempts. Ask for a new code.", "TOO_MANY_ATTEMPTS");
        }

        throw new AuthError(
            401,
            `That code isn't right. ${left} attempt${left === 1 ? "" : "s"} left.`,
            "BAD_CODE"
        );
    }

    // Single use: a correct code can't be replayed.
    await pool.query(
        "UPDATE customer_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = $1",
        [record.id]
    );
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

const DUPLICATE_KEY_CODES = new Set(["23505", "ER_DUP_ENTRY"]);

/**
 * Signing in for the first time creates the customer. Matching is done on the
 * last 10 digits because checkout may have already saved this person as
 * "+919876543210" while OTP login normalises to "9876543210".
 */
async function findOrCreateCustomerByPhone(phone) {
    const existing = await pool.query(
        `SELECT * FROM customers
         WHERE RIGHT(phone, 10) = $1
         ORDER BY created_at ASC LIMIT 1`,
        [phone]
    );

    if (existing.rows.length > 0) {
        return { customer: existing.rows[0], created: false };
    }

    const id = randomUUID();
    await pool.query("INSERT INTO customers (id, phone) VALUES ($1, $2)", [id, phone]);
    const created = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    return { customer: created.rows[0], created: true };
}

async function findOrCreateCustomerByEmail(email) {
    const existing = await pool.query(
        `SELECT * FROM customers
         WHERE LOWER(email) = $1
         ORDER BY created_at ASC LIMIT 1`,
        [email]
    );

    if (existing.rows.length > 0) {
        return { customer: existing.rows[0], created: false };
    }

    const id = randomUUID();
    let inserted = true;
    try {
        await pool.query("INSERT INTO customers (id, email) VALUES ($1, $2)", [id, email]);
    } catch (error) {
        if (!DUPLICATE_KEY_CODES.has(error.code)) throw error;
        inserted = false;
    }

    const created = await pool.query(
        `SELECT * FROM customers
         WHERE LOWER(email) = $1
         ORDER BY created_at ASC LIMIT 1`,
        [email]
    );
    return { customer: created.rows[0], created: inserted };
}

async function findOrCreateCustomer(destination) {
    if (destination.email) return findOrCreateCustomerByEmail(destination.email);
    return findOrCreateCustomerByPhone(destination.phone);
}

async function findCustomerById(id) {
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    return result.rows[0] || null;
}

async function registerLogin(customerId) {
    await pool.query(
        "UPDATE customers SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [customerId]
    );
}

/** The only shape of a customer that reaches the browser. */
function toPublicCustomer(customer) {
    const name = customer.full_name || "";
    const fallback = customer.phone || customer.email || "J";
    return {
        id: customer.id,
        fullName: name || null,
        email: customer.email || null,
        phone: customer.phone || null,
        acceptsMarketing: customer.accepts_marketing,
        defaultAddress: customer.default_address,
        ordersCount: customer.orders_count,
        totalSpent: Number(customer.total_spent || 0),
        initials:
            (name
                ? name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")
                : fallback.slice(0, 2)
            ).toUpperCase(),
        createdAt: customer.created_at,
    };
}

/* ------------------------------------------------------------------ */
/* Tokens and sessions                                                 */
/* ------------------------------------------------------------------ */

function signAccessToken(customer) {
    return jwt.sign(
        { sub: customer.id, phone: customer.phone || null, email: customer.email || null, ver: customer.token_version },
        requireSecret(),
        { expiresIn: ACCESS_TOKEN_TTL, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
    );
}

function verifyAccessToken(token) {
    try {
        return jwt.verify(token, requireSecret(), {
            issuer: JWT_ISSUER,
            // Audience matters: an admin token must not open a customer
            // endpoint, or the reverse.
            audience: JWT_AUDIENCE,
            algorithms: ["HS256"],
        });
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            throw new AuthError(401, "Your session expired", "TOKEN_EXPIRED");
        }
        throw new AuthError(401, "Not signed in", "INVALID_TOKEN");
    }
}

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession(customerId, { userAgent, ip } = {}) {
    const token = crypto.randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
        `INSERT INTO customer_sessions (id, customer_id, token_hash, user_agent, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), customerId, hashRefreshToken(token), userAgent || null, ip || null, expiresAt]
    );

    return { token, expiresAt };
}

async function findLiveSession(token) {
    if (!token) return null;
    const result = await pool.query(
        `SELECT * FROM customer_sessions
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
        [hashRefreshToken(token)]
    );
    return result.rows[0] || null;
}

async function revokeSession(token) {
    if (!token) return;
    await pool.query(
        "UPDATE customer_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND revoked_at IS NULL",
        [hashRefreshToken(token)]
    );
}

async function revokeAllSessions(customerId) {
    await pool.query(
        "UPDATE customer_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE customer_id = $1 AND revoked_at IS NULL",
        [customerId]
    );
}

/* ------------------------------------------------------------------ */
/* Cookie                                                              */
/* ------------------------------------------------------------------ */

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
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: REFRESH_COOKIE_PATH,
        maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    };
}

function setRefreshCookie(res, token) {
    res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
}

module.exports = {
    AuthError,
    OTP_TTL_MINUTES,
    OTP_RESEND_SECONDS,
    REFRESH_COOKIE,
    normalisePhone,
    normaliseEmail,
    formatPhone,
    formatDestination,
    issueOtp,
    verifyOtp,
    findOrCreateCustomerByPhone,
    findOrCreateCustomerByEmail,
    findOrCreateCustomer,
    findCustomerById,
    registerLogin,
    toPublicCustomer,
    signAccessToken,
    verifyAccessToken,
    createSession,
    findLiveSession,
    revokeSession,
    revokeAllSessions,
    readCookie,
    setRefreshCookie,
    clearRefreshCookie,
};
