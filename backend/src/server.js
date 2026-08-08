require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const paymentRoutes = require("./routes/payments.js");
const userRoutes = require("./routes/userRoutes");

app.use("/api/payment", paymentRoutes);
app.use("/api/product", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api", userRoutes);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});