require('dotenv').config({ path: 'test/.env.test' });

const AccountService = require('../../services/account');
const chai = require('../chai');
const initLocalDynamo = require('../local_dynamo');
const { generateAccountId } = require('../utils');

const { expect } = chai;

const accountService = new AccountService();

describe('AccountService', function () {
    let terminateLocalDynamo;
    before(async function() {
        this.timeout(10000);
        ({ terminateLocalDynamo } = await initLocalDynamo());
    });

    after(async function() {
        await terminateLocalDynamo();
    });

    describe('createAccount', function () {
        it('accounts are created with default parameters', async function () {
            const accountId = generateAccountId();
            const account = await accountService.createAccount(accountId);
            expect(account).property('accountId', accountId);
            expect(account).property('fundedAccountNeedsDeposit', false);
        });

        it('accounts are correctly created with fundedAccountNeedsDeposit', async function () {
            const accountId = generateAccountId();
            const account = await accountService.createAccount(accountId, { fundedAccountNeedsDeposit: true });
            expect(account).property('accountId', accountId);
            expect(account).property('fundedAccountNeedsDeposit', true);
        });
    });

    describe('deleteAccount', function () {
        it('the account with matching accountId is deleted', async function () {
            const accountId = generateAccountId();
            let account = await accountService.createAccount(accountId);
            expect(account).property('accountId', accountId);

            await accountService.deleteAccount(accountId);
            account = await accountService.getAccount(accountId);
            expect(account).null;
        });
    });

    describe('getAccount', function () {
        it('the account with matching accountId is returned', async function () {
            const accountId = generateAccountId();
            let account = await accountService.createAccount(accountId);
            expect(account).property('accountId', accountId);

            account = await accountService.getAccount(accountId);
            expect(account).property('accountId', accountId);
        });

        it('returns null for non-existent accounts', async function () {
            const accountId = 'nonexistent.near';
            const account = await accountService.getAccount(accountId);
            expect(account).null;
        });
    });

    describe('setAccountRequiresDeposit', function () {
        it('sets the fundedAccountNeedsDeposit flag', async function () {
            const accountId = generateAccountId();
            let account = await accountService.createAccount(accountId);
            expect(account).property('fundedAccountNeedsDeposit', false);

            await accountService.setAccountRequiresDeposit(accountId, true);
            account = await accountService.getAccount(accountId);
            expect(account).property('fundedAccountNeedsDeposit', true);
        });
    });
});
