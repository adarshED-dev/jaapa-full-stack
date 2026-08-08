const express = require("express");
const { randomUUID } = require("crypto");
const router = express.Router();
const pool = require("../config/db");

function parseQuantity(value) {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

async function getCartWithItems(cartId) {
    const cartResult = await pool.query(
        "SELECT id, status, created_at, updated_at FROM carts WHERE id = $1",
        [cartId]
    );

    if (cartResult.rows.length === 0) return null;

    const itemsResult = await pool.query(
        `SELECT
            ci.product_id,
            ci.quantity,
            p.title,
            p.handle,
            p.selling_price,
            p.compare_price,
            p.images,
            p.status
         FROM cart_items ci
         JOIN products p ON p.id::text = ci.product_id
         WHERE ci.cart_id = $1
         ORDER BY ci.created_at ASC`,
        [cartId]
    );

    return { ...cartResult.rows[0], items: itemsResult.rows };
}

// Create an anonymous cart. Save the returned `cart.id` in localStorage.
router.post("/", async (req, res) => {
    try {
        const id = randomUUID();
        const result = await pool.query(
            "INSERT INTO carts (id) VALUES ($1) RETURNING id, status, created_at, updated_at",
            [id]
        );

        res.status(201).json({ success: true, cart: { ...result.rows[0], items: [] } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to create cart" });
    }
});

// Admin listing for anonymous carts. Customer details are intentionally not
// included because anonymous carts do not have an account/contact attached.
router.get("/admin/list", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                c.id,
                c.created_at,
                c.updated_at,
                COALESCE(SUM(ci.quantity), 0)::integer AS item_count,
                COALESCE(SUM(ci.quantity * p.selling_price), 0) AS cart_value,
                CASE
                    WHEN COALESCE(SUM(ci.quantity), 0) = 0 THEN 'empty'
                    WHEN c.updated_at < CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 'abandoned'
                    ELSE 'active'
                END AS cart_status
             FROM carts c
             LEFT JOIN cart_items ci ON ci.cart_id = c.id
             LEFT JOIN products p ON p.id::text = ci.product_id
             GROUP BY c.id, c.created_at, c.updated_at
             ORDER BY c.updated_at DESC`
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            carts: result.rows,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load carts" });
    }
});

router.delete("/admin/:cartId", async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM carts WHERE id = $1 RETURNING id",
            [req.params.cartId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        res.status(200).json({
            success: true,
            message: "Cart deleted successfully",
            cartId: result.rows[0].id,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to delete cart" });
    }
});

router.get("/:cartId", async (req, res) => {
    try {
        const cart = await getCartWithItems(req.params.cartId);
        if (!cart) return res.status(404).json({ success: false, message: "Cart not found" });

        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load cart" });
    }
});

router.post("/:cartId/items", async (req, res) => {
    const client = await pool.connect();
    try {
        const { productId, quantity = 1 } = req.body;
        const validQuantity = parseQuantity(quantity);
        if (!productId || !validQuantity) {
            return res.status(400).json({ success: false, message: "productId and a positive integer quantity are required" });
        }

        await client.query("BEGIN");
        const cartResult = await client.query(
            "SELECT id FROM carts WHERE id = $1 AND status = 'active' FOR UPDATE",
            [req.params.cartId]
        );
        if (cartResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Active cart not found" });
        }

        const productResult = await client.query(
            "SELECT id FROM products WHERE id::text = $1 AND status = 'active'",
            [String(productId)]
        );
        if (productResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Active product not found" });
        }

        await client.query(
            `INSERT INTO cart_items (cart_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (cart_id, product_id)
             DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                           updated_at = CURRENT_TIMESTAMP`,
            [req.params.cartId, String(productId), validQuantity]
        );
        await client.query("UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.cartId]);
        await client.query("COMMIT");

        const cart = await getCartWithItems(req.params.cartId);
        res.status(200).json({ success: true, cart });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to add item to cart" });
    } finally {
        client.release();
    }
});

router.patch("/:cartId/items/:productId", async (req, res) => {
    try {
        const validQuantity = parseQuantity(req.body.quantity);
        if (!validQuantity) {
            return res.status(400).json({ success: false, message: "A positive integer quantity is required" });
        }

        const result = await pool.query(
            `UPDATE cart_items
             SET quantity = $1, updated_at = CURRENT_TIMESTAMP
             WHERE cart_id = $2 AND product_id = $3
             RETURNING *`,
            [validQuantity, req.params.cartId, req.params.productId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        await pool.query("UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.cartId]);
        const cart = await getCartWithItems(req.params.cartId);
        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to update cart item" });
    }
});

router.delete("/:cartId/items/:productId", async (req, res) => {
    try {
        const result = await pool.query(
            "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING *",
            [req.params.cartId, req.params.productId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        await pool.query("UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.cartId]);
        const cart = await getCartWithItems(req.params.cartId);
        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to remove cart item" });
    }
});

module.exports = router;
