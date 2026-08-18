const { createKnexConfig } = require("./src/config/knexConfig");

module.exports = {
    development: createKnexConfig(),
    production: createKnexConfig(),
};
