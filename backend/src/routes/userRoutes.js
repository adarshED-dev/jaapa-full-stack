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

router.post("/product/add/new-product", async (req, res)=>{
    try{
        const { id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert } = req.body;
        const result = await pool.query(
            `INSERT INTO products 
                (id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [id, title, tagline, description, handle, vendor, selling_price, compare_price, quantity, available, status, tags, low_stock_alert]);
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

module.exports = router;