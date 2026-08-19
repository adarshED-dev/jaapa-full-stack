// Shiprocket fulfilment.
//
// The admin "Ship Now" action calls createShipment(). When
// SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD are present, the order is pushed to
// Shiprocket's custom-order API and the returned Shiprocket order/shipment
// ids are saved back on our order.
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
const DEFAULT_LENGTH_CM =
    Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM || process.env.SHIPROCKET_DEFAULT_DIMENSION_CM) || 15;
const DEFAULT_BREADTH_CM =
    Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM || process.env.SHIPROCKET_DEFAULT_DIMENSION_CM) || 15;
const DEFAULT_HEIGHT_CM =
    Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM || process.env.SHIPROCKET_DEFAULT_DIMENSION_CM) || 15;

function isConfigured() {
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

class ShiprocketError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}

function parseJsonField(value, fallback) {
    if (value == null) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function cleanString(value, maxLength = 255) {
    return String(value ?? "").trim().slice(0, maxLength);
}

function numeric(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function phone10(value) {
    return cleanString(value).replace(/\D/g, "").slice(-10);
}

function truthyEnv(value) {
    return /^(1|true|yes)$/i.test(String(value || "").trim());
}

function shiprocketResponseData(data) {
    return data?.response?.data || data?.data || data || {};
}

function buildTrackingUrl(data) {
    const responseData = shiprocketResponseData(data);
    return responseData.tracking_url || data?.tracking_url || null;
}

function extractShipment(data) {
    const responseData = shiprocketResponseData(data);
    const shiprocketOrderId = responseData.order_id ?? data?.order_id;
    const shipmentId = responseData.shipment_id ?? data?.shipment_id;

    return {
        shiprocketOrderId: shiprocketOrderId == null ? null : String(shiprocketOrderId),
        shipmentId: shipmentId == null ? null : String(shipmentId),
        awbCode: responseData.awb_code || data?.awb_code || null,
        courierName: responseData.courier_name || data?.courier_name || null,
        trackingUrl: buildTrackingUrl(data),
        raw: data,
    };
}

function normalizeOrder(order) {
    return {
        ...order,
        customer_info: parseJsonField(order.customer_info, {}),
        items: parseJsonField(order.items, []),
        shipping_address: parseJsonField(order.shipping_address, null),
    };
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
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });
        return data;
    } catch (error) {
        throw new ShiprocketError(
            error.response?.data?.message || `Shiprocket rejected the request to ${path}`,
            error.response?.data
        );
    }
}

async function assignAwb(shipmentId) {
    if (!truthyEnv(process.env.SHIPROCKET_AUTO_ASSIGN_AWB)) return null;

    const body = { shipment_id: Number(shipmentId) || shipmentId };
    if (process.env.SHIPROCKET_COURIER_ID) {
        body.courier_id = Number(process.env.SHIPROCKET_COURIER_ID);
    }

    const data = await authedPost("/courier/assign/awb", body);
    return extractShipment(data);
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
    const normalized = normalizeOrder(order);
    const address = normalized.shipping_address || {};
    const customer = normalized.customer_info || {};
    const items = Array.isArray(normalized.items) ? normalized.items : [];

    if (items.length === 0) {
        throw new ShiprocketError("This order has no items to ship.");
    }

    if (!address.address1 || !address.city || !address.state || !address.pincode || !address.phone) {
        throw new ShiprocketError("This order has an incomplete shipping address.");
    }

    const payload = {
        order_id: normalized.order_number,
        order_date: new Date(normalized.created_at || Date.now()).toISOString().slice(0, 19).replace("T", " "),

        // Must exactly match a pickup location nickname already saved in the
        // Shiprocket dashboard (Settings -> Pickup Addresses) — there's no
        // way to create one through this API, so this has to be set up there
        // first regardless of what's configured here.
        pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",

        billing_customer_name: cleanString(address.fullName || customer.fullName || "Customer", 120),
        billing_last_name: "",
        billing_address: cleanString(address.address1, 200),
        billing_address_2: cleanString(address.address2, 200),
        billing_city: cleanString(address.city, 80),
        billing_state: cleanString(address.state, 80),
        billing_pincode: cleanString(address.pincode, 10),
        billing_country: cleanString(address.country || "India", 60),
        billing_phone: phone10(address.phone || customer.phone),
        billing_email: customer.email || undefined,
        shipping_is_billing: true,

        order_items: items.map((item) => ({
            name: cleanString(item.title || "Product", 200),
            sku: cleanString(item.sku || item.product_id || item.id || normalized.order_number, 100),
            units: numeric(item.quantity, 1),
            selling_price: numeric(item.unit_price || item.selling_price || item.price),
        })),

        payment_method: normalized.payment_method === "cod" ? "COD" : "Prepaid",
        shipping_charges: numeric(normalized.shipping_amount),
        total_discount: numeric(normalized.discount_amount),
        sub_total: numeric(normalized.subtotal_amount),
        invoice_number: normalized.order_number,
        company_name: process.env.SHIPROCKET_COMPANY_NAME || undefined,

        // Per-parcel weight/dimensions aren't tracked per product yet — see
        // the module comment above.
        length: DEFAULT_LENGTH_CM,
        breadth: DEFAULT_BREADTH_CM,
        height: DEFAULT_HEIGHT_CM,
        weight: DEFAULT_WEIGHT_KG,
    };

    const data = await authedPost("/orders/create/adhoc", payload);
    const shipment = extractShipment(data);

    if (!shipment.shipmentId) {
        throw new ShiprocketError(data.message || "Shiprocket didn't return a shipment id.", data);
    }

    const awb = await assignAwb(shipment.shipmentId);

    return {
        ...shipment,
        awbCode: awb?.awbCode || shipment.awbCode || null,
        courierName: awb?.courierName || shipment.courierName || null,
        trackingUrl: awb?.trackingUrl || shipment.trackingUrl || null,
    };
}

module.exports = {
    isConfigured,
    createShipment,
    ShiprocketError,
};
