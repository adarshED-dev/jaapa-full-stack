// Shiprocket — NOT CONNECTED YET.
//
// This is the real integration shape, not a placeholder that gets thrown
// away later: the moment SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are set in
// .env, createShipment() below starts actually talking to Shiprocket with no
// further code changes. Until then, isConfigured() is false and the route
// that calls this refuses cleanly instead of pretending to ship something.
//
// Auth model: POST /auth/login returns a bearer token good for ~10 days.
// There's no refresh endpoint — cache it and re-login when it's close to
// expiring, same pattern as every other token cache in this backend.

const axios = require("axios");

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

// A guessed default so a shipment can be created before every product has
// real weight/dimensions recorded — there's no per-product weight/size field
// yet. Override via env if your typical parcel differs.
const DEFAULT_WEIGHT_KG = Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG) || 0.5;
const DEFAULT_DIMENSION_CM = Number(process.env.SHIPROCKET_DEFAULT_DIMENSION_CM) || 15;

function isConfigured() {
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

class ShiprocketError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}

/* ------------------------------------------------------------------ */
/* Auth — cached in memory, re-logged-in a day before it actually expires */
/* ------------------------------------------------------------------ */

let cached = { token: null, expiresAt: 0 };

async function getToken() {
    if (cached.token && Date.now() < cached.expiresAt) return cached.token;

    try {
        const { data } = await axios.post(`${BASE_URL}/auth/login`, {
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD,
        });

        cached = {
            token: data.token,
            expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000, // valid ~10 days; refresh a day early
        };
        return cached.token;
    } catch (error) {
        throw new ShiprocketError(
            "Couldn't sign in to Shiprocket. Check SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD.",
            error.response?.data
        );
    }
}

async function authedPost(path, body) {
    const token = await getToken();
    try {
        const { data } = await axios.post(`${BASE_URL}${path}`, body, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return data;
    } catch (error) {
        throw new ShiprocketError(
            error.response?.data?.message || `Shiprocket rejected the request to ${path}`,
            error.response?.data
        );
    }
}

/* ------------------------------------------------------------------ */
/* Create the shipment                                                 */
/* ------------------------------------------------------------------ */

/**
 * order: a full row from the `orders` table (items, shipping_address,
 * total_amount, etc. — exactly what pool.query("SELECT * FROM orders...")
 * returns).
 *
 * Returns { shiprocketOrderId, shipmentId }. Throws ShiprocketError on any
 * rejection (bad pincode, misconfigured pickup location, ...) — the caller
 * persists error.message onto the order rather than silently failing.
 */
async function createShipment(order) {
    const address = order.shipping_address || {};
    const items = Array.isArray(order.items) ? order.items : [];

    if (items.length === 0) {
        throw new ShiprocketError("This order has no items to ship.");
    }

    const payload = {
        order_id: order.order_number,
        order_date: new Date(order.created_at).toISOString().slice(0, 19).replace("T", " "),

        // Must exactly match a pickup location nickname already saved in the
        // Shiprocket dashboard (Settings -> Pickup Addresses) — there's no
        // way to create one through this API, so this has to be set up there
        // first regardless of what's configured here.
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",

        billing_customer_name: address.fullName || "Customer",
        billing_last_name: "",
        billing_address: address.address1 || "",
        billing_address_2: address.address2 || "",
        billing_city: address.city || "",
        billing_state: address.state || "",
        billing_pincode: address.pincode || "",
        billing_country: address.country || "India",
        billing_phone: (address.phone || "").replace(/\D/g, "").slice(-10),
        billing_email: order.customer_info?.email || undefined,
        shipping_is_billing: true,

        order_items: items.map((item) => ({
            name: item.title,
            sku: item.product_id,
            units: item.quantity,
            selling_price: item.unit_price,
        })),

        payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
        sub_total: Number(order.subtotal_amount),

        // Per-parcel weight/dimensions aren't tracked per product yet — see
        // the module comment above.
        length: DEFAULT_DIMENSION_CM,
        breadth: DEFAULT_DIMENSION_CM,
        height: DEFAULT_DIMENSION_CM,
        weight: DEFAULT_WEIGHT_KG,
    };

    const data = await authedPost("/orders/create/adhoc", payload);

    if (!data.shipment_id) {
        throw new ShiprocketError(data.message || "Shiprocket didn't return a shipment id.", data);
    }

    return {
        shiprocketOrderId: String(data.order_id),
        shipmentId: String(data.shipment_id),
    };
}

module.exports = {
    isConfigured,
    createShipment,
    ShiprocketError,
};
