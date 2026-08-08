const express = require("express");
const razorpay = require("../config/razorpay");
const axios = require("axios")

const router = express.Router();

router.post("/create-order", async (req, res) => {
  try {
    const id = req.body
    const orderData = await axios.post("http://localhost:5000/api/product/get/order-details", id);
    const product = orderData.data.body[0]
    const options = {
        amount: Number(product.selling_price) + "00",
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
      product: {
        name: product.title,
        image: product.images[0],
        price: product.selling_price,
      },
    });
  } catch (error) {
    console.error("Razorpay error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create order",
    });
  }
});

module.exports = router;