const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const pool = require("../config/db");

router.post(
    "/upload-images",
    upload.array("images",10),
    (req,res)=>{
        const urls = (req.files || []).map((file) =>
            `${req.protocol}://${req.get("host")}/uploads/products/${encodeURIComponent(file.filename)}`
        );

        res.json({
            success: true,
            urls,
        });

    }
)

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

router.put("/:productId/variants", async (req, res) => {
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
