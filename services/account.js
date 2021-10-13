const models = require('../models');

const { Account } = models;

const WRITE_TO_POSTGRES = true;

const AccountService = {
    async createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? [this.createAccount_sequelize(accountId, { fundedAccountNeedsDeposit })] : []),
        ]);

        return postgresAccount;
    },

    async createAccount_sequelize(accountId, { fundedAccountNeedsDeposit }) {
        const [account] = await Account.findOrCreate({
            where: { accountId },
            ...(fundedAccountNeedsDeposit !== undefined && {
                defaults: {
                    fundedAccountNeedsDeposit,
                },
            }),
        });

        return account.toJSON();
    },

    async deleteAccount(accountId) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.deleteAccount_sequelize(accountId) : []),
        ]);

        return postgresAccount;
    },

    async deleteAccount_sequelize(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        await account.destroy();
        return account.toJSON();
    },

    getAccount(accountId) {
        return this.getAccount_sequelize(accountId);
    },

    async getAccount_sequelize(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return null;
        }

        return account.toJSON();
    },

    async setAccountRequiresDeposit(accountId, requiresDeposit) {
        const [postgresAccount] = await Promise.all([
            ...(WRITE_TO_POSTGRES ? this.setAccountRequiresDeposit_sequelize(accountId, requiresDeposit) : []),
        ]);

        return postgresAccount;
    },

    async setAccountRequiresDeposit_sequelize(accountId, requiresDeposit) {
        await Account.update({ fundedAccountNeedsDeposit: requiresDeposit }, { where: { accountId } });

        // sequelize updates don't actually return anything useful but we'll want the
        // eventual interface to return the updated object so use a placeholder for now
        return {};
    },
};

module.exports = AccountService;
