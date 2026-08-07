const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const userRoutes = require("./routes/userRoutes");
app.use("/api/product", require("./routes/productRoutes"));

app.use("/api", userRoutes);

// app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads", express.static("uploads"));

app.listen(5000, () => {
    console.log("Server running on port 5000");
});