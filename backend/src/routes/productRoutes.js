const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const pool = require("../config/db");
const { publicUploadUrl } = require("../services/uploadUrl");
const { requireAdmin } = require("../middleware/requireAdmin");

router.post("/upload-images", requireAdmin, (req, res) => {
    upload.array("images", 10)(req, res, (error) => {
        if (error) {
            return res.status(400).json({ success: false, message: error.message });
        }

        const urls = (req.files || []).map((file) =>
            publicUploadUrl("products", file.filename)
        );

        res.json({
            success: true,
            urls,
        });
    });
});

// Admin dashboard's low-stock panel. A product opts in by having
// low_stock_alert set at all — NULL (the default) means "don't alert on
// this one", and the comparison naturally excludes it (NULL <= anything is
// unknown in SQL, so those rows never match).
router.get("/alerts/low-stock", requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, sku, quantity, low_stock_alert, updated_at
             FROM products
             WHERE low_stock_alert IS NOT NULL AND quantity <= low_stock_alert
             ORDER BY quantity ASC, updated_at DESC`
        );

        res.json({
            success: true,
            alerts: result.rows.map((row) => ({
                id: row.id,
                title: row.title,
                sku: row.sku,
                quantity: row.quantity,
                lowStockAlert: Number(row.low_stock_alert),
                updatedAt: row.updated_at,
            })),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load low-stock alerts" });
    }
});

router.get("/:productId/variants", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, product_id, title, sku, selling_price, compare_price, quantity, available, image, position
             FROM product_variants WHERE product_id = $1 ORDER BY position, id`,
            [req.params.productId]
        );
        res.json({ success: true, variants: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to load product variants" });
    }
});

// Admin-only: this rewrites prices and stock, unlike the GET above.
router.put("/:productId/variants", requireAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
        const variants = Array.isArray(req.body.variants) ? req.body.variants : null;
        if (!variants) return res.status(400).json({ success: false, message: "variants must be an array" });

        const product = await client.query("SELECT id FROM products WHERE id = $1", [req.params.productId]);
        if (product.rows.length === 0) return res.status(404).json({ success: false, message: "Product not found" });

        await client.query("BEGIN");
        await client.query("DELETE FROM product_variants WHERE product_id = $1", [req.params.productId]);
        for (const [position, variant] of variants.entries()) {
            if (!variant.title || Number(variant.selling_price) < 0) {
                throw new Error("Every variant needs a title and a valid price");
            }
            await client.query(
                `INSERT INTO product_variants
                 (product_id, title, sku, selling_price, compare_price, quantity, available, image, position)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [req.params.productId, variant.title, variant.sku || null, variant.selling_price,
                 variant.compare_price || null, variant.quantity ?? null, variant.available !== false,
                 variant.image || null, position]
            );
        }
        await client.query("COMMIT");
        const result = await pool.query(
            "SELECT * FROM product_variants WHERE product_id = $1 ORDER BY position, id",
            [req.params.productId]
        );
        res.json({ success: true, variants: result.rows });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ success: false, message: error.message || "Unable to save product variants" });
    } finally {
        client.release();
    }
});

module.exports = router;
