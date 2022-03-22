const Promise = require('bluebird');
require('dotenv').config({ path: 'test/.env.test' });

const Constants = require('../../constants');
const { USE_DYNAMODB } = require('../../features');
const AccountService = require('../../services/account');
const RecoveryMethodService = require('../../services/recovery_method');
const chai = require('../chai');
const { deleteAllRows } = require('../db');
const initLocalDynamo = require('../local_dynamo');
const { generateEmailAddress, generateSmsNumber } = require('../utils');

const { IDENTITY_VERIFICATION_METHOD_KINDS, TWO_FACTOR_AUTH_KINDS } = Constants;
const { expect } = chai;

const ACCOUNT_ID = 'near.near';
const SECURITY_CODE = '123456';
const PUBLIC_KEY = 'xyz';

const accountService = new AccountService();
const recoveryMethodService = new RecoveryMethodService();

describe('RecoveryMethodService', function () {
    beforeEach(async function () {
        if (USE_DYNAMODB) {
            const methods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            await Promise.all(methods.map((method) => recoveryMethodService.deleteRecoveryMethod(method)));
        } else {
            await deleteAllRows();
            await accountService.createAccount(ACCOUNT_ID);
        }
    });

    let terminateLocalDynamo;
    before(async function() {
        if (USE_DYNAMODB) {
            this.timeout(10000);
            ({ terminateLocalDynamo } = await initLocalDynamo());
        }
    });

    after(async function() {
        if (USE_DYNAMODB) {
            await terminateLocalDynamo();
        }
    });

    describe('createRecoveryMethod', function () {
        it('creates the recovery method', async function () {
            const email = generateEmailAddress();
            const recoveryMethod = await recoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: email,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
            });

            expect(recoveryMethod).property('detail', email);
            expect(recoveryMethod).property('kind', IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL);
            expect(recoveryMethod).property('securityCode', SECURITY_CODE.toString());
        });
    });

    describe('deleteOtherRecoveryMethods', function () {
        it('deletes recovery methods for the same account without the specified detail', async function () {
            const email = generateEmailAddress();
            const secondaryEmail = generateEmailAddress();
            await Promise.all([
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: email,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    publicKey: 'abc',
                    securityCode: SECURITY_CODE,
                }),
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: secondaryEmail,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    publicKey: 'xyz',
                    securityCode: SECURITY_CODE,
                })
            ]);

            let recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(2);

            await recoveryMethodService.deleteOtherRecoveryMethods({ accountId: ACCOUNT_ID, detail: email });
            recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);

            expect(recoveryMethods).length(1);
            expect(recoveryMethods[0]).property('detail', email);
        });
    });

    describe('deleteRecoveryMethod', function () {
        it('deletes the specified recovery method', async function () {
            await recoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            let recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(1);

            await recoveryMethodService.deleteRecoveryMethod({
                accountId: ACCOUNT_ID,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                publicKey: PUBLIC_KEY,
            });

            recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).empty;
        });
    });

    describe('getTwoFactorRecoveryMethod', function () {
        it('returns null when no two-factor recovery method exists', async function () {
            await recoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            const recoveryMethod = await recoveryMethodService.getTwoFactorRecoveryMethod(ACCOUNT_ID);
            expect(recoveryMethod).null;
        });

        it('returns the two-factor recovery method', async function () {
            await recoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: generateEmailAddress(),
                kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            const recoveryMethod = await recoveryMethodService.getTwoFactorRecoveryMethod(ACCOUNT_ID);
            expect(recoveryMethod).property('kind', TWO_FACTOR_AUTH_KINDS.EMAIL);
        });
    });

    describe('isTwoFactorRequestExpired', function () {
        it('returns true for expired requests', async function () {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const isExpired = recoveryMethodService.isTwoFactorRequestExpired({ updatedAt: oneHourAgo });
            expect(isExpired).true;
        });

        it('returns false for non-expired requests', async function () {
            const oneMinuteAgo = Date.now() - (60 * 1000);
            const isExpired = recoveryMethodService.isTwoFactorRequestExpired({ updatedAt: oneMinuteAgo });
            expect(isExpired).false;
        });
    });

    describe('listAllRecoveryMethods', function () {
        it('returns all recovery methods for the provided account', async function () {
            let recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(0);

            await Promise.all([
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: generateEmailAddress(),
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: generateSmsNumber(),
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: SECURITY_CODE,
                })
            ]);

            recoveryMethods = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(2);
        });
    });

    (USE_DYNAMODB ? describe.skip : describe)('listRecoveryMethods', function () {
        it('returns all recovery methods for the given detail and kind', async function () {
            const email = generateEmailAddress();
            await Promise.all([
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: email,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: generateSmsNumber(),
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: '654321',
                })
            ]);

            const recoveryMethods = await recoveryMethodService.listRecoveryMethods({
                accountId: ACCOUNT_ID,
                detail: email,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            });
            expect(recoveryMethods).length(1);
        });

        it('returns all recovery methods for the given security code', async function () {
            const email = generateEmailAddress();
            await Promise.all([
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: email,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                recoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: generateSmsNumber(),
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: '654321',
                })
            ]);

            const recoveryMethods = await recoveryMethodService.listRecoveryMethods({
                accountId: ACCOUNT_ID,
                securityCode: SECURITY_CODE.toString(),
            });

            expect(recoveryMethods).length(1);
            expect(recoveryMethods[0]).property('detail', email);
        });
    });

    describe('resetTwoFactorRequest', function () {
        it('resets the requestId and security code on the two-factor recovery method', async function () {
            await recoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: generateEmailAddress(),
                kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                requestId: 1,
            });

            let [twoFactorRecoveryMethod] = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(twoFactorRecoveryMethod).property('requestId', 1);

            await recoveryMethodService.resetTwoFactorRequest(ACCOUNT_ID);
            [twoFactorRecoveryMethod] = await recoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(twoFactorRecoveryMethod).property('requestId', -1);
        });
    });
});
