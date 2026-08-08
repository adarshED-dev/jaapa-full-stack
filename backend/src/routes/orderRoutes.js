const express = require("express");
const { randomUUID } = require("crypto");
const router = express.Router();
const pool = require("../config/db");

// Place an order. Expects a JSON body with at least: cartId, items (non-empty array), totalAmount
router.post("/orders/place-order", async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            cartId,
            customer = {},
            items = [],
            totalAmount,
            shippingAddress = null,
            paymentMethod = null,
            metadata = {}
        } = req.body;

        if (!cartId || !Array.isArray(items) || items.length === 0 || typeof totalAmount !== "number") {
            return res.status(400).json({ success: false, message: "cartId, items (non-empty array) and totalAmount are required" });
        }

        const id = randomUUID();

        await client.query("BEGIN");

        // Insert order. Adjust column names/types in your DB schema as needed.
        const insertQuery = `
            INSERT INTO orders (
                id,
                cart_id,
                customer_info,
                items,
                total_amount,
                shipping_address,
                payment_method,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

        const values = [
            id,
            cartId,
            customer,
            items,
            totalAmount,
            shippingAddress,
            paymentMethod,
            "pending",
        ];

        const result = await client.query(insertQuery, values);

        await client.query("COMMIT");

        res.status(201).json({ success: true, order: result.rows[0] });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch (e) {}
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to place order" });
    } finally {
        client.release();
    }
});

module.exports = router;