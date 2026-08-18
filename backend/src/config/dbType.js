require("dotenv").config();

function normalizeDbType(value = process.env.DB_TYPE) {
    const normalized = String(value || "postgresql")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    if (["mysql", "mysql2", "mariadb"].includes(normalized)) return "mysql";
    if (["postgres", "postgresql", "postresql", "pg"].includes(normalized)) return "postgresql";

    throw new Error(`Unsupported DB_TYPE "${value}". Use "mysql" or "postgresql".`);
}

const DB_TYPE = normalizeDbType();

module.exports = {
    DB_TYPE,
    normalizeDbType,
    isMysql: () => DB_TYPE === "mysql",
    isPostgresql: () => DB_TYPE === "postgresql",
};
