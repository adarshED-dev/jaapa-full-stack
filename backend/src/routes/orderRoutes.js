// Orders.
//
//   GET  /api/orders/quote?cartId=...   — priced cart summary for checkout
//   POST /api/orders/place-order        — creates an order (COD path; the
//                                         Razorpay path calls the same
//                                         createOrder service from
//                                         /api/payment/create-order)
//   GET  /api/orders/number/:orderNumber — order confirmation page
//   GET  /api/orders                     — admin listing
//   POST /api/orders/:id/ship            — admin: hand the order to Shiprocket

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { requireAdmin } = require("../middleware/requireAdmin");
const shiprocket = require("../services/shiprocket");
const {
    HttpError,
    quoteCart,
    upsertCustomer,
    recordCustomerPurchase,
    reserveStock,
    sendOrderConfirmationEmail,
    createOrder,
    closeCart,
    findOrderByNumber,
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

router.get("/quote", async (req, res) => {
    try {
        const { cartId, state, paymentMethod = "razorpay", couponCode } = req.query;
        if (!cartId) throw new HttpError(400, "cartId is required");

        const { items, totals, coupon } = await quoteCart({
            cartId,
            shippingState: state,
            paymentMethod,
            couponCode,
        });

        res.json({ success: true, items, totals, coupon });
    } catch (error) {
        sendError(res, error, "Unable to price this cart");
    }
});

// Cash on delivery, or any order that isn't paid online. Online payments go
// through /api/payment/create-order, which reuses createOrder below.
router.post("/place-order", async (req, res) => {
    const client = await pool.connect();
    try {
        const { cartId, paymentMethod = "cod", couponCode = null } = req.body;

        if (!cartId) throw new HttpError(400, "cartId is required");
        if (paymentMethod !== "cod") {
            throw new HttpError(400, "Online payments must go through /api/payment/create-order");
        }

        const customerCheck = validateCustomer(req.body.customer);
        if (customerCheck.error) throw new HttpError(400, customerCheck.error);

        const addressCheck = validateShippingAddress(req.body.shippingAddress);
        if (addressCheck.error) throw new HttpError(400, addressCheck.error);

        const { items, totals, coupon } = await quoteCart(
            { cartId, shippingState: addressCheck.address.state, paymentMethod, couponCode },
            client
        );

        await client.query("BEGIN");

        const { customer } = await upsertCustomer(client, {
            ...customerCheck.customer,
            fullName: customerCheck.customer.fullName || addressCheck.address.fullName,
            address: addressCheck.address,
        });

        const order = await createOrder(client, {
            cartId,
            customerId: customer.id,
            customer: customerCheck.customer,
            items,
            totals,
            shippingAddress: addressCheck.address,
            paymentMethod: "cod",
            paymentStatus: "pending",
            status: "confirmed",
            couponCode: coupon.code,
        });

        // A COD order is confirmed the moment it's placed — no separate
        // payment step — so stock comes off right here, inside the same
        // transaction. If a race left less in stock than this order needs,
        // this throws and the whole order (and the customer/cart writes
        // above) rolls back with it.
        await reserveStock(client, items);

        await recordCustomerPurchase(client, customer.id, order.total_amount);
        await closeCart(client, cartId);

        await client.query("COMMIT");

        res.status(201).json({ success: true, order: toPublicOrder(order) });

        // After the response, not before: an order is real the moment it's
        // committed, and a slow or failing mail send must never hold up (or
        // break) the checkout the customer is sitting there waiting on.
        sendOrderConfirmationEmail(order, customer.email).catch(() => {});
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
        sendError(res, error, "Unable to place this order");
    } finally {
        client.release();
    }
});

router.get("/number/:orderNumber", async (req, res) => {
    try {
        const order = await findOrderByNumber(pool, req.params.orderNumber);
        if (!order) throw new HttpError(404, "Order not found");

        res.json({ success: true, order: toPublicOrder(order) });
    } catch (error) {
        sendError(res, error, "Unable to load this order");
    }
});

// Admin listing. Newest first, with the customer joined in where we have one.
// Admin-only: toPublicOrder is deliberately thin for the customer-facing
// confirmation page, but this route also hands back customer_id and the raw
// Razorpay payment_details (card network, UPI VPA, bank) — an admin needs
// enough to actually reconcile a payment, a customer's own receipt doesn't.
router.get("/", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT o.*, c.full_name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
             FROM orders o
             LEFT JOIN customers c ON c.id = o.customer_id
             ORDER BY o.created_at DESC
             LIMIT 200`
        );

        res.json({
            success: true,
            count: result.rows.length,
            orders: result.rows.map((row) => ({
                ...toPublicOrder(row),
                customer_id: row.customer_id,
                payment_details: row.payment_details,
                shiprocket_order_id: row.shiprocket_order_id,
                shiprocket_shipment_id: row.shiprocket_shipment_id,
                fulfilment_error: row.fulfilment_error,
                customer_name: row.customer_name,
                customer_email: row.customer_email,
                customer_phone: row.customer_phone,
            })),
        });
    } catch (error) {
        sendError(res, error, "Unable to load orders");
    }
});

// Hands a confirmed order to Shiprocket. Not wired to real credentials yet —
// see src/services/shiprocket.js — so this refuses cleanly with a 501 until
// SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD are set, rather than pretending an
// order shipped when nothing actually happened.
router.post("/:id/ship", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
        const order = result.rows[0];
        if (!order) throw new HttpError(404, "Order not found");

        if (order.status !== "confirmed") {
            throw new HttpError(409, "Only confirmed orders can be shipped.");
        }
        if (order.fulfilment_status !== "unfulfilled") {
            throw new HttpError(409, `This order is already ${order.fulfilment_status}.`);
        }

        if (!shiprocket.isConfigured()) {
            throw new HttpError(
                501,
                "Shiprocket isn't connected yet. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to the backend's .env, then try again."
            );
        }

        let shipment;
        try {
            shipment = await shiprocket.createShipment(order);
        } catch (shiprocketError) {
            // Recorded rather than just logged, so the reason Ship Now
            // failed is visible in the order detail panel, not just in a
            // server log the admin can't see.
            await pool.query(
                "UPDATE orders SET fulfilment_error = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                [order.id, shiprocketError.message]
            );
            throw new HttpError(502, shiprocketError.message);
        }

        await pool.query(
            `UPDATE orders
             SET fulfilment_status = 'processing',
                 shiprocket_order_id = $2,
                 shiprocket_shipment_id = $3,
                 fulfilment_error = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [order.id, shipment.shiprocketOrderId, shipment.shipmentId]
        );
        const updated = await pool.query("SELECT * FROM orders WHERE id = $1", [order.id]);

        res.json({
            success: true,
            order: {
                ...toPublicOrder(updated.rows[0]),
                shiprocket_order_id: updated.rows[0].shiprocket_order_id,
                shiprocket_shipment_id: updated.rows[0].shiprocket_shipment_id,
                fulfilment_error: updated.rows[0].fulfilment_error,
            },
        });
    } catch (error) {
        sendError(res, error, "Unable to start shipping this order");
    }
});

module.exports = router;
