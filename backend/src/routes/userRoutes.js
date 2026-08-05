const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/tst_users", async (req, res)=>{
    try{
        const result = await pool.query("SELECT * FROM tst_data");
        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
})

router.post("/add_users", async (req, res)=>{
    try{
        const {name, email} = req.body.data[0];
        const result = await pool.query("INSERT INTO tst_data (name, email) VALUES ($1, $2)", [name, email]);
        res.status(201).json({
            success: true,
            message: "User added successfully",
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