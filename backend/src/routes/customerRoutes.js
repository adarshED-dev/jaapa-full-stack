// Customers.
//
//   POST   /api/customers      — create, or fill in the blanks on an existing
//                                customer matched by email/phone
//   GET    /api/customers      — admin listing
//   GET    /api/customers/:id  — one customer with their orders
//   DELETE /api/customers/:id  — admin: remove a customer
//
// The Razorpay verify handler creates customers through the same
// upsertCustomer service this route uses — in-process and inside the payment
// transaction, so a customer is never created for a payment that then fails
// to record.

const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { requireAdmin } = require("../middleware/requireAdmin");
const { HttpError, upsertCustomer, toPublicOrder } = require("../services/orderService");
const { validateCustomer, validateShippingAddress } = require("../services/validation");

function sendError(res, error, fallbackMessage) {
    if (error instanceof HttpError) {
        return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: fallbackMessage });
}

function toPublicCustomer(customer) {
    if (!customer) return null;
    return {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        full_name: customer.full_name,
        accepts_marketing: customer.accepts_marketing,
        default_address: customer.default_address,
        orders_count: customer.orders_count,
        total_spent: Number(customer.total_spent),
        // Lets the admin list tell a brochure lead apart from a buyer.
        is_brochure_lead: customer.is_brochure_lead === true,
        source: customer.source || null,
        subscribed_at: customer.subscribed_at || null,
        brochure_download_count: customer.brochure_download_count ?? 0,
        created_at: customer.created_at,
    };
}

router.post("/", async (req, res) => {
    try {
        const check = validateCustomer(req.body);
        if (check.error) throw new HttpError(400, check.error);

        // An address is optional here — a customer can exist before they've
        // ever given one — but it's validated when present.
        let address = null;
        if (req.body.address) {
            const addressCheck = validateShippingAddress(req.body.address);
            if (addressCheck.error) throw new HttpError(400, addressCheck.error);
            address = addressCheck.address;
        }

        const { customer, created } = await upsertCustomer(pool, { ...check.customer, address });

        res.status(created ? 201 : 200).json({
            success: true,
            created,
            customer: toPublicCustomer(customer),
        });
    } catch (error) {
        sendError(res, error, "Unable to save this customer");
    }
});

// Admin only: this is the whole customer list, names and phone numbers
// included, and the admin panel is the only thing that needs it.
router.get("/", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM customers ORDER BY created_at DESC LIMIT 500"
        );
        res.json({
            success: true,
            count: result.rows.length,
            customers: result.rows.map(toPublicCustomer),
        });
    } catch (error) {
        sendError(res, error, "Unable to load customers");
    }
});

// Admin only: one customer plus their entire order history.
router.get("/:id", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) throw new HttpError(404, "Customer not found");

        const orders = await pool.query(
            "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
            [req.params.id]
        );

        res.json({
            success: true,
            customer: toPublicCustomer(result.rows[0]),
            // Same admin-only enrichment as GET /api/orders — payment_details
            // so this customer's order history shows how each one was paid,
            // not just that it was.
            orders: orders.rows.map((row) => ({
                ...toPublicOrder(row),
                payment_details: row.payment_details,
                shiprocket_order_id: row.shiprocket_order_id,
                shiprocket_shipment_id: row.shiprocket_shipment_id,
                fulfilment_error: row.fulfilment_error,
            })),
        });
    } catch (error) {
        sendError(res, error, "Unable to load this customer");
    }
});

// Admin only. Their sessions, cart and wishlist go with them (ON DELETE
// CASCADE); their orders don't (ON DELETE SET NULL) — each order keeps its
// own customer_info snapshot from checkout, so order history stays intact
// and readable after the account is gone.
router.delete("/:id", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM customers WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) throw new HttpError(404, "Customer not found");

        await pool.query("DELETE FROM customers WHERE id = $1", [req.params.id]);

        res.json({ success: true, customer: toPublicCustomer(result.rows[0]) });
    } catch (error) {
        sendError(res, error, "Unable to delete this customer");
    }
});

module.exports = router;
