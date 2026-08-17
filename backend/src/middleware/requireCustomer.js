// Gate for endpoints that belong to a signed-in shopper.
//
//   router.get("/my-orders", requireCustomer, handler)
//
// Same reasoning as requireAdmin: a JWT stays cryptographically valid until it
// expires, so every request re-reads the customer and compares token_version.
// That's what makes "sign out of all devices" take effect immediately.

const {
    verifyAccessToken,
    findCustomerById,
    toPublicCustomer,
    AuthError,
} = require("../services/customerAuth");

function readBearerToken(req) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (!token || scheme.toLowerCase() !== "bearer") return null;
    return token.trim();
}

async function requireCustomer(req, res, next) {
    try {
        const token = readBearerToken(req);
        if (!token) throw new AuthError(401, "Sign in to continue", "NO_TOKEN");

        const payload = verifyAccessToken(token);
        const customer = await findCustomerById(payload.sub);

        if (!customer) throw new AuthError(401, "Sign in to continue", "NO_CUSTOMER");
        if (customer.token_version !== payload.ver) {
            throw new AuthError(401, "Your session is no longer valid", "TOKEN_REVOKED");
        }

        req.customer = toPublicCustomer(customer);
        next();
    } catch (error) {
        if (error instanceof AuthError) {
            return res.status(error.status).json({ success: false, message: error.message, code: error.code });
        }
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to verify your session" });
    }
}

module.exports = { requireCustomer };
