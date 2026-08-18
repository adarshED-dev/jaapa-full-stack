const path = require("path");
require("dotenv").config();

function createKnexConfig() {
    return {
        client: "mysql2",
        connection: {
            host: process.env.DB_HOST || "127.0.0.1",
            port: Number(process.env.DB_PORT || 3306),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            charset: "utf8mb4",
        },
        pool: {
            min: 0,
            max: 10,
        },
        migrations: {
            directory: path.join(__dirname, "../../migrations"),
            tableName: "knex_migrations",
            extension: "js",
        },
    };
}

module.exports = { createKnexConfig };
