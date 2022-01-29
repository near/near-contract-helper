const AccountService = require('../../services/account');
const chai = require('../chai');
const { deleteAllRows } = require('../db');

const { expect } = chai;

function* generateAccountId() {
    let accountSuffix = 1;
    while (true) {
        yield `account${accountSuffix++}.near`;
    }
}

const accountGenerator = generateAccountId();
function getAccountId() {
    return accountGenerator.next().value;
}

describe('AccountService', function () {
    before(async function() {
        await deleteAllRows();
    });

    describe('createAccount', function () {
        it('accounts are created with default parameters', async function () {
            const accountId = getAccountId();
            const account = await AccountService().createAccount(accountId);
            expect(account).property('accountId', accountId);
            expect(account).property('fundedAccountNeedsDeposit', false);
        });

        it('accounts are correctly created with fundedAccountNeedsDeposit', async function () {
            const accountId = getAccountId();
            const account = await AccountService().createAccount(accountId, { fundedAccountNeedsDeposit: true });
            expect(account).property('accountId', accountId);
            expect(account).property('fundedAccountNeedsDeposit', true);
        });
    });

    describe('deleteAccount', function () {
        it('the account with matching accountId is deleted', async function () {
            const accountId = getAccountId();
            let account = await AccountService().createAccount(accountId);
            expect(account).property('accountId', accountId);

            await AccountService().deleteAccount(accountId);
            account = await AccountService().getAccount(accountId);
            expect(account).null;
        });
    });

    describe('getAccount', function () {
        it('the account with matching accountId is returned', async function () {
            const accountId = getAccountId();
            let account = await AccountService().createAccount(accountId);
            expect(account).property('accountId', accountId);

            account = await AccountService().getAccount(accountId);
            expect(account).property('accountId', accountId);
        });

        it('returns null for non-existent accounts', async function () {
            const accountId = 'nonexistent.near';
            const account = await AccountService().getAccount(accountId);
            expect(account).null;
        });
    });

    describe('setAccountRequiresDeposit', function () {
        it('sets the fundedAccountNeedsDeposit flag', async function () {
            const accountId = getAccountId();
            let account = await AccountService().createAccount(accountId);
            expect(account).property('fundedAccountNeedsDeposit', false);

            await AccountService().setAccountRequiresDeposit(accountId, true);
            account = await AccountService().getAccount(accountId);
            expect(account).property('fundedAccountNeedsDeposit', true);
        });
    });
});
