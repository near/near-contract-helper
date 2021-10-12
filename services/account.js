const models = require('../models');

const { Account } = models;

const WRITE_TO_POSTGRES = true;

const AccountService = {
    createAccount(accountId) {
        return ([
            ...(WRITE_TO_POSTGRES ? this.createAccount_sequelize(accountId) : []),
        ]);
    },

    async createAccount_sequelize(accountId) {
        const account = await Account.create({ accountId });
        return account.toJSON();
    },

    getAccount(accountId) {
        return this.getAccount_sequelize(accountId);
    },

    async getAccount_sequelize(accountId) {
        const [account] = await Account.findOne({ where: { accountId } });
        return account.toJSON();
    },

    setAccountRequiresDeposit(accountId, requiresDeposit) {
        return Promise.all([
            ...(WRITE_TO_POSTGRES ? this.setAccountRequiresDeposit_sequelize(accountId, requiresDeposit) : []),
        ]);
    },

    async setAccountRequiresDeposit_sequelize(accountId, requiresDeposit) {
        await Account.update({ fundedAccountNeedsDeposit: requiresDeposit }, { where: { accountId } });
    },
};

module.exports = AccountService;
