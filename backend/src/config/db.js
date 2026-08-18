require("dotenv").config();

const { Pool } = require("pg");
const mysql = require("mysql2/promise");
const { DB_TYPE } = require("./dbType");

function databaseConfig(defaultPort) {
    const prefix = DB_TYPE === "mysql" ? "MYSQL_DB" : "POSTGRES_DB";

    return {
        host: process.env[`${prefix}_HOST`] || process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env[`${prefix}_PORT`] || process.env.DB_PORT || defaultPort),
        database: process.env[`${prefix}_NAME`] || process.env.DB_NAME,
        user: process.env[`${prefix}_USER`] || process.env.DB_USER,
        password: process.env[`${prefix}_PASSWORD`] || process.env.DB_PASSWORD,
    };
}

function createPostgresPool() {
    return new Pool(databaseConfig(5432));
}

function intervalUnit(unit) {
    return String(unit || "").replace(/s$/i, "").toUpperCase();
}

function toMysqlQuery(sql, params = []) {
    let text = String(sql);

    text = text.replace(
        /CURRENT_TIMESTAMP\s*\+\s*\(\$(\d+)\s*\|\|\s*' minutes'\)::interval/gi,
        (_, index) => `DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $${index} MINUTE)`
    );
    text = text.replace(
        /CURRENT_TIMESTAMP\s*-\s*INTERVAL\s*'(\d+)\s+([a-z]+)'/gi,
        (_, amount, unit) => `DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${amount} ${intervalUnit(unit)})`
    );
    text = text.replace(
        /regexp_replace\(([^,]+),\s*'\\\\D',\s*'',\s*'g'\)/gi,
        (_, expression) => `REGEXP_REPLACE(${expression}, '[^0-9]', '')`
    );
    text = text.replace(
        /ORDER BY ([A-Za-z_][\w.]*) DESC NULLS LAST/gi,
        (_, column) => `ORDER BY ${column} IS NULL, ${column} DESC`
    );
    text = text.replace(
        /\$(\d+)::(?:jsonb|json|text|uuid|int|integer|numeric|boolean)/gi,
        (_, index) => `$${index}`
    );
    text = text.replace(
        /([A-Za-z_][\w.]*?)::text/g,
        (_, expression) => `CAST(${expression} AS CHAR)`
    );
    text = text.replace(/::(?:jsonb|json|text|uuid|int|integer|numeric|boolean)\b/gi, "");

    if (!/\$\d+/.test(text)) {
        return { text, values: params.map(normalizeMysqlParam) };
    }

    const values = [];
    text = text.replace(/\$(\d+)/g, (_, index) => {
        values.push(normalizeMysqlParam(params[Number(index) - 1]));
        return "?";
    });

    return { text, values };
}

function normalizeMysqlParam(value) {
    if (value === undefined) return null;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (Array.isArray(value) || (value && typeof value === "object")) {
        return JSON.stringify(value);
    }
    return value;
}

function mysqlResult(rows) {
    if (Array.isArray(rows)) {
        return { rows, rowCount: rows.length };
    }
    return {
        rows: [],
        rowCount: rows.affectedRows || 0,
        insertId: rows.insertId,
        affectedRows: rows.affectedRows || 0,
    };
}

async function runMysqlQuery(executor, sql, params) {
    const { text, values } = toMysqlQuery(sql, params);
    const [rows] = await executor.query(text, values);
    return mysqlResult(rows);
}

function createMysqlPool() {
    const pool = mysql.createPool({
        ...databaseConfig(3306),
        waitForConnections: true,
        connectionLimit: 10,
    });


    return {
        query(sql, params) {
            return runMysqlQuery(pool, sql, params);
        },
        async connect() {
            const connection = await pool.getConnection();
            return {
                query(sql, params) {
                    return runMysqlQuery(connection, sql, params);
                },
                release() {
                    connection.release();
                },
            };
        },
        end() {
            return pool.end();
        },
    };
}

module.exports = DB_TYPE === "mysql" ? createMysqlPool() : createPostgresPool();
