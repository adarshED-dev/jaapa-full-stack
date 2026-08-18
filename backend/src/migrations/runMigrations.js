const knexFactory = require("knex");
const { createKnexConfig } = require("../config/knexConfig");

async function runMigrations() {
    const knex = knexFactory(createKnexConfig());

    try {
        const [batchNo, migrations] = await knex.migrate.latest();
        if (migrations.length > 0) {
            console.log(`Database migrations applied batch ${batchNo}: ${migrations.join(", ")}`);
        } else {
            console.log("Database migrations already up to date");
        }
    } finally {
        await knex.destroy();
    }
}

module.exports = { runMigrations };
