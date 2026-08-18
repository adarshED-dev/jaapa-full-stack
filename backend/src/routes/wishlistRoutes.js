// Anonymous wishlists — same shape as cartRoutes, minus quantities.
//
//   POST   /api/wishlist                          create (id goes in localStorage)
//   GET    /api/wishlist/:wishlistId              wishlist + joined product data
//   POST   /api/wishlist/:wishlistId/items        save a product
//   DELETE /api/wishlist/:wishlistId/items/:id    remove a product
//   DELETE /api/wishlist/:wishlistId/items        clear it

const express = require("express");
const { randomUUID } = require("crypto");
const router = express.Router();
const pool = require("../config/db");
const { requireCustomer } = require("../middleware/requireCustomer");

function parseJsonField(value, fallback) {
    if (value == null) return fallback;
    if (Array.isArray(value) || typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function wishlistItemRow(row) {
    if (!row) return row;
    return {
        ...row,
        images: parseJsonField(row.images, []),
    };
}

async function getWishlistWithItems(wishlistId) {
    const wishlistResult = await pool.query(
        "SELECT id, status, created_at, updated_at FROM wishlists WHERE id = $1",
        [wishlistId]
    );

    if (wishlistResult.rows.length === 0) return null;

    // Most recently saved first — a wishlist reads as a list of things you
    // just found, unlike a cart where insertion order is what you expect.
    const itemsResult = await pool.query(
        `SELECT
            wi.product_id,
            wi.created_at,
            p.title,
            p.tagline,
            p.handle,
            p.selling_price,
            p.compare_price,
            p.images,
            p.quantity,
            p.status
         FROM wishlist_items wi
         JOIN products p ON p.id = wi.product_id
         WHERE wi.wishlist_id = $1
         ORDER BY wi.created_at DESC`,
        [wishlistId]
    );

    return { ...wishlistResult.rows[0], items: itemsResult.rows.map(wishlistItemRow) };
}

router.post("/", async (req, res) => {
    try {
        const id = randomUUID();
        await pool.query("INSERT INTO wishlists (id) VALUES ($1)", [id]);
        const wishlist = await getWishlistWithItems(id);

        res.status(201).json({ success: true, wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to create wishlist" });
    }
});

/* ------------------------------------------------------------------ */
/* Account-linked wishlists                                            */
/* ------------------------------------------------------------------ */

/** The signed-in customer's wishlist, created on first use. */
async function findOrCreateCustomerWishlist(client, customerId) {
    const existing = await client.query(
        "SELECT id FROM wishlists WHERE customer_id = $1",
        [customerId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const id = randomUUID();
    await client.query("INSERT INTO wishlists (id, customer_id) VALUES ($1, $2)", [id, customerId]);
    return id;
}

// GET /api/wishlist/mine — used on sign-in and on every page load while
// signed in, so the wishlist follows the account rather than the browser.
router.get("/mine", requireCustomer, async (req, res) => {
    const client = await pool.connect();
    try {
        const id = await findOrCreateCustomerWishlist(client, req.customer.id);
        res.json({ success: true, wishlist: await getWishlistWithItems(id) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load your wishlist" });
    } finally {
        client.release();
    }
});

// POST /api/wishlist/claim { wishlistId } — called right after sign-in.
// Folds whatever the guest saved into the account's wishlist, then throws
// the anonymous one away. Saving the same product twice is a no-op, so a
// repeat login can't duplicate anything.
router.post("/claim", requireCustomer, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const targetId = await findOrCreateCustomerWishlist(client, req.customer.id);
        const sourceId = req.body.wishlistId || null;

        if (sourceId && sourceId !== targetId) {
            // Only an unclaimed wishlist can be absorbed — one already owned
            // by somebody else must not be readable by guessing its id.
            const source = await client.query(
                "SELECT id FROM wishlists WHERE id = $1 AND customer_id IS NULL",
                [sourceId]
            );

            if (source.rows.length > 0) {
                const sourceItems = await client.query(
                    "SELECT product_id, created_at FROM wishlist_items WHERE wishlist_id = $1",
                    [sourceId]
                );
                for (const item of sourceItems.rows) {
                    await client.query(
                        `INSERT IGNORE INTO wishlist_items (wishlist_id, product_id, created_at)
                         VALUES ($1, $2, $3)`,
                        [targetId, item.product_id, item.created_at]
                    );
                }
                // Items cascade with it.
                await client.query("DELETE FROM wishlists WHERE id = $1", [sourceId]);
            }
        }

        await client.query("COMMIT");
        res.json({ success: true, wishlist: await getWishlistWithItems(targetId) });
    } catch (error) {
        try { await client.query("ROLLBACK"); } catch { /* connection already gone */ }
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to link your wishlist" });
    } finally {
        client.release();
    }
});

router.get("/:wishlistId", async (req, res) => {
    try {
        const wishlist = await getWishlistWithItems(req.params.wishlistId);
        if (!wishlist) return res.status(404).json({ success: false, message: "Wishlist not found" });

        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load wishlist" });
    }
});

router.post("/:wishlistId/items", async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({ success: false, message: "productId is required" });
        }

        const wishlistResult = await pool.query(
            "SELECT id FROM wishlists WHERE id = $1",
            [req.params.wishlistId]
        );
        if (wishlistResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        // Unlike the cart, an archived or draft product can still be saved —
        // wishing for something that's out of stock is the whole point.
        const productResult = await pool.query(
            "SELECT id FROM products WHERE id = $1",
            [String(productId)]
        );
        if (productResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Saving twice is a no-op rather than an error, so a double click on
        // the heart can't 500.
        await pool.query(
            "INSERT IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES ($1, $2)",
            [req.params.wishlistId, String(productId)]
        );
        await pool.query(
            "UPDATE wishlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [req.params.wishlistId]
        );

        const wishlist = await getWishlistWithItems(req.params.wishlistId);
        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to save this product" });
    }
});

router.delete("/:wishlistId/items/:productId", async (req, res) => {
    try {
        const existing = await pool.query(
            "SELECT wishlist_id FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2",
            [req.params.wishlistId, req.params.productId]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Item not in this wishlist" });
        }

        await pool.query(
            "DELETE FROM wishlist_items WHERE wishlist_id = $1 AND product_id = $2",
            [req.params.wishlistId, req.params.productId]
        );

        await pool.query(
            "UPDATE wishlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [req.params.wishlistId]
        );

        const wishlist = await getWishlistWithItems(req.params.wishlistId);
        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to remove this product" });
    }
});

// Used by "move all to cart", once every item has made it into the cart.
router.delete("/:wishlistId/items", async (req, res) => {
    try {
        const wishlistResult = await pool.query(
            "SELECT id FROM wishlists WHERE id = $1",
            [req.params.wishlistId]
        );
        if (wishlistResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        await pool.query("DELETE FROM wishlist_items WHERE wishlist_id = $1", [req.params.wishlistId]);
        await pool.query(
            "UPDATE wishlists SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [req.params.wishlistId]
        );

        const wishlist = await getWishlistWithItems(req.params.wishlistId);
        res.status(200).json({ success: true, wishlist });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to clear this wishlist" });
    }
});

module.exports = router;
