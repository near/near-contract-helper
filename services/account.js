const SequelizeAccounts = require('./sequelize/account');

const WRITE_TO_POSTGRES = true;

const AccountService = {
    async createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeAccounts.createAccount(accountId, { fundedAccountNeedsDeposit })] : []),
        ]);

        return postgresAccount;
    },

    async deleteAccount(accountId) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeAccounts.deleteAccount(accountId)] : []),
        ]);

        return postgresAccount;
    },

    getAccount(accountId) {
        return SequelizeAccounts.getAccount(accountId);
    },

    async setAccountRequiresDeposit(accountId, requiresDeposit) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [SequelizeAccounts.setAccountRequiresDeposit(accountId, requiresDeposit)] : []),
        ]);

        return postgresAccount;
    },
};

module.exports = AccountService;
