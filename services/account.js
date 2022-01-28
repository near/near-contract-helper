const {
    createAccount,
    deleteAccount,
    getAccountById,
    updateAccount,
} = require('../db/methods/account');
const { USE_DYNAMODB } = require('../features');
const SequelizeAccounts = require('./sequelize/account');

const AccountService = {
    createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
        if (!USE_DYNAMODB) {
            return SequelizeAccounts.createAccount(accountId, { fundedAccountNeedsDeposit });
        }
        return createAccount({ accountId, fundedAccountNeedsDeposit });
    },

    async deleteAccount(accountId) {
        if (!USE_DYNAMODB) {
            return SequelizeAccounts.deleteAccount(accountId);
        }
        return deleteAccount(accountId);
    },

    getAccount(accountId) {
        if (!USE_DYNAMODB) {
            return SequelizeAccounts.getAccount(accountId);
        }
        return getAccountById(accountId);
    },

    async setAccountRequiresDeposit(accountId, requiresDeposit) {
        if (!USE_DYNAMODB) {
            return SequelizeAccounts.setAccountRequiresDeposit(accountId, requiresDeposit);
        }
        return updateAccount(accountId, { fundedAccountNeedsDeposit: requiresDeposit });
    },
};

module.exports = AccountService;
