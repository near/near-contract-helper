const {
    createAccount,
    deleteAccount,
    getAccountById,
    updateAccount,
} = require('../db/methods/account');

class AccountService {
    constructor(params = {
        db: {
            createAccount,
            deleteAccount,
            getAccountById,
            updateAccount,
        },
    }) {
        this.db = params.db;
    }
    createAccount(accountId, { fundedAccountNeedsDeposit } = {}) {
        return this.db.createAccount({ accountId, fundedAccountNeedsDeposit });
    }

    deleteAccount(accountId) {
        return this.db.deleteAccount(accountId);
    }

    getAccount(accountId) {
        return this.db.getAccountById(accountId);
    }

    async getOrCreateAccount(accountId) {
        const account = await this.getAccount(accountId);
        if (account) {
            return account;
        }

        return this.createAccount(accountId);
    }

    setAccountRequiresDeposit(accountId, requiresDeposit) {
        return this.db.updateAccount(accountId, { fundedAccountNeedsDeposit: requiresDeposit });
    }
}

module.exports = AccountService;
