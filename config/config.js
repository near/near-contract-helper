module.exports = {
    development: {
        username: 'helper',
        password: 'helper',
        database: 'accounts_development',
        host: '127.0.0.1',
        dialect: 'postgres',
    },
    test: {
        username: 'helper',
        password: 'helper',
        database: 'accounts_test',
        host: '127.0.0.1',
        dialect: 'postgres',
        logging: false
    },
    production: {
        username: process.env.HELPER_DB_USERNAME || 'helper',
        password: process.env.HELPER_DB_PASSWORD || 'helper',
        database: process.env.HELPER_DB_NAME || 'accounts_production',
        host:  process.env.HELPER_DB_HOST || '127.0.0.1',
        dialect: 'postgres',
    },
};