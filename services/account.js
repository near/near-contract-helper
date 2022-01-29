const stampit = require('@stamp/it');

const {
    createAccount,
    deleteAccount,
    getAccountById,
    updateAccount,
} = require('../db/methods/account');
const { USE_DYNAMODB } = require('../features');
const SequelizeAccounts = require('./sequelize/account');

const AccountService = stampit({
    props: {
        db: {
            createAccount,
            deleteAccount,
            getAccountById,
            updateAccount,
        },
        sequelize: SequelizeAccounts,
    },
    methods: {
        createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
            if (!USE_DYNAMODB) {
                return this.sequelize.createAccount(accountId, { fundedAccountNeedsDeposit });
            }
            return this.db.createAccount({ accountId, fundedAccountNeedsDeposit });
        },

        async deleteAccount(accountId) {
            if (!USE_DYNAMODB) {
                return this.sequelize.deleteAccount(accountId);
            }
            return this.db.deleteAccount(accountId);
        },

        getAccount(accountId) {
            if (!USE_DYNAMODB) {
                return this.sequelize.getAccount(accountId);
            }
            return this.db.getAccountById(accountId);
        },

        async getOrCreateAccount(accountId) {
            if (!USE_DYNAMODB) {
                return this.createAccount(accountId);
            }
            const account = await this.getAccount(accountId);
            if (account) {
                return account;
            }

            return this.createAccount(accountId);
        },

        async setAccountRequiresDeposit(accountId, requiresDeposit) {
            if (!USE_DYNAMODB) {
                return this.sequelize.setAccountRequiresDeposit(accountId, requiresDeposit);
            }
            return this.db.updateAccount(accountId, { fundedAccountNeedsDeposit: requiresDeposit });
        },
    },
});

module.exports = AccountService;
