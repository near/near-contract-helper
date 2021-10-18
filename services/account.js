const SequelizeAccounts = require('./sequelize/account');

const AccountService = {
    createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
        return SequelizeAccounts.createAccount(accountId, { fundedAccountNeedsDeposit });
    },

    async deleteAccount(accountId) {
        return SequelizeAccounts.deleteAccount(accountId);
    },

    getAccount(accountId) {
        return SequelizeAccounts.getAccount(accountId);
    },

    async setAccountRequiresDeposit(accountId, requiresDeposit) {
        return SequelizeAccounts.setAccountRequiresDeposit(accountId, requiresDeposit);
    },
};

module.exports = AccountService;
