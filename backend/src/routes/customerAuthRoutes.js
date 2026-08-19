// Customer sign-in by email OTP.
//
//   POST /api/auth/request-otp   { email }       -> { expiresInSeconds, otpLength }
//   POST /api/auth/verify-otp    { email, code } -> { accessToken, customer }
//   POST /api/auth/refresh       (refresh cookie)  -> { accessToken, customer }
//   POST /api/auth/logout        (refresh cookie)
//   POST /api/auth/logout-all    (bearer)
//   GET  /api/auth/me            (bearer)
//   PATCH /api/auth/me           (bearer)  name / email / marketing opt-in
//   GET  /api/auth/orders        (bearer)  the signed-in customer's own orders
//
// Signing in creates the customer if this is a new email — there is no
// separate sign-up step.

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { requireCustomer } = require("../middleware/requireCustomer");
const { EMAIL_RE, clean } = require("../services/validation");
const { toPublicOrder } = require("../services/orderService");
const {
    AuthError,
    normaliseEmail,
    formatDestination,
    issueOtp,
    verifyOtp,
    findOrCreateCustomer,
    findCustomerById,
    registerLogin,
    toPublicCustomer,
    signAccessToken,
    createSession,
    findLiveSession,
    revokeSession,
    revokeAllSessions,
    readCookie,
    setRefreshCookie,
    clearRefreshCookie,
    REFRESH_COOKIE,
} = require("../services/customerAuth");

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

function readOtpDestination(body = {}) {
    const email = normaliseEmail(body.email || body.identifier);
    if (!email) throw new AuthError(400, "Enter a valid email address", "INVALID_EMAIL");
    return { email };
}

/* ------------------------------------------------------------------ */
/* Per-IP throttle                                                     */
/* ------------------------------------------------------------------ */

// The per-destination limits in customerAuth stop one phone/email being
// hammered. This stops one machine walking through a list of destinations.
// In-memory is fine for a single process; move to Redis before running more
// than one.
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 30;
const hits = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
        if (now > entry.resetAt) hits.delete(ip);
    }
}, RATE_WINDOW_MS).unref();

function rateLimit(req, res, next) {
    const ip = clientIp(req) || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }

    entry.count += 1;
    if (entry.count > RATE_MAX) {
        const minutes = Math.ceil((entry.resetAt - now) / 60000);
        return res.status(429).json({
            success: false,
            message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
            code: "RATE_LIMITED",
        });
    }
    next();
}

/* ------------------------------------------------------------------ */
/* Request a code                                                      */
/* ------------------------------------------------------------------ */

router.post("/request-otp", rateLimit, async (req, res) => {
    try {
        const destination = readOtpDestination(req.body);

        const result = await issueOtp(destination, { ip: clientIp(req) });

        res.json({
            success: true,
            message: `Code sent to ${formatDestination(destination)}`,
            channel: destination.email ? "email" : "phone",
            phone: destination.phone || null,
            email: destination.email || null,
            expiresInSeconds: result.expiresInSeconds,
            resendInSeconds: result.resendInSeconds,
            otpLength: result.otpLength,
        });
    } catch (error) {
        sendError(res, error, "Unable to send a code right now");
    }
});

/* ------------------------------------------------------------------ */
/* Verify and sign in                                                  */
/* ------------------------------------------------------------------ */

router.post("/verify-otp", rateLimit, async (req, res) => {
    try {
        const destination = readOtpDestination(req.body);

        const code = String(req.body.code || "").trim();
        if (!/^\d{4}$/.test(code)) {
            throw new AuthError(400, "Enter the 4-digit OTP code", "INVALID_CODE");
        }

        await verifyOtp(destination, code);

        const { customer, created } = await findOrCreateCustomer(destination);
        await registerLogin(customer.id);

        const { token: refreshToken } = await createSession(customer.id, {
            userAgent: req.headers["user-agent"],
            ip: clientIp(req),
        });
        setRefreshCookie(res, refreshToken);

        const fresh = await findCustomerById(customer.id);
        res.json({
            success: true,
            isNewCustomer: created,
            accessToken: signAccessToken(fresh),
            customer: toPublicCustomer(fresh),
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

        const customer = await findCustomerById(session.customer_id);
        if (!customer) {
            await revokeSession(presented);
            clearRefreshCookie(res);
            throw new AuthError(401, "Please sign in again", "NO_CUSTOMER");
        }

        await revokeSession(presented);
        const { token: nextToken } = await createSession(customer.id, {
            userAgent: req.headers["user-agent"],
            ip: clientIp(req),
        });
        setRefreshCookie(res, nextToken);

        res.json({
            success: true,
            accessToken: signAccessToken(customer),
            customer: toPublicCustomer(customer),
        });
    } catch (error) {
        sendError(res, error, "Unable to refresh your session");
    }
});

/* ------------------------------------------------------------------ */
/* Sign out                                                            */
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

router.post("/logout-all", requireCustomer, async (req, res) => {
    try {
        await revokeAllSessions(req.customer.id);
        await pool.query(
            "UPDATE customers SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [req.customer.id]
        );
        clearRefreshCookie(res);
        res.json({ success: true });
    } catch (error) {
        sendError(res, error, "Unable to sign out everywhere");
    }
});

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

router.get("/me", requireCustomer, (req, res) => {
    res.json({ success: true, customer: req.customer });
});

// What a first-time customer fills in after signing in — OTP may only give us
// an email address.
router.patch("/me", requireCustomer, async (req, res) => {
    try {
        const fullName = req.body.fullName === undefined ? undefined : clean(req.body.fullName);
        const email =
            req.body.email === undefined ? undefined : clean(req.body.email, 255).toLowerCase();

        if (email && !EMAIL_RE.test(email)) {
            throw new AuthError(400, "Enter a valid email address", "INVALID_EMAIL");
        }

        const acceptsMarketing =
            req.body.acceptsMarketing === undefined ? undefined : Boolean(req.body.acceptsMarketing);

        // COALESCE keeps a field untouched when the request didn't mention it,
        // so a form that only edits the name can't blank out the email.
        await pool.query(
            `UPDATE customers
             SET full_name = COALESCE($2, full_name),
                 email = COALESCE($3, email),
                 accepts_marketing = COALESCE($4, accepts_marketing),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [
                req.customer.id,
                fullName === undefined || fullName === "" ? null : fullName,
                email === undefined || email === "" ? null : email,
                acceptsMarketing === undefined ? null : acceptsMarketing,
            ]
        );

        const result = await pool.query("SELECT * FROM customers WHERE id = $1", [req.customer.id]);
        res.json({ success: true, customer: toPublicCustomer(result.rows[0]) });
    } catch (error) {
        // customers_email_key: this address already belongs to another account.
        if (error.code === "23505" || error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "That email is already used by another account",
                code: "EMAIL_TAKEN",
            });
        }
        sendError(res, error, "Unable to save your details");
    }
});

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

// Scoped to req.customer.id from the token — there is no id in the URL to
// tamper with, so this can only ever return the signed-in customer's own
// orders.
router.get("/orders", requireCustomer, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
            [req.customer.id]
        );
        res.json({
            success: true,
            count: result.rows.length,
            orders: result.rows.map(toPublicOrder),
        });
    } catch (error) {
        sendError(res, error, "Unable to load your orders");
    }
});

module.exports = router;
