const fs = require("fs");
const path = require("path");

const CHARSET = "utf8mb4";
const COLLATE = "utf8mb4_unicode_ci";

exports.config = { transaction: false };

function useUtf8(table) {
    table.charset(CHARSET);
    table.collate(COLLATE);
}

function uuidPrimary(table, column = "id") {
    table.specificType(column, "char(36)").primary();
}

function uuidColumn(table, column) {
    return table.specificType(column, "char(36)");
}

function timestamps(table, knex) {
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
}

async function ensureTable(knex, tableName, createTable) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) return;

    await knex.schema.createTable(tableName, (table) => {
        useUtf8(table);
        createTable(table);
    });
}

async function ensureColumn(knex, tableName, columnName, addColumn) {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (exists) return;

    await knex.schema.alterTable(tableName, (table) => {
        addColumn(table);
    });
}

async function indexExists(knex, tableName, indexName) {
    const [rows] = await knex.raw(
        `SELECT 1
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1`,
        [tableName, indexName]
    );
    return rows.length > 0;
}

async function ensureIndex(knex, tableName, indexName, createSql) {
    if (await indexExists(knex, tableName, indexName)) return;
    await knex.raw(createSql);
}

function isPostgresql(knex) {
    return ["pg", "postgres", "postgresql"].includes(knex.client.config.client);
}

async function runSqlFile(knex, filename) {
    const sql = fs.readFileSync(path.join(__dirname, "../sql", filename), "utf8");
    await knex.raw(sql);
}

async function ensurePostgresProducts(knex) {
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS products (
            id VARCHAR PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            tagline VARCHAR(255),
            description TEXT,
            handle VARCHAR(255),
            vendor VARCHAR(255),
            selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
            compare_price NUMERIC(12,2),
            quantity INTEGER,
            available BOOLEAN NOT NULL DEFAULT TRUE,
            status VARCHAR(24) NOT NULL DEFAULT 'active',
            tags JSONB,
            low_stock_alert INTEGER,
            sku VARCHAR(120),
            images JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function runPostgresBaseline(knex) {
    await ensurePostgresProducts(knex);

    for (const filename of [
        "admin-auth-schema.sql",
        "orders-schema.sql",
        "cart-schema.sql",
        "wishlist-schema.sql",
        "customer-auth-schema.sql",
        "product-variants.sql",
        "products-updated-at.sql",
        "store-settings.sql",
        "account-linking.sql",
        "newsletter-schema.sql",
        "shiprocket-fulfilment.sql",
        "admin-owner-lock.sql",
    ]) {
        await runSqlFile(knex, filename);
    }
}

exports.up = async function up(knex) {
    if (isPostgresql(knex)) {
        await runPostgresBaseline(knex);
        return;
    }

    await ensureTable(knex, "admin_users", (table) => {
        uuidPrimary(table);
        table.string("email", 255).notNullable();
        table.text("password_hash").notNullable();
        table.string("full_name", 120).notNullable();
        table.string("role", 32).notNullable().defaultTo("owner");
        table.boolean("is_active").notNullable().defaultTo(true);
        table.integer("token_version").notNullable().defaultTo(0);
        table.integer("failed_attempts").notNullable().defaultTo(0);
        table.timestamp("locked_until").nullable();
        table.timestamp("last_login_at").nullable();
        table.string("last_login_ip", 64).nullable();
        table.timestamp("password_changed_at").notNullable().defaultTo(knex.fn.now());
        timestamps(table, knex);
    });

    await ensureTable(knex, "customers", (table) => {
        uuidPrimary(table);
        table.string("email", 255).nullable();
        table.string("phone", 20).nullable();
        table.string("full_name", 120).nullable();
        table.boolean("accepts_marketing").notNullable().defaultTo(false);
        table.json("default_address").nullable();
        table.integer("orders_count").notNullable().defaultTo(0);
        table.decimal("total_spent", 12, 2).notNullable().defaultTo(0);
        table.string("razorpay_customer_id", 64).nullable();
        timestamps(table, knex);
        table.integer("token_version").notNullable().defaultTo(0);
        table.timestamp("last_login_at").nullable();
        table.boolean("is_brochure_lead").notNullable().defaultTo(false);
        table.string("source", 32).nullable();
        table.timestamp("subscribed_at").nullable();
        table.timestamp("brochure_downloaded_at").nullable();
        table.integer("brochure_download_count").notNullable().defaultTo(0);
    });

    await ensureTable(knex, "products", (table) => {
        table.string("id", 255).primary();
        table.string("title", 255).notNullable();
        table.string("tagline", 255).nullable();
        table.text("description").nullable();
        table.string("handle", 255).nullable();
        table.string("vendor", 255).nullable();
        table.decimal("selling_price", 12, 2).notNullable().defaultTo(0);
        table.decimal("compare_price", 12, 2).nullable();
        table.integer("quantity").nullable();
        table.boolean("available").notNullable().defaultTo(true);
        table.string("status", 24).notNullable().defaultTo("active");
        table.json("tags").nullable();
        table.integer("low_stock_alert").nullable();
        table.string("sku", 120).nullable();
        table.json("images").nullable();
        timestamps(table, knex);
    });

    await ensureTable(knex, "carts", (table) => {
        uuidPrimary(table);
        table.string("status", 20).notNullable().defaultTo("active");
        timestamps(table, knex);
        uuidColumn(table, "customer_id").nullable();
        table.foreign("customer_id", "carts_customer_fk").references("customers.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "wishlists", (table) => {
        uuidPrimary(table);
        table.string("status", 20).notNullable().defaultTo("active");
        timestamps(table, knex);
        uuidColumn(table, "customer_id").nullable();
        table.foreign("customer_id", "wishlists_customer_fk").references("customers.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "store_settings", (table) => {
        table.string("section", 64).primary();
        table.specificType("data", "json").notNullable().defaultTo(knex.raw("(JSON_OBJECT())"));
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });

    await ensureTable(knex, "admin_sessions", (table) => {
        uuidPrimary(table);
        uuidColumn(table, "admin_id").notNullable();
        table.string("token_hash", 128).notNullable();
        table.text("user_agent").nullable();
        table.string("ip_address", 64).nullable();
        table.timestamp("expires_at").notNullable();
        table.timestamp("revoked_at").nullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.foreign("admin_id", "admin_sessions_admin_fk").references("admin_users.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "customer_otp_codes", (table) => {
        uuidPrimary(table);
        table.string("phone", 10).nullable();
        table.string("email", 255).nullable();
        table.string("code_hash", 128).notNullable();
        table.timestamp("expires_at").notNullable();
        table.integer("attempts").notNullable().defaultTo(0);
        table.timestamp("consumed_at").nullable();
        table.string("ip_address", 64).nullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    });

    await ensureTable(knex, "customer_sessions", (table) => {
        uuidPrimary(table);
        uuidColumn(table, "customer_id").notNullable();
        table.string("token_hash", 128).notNullable();
        table.text("user_agent").nullable();
        table.string("ip_address", 64).nullable();
        table.timestamp("expires_at").notNullable();
        table.timestamp("revoked_at").nullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.foreign("customer_id", "customer_sessions_customer_fk").references("customers.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "product_variants", (table) => {
        table.bigIncrements("id").primary();
        table.string("product_id", 255).notNullable();
        table.string("title", 255).notNullable();
        table.string("sku", 255).nullable();
        table.decimal("selling_price", 12, 2).notNullable();
        table.decimal("compare_price", 12, 2).nullable();
        table.integer("quantity").nullable();
        table.boolean("available").notNullable().defaultTo(true);
        table.string("image", 255).nullable();
        table.integer("position").notNullable().defaultTo(0);
        timestamps(table, knex);
        table.foreign("product_id", "product_variants_product_fk").references("products.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "cart_items", (table) => {
        uuidColumn(table, "cart_id").notNullable();
        table.string("product_id", 255).notNullable();
        table.integer("quantity").notNullable();
        timestamps(table, knex);
        table.primary(["cart_id", "product_id"]);
        table.foreign("cart_id", "cart_items_cart_fk").references("carts.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "wishlist_items", (table) => {
        uuidColumn(table, "wishlist_id").notNullable();
        table.string("product_id", 255).notNullable();
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.primary(["wishlist_id", "product_id"]);
        table.foreign("wishlist_id", "wishlist_items_wishlist_fk").references("wishlists.id").onDelete("CASCADE");
    });

    await ensureTable(knex, "orders", (table) => {
        uuidPrimary(table);
        uuidColumn(table, "cart_id").nullable();
        table.specificType("customer_info", "json").notNullable().defaultTo(knex.raw("(JSON_OBJECT())"));
        table.specificType("items", "json").notNullable().defaultTo(knex.raw("(JSON_ARRAY())"));
        table.decimal("total_amount", 12, 2).notNullable().defaultTo(0);
        table.json("shipping_address").nullable();
        table.string("payment_method", 32).nullable();
        table.string("status", 24).notNullable().defaultTo("pending");
        timestamps(table, knex);
        table.string("order_number", 24).nullable();
        uuidColumn(table, "customer_id").nullable();
        table.decimal("subtotal_amount", 12, 2).notNullable().defaultTo(0);
        table.decimal("tax_amount", 12, 2).notNullable().defaultTo(0);
        table.decimal("shipping_amount", 12, 2).notNullable().defaultTo(0);
        table.decimal("discount_amount", 12, 2).notNullable().defaultTo(0);
        table.decimal("cod_fee", 12, 2).notNullable().defaultTo(0);
        table.decimal("tax_rate", 5, 2).notNullable().defaultTo(0);
        table.string("currency", 3).notNullable().defaultTo("INR");
        table.string("payment_status", 24).notNullable().defaultTo("pending");
        table.string("razorpay_order_id", 64).nullable();
        table.string("razorpay_payment_id", 64).nullable();
        table.string("razorpay_signature", 160).nullable();
        table.json("payment_details").nullable();
        table.string("coupon_code", 40).nullable();
        table.text("notes").nullable();
        table.timestamp("paid_at").nullable();
        table.string("fulfilment_status", 24).notNullable().defaultTo("unfulfilled");
        table.string("shiprocket_order_id", 64).nullable();
        table.string("shiprocket_shipment_id", 64).nullable();
        table.string("awb_code", 64).nullable();
        table.string("courier_name", 80).nullable();
        table.text("tracking_url").nullable();
        table.timestamp("shipped_at").nullable();
        table.text("fulfilment_error").nullable();
        table.foreign("customer_id", "orders_customer_fk").references("customers.id").onDelete("SET NULL");
    });

    await ensureColumn(knex, "products", "updated_at", (table) =>
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now())
    );
    await ensureColumn(knex, "customers", "token_version", (table) => table.integer("token_version").notNullable().defaultTo(0));
    await ensureColumn(knex, "customers", "last_login_at", (table) => table.timestamp("last_login_at").nullable());
    await ensureColumn(knex, "customers", "is_brochure_lead", (table) =>
        table.boolean("is_brochure_lead").notNullable().defaultTo(false)
    );
    await ensureColumn(knex, "customers", "source", (table) => table.string("source", 32).nullable());
    await ensureColumn(knex, "customers", "subscribed_at", (table) => table.timestamp("subscribed_at").nullable());
    await ensureColumn(knex, "customers", "brochure_downloaded_at", (table) =>
        table.timestamp("brochure_downloaded_at").nullable()
    );
    await ensureColumn(knex, "customers", "brochure_download_count", (table) =>
        table.integer("brochure_download_count").notNullable().defaultTo(0)
    );
    await ensureColumn(knex, "carts", "customer_id", (table) => uuidColumn(table, "customer_id").nullable());
    await ensureColumn(knex, "wishlists", "customer_id", (table) => uuidColumn(table, "customer_id").nullable());

    for (const [column, addColumn] of [
        ["order_number", (table) => table.string("order_number", 24).nullable()],
        ["customer_id", (table) => uuidColumn(table, "customer_id").nullable()],
        ["subtotal_amount", (table) => table.decimal("subtotal_amount", 12, 2).notNullable().defaultTo(0)],
        ["tax_amount", (table) => table.decimal("tax_amount", 12, 2).notNullable().defaultTo(0)],
        ["shipping_amount", (table) => table.decimal("shipping_amount", 12, 2).notNullable().defaultTo(0)],
        ["discount_amount", (table) => table.decimal("discount_amount", 12, 2).notNullable().defaultTo(0)],
        ["cod_fee", (table) => table.decimal("cod_fee", 12, 2).notNullable().defaultTo(0)],
        ["tax_rate", (table) => table.decimal("tax_rate", 5, 2).notNullable().defaultTo(0)],
        ["currency", (table) => table.string("currency", 3).notNullable().defaultTo("INR")],
        ["payment_status", (table) => table.string("payment_status", 24).notNullable().defaultTo("pending")],
        ["razorpay_order_id", (table) => table.string("razorpay_order_id", 64).nullable()],
        ["razorpay_payment_id", (table) => table.string("razorpay_payment_id", 64).nullable()],
        ["razorpay_signature", (table) => table.string("razorpay_signature", 160).nullable()],
        ["payment_details", (table) => table.json("payment_details").nullable()],
        ["coupon_code", (table) => table.string("coupon_code", 40).nullable()],
        ["notes", (table) => table.text("notes").nullable()],
        ["paid_at", (table) => table.timestamp("paid_at").nullable()],
        ["fulfilment_status", (table) => table.string("fulfilment_status", 24).notNullable().defaultTo("unfulfilled")],
        ["shiprocket_order_id", (table) => table.string("shiprocket_order_id", 64).nullable()],
        ["shiprocket_shipment_id", (table) => table.string("shiprocket_shipment_id", 64).nullable()],
        ["awb_code", (table) => table.string("awb_code", 64).nullable()],
        ["courier_name", (table) => table.string("courier_name", 80).nullable()],
        ["tracking_url", (table) => table.text("tracking_url").nullable()],
        ["shipped_at", (table) => table.timestamp("shipped_at").nullable()],
        ["fulfilment_error", (table) => table.text("fulfilment_error").nullable()],
    ]) {
        await ensureColumn(knex, "orders", column, addColumn);
    }

    await ensureIndex(knex, "admin_users", "admin_users_email_key", "CREATE UNIQUE INDEX admin_users_email_key ON admin_users ((LOWER(email)))");
    await ensureIndex(knex, "admin_users", "admin_users_single_owner", "CREATE UNIQUE INDEX admin_users_single_owner ON admin_users ((1))");
    await ensureIndex(knex, "admin_sessions", "admin_sessions_token_hash_key", "CREATE UNIQUE INDEX admin_sessions_token_hash_key ON admin_sessions (token_hash)");
    await ensureIndex(knex, "admin_sessions", "admin_sessions_admin_id_idx", "CREATE INDEX admin_sessions_admin_id_idx ON admin_sessions (admin_id)");
    await ensureIndex(knex, "admin_sessions", "admin_sessions_expires_at_idx", "CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at)");
    await ensureIndex(knex, "customers", "customers_email_key", "CREATE UNIQUE INDEX customers_email_key ON customers ((LOWER(email)))");
    await ensureIndex(knex, "customers", "customers_phone_key", "CREATE UNIQUE INDEX customers_phone_key ON customers (phone)");
    await ensureIndex(knex, "customers", "customers_brochure_lead_idx", "CREATE INDEX customers_brochure_lead_idx ON customers (is_brochure_lead)");
    await ensureIndex(knex, "customer_otp_codes", "customer_otp_phone_idx", "CREATE INDEX customer_otp_phone_idx ON customer_otp_codes (phone, created_at DESC)");
    await ensureIndex(knex, "customer_otp_codes", "customer_otp_email_idx", "CREATE INDEX customer_otp_email_idx ON customer_otp_codes (email, created_at DESC)");
    await ensureIndex(knex, "customer_otp_codes", "customer_otp_expires_idx", "CREATE INDEX customer_otp_expires_idx ON customer_otp_codes (expires_at)");
    await ensureIndex(knex, "customer_sessions", "customer_sessions_token_hash_key", "CREATE UNIQUE INDEX customer_sessions_token_hash_key ON customer_sessions (token_hash)");
    await ensureIndex(knex, "customer_sessions", "customer_sessions_customer_id_idx", "CREATE INDEX customer_sessions_customer_id_idx ON customer_sessions (customer_id)");
    await ensureIndex(knex, "customer_sessions", "customer_sessions_expires_at_idx", "CREATE INDEX customer_sessions_expires_at_idx ON customer_sessions (expires_at)");
    await ensureIndex(knex, "products", "products_id_key", "CREATE UNIQUE INDEX products_id_key ON products (id)");
    await ensureIndex(knex, "product_variants", "product_variants_product_id_idx", "CREATE INDEX product_variants_product_id_idx ON product_variants (product_id)");
    await ensureIndex(knex, "carts", "carts_customer_active_key", "CREATE UNIQUE INDEX carts_customer_active_key ON carts (customer_id, status)");
    await ensureIndex(knex, "carts", "carts_customer_id_idx", "CREATE INDEX carts_customer_id_idx ON carts (customer_id)");
    await ensureIndex(knex, "cart_items", "cart_items_product_id_idx", "CREATE INDEX cart_items_product_id_idx ON cart_items (product_id)");
    await ensureIndex(knex, "wishlists", "wishlists_customer_key", "CREATE UNIQUE INDEX wishlists_customer_key ON wishlists (customer_id)");
    await ensureIndex(knex, "wishlists", "wishlists_customer_id_idx", "CREATE INDEX wishlists_customer_id_idx ON wishlists (customer_id)");
    await ensureIndex(knex, "wishlist_items", "wishlist_items_product_id_idx", "CREATE INDEX wishlist_items_product_id_idx ON wishlist_items (product_id)");
    await ensureIndex(knex, "orders", "orders_order_number_key", "CREATE UNIQUE INDEX orders_order_number_key ON orders (order_number)");
    await ensureIndex(knex, "orders", "orders_razorpay_order_id_key", "CREATE UNIQUE INDEX orders_razorpay_order_id_key ON orders (razorpay_order_id)");
    await ensureIndex(knex, "orders", "orders_razorpay_payment_id_key", "CREATE UNIQUE INDEX orders_razorpay_payment_id_key ON orders (razorpay_payment_id)");
    await ensureIndex(knex, "orders", "orders_customer_id_idx", "CREATE INDEX orders_customer_id_idx ON orders (customer_id)");
    await ensureIndex(knex, "orders", "orders_created_at_idx", "CREATE INDEX orders_created_at_idx ON orders (created_at DESC)");
    await ensureIndex(knex, "orders", "orders_fulfilment_status_idx", "CREATE INDEX orders_fulfilment_status_idx ON orders (fulfilment_status)");

    await knex("admin_users").whereNot("role", "owner").update({ role: "owner" });
};

exports.down = async function down() {
    // This is a baseline/create migration for a live store database.
    // Rollbacks should be written as explicit follow-up migrations, not by
    // dropping customer/order data from here.
};
