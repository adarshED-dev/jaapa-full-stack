import razorpay from "../config/razorpay.js";

const order = await razorpay.orders.create({
  amount: 50000, // ₹500
  currency: "INR",
  receipt: "receipt_123",
});