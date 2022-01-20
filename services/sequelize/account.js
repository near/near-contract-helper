const models = require('../../models');

const { Account } = models;

const SequelizeAccounts = {
    async createAccount(accountId, { fundedAccountNeedsDeposit }) {
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
        const account = await Account.findOne({ where: { accountId } });
        await account.destroy();
        return account.toJSON();
    },

    async getAccount(accountId) {
        const account = await Account.findOne({ where: { accountId } });
        if (!account) {
            return null;
        }

        return account.toJSON();
    },

    async setAccountRequiresDeposit(accountId, requiresDeposit) {
        await Account.update({ fundedAccountNeedsDeposit: requiresDeposit }, { where: { accountId } });

        // sequelize updates don't actually return anything useful but we'll want the
        // eventual interface to return the updated object so use a placeholder for now
        return {};
    },
};

module.exports = SequelizeAccounts;
