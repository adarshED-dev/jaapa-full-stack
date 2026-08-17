// Shared order/customer logic.
//
// The HTTP routes (POST /api/orders/place-order, POST /api/customers) and the
// Razorpay verify/webhook handlers all go through these functions, so a paid
// order and a COD order are built by exactly the same code.

const { randomUUID } = require("crypto");
const pool = require("../config/db");
const { getGstSettings, computeTotals, resolveDiscount } = require("./pricing");
const mailer = require("./mailer");
const { buildOrderConfirmationEmail } = require("../emails/orderConfirmation");

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const UNIQUE_VIOLATION = "23505";

/* ------------------------------------------------------------------ */
/* Line items — always priced from the products table                  */
/* ------------------------------------------------------------------ */

function toItem(row, quantity) {
    const unitPrice = Number(row.selling_price);
    return {
        product_id: String(row.id ?? row.product_id),
        title: row.title,
        handle: row.handle || null,
        image: Array.isArray(row.images) ? row.images[0] || null : null,
        unit_price: unitPrice,
        quantity: Number(quantity),
        line_total: Math.round(unitPrice * Number(quantity) * 100) / 100,
    };
}

async function buildItemsFromCart(db, cartId) {
    const result = await db.query(
        `SELECT ci.product_id, ci.quantity, p.title, p.handle, p.images, p.selling_price,
                p.status, p.quantity AS stock_quantity
         FROM cart_items ci
         JOIN products p ON p.id::text = ci.product_id
         WHERE ci.cart_id = $1
         ORDER BY ci.created_at ASC`,
        [cartId]
    );

    if (result.rows.length === 0) {
        throw new HttpError(400, "Your cart is empty");
    }

    const unavailable = result.rows.filter((row) => row.status !== "active");
    if (unavailable.length > 0) {
        throw new HttpError(
            409,
            `${unavailable.map((row) => row.title).join(", ")} is no longer available. Please remove it and try again.`
        );
    }

    // Checked here so /orders/quote and /payment/create-order both refuse a
    // cart that can't be fulfilled before any payment is attempted — the
    // atomic decrement in reserveStock is the race-safe backstop for the
    // moment of purchase itself, this is the early, friendly warning.
    const outOfStock = result.rows.filter(
        (row) => row.stock_quantity != null && Number(row.stock_quantity) < Number(row.quantity)
    );
    if (outOfStock.length > 0) {
        throw new HttpError(
            409,
            outOfStock.length === 1
                ? `Only ${outOfStock[0].stock_quantity} left of ${outOfStock[0].title}. Please update the quantity in your cart.`
                : `${outOfStock.map((row) => row.title).join(", ")} don't have enough stock for the quantity in your cart.`
        );
    }

    return result.rows.map((row) => toItem(row, row.quantity));
}

/**
 * Prices a cart and returns both the line items and every amount the
 * checkout summary needs. Used by the quote endpoint and by create-order, so
 * what the customer sees is what Razorpay is asked to charge.
 */
async function quoteCart({ cartId, shippingState, paymentMethod, couponCode }, db = pool) {
    const items = await buildItemsFromCart(db, cartId);
    const gst = await getGstSettings();

    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const coupon = resolveDiscount(couponCode, subtotal);

    const totals = computeTotals({
        items,
        gst,
        shippingState,
        paymentMethod,
        discountAmount: coupon.discountAmount,
    });

    return { items, totals, coupon };
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

function normalizeEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    return value || null;
}

// Razorpay hands back contacts like "+919876543210"; the checkout form sends
// "98765 43210". Both have to land on the same customer row.
function normalizePhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return null;
    const last10 = digits.slice(-10);
    return last10.length === 10 ? last10 : digits;
}

/**
 * Creates the customer, or fills in the blanks on the one that already
 * matches this email/phone. Never overwrites a stored value with an empty
 * one — a Razorpay payment that only carries a phone number shouldn't wipe
 * the name and address collected at checkout.
 */
async function upsertCustomer(db, input) {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);

    if (!email && !phone) {
        throw new HttpError(400, "A customer needs at least an email address or a phone number");
    }

    const fullName = input.fullName ? String(input.fullName).trim().slice(0, 120) : null;
    const address = input.address || null;
    const acceptsMarketing = input.acceptsMarketing === true;
    const razorpayCustomerId = input.razorpayCustomerId || null;

    const existing = await db.query(
        `SELECT * FROM customers
         WHERE ($1::text IS NOT NULL AND LOWER(email) = $1)
            OR ($2::text IS NOT NULL AND phone = $2)
         ORDER BY created_at ASC
         LIMIT 1`,
        [email, phone]
    );

    if (existing.rows.length > 0) {
        const updated = await db.query(
            `UPDATE customers
             SET email = COALESCE(email, $2),
                 phone = COALESCE(phone, $3),
                 full_name = COALESCE($4, full_name),
                 default_address = COALESCE($5::jsonb, default_address),
                 accepts_marketing = accepts_marketing OR $6,
                 razorpay_customer_id = COALESCE($7, razorpay_customer_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [
                existing.rows[0].id,
                email,
                phone,
                fullName,
                address ? JSON.stringify(address) : null,
                acceptsMarketing,
                razorpayCustomerId,
            ]
        );
        return { customer: updated.rows[0], created: false };
    }

    try {
        const inserted = await db.query(
            `INSERT INTO customers (id, email, phone, full_name, default_address, accepts_marketing, razorpay_customer_id)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
             RETURNING *`,
            [
                randomUUID(),
                email,
                phone,
                fullName,
                address ? JSON.stringify(address) : null,
                acceptsMarketing,
                razorpayCustomerId,
            ]
        );
        return { customer: inserted.rows[0], created: true };
    } catch (error) {
        // Two checkouts for the same person at once — the unique index caught
        // the second one, so read back the row the first one wrote.
        if (error.code !== UNIQUE_VIOLATION) throw error;
        const retry = await db.query(
            `SELECT * FROM customers
             WHERE ($1::text IS NOT NULL AND LOWER(email) = $1)
                OR ($2::text IS NOT NULL AND phone = $2)
             LIMIT 1`,
            [email, phone]
        );
        if (retry.rows.length === 0) throw error;
        return { customer: retry.rows[0], created: false };
    }
}

async function recordCustomerPurchase(db, customerId, amount) {
    if (!customerId) return;
    await db.query(
        `UPDATE customers
         SET orders_count = orders_count + 1,
             total_spent = total_spent + $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [customerId, Number(amount) || 0]
    );
}

/* ------------------------------------------------------------------ */
/* Stock                                                               */
/* ------------------------------------------------------------------ */

/**
 * Strict decrement — used for COD, where no money has moved yet. The
 * `quantity >= $2` guard makes this one atomic UPDATE per item: if two
 * checkouts race for the last few units, the second one to reach this call
 * gets zero rows back and the whole order transaction rolls back around it,
 * rather than either one reading stale stock and going negative.
 *
 * Must run inside the same transaction as the order insert.
 */
async function reserveStock(db, items) {
    for (const item of items) {
        const result = await db.query(
            `UPDATE products
             SET quantity = quantity - $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND quantity >= $2
             RETURNING quantity`,
            [item.product_id, item.quantity]
        );

        if (result.rows.length === 0) {
            throw new HttpError(
                409,
                `${item.title || "One of the items in your order"} doesn't have enough stock left. Please update your cart and try again.`
            );
        }
    }
}

/**
 * Best-effort decrement — used once a Razorpay payment has already been
 * captured. The money has moved by this point, so the order has to be
 * fulfilled regardless of what stock says; this floors at zero instead of
 * throwing, because refusing to finish recording a paid order over a stock
 * race is worse than a product briefly reading 0 for the admin to notice via
 * the low-stock alert.
 */
async function deductStockAfterPayment(db, items) {
    for (const item of items) {
        const result = await db.query(
            `UPDATE products
             SET quantity = GREATEST(quantity - $2, 0), updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND quantity IS NOT NULL
             RETURNING quantity`,
            [item.product_id, item.quantity]
        );

        if (result.rows.length > 0 && Number(result.rows[0].quantity) === 0) {
            console.warn(
                `Stock for product ${item.product_id} hit 0 while fulfilling a paid order — check for oversell.`
            );
        }
    }
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

// Timestamp in base36 plus two random characters — readable, sortable, and
// unique without a round trip to the database.
function generateOrderNumber() {
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `JP-${stamp}-${suffix}`;
}

/**
 * Inserts an order. `payment_status` is "pending" for COD and "created" for a
 * Razorpay order that hasn't been paid yet — markOrderPaid moves it to "paid".
 */
async function createOrder(db, order) {
    const id = randomUUID();
    const orderNumber = order.orderNumber || generateOrderNumber();
    const totals = order.totals;

    const result = await db.query(
        `INSERT INTO orders (
            id, order_number, cart_id, customer_id, customer_info, items,
            subtotal_amount, tax_amount, tax_rate, shipping_amount, cod_fee,
            discount_amount, total_amount, currency, shipping_address,
            payment_method, payment_status, status, razorpay_order_id,
            coupon_code, notes
         ) VALUES (
            $1, $2, $3, $4, $5::jsonb, $6::jsonb,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15::jsonb,
            $16, $17, $18, $19,
            $20, $21
         ) RETURNING *`,
        [
            id,
            orderNumber,
            order.cartId || null,
            order.customerId || null,
            JSON.stringify(order.customer || {}),
            JSON.stringify(order.items || []),
            totals.subtotal,
            totals.taxAmount,
            totals.taxRate,
            totals.shippingAmount,
            totals.codFee,
            totals.discountAmount,
            totals.total,
            totals.currency,
            order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
            order.paymentMethod || null,
            order.paymentStatus || "pending",
            order.status || "pending",
            order.razorpayOrderId || null,
            order.couponCode || null,
            order.notes || null,
        ]
    );

    return result.rows[0];
}

/**
 * Flips an order to paid. The `payment_status <> 'paid'` guard makes this
 * idempotent: whichever of the browser callback and the webhook arrives
 * second updates nothing and gets back null.
 */
async function markOrderPaid(db, { orderId, customerId, paymentId, signature, paymentDetails }) {
    const result = await db.query(
        `UPDATE orders
         SET payment_status = 'paid',
             status = 'confirmed',
             customer_id = COALESCE($2, customer_id),
             razorpay_payment_id = $3,
             razorpay_signature = COALESCE($4, razorpay_signature),
             payment_details = $5::jsonb,
             paid_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_status <> 'paid'
         RETURNING *`,
        [
            orderId,
            customerId || null,
            paymentId,
            signature || null,
            paymentDetails ? JSON.stringify(paymentDetails) : null,
        ]
    );

    return result.rows[0] || null;
}

async function markOrderFailed(db, orderId, reason) {
    await db.query(
        `UPDATE orders
         SET payment_status = 'failed',
             status = 'cancelled',
             notes = COALESCE(notes || E'\\n', '') || $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_status NOT IN ('paid', 'failed')`,
        [orderId, `Payment failed: ${reason || "unknown reason"}`]
    );
}

/**
 * Marks earlier unpaid attempts on the same cart as abandoned so a customer
 * who dismisses the Razorpay popup and tries again doesn't leave a trail of
 * pending orders. A late payment on one of them still gets fulfilled —
 * markOrderPaid only refuses orders that are already paid.
 */
async function abandonPendingOrders(db, cartId) {
    if (!cartId) return;
    await db.query(
        `UPDATE orders
         SET payment_status = 'abandoned', status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE cart_id = $1 AND payment_status = 'created'`,
        [cartId]
    );
}

async function closeCart(db, cartId) {
    if (!cartId) return;
    await db.query(
        "UPDATE carts SET status = 'converted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [cartId]
    );
}

/**
 * `forUpdate` locks the row for the rest of the transaction. Fulfilment uses
 * it so the browser callback and the webhook — which routinely arrive within
 * milliseconds of each other — take turns instead of both deciding the order
 * still needs to be marked paid.
 */
async function findOrderByRazorpayOrderId(db, razorpayOrderId, { forUpdate = false } = {}) {
    const result = await db.query(
        `SELECT * FROM orders WHERE razorpay_order_id = $1${forUpdate ? " FOR UPDATE" : ""}`,
        [razorpayOrderId]
    );
    return result.rows[0] || null;
}

async function findOrderByNumber(db, orderNumber) {
    const result = await db.query("SELECT * FROM orders WHERE order_number = $1", [orderNumber]);
    return result.rows[0] || null;
}

/**
 * What an order looks like to the storefront. The raw row carries the
 * Razorpay signature and the full gateway payload, neither of which has any
 * business being sent to a browser.
 */
function toPublicOrder(order) {
    if (!order) return null;
    return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        items: order.items,
        customer: order.customer_info,
        shipping_address: order.shipping_address,
        subtotal_amount: Number(order.subtotal_amount),
        tax_amount: Number(order.tax_amount),
        tax_rate: Number(order.tax_rate),
        shipping_amount: Number(order.shipping_amount),
        cod_fee: Number(order.cod_fee),
        discount_amount: Number(order.discount_amount),
        total_amount: Number(order.total_amount),
        currency: order.currency,
        coupon_code: order.coupon_code,
        razorpay_order_id: order.razorpay_order_id,
        razorpay_payment_id: order.razorpay_payment_id,
        paid_at: order.paid_at,
        created_at: order.created_at,
        // Genuinely useful on the customer's own order-confirmation/tracking
        // view ("has this shipped, where is it"), so it travels with the
        // rest of the order rather than being admin-only. The internal
        // Shiprocket order/shipment ids stay off this shape — see the admin
        // listing routes, which add those on top of toPublicOrder.
        fulfilment_status: order.fulfilment_status,
        awb_code: order.awb_code,
        courier_name: order.courier_name,
        tracking_url: order.tracking_url,
        shipped_at: order.shipped_at,
    };
}

/**
 * Sends the "your order is confirmed" email — best-effort, never throws.
 * Called after the order's transaction has already committed, from both the
 * COD path and the Razorpay-paid path, so a customer gets exactly one of
 * these regardless of which way they checked out.
 *
 * `email` is passed in rather than read off the order, because by the time
 * this runs the caller usually has a fresher one (the customer row, updated
 * from what Razorpay actually reports) than the JSONB snapshot taken at
 * checkout.
 */
async function sendOrderConfirmationEmail(order, email) {
    if (!email) {
        console.warn(`[mailer] Order ${order.order_number} has no email on file — confirmation not sent`);
        return;
    }
    if (!mailer.isConfigured()) {
        console.warn(`[mailer] Skipped confirmation for ${order.order_number} — EMAIL_USER/EMAIL_APP_PASSWORD not set`);
        return;
    }

    try {
        const storefrontUrl = (process.env.STOREFRONT_URL || "http://localhost:5173").replace(/\/+$/, "");
        const { subject, html } = buildOrderConfirmationEmail(order, storefrontUrl);
        await mailer.sendMail({ to: email, subject, html });
    } catch (error) {
        // buildOrderConfirmationEmail throwing (malformed order data) is the
        // only way this reaches here — mailer.sendMail already swallows its
        // own errors — and either way an email problem must never surface as
        // an order problem.
        console.error(`[mailer] Unable to build confirmation email for ${order.order_number}:`, error.message);
    }
}

module.exports = {
    HttpError,
    toPublicOrder,
    buildItemsFromCart,
    quoteCart,
    upsertCustomer,
    recordCustomerPurchase,
    reserveStock,
    sendOrderConfirmationEmail,
    deductStockAfterPayment,
    createOrder,
    markOrderPaid,
    markOrderFailed,
    abandonPendingOrders,
    closeCart,
    findOrderByRazorpayOrderId,
    findOrderByNumber,
    generateOrderNumber,
};
