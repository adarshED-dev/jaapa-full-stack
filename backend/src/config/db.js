const mysql = require("mysql2/promise");
require("dotenv").config();

const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
});

function toMysqlQuery(sql, params = []) {
    let text = String(sql);

    text = text.replace(
        /CURRENT_TIMESTAMP \+ \(\$(\d+) \|\| ' minutes'\)::interval/g,
        (_, index) => `DATE_ADD(CURRENT_TIMESTAMP, INTERVAL $${index} MINUTE)`
    );
    text = text.replace(/\$(\d+)::(?:jsonb|json|text|uuid|int|integer|numeric|boolean)/g, (_, index) => `$${index}`);
    text = text.replace(/([A-Za-z_][\w.]*?)::text/g, "CAST($1 AS CHAR)");
    text = text.replace(/::jsonb\b/g, "");

    if (!/\$\d+/.test(text)) {
        return { text, values: params.map(normalizeParam) };
    }

    const values = [];
    text = text.replace(/\$(\d+)/g, (_, index) => {
        values.push(normalizeParam(params[Number(index) - 1]));
        return "?";
    });

    return { text, values };
}

function normalizeParam(value) {
    if (value === undefined) return null;
    if (value instanceof Date || Buffer.isBuffer(value)) return value;
    if (Array.isArray(value) || (value && typeof value === "object")) {
        return JSON.stringify(value);
    }
    return value;
}

function resultFromMysql(rows) {
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

async function runQuery(executor, sql, params) {
    const { text, values } = toMysqlQuery(sql, params);
    const [rows] = await executor.query(text, values);
    return resultFromMysql(rows);
}

module.exports = {
    query(sql, params) {
        return runQuery(mysqlPool, sql, params);
    },
    async connect() {
        const connection = await mysqlPool.getConnection();
        return {
            query(sql, params) {
                return runQuery(connection, sql, params);
            },
            release() {
                connection.release();
            },
        };
    },
    end() {
        return mysqlPool.end();
    },
};
