const path = require("path");
require("dotenv").config();
const { DB_TYPE } = require("./dbType");

function defaultPort() {
    return DB_TYPE === "mysql" ? 3306 : 5432;
}

function createKnexConfig() {
    const connection = {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT || defaultPort()),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    };

    if (DB_TYPE === "mysql") {
        connection.charset = "utf8mb4";
    }

    return {
        client: DB_TYPE === "mysql" ? "mysql2" : "pg",
        connection,
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
