module.exports = {
    buildTableName(baseName) {
        const { NEAR_WALLET_ENV } = process.env;
        if (NEAR_WALLET_ENV.startsWith('testnet')) {
            return `testnet_${baseName}`;
        }

        if (NEAR_WALLET_ENV.startsWith('mainnet')) {
            return `mainnet_${baseName}`;
        }

        throw new Error('Invalid environment');
    },
};
