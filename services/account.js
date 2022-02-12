const stampit = require('@stamp/it');

const {
    createAccount,
    deleteAccount,
    getAccountById,
    updateAccount,
} = require('../db/methods/account');

const AccountService = stampit({
    props: {
        db: {
            createAccount,
            deleteAccount,
            getAccountById,
            updateAccount,
        },
    },
    methods: {
        createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
            return this.db.createAccount({ accountId, fundedAccountNeedsDeposit });
        },

        async deleteAccount(accountId) {
            return this.db.deleteAccount(accountId);
        },

        getAccount(accountId) {
            return this.db.getAccountById(accountId);
        },

        async getOrCreateAccount(accountId) {
            const account = await this.getAccount(accountId);
            if (account) {
                return account;
            }

            return this.createAccount(accountId);
        },

        async setAccountRequiresDeposit(accountId, requiresDeposit) {
            return this.db.updateAccount(accountId, { fundedAccountNeedsDeposit: requiresDeposit });
        },
    },
});

module.exports = AccountService;
