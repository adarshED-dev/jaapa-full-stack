exports.config = { transaction: false };

function isPostgresql(knex) {
    return ["pg", "postgres", "postgresql"].includes(knex.client.config.client);
}

async function indexExists(knex, tableName, indexName) {
    if (isPostgresql(knex)) {
        const result = await knex.raw(
            `SELECT 1
             FROM pg_indexes
             WHERE schemaname = current_schema()
               AND tablename = ?
               AND indexname = ?
             LIMIT 1`,
            [tableName, indexName]
        );
        return result.rows.length > 0;
    }

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

async function ensureColumn(knex, tableName, columnName, addColumn) {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (exists) return;

    await knex.schema.alterTable(tableName, (table) => {
        addColumn(table);
    });
}

async function ensureIndex(knex, tableName, indexName, createSql) {
    if (await indexExists(knex, tableName, indexName)) return;
    await knex.raw(createSql);
}

exports.up = async function up(knex) {
    await ensureColumn(knex, "customer_otp_codes", "email", (table) => table.string("email", 255).nullable());

    if (isPostgresql(knex)) {
        await knex.raw("ALTER TABLE customer_otp_codes ALTER COLUMN phone DROP NOT NULL");
        await ensureIndex(
            knex,
            "customer_otp_codes",
            "customer_otp_email_idx",
            "CREATE INDEX customer_otp_email_idx ON customer_otp_codes (email, created_at DESC)"
        );
        return;
    }

    await knex.raw("ALTER TABLE customer_otp_codes MODIFY phone VARCHAR(10) NULL");
    await ensureIndex(
        knex,
        "customer_otp_codes",
        "customer_otp_email_idx",
        "CREATE INDEX customer_otp_email_idx ON customer_otp_codes (email, created_at DESC)"
    );
};

exports.down = async function down() {
    // Keep email OTP data and nullable phone rows. Use an explicit data
    // migration if this ever has to be reversed in production.
};
