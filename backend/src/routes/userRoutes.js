const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/product/get/data", async (req, res)=>{
    try{
        const result = await pool.query("SELECT * FROM products");
        res.status(200).json({
            success: true,
            count: result.rows.length,
            body: result.rows,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
})
router.post("/product/get/order-details", async (req, res)=>{
    try{
        const { id } = req.body
        const result = await pool.query("SELECT * FROM products WHERE id = $1", [id]);
        res.status(200).json({
            success: true,
            count: result.rows.length,
            body: result.rows,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
})
router.post("/product/add/new-product", async (req, res)=>{
    try{
        const { id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert, sku, images } = req.body;
        const result = await pool.query(
            `INSERT INTO products 
                (id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert, sku, images) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert, sku, images ]);
        res.status(201).json({
            success: true,
            message: "Product added successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
})

router.put("/product/update/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            tagline,
            description,
            handle,
            vendor,
            selling_price,
            compare_price,
            quantity,
            available,
            status,
            tags,
            low_stock_alert,
            sku,
            images,
        } = req.body;

        const result = await pool.query(
            `UPDATE products
             SET title = $1,
                 tagline = $2,
                 description = $3,
                 handle = $4,
                 vendor = $5,
                 selling_price = $6,
                 compare_price = $7,
                 quantity = $8,
                 available = $9,
                 status = $10,
                 tags = $11,
                 low_stock_alert = $12,
                 sku = $13,
                 images = $14
             WHERE id = $15
             RETURNING *`,
            [
                title,
                tagline,
                description,
                handle,
                vendor,
                selling_price,
                compare_price,
                quantity,
                available,
                status,
                tags,
                low_stock_alert,
                sku,
                images,
                id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

router.delete("/product/delete/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            "DELETE FROM products WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
            data: result.rows[0],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

module.exports = router;
