// Order pricing. Every amount a customer is charged is worked out here, on
// the server, from prices read out of the database — never from a number the
// browser sent us.

const pool = require("../config/db");

const COD_FEE = 40;
const SHIPPING_FEE = 0; // free shipping across India for now

// Used when the GST section of store settings hasn't been filled in yet.
const DEFAULT_GST = {
    defaultRate: 18,
    pricesIncludeTax: true,
    taxOnShipping: true,
    stateRates: [],
};

function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

/**
 * Reads the GST section saved by the admin Settings tab. Falls back to
 * DEFAULT_GST if the table or the row isn't there, so checkout keeps working
 * on a fresh install.
 */
async function getGstSettings() {
    try {
        const result = await pool.query(
            "SELECT data FROM store_settings WHERE section = 'gst-settings'"
        );
        return { ...DEFAULT_GST, ...parseJsonField(result.rows[0]?.data, {}) };
    } catch (error) {
        console.warn("GST settings unavailable, using defaults:", error.message);
        return DEFAULT_GST;
    }
}

function resolveTaxRate(gst, shippingState) {
    const override = (gst.stateRates || []).find(
        (row) => row.state && shippingState && row.state.toLowerCase() === String(shippingState).toLowerCase()
    );
    const rate = Number(override ? override.rate : gst.defaultRate);
    return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_GST.defaultRate;
}

/**
 * items: [{ unit_price, quantity, ... }]
 *
 * Returns every line the checkout summary shows plus `amountInPaise`, which
 * is the only amount Razorpay is ever told about.
 */
function computeTotals({ items, gst, shippingState, paymentMethod = "razorpay", discountAmount = 0 }) {
    const subtotal = round2(
        items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0)
    );

    const taxRate = resolveTaxRate(gst, shippingState);
    const shippingAmount = SHIPPING_FEE;
    const codFee = paymentMethod === "cod" ? COD_FEE : 0;
    const discount = Math.min(round2(discountAmount), subtotal);

    // Inclusive pricing means the listed price already contains GST, so the
    // tax is extracted from the subtotal rather than added on top.
    const taxableBase = subtotal - discount + (gst.taxOnShipping ? shippingAmount : 0);
    const taxAmount = gst.pricesIncludeTax
        ? round2(taxableBase - taxableBase / (1 + taxRate / 100))
        : round2((taxableBase * taxRate) / 100);

    const total = gst.pricesIncludeTax
        ? round2(subtotal - discount + shippingAmount + codFee)
        : round2(subtotal - discount + shippingAmount + codFee + taxAmount);

    return {
        subtotal,
        taxRate,
        taxAmount,
        shippingAmount,
        codFee,
        discountAmount: discount,
        pricesIncludeTax: Boolean(gst.pricesIncludeTax),
        total,
        currency: "INR",
        // Razorpay works in the smallest currency unit. Rounding here (rather
        // than `total + "00"`) is what keeps ₹1799.50 from becoming ₹1799.5000.
        amountInPaise: Math.round(total * 100),
    };
}

// Coupons live here so the discount is decided by the server. The browser
// only ever sends a code — never an amount.
const COUPONS = {
    WELCOME10: { type: "flat", value: 100, minSubtotal: 500 },
};

function resolveDiscount(couponCode, subtotal) {
    const code = String(couponCode || "").trim().toUpperCase();
    if (!code) return { code: null, discountAmount: 0, message: null };

    const coupon = COUPONS[code];
    if (!coupon) {
        return { code: null, discountAmount: 0, message: "Invalid or expired coupon code." };
    }
    if (subtotal < coupon.minSubtotal) {
        return {
            code: null,
            discountAmount: 0,
            message: `This coupon needs a minimum order of ₹${coupon.minSubtotal}.`,
        };
    }

    const discountAmount =
        coupon.type === "percent"
            ? round2((subtotal * coupon.value) / 100)
            : Math.min(coupon.value, subtotal);

    return { code, discountAmount, message: `Coupon applied — you saved ₹${discountAmount}.` };
}

module.exports = {
    getGstSettings,
    computeTotals,
    resolveDiscount,
    round2,
    COD_FEE,
    SHIPPING_FEE,
};
