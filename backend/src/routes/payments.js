// Razorpay payment flow.
//
//   POST /api/payment/create-order  — prices the cart server-side, saves a
//                                     pending order, opens a Razorpay order.
//   POST /api/payment/verify        — checks the signature, confirms the
//                                     payment with Razorpay, creates the
//                                     customer and marks the order paid.
//   POST /api/payment/webhook       — same fulfilment, driven by Razorpay, so
//                                     an order still completes if the browser
//                                     is closed mid-redirect.
//
// The browser never tells us an amount and never tells us a payment
// succeeded — both come from Razorpay and from our own database.

const express = require("express");
const crypto = require("crypto");

const router = express.Router();
const pool = require("../config/db");
const razorpay = require("../config/razorpay");
const {
    HttpError,
    quoteCart,
    upsertCustomer,
    recordCustomerPurchase,
    deductStockAfterPayment,
    sendOrderConfirmationEmail,
    createOrder,
    markOrderPaid,
    markOrderFailed,
    abandonPendingOrders,
    closeCart,
    findOrderByRazorpayOrderId,
    toPublicOrder,
} = require("../services/orderService");
const { validateCustomer, validateShippingAddress } = require("../services/validation");

function sendError(res, error, fallbackMessage) {
    if (error instanceof HttpError) {
        return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: fallbackMessage });
}

// Constant-time compare so a signature can't be guessed byte by byte.
function signaturesMatch(expected, received) {
    const a = Buffer.from(String(expected));
    const b = Buffer.from(String(received || ""));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");
    return signaturesMatch(expected, signature);
}

/* ------------------------------------------------------------------ */
/* 1. Create order                                                     */
/* ------------------------------------------------------------------ */

router.post("/create-order", async (req, res) => {
    const client = await pool.connect();
    try {
        const { cartId, paymentMethod = "razorpay", couponCode = null } = req.body;

        if (!cartId) {
            throw new HttpError(400, "cartId is required");
        }
        if (paymentMethod === "cod") {
            throw new HttpError(400, "Use POST /api/orders/place-order for cash on delivery");
        }

        const customerCheck = validateCustomer(req.body.customer);
        if (customerCheck.error) throw new HttpError(400, customerCheck.error);

        const addressCheck = validateShippingAddress(req.body.shippingAddress);
        if (addressCheck.error) throw new HttpError(400, addressCheck.error);

        const customer = customerCheck.customer;
        const shippingAddress = addressCheck.address;

        // Prices come from the products table, taxes from the GST settings —
        // nothing here trusts the request body.
        const { items, totals, coupon } = await quoteCart(
            { cartId, shippingState: shippingAddress.state, paymentMethod, couponCode },
            client
        );

        const razorpayOrder = await razorpay.orders.create({
            amount: totals.amountInPaise,
            currency: totals.currency,
            receipt: `rcpt_${Date.now()}`,
            notes: {
                cart_id: String(cartId),
                customer_email: customer.email || "",
                customer_phone: customer.phone || "",
            },
        });

        await client.query("BEGIN");
        await abandonPendingOrders(client, cartId);

        // The order row is written now, in "created" state, so the webhook has
        // something to find even if the customer closes the tab after paying.
        const order = await createOrder(client, {
            cartId,
            customer,
            items,
            totals,
            shippingAddress,
            paymentMethod: "razorpay",
            paymentStatus: "created",
            status: "pending",
            razorpayOrderId: razorpayOrder.id,
            couponCode: coupon.code,
        });

        await client.query("COMMIT");

        res.json({
            success: true,
            keyId: process.env.RAZORPAY_KEY_ID,
            razorpayOrder: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
            },
            order: toPublicOrder(order),
            totals,
            coupon,
        });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
        sendError(res, error, "Unable to start this payment");
    } finally {
        client.release();
    }
});

/* ------------------------------------------------------------------ */
/* 2. Fulfilment — shared by verify and webhook                        */
/* ------------------------------------------------------------------ */

/**
 * Turns a confirmed Razorpay payment into a paid order:
 * customer upsert -> order marked paid -> cart closed.
 *
 * Safe to run twice. If the order is already paid (the webhook got here
 * first, or the customer refreshed) it returns that order untouched.
 */
async function fulfillPaidOrder({ payment, signature }) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const order = await findOrderByRazorpayOrderId(client, payment.order_id, { forUpdate: true });
        if (!order) {
            throw new HttpError(404, "We couldn't find this order. Please contact support.");
        }

        if (order.payment_status === "paid") {
            await client.query("COMMIT");
            return { order, alreadyPaid: true };
        }

        // Razorpay is the authority on what was actually charged.
        const expectedPaise = Math.round(Number(order.total_amount) * 100);
        if (Number(payment.amount) !== expectedPaise) {
            await client.query("ROLLBACK");
            console.error(
                `Amount mismatch on order ${order.order_number}: charged ${payment.amount}, expected ${expectedPaise}`
            );
            throw new HttpError(409, "Payment amount doesn't match this order. Please contact support.");
        }

        // The email and phone Razorpay captured are what the customer actually
        // paid with; the checkout form fills in the name and address.
        const info = order.customer_info || {};
        const { customer } = await upsertCustomer(client, {
            email: payment.email || info.email,
            phone: payment.contact || info.phone,
            fullName: info.fullName || order.shipping_address?.fullName,
            acceptsMarketing: info.acceptsMarketing === true,
            address: order.shipping_address,
        });

        const paidOrder = await markOrderPaid(client, {
            orderId: order.id,
            customerId: customer.id,
            paymentId: payment.id,
            signature,
            paymentDetails: {
                method: payment.method,
                bank: payment.bank || null,
                wallet: payment.wallet || null,
                vpa: payment.vpa || null,
                card_last4: payment.card?.last4 || null,
                card_network: payment.card?.network || null,
                email: payment.email || null,
                contact: payment.contact || null,
                fee: payment.fee ?? null,
                tax: payment.tax ?? null,
                captured_at: payment.created_at || null,
            },
        });

        // Belt and braces: the row lock above means this shouldn't happen,
        // but never dereference a null order if it somehow does.
        if (!paidOrder) {
            await client.query("COMMIT");
            return { order, alreadyPaid: true };
        }

        // The payment is captured by this point — real money has moved — so
        // this is a best-effort floor-at-zero deduction, not the strict one
        // COD uses. paidOrder.items is the JSONB snapshot written at
        // create-order time, so this is exactly what was actually charged.
        await deductStockAfterPayment(client, paidOrder.items);

        await recordCustomerPurchase(client, customer.id, paidOrder.total_amount);
        await closeCart(client, paidOrder.cart_id);

        await client.query("COMMIT");

        // Whichever of /verify and /webhook gets here first is the one that
        // actually flips payment_status to paid (alreadyPaid is false only
        // for that one) — so exactly one of them sends this, never both,
        // regardless of which wins the race.
        sendOrderConfirmationEmail(paidOrder, customer.email).catch(() => {});

        return { order: paidOrder, customer, alreadyPaid: false };
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
        throw error;
    } finally {
        client.release();
    }
}

/* ------------------------------------------------------------------ */
/* 3. Verify (called from the Razorpay checkout handler)               */
/* ------------------------------------------------------------------ */

router.post("/verify", async (req, res) => {
    try {
        const {
            razorpay_order_id: razorpayOrderId,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: signature,
        } = req.body;

        if (!razorpayOrderId || !razorpayPaymentId || !signature) {
            throw new HttpError(400, "razorpay_order_id, razorpay_payment_id and razorpay_signature are required");
        }

        if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, signature })) {
            console.error(`Signature check failed for payment ${razorpayPaymentId}`);
            throw new HttpError(400, "Payment could not be verified.");
        }

        // Even with a valid signature, ask Razorpay what really happened.
        let payment = await razorpay.payments.fetch(razorpayPaymentId);

        if (payment.order_id !== razorpayOrderId) {
            throw new HttpError(400, "This payment belongs to a different order.");
        }

        // Accounts without auto-capture leave the payment authorised; capture
        // it now or the money is released back after a few days.
        if (payment.status === "authorized") {
            payment = await razorpay.payments.capture(payment.id, payment.amount, payment.currency);
        }

        if (payment.status !== "captured") {
            const order = await findOrderByRazorpayOrderId(pool, razorpayOrderId);
            if (order) await markOrderFailed(pool, order.id, `payment status ${payment.status}`);
            throw new HttpError(402, "This payment didn't go through. You have not been charged.");
        }

        const { order, alreadyPaid } = await fulfillPaidOrder({ payment, signature });

        res.json({
            success: true,
            alreadyPaid,
            order: toPublicOrder(order),
        });
    } catch (error) {
        sendError(res, error, "We couldn't confirm this payment");
    }
});

/* ------------------------------------------------------------------ */
/* 4. Failure callback (Razorpay's payment.failed event in the browser) */
/* ------------------------------------------------------------------ */

router.post("/failed", async (req, res) => {
    try {
        const { razorpay_order_id: razorpayOrderId, reason } = req.body;
        if (!razorpayOrderId) {
            throw new HttpError(400, "razorpay_order_id is required");
        }

        const order = await findOrderByRazorpayOrderId(pool, razorpayOrderId);
        if (order) await markOrderFailed(pool, order.id, reason);

        res.json({ success: true });
    } catch (error) {
        sendError(res, error, "Unable to record this payment failure");
    }
});

/* ------------------------------------------------------------------ */
/* 5. Webhook (server-to-server safety net)                            */
/* ------------------------------------------------------------------ */

// server.js gives this route a raw body — the signature is computed over the
// exact bytes Razorpay sent, so a re-serialised JSON object would never match.
router.post("/webhook", async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.error("RAZORPAY_WEBHOOK_SECRET is not set — webhook ignored");
        return res.status(503).json({ success: false, message: "Webhook not configured" });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    if (!signaturesMatch(expected, req.headers["x-razorpay-signature"])) {
        console.error("Webhook signature check failed");
        return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    let event;
    try {
        event = JSON.parse(rawBody.toString("utf8"));
    } catch {
        return res.status(400).json({ success: false, message: "Malformed payload" });
    }

    // Always 200 once the signature checks out: a non-2xx makes Razorpay retry
    // the same event, and a bug in our fulfilment shouldn't cause a retry storm.
    try {
        const payment = event.payload?.payment?.entity;

        if (event.event === "payment.captured" && payment) {
            const { alreadyPaid } = await fulfillPaidOrder({ payment, signature: null });
            console.log(`Webhook: payment ${payment.id} ${alreadyPaid ? "already fulfilled" : "fulfilled"}`);
        } else if (event.event === "payment.failed" && payment) {
            const order = await findOrderByRazorpayOrderId(pool, payment.order_id);
            if (order) await markOrderFailed(pool, order.id, payment.error_description || "failed at gateway");
        }
    } catch (error) {
        console.error("Webhook handling failed:", error.message);
    }

    res.json({ success: true });
});

module.exports = router;
