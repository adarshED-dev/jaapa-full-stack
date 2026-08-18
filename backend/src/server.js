require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { runMigrations } = require("./migrations/runMigrations");

const app = express();

// Behind a proxy (Render, nginx) this makes req.ip and x-forwarded-for
// trustworthy, which the login rate limiter depends on.
app.set("trust proxy", 1);

// The admin portal sends its refresh cookie with credentials: true, and a
// wildcard origin is not allowed with credentials — so origins are listed.
// Add production URLs via ALLOWED_ORIGINS="https://a.com,https://b.com".
const ALLOWED_ORIGINS = [
    "http://localhost:5173", // storefront (vite default)
    "http://127.0.0.1:5173",
    "http://localhost:5174", // admin portal (see admin/vite.config.js)
    "http://127.0.0.1:5174",
    ...(process.env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean),
];

app.use(
    cors({
        origin(origin, callback) {
            // No origin = curl, Postman, server-to-server (Razorpay webhook).
            if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
            callback(new Error(`Origin ${origin} is not allowed`));
        },
        credentials: true,
    })
);

// The Razorpay webhook signature is computed over the exact bytes Razorpay
// sent, so this route must keep its raw body — it has to be registered
// before express.json() gets a chance to parse and re-serialise it.
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "1mb" }));

const paymentRoutes = require("./routes/payments.js");
const userRoutes = require("./routes/userRoutes");

app.use("/api/admin/auth", require("./routes/adminAuthRoutes"));
app.use("/api/auth", require("./routes/customerAuthRoutes"));
app.use("/api/payment", paymentRoutes);
app.use("/api/product", require("./routes/productRoutes"));
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/wishlist", require("./routes/wishlistRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/newsletter", require("./routes/newsletterRoutes"));
app.use("/api", userRoutes);

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
    try {
        await runMigrations();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Unable to start server because database migrations failed:");
        console.error(error);
        process.exit(1);
    }
}

startServer();
