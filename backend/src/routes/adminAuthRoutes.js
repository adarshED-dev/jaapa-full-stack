// Admin authentication.
//
//   POST /api/admin/auth/login            { email, password } -> { accessToken, admin }
//   POST /api/admin/auth/refresh          (refresh cookie)    -> { accessToken, admin }
//   POST /api/admin/auth/logout           (refresh cookie)
//   POST /api/admin/auth/logout-all       (bearer)  sign out every device
//   GET  /api/admin/auth/me               (bearer)
//   GET  /api/admin/auth/sessions         (bearer)  devices currently signed in
//   DELETE /api/admin/auth/sessions/:id   (bearer)  sign one device out
//   POST /api/admin/auth/change-password  (bearer)
//
// There is no registration route on purpose — see src/scripts/createAdmin.js.

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { requireAdmin } = require("../middleware/requireAdmin");
const {
    AuthError,
    MAX_FAILED_ATTEMPTS,
    validatePasswordStrength,
    hashPassword,
    verifyPassword,
    dummyHash,
    signAccessToken,
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
    REFRESH_COOKIE,
} = require("../services/adminAuth");

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

function sendError(res, error, fallback) {
    if (error instanceof AuthError) {
        return res.status(error.status).json({ success: false, message: error.message, code: error.code });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: fallback });
}

function clientIp(req) {
    return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || null;
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

// Per-IP throttle in front of the per-account lockout, so one attacker can't
// work through a list of accounts without tripping anything. In-memory is
// fine for a single process; move to Redis if you ever run more than one.
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_ATTEMPTS = 12;
const attemptsByIp = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of attemptsByIp) {
        if (now > entry.resetAt) attemptsByIp.delete(ip);
    }
}, RATE_WINDOW_MS).unref();

function rateLimitLogin(req, res, next) {
    const ip = clientIp(req) || "unknown";
    const now = Date.now();
    const entry = attemptsByIp.get(ip);

    if (!entry || now > entry.resetAt) {
        attemptsByIp.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }

    entry.count += 1;
    if (entry.count > RATE_MAX_ATTEMPTS) {
        const minutes = Math.ceil((entry.resetAt - now) / 60000);
        return res.status(429).json({
            success: false,
            message: `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            code: "RATE_LIMITED",
        });
    }
    next();
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

router.post("/login", rateLimitLogin, async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!EMAIL_RE.test(email) || !password) {
            throw new AuthError(400, "Enter a valid email address and password", "INVALID_INPUT");
        }

        const admin = await findAdminByEmail(email);

        // Same message whether the account doesn't exist, is disabled, or the
        // password is wrong — anything more specific tells an attacker which
        // email addresses are real.
        const genericFailure = new AuthError(401, "Email or password is incorrect", "BAD_CREDENTIALS");

        if (!admin) {
            // Spend roughly the same time as a real bcrypt compare so response
            // timing doesn't reveal whether the account exists.
            await verifyPassword(password, await dummyHash());
            throw genericFailure;
        }

        if (!admin.is_active) throw genericFailure;

        const lockedFor = lockRemainingMinutes(admin);
        if (lockedFor > 0) {
            throw new AuthError(
                423,
                `Too many failed attempts. This account is locked for ${lockedFor} more minute${lockedFor === 1 ? "" : "s"}.`,
                "ACCOUNT_LOCKED"
            );
        }

        const passwordOk = await verifyPassword(password, admin.password_hash);
        if (!passwordOk) {
            const { locked, remaining } = await registerFailedAttempt(admin);
            if (locked) {
                throw new AuthError(
                    423,
                    "Too many failed attempts. This account is locked for 15 minutes.",
                    "ACCOUNT_LOCKED"
                );
            }
            throw new AuthError(
                401,
                `Email or password is incorrect. ${remaining} attempt${remaining === 1 ? "" : "s"} left before this account locks.`,
                "BAD_CREDENTIALS"
            );
        }

        await registerSuccessfulLogin(admin.id, clientIp(req));

        const { token: refreshToken } = await createSession(admin.id, {
            userAgent: req.headers["user-agent"],
            ip: clientIp(req),
        });
        setRefreshCookie(res, refreshToken);

        const fresh = await findAdminById(admin.id);
        res.json({
            success: true,
            accessToken: signAccessToken(fresh),
            admin: toPublicAdmin(fresh),
        });
    } catch (error) {
        sendError(res, error, "Unable to sign you in right now");
    }
});

/* ------------------------------------------------------------------ */
/* Refresh — rotates the token on every call                           */
/* ------------------------------------------------------------------ */

router.post("/refresh", async (req, res) => {
    try {
        const presented = readCookie(req, REFRESH_COOKIE);
        const session = await findLiveSession(presented);

        if (!session) {
            clearRefreshCookie(res);
            throw new AuthError(401, "Please sign in again", "NO_SESSION");
        }

        const admin = await findAdminById(session.admin_id);
        if (!admin || !admin.is_active) {
            await revokeSession(presented);
            clearRefreshCookie(res);
            throw new AuthError(401, "This account is no longer active", "INACTIVE");
        }

        // Rotation: the presented token dies here and a new one takes its
        // place, so a stolen refresh token is usable at most once.
        await revokeSession(presented);
        const { token: nextToken } = await createSession(admin.id, {
            userAgent: req.headers["user-agent"],
            ip: clientIp(req),
        });
        setRefreshCookie(res, nextToken);

        res.json({
            success: true,
            accessToken: signAccessToken(admin),
            admin: toPublicAdmin(admin),
        });
    } catch (error) {
        sendError(res, error, "Unable to refresh your session");
    }
});

/* ------------------------------------------------------------------ */
/* Logout                                                              */
/* ------------------------------------------------------------------ */

router.post("/logout", async (req, res) => {
    try {
        await revokeSession(readCookie(req, REFRESH_COOKIE));
        clearRefreshCookie(res);
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, "Unable to sign you out");
    }
});

router.post("/logout-all", requireAdmin, async (req, res) => {
    try {
        await revokeAllSessions(req.admin.id);
        // Invalidates every access token already handed out for this account.
        await pool.query(
            "UPDATE admin_users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [req.admin.id]
        );
        clearRefreshCookie(res);
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, "Unable to sign out everywhere");
    }
});

/* ------------------------------------------------------------------ */
/* Session info + password change                                      */
/* ------------------------------------------------------------------ */

router.get("/me", requireAdmin, (req, res) => {
    res.json({ success: true, admin: req.admin });
});

// The panel's "signed-in devices" list. Anything here that the owner doesn't
// recognise can be revoked on the spot — that session's next refresh fails
// and it drops back to the login screen within 15 minutes at worst.
router.get("/sessions", requireAdmin, async (req, res) => {
    try {
        const sessions = await listSessions(req.admin.id, readCookie(req, REFRESH_COOKIE));
        res.json({ success: true, sessions });
    } catch (error) {
        sendError(res, error, "Unable to load your sessions");
    }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.delete("/sessions/:id", requireAdmin, async (req, res) => {
    try {
        // Postgres raises a type error on a malformed UUID, which would surface
        // as a 500 — reject it here as the 404 it actually is.
        if (!UUID_RE.test(req.params.id)) {
            throw new AuthError(404, "That session is already signed out", "NO_SESSION");
        }

        const revoked = await revokeSessionById(req.admin.id, req.params.id);
        if (!revoked) throw new AuthError(404, "That session is already signed out", "NO_SESSION");
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, "Unable to sign that device out");
    }
});

router.post("/change-password", requireAdmin, async (req, res) => {
    try {
        const currentPassword = String(req.body.currentPassword || "");
        const newPassword = String(req.body.newPassword || "");

        const admin = await findAdminById(req.admin.id);
        if (!admin) throw new AuthError(401, "Please sign in again", "NO_SESSION");

        const currentOk = await verifyPassword(currentPassword, admin.password_hash);
        if (!currentOk) {
            throw new AuthError(401, "Your current password is incorrect", "BAD_CREDENTIALS");
        }

        const weakness = validatePasswordStrength(newPassword);
        if (weakness) throw new AuthError(400, weakness, "WEAK_PASSWORD");

        if (await verifyPassword(newPassword, admin.password_hash)) {
            throw new AuthError(400, "Choose a password you haven't used here before", "PASSWORD_REUSED");
        }

        // Changing the password signs out every other device: sessions are
        // revoked and token_version moves, killing outstanding access tokens.
        await pool.query(
            `UPDATE admin_users
             SET password_hash = $2,
                 password_changed_at = CURRENT_TIMESTAMP,
                 token_version = token_version + 1,
                 failed_attempts = 0,
                 locked_until = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [admin.id, await hashPassword(newPassword)]
        );
        await revokeAllSessions(admin.id);

        const updated = await findAdminById(admin.id);
        const { token: refreshToken } = await createSession(updated.id, {
            userAgent: req.headers["user-agent"],
            ip: clientIp(req),
        });
        setRefreshCookie(res, refreshToken);

        res.json({
            success: true,
            message: "Password updated. Other devices have been signed out.",
            accessToken: signAccessToken(updated),
            admin: toPublicAdmin(updated),
        });
    } catch (error) {
        sendError(res, error, "Unable to change your password");
    }
});

module.exports = router;
