// Gate for every admin-only endpoint.
//
//   router.post("/something", requireAdmin, handler)   // any signed-in admin
//   router.delete("/x", requireAdmin, requireRole("owner"), handler)
//
// Verifying the JWT signature alone isn't enough: a token stays
// cryptographically valid until it expires, even if the account was disabled
// or the password was changed a minute ago. So every request also re-reads
// the account and compares token_version.

const { verifyAccessToken, findAdminById, toPublicAdmin, AuthError } = require("../services/adminAuth");

function readBearerToken(req) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") return null;
    return token.trim();
}

async function requireAdmin(req, res, next) {
    try {
        const token = readBearerToken(req);
        if (!token) {
            throw new AuthError(401, "Sign in to continue", "NO_TOKEN");
        }

        const payload = verifyAccessToken(token);
        const admin = await findAdminById(payload.sub);

        if (!admin || !admin.is_active) {
            throw new AuthError(401, "This account is no longer active", "INACTIVE");
        }
        if (admin.token_version !== payload.ver) {
            throw new AuthError(401, "Your session is no longer valid", "TOKEN_REVOKED");
        }

        req.admin = toPublicAdmin(admin);
        next();
    } catch (error) {
        if (error instanceof AuthError) {
            return res.status(error.status).json({ success: false, message: error.message, code: error.code });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to verify your session" });
    }
}

/** Use after requireAdmin when an endpoint should be owner-only. */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.admin || !roles.includes(req.admin.role)) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to do that",
                code: "FORBIDDEN",
            });
        }
        next();
    };
}

module.exports = { requireAdmin, requireRole };
