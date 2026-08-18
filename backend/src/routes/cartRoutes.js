const express = require("express");
const { randomUUID } = require("crypto");
const router = express.Router();
const pool = require("../config/db");
const { requireCustomer } = require("../middleware/requireCustomer");
const { requireAdmin } = require("../middleware/requireAdmin");

function parseQuantity(value) {
    const quantity = Number(value);
    return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
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

function cartItemRow(row) {
    if (!row) return row;
    return {
        ...row,
        images: parseJsonField(row.images, []),
    };
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
         JOIN products p ON p.id = ci.product_id
         WHERE ci.cart_id = $1
         ORDER BY ci.created_at ASC`,
        [cartId]
    );

    return { ...cartResult.rows[0], items: itemsResult.rows.map(cartItemRow) };
}

// Create an anonymous cart. Save the returned `cart.id` in localStorage.
router.post("/", async (req, res) => {
    try {
        const id = randomUUID();
        await pool.query("INSERT INTO carts (id) VALUES ($1)", [id]);
        const cart = await getCartWithItems(id);

        res.status(201).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to create cart" });
    }
});

// Admin listing for anonymous carts. Customer details are intentionally not
// included because anonymous carts do not have an account/contact attached.
router.get("/admin/list", requireAdmin, async (req, res) => {
    try {
        const abandonedBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await pool.query(
            `SELECT
                c.id,
                c.created_at,
                c.updated_at,
                COALESCE(SUM(ci.quantity), 0) AS item_count,
                COALESCE(SUM(ci.quantity * p.selling_price), 0) AS cart_value,
                CASE
                    WHEN COALESCE(SUM(ci.quantity), 0) = 0 THEN 'empty'
                    WHEN c.updated_at < $1 THEN 'abandoned'
                    ELSE 'active'
                END AS cart_status
             FROM carts c
             LEFT JOIN cart_items ci ON ci.cart_id = c.id
             LEFT JOIN products p ON p.id = ci.product_id
             GROUP BY c.id, c.created_at, c.updated_at
             ORDER BY c.updated_at DESC`,
            [abandonedBefore]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            carts: result.rows.map((row) => ({
                ...row,
                item_count: Number(row.item_count),
                cart_value: Number(row.cart_value),
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load carts" });
    }
});

router.delete("/admin/:cartId", requireAdmin, async (req, res) => {
    try {
        const existing = await pool.query("SELECT id FROM carts WHERE id = $1", [req.params.cartId]);

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        await pool.query("DELETE FROM carts WHERE id = $1", [req.params.cartId]);

        res.status(200).json({
            success: true,
            message: "Cart deleted successfully",
            cartId: req.params.cartId,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to delete cart" });
    }
});

/* ------------------------------------------------------------------ */
/* Account-linked carts                                                */
/* ------------------------------------------------------------------ */

/** The signed-in customer's active cart, created on first use. */
async function findOrCreateCustomerCart(client, customerId) {
    const existing = await client.query(
        "SELECT id FROM carts WHERE customer_id = $1 AND status = 'active'",
        [customerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const id = randomUUID();
    await client.query("INSERT INTO carts (id, customer_id) VALUES ($1, $2)", [id, customerId]);
    return id;
}

// GET /api/cart/mine — the cart that follows the account rather than the
// browser, so it's still there on another device.
router.get("/mine", requireCustomer, async (req, res) => {
    const client = await pool.connect();
    try {
        const id = await findOrCreateCustomerCart(client, req.customer.id);
        res.json({ success: true, cart: await getCartWithItems(id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load your cart" });
    } finally {
        client.release();
    }
});

// POST /api/cart/claim { cartId } — called right after sign-in, so a cart
// filled as a guest survives logging in.
router.post("/claim", requireCustomer, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const targetId = await findOrCreateCustomerCart(client, req.customer.id);
        const sourceId = req.body.cartId || null;

        if (sourceId && sourceId !== targetId) {
            const source = await client.query(
                "SELECT id FROM carts WHERE id = $1 AND customer_id IS NULL AND status = 'active'",
                [sourceId]
            );

            if (source.rows.length > 0) {
                // GREATEST, not a sum: signing in twice with 2 in the guest
                // cart should leave 2, not 4. Taking the larger of the two
                // also means nothing a shopper deliberately added is lost.
                const sourceItems = await client.query(
                    "SELECT product_id, quantity, created_at, updated_at FROM cart_items WHERE cart_id = $1",
                    [sourceId]
                );
                for (const item of sourceItems.rows) {
                    const targetItem = await client.query(
                        "SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2 FOR UPDATE",
                        [targetId, item.product_id]
                    );
                    if (targetItem.rows.length > 0) {
                        await client.query(
                            `UPDATE cart_items
                             SET quantity = GREATEST(quantity, $3), updated_at = CURRENT_TIMESTAMP
                             WHERE cart_id = $1 AND product_id = $2`,
                            [targetId, item.product_id, item.quantity]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO cart_items (cart_id, product_id, quantity, created_at, updated_at)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [targetId, item.product_id, item.quantity, item.created_at, item.updated_at]
                        );
                    }
                }
                await client.query("DELETE FROM carts WHERE id = $1", [sourceId]);
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, cart: await getCartWithItems(targetId) });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to link your cart" });
    } finally {
        client.release();
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
            "SELECT id FROM products WHERE id = $1 AND status = 'active'",
            [String(productId)]
        );
        if (productResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Active product not found" });
        }

        const itemResult = await client.query(
            "SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2 FOR UPDATE",
            [req.params.cartId, String(productId)]
        );
        if (itemResult.rows.length > 0) {
            await client.query(
                `UPDATE cart_items
                 SET quantity = quantity + $3, updated_at = CURRENT_TIMESTAMP
                 WHERE cart_id = $1 AND product_id = $2`,
                [req.params.cartId, String(productId), validQuantity]
            );
        } else {
            await client.query(
                "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)",
                [req.params.cartId, String(productId), validQuantity]
            );
        }
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

        const existing = await pool.query(
            "SELECT cart_id FROM cart_items WHERE cart_id = $1 AND product_id = $2",
            [req.params.cartId, req.params.productId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        await pool.query(
            `UPDATE cart_items
             SET quantity = $1, updated_at = CURRENT_TIMESTAMP
             WHERE cart_id = $2 AND product_id = $3`,
            [validQuantity, req.params.cartId, req.params.productId]
        );

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
        const existing = await pool.query(
            "SELECT cart_id FROM cart_items WHERE cart_id = $1 AND product_id = $2",
            [req.params.cartId, req.params.productId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Cart item not found" });
        }

        await pool.query(
            "DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2",
            [req.params.cartId, req.params.productId]
        );

        await pool.query("UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [req.params.cartId]);
        const cart = await getCartWithItems(req.params.cartId);
        res.status(200).json({ success: true, cart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to remove cart item" });
    }
});

module.exports = router;
