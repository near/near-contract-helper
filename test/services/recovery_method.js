const Constants = require('../../constants');
const AccountService = require('../../services/account');
const RecoveryMethodService = require('../../services/recovery_method');
const chai = require('../chai');
const { deleteAllRows } = require('../db');

const { IDENTITY_VERIFICATION_METHOD_KINDS, TWO_FACTOR_AUTH_KINDS } = Constants;
const { expect } = chai;

const ACCOUNT_ID = 'near.near';
const EMAIL = 'test@near.org';
const PHONE = '+1-111-222-3333';
const SECURITY_CODE = 123456;
const PUBLIC_KEY = 'xyz';

describe('RecoveryMethodService', function () {
    beforeEach(async function () {
        await deleteAllRows();
        await AccountService.createAccount(ACCOUNT_ID);
    });

    describe('createRecoveryMethod', function () {
        it('creates the recovery method', async function () {
            const recoveryMethod = await RecoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
            });

            expect(recoveryMethod).property('detail', EMAIL);
            expect(recoveryMethod).property('kind', IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL);
            expect(recoveryMethod).property('securityCode', SECURITY_CODE.toString());
        });
    });

    describe('deleteOtherRecoveryMethods', function () {
        it('deletes recovery methods for the same account without the specified detail', async function () {
            const secondaryEmail = 'not-test@near.org';
            await Promise.all([
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: EMAIL,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: secondaryEmail,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                })
            ]);

            let recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(2);

            await RecoveryMethodService.deleteOtherRecoveryMethods({ accountId: ACCOUNT_ID, detail: EMAIL });
            recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);

            expect(recoveryMethods).length(1);
            expect(recoveryMethods[0]).property('detail', EMAIL);
        });
    });

    describe('deleteRecoveryMethod', function () {
        it('deletes the specified recovery method', async function () {
            await RecoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            let recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(1);

            await RecoveryMethodService.deleteRecoveryMethod({
                accountId: ACCOUNT_ID,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                publicKey: PUBLIC_KEY,
            });

            recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).empty;
        });
    });

    describe('getTwoFactorRecoveryMethod', function () {
        it('returns null when no two-factor recovery method exists', async function () {
            await RecoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            const recoveryMethod = await RecoveryMethodService.getTwoFactorRecoveryMethod(ACCOUNT_ID);
            expect(recoveryMethod).null;
        });

        it('returns the two-factor recovery method', async function () {
            await RecoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                publicKey: PUBLIC_KEY,
            });

            const recoveryMethod = await RecoveryMethodService.getTwoFactorRecoveryMethod(ACCOUNT_ID);
            expect(recoveryMethod).property('kind', TWO_FACTOR_AUTH_KINDS.EMAIL);
        });
    });

    describe('isTwoFactorRequestExpired', function () {
        it('returns true for expired requests', async function () {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const isExpired = RecoveryMethodService.isTwoFactorRequestExpired({ updatedAt: oneHourAgo });
            expect(isExpired).true;
        });

        it('returns true for future values', async function () {
            const oneMinuteFromNow = Date.now() + (60 * 1000);
            const isExpired = RecoveryMethodService.isTwoFactorRequestExpired({ updatedAt: oneMinuteFromNow });
            expect(isExpired).true;
        });

        it('returns true for empty values', async function () {
            const isExpired = RecoveryMethodService.isTwoFactorRequestExpired({});
            expect(isExpired).true;
        });

        it('returns false for non-expired requests', async function () {
            const oneMinuteAgo = Date.now() - (60 * 1000);
            const isExpired = RecoveryMethodService.isTwoFactorRequestExpired({ updatedAt: oneMinuteAgo });
            expect(isExpired).false;
        });
    });

    describe('listAllRecoveryMethods', function () {
        it('returns all recovery methods for the provided account', async function () {
            let recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(0);

            await Promise.all([
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: EMAIL,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: PHONE,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: SECURITY_CODE,
                })
            ]);

            recoveryMethods = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(recoveryMethods).length(2);
        });
    });

    describe('listRecoveryMethods', function () {
        it('returns all recovery methods for the given detail and kind', async function () {
            await Promise.all([
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: EMAIL,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: PHONE,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: '654321',
                })
            ]);

            const recoveryMethods = await RecoveryMethodService.listRecoveryMethods({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            });
            expect(recoveryMethods).length(1);
        });

        it('returns all recovery methods for the given security code', async function () {
            await Promise.all([
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: EMAIL,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                    securityCode: SECURITY_CODE,
                }),
                RecoveryMethodService.createRecoveryMethod({
                    accountId: ACCOUNT_ID,
                    detail: PHONE,
                    kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                    securityCode: '654321',
                })
            ]);

            const recoveryMethods = await RecoveryMethodService.listRecoveryMethods({
                accountId: ACCOUNT_ID,
                securityCode: SECURITY_CODE.toString(),
            });

            expect(recoveryMethods).length(1);
            expect(recoveryMethods[0]).property('detail', EMAIL);
        });
    });

    describe('resetTwoFactorRequest', function () {
        it('resets the requestId and security code on the two-factor recovery method', async function () {
            await RecoveryMethodService.createRecoveryMethod({
                accountId: ACCOUNT_ID,
                detail: EMAIL,
                kind: TWO_FACTOR_AUTH_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
                requestId: 1,
            });

            let [twoFactorRecoveryMethod] = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(twoFactorRecoveryMethod).property('requestId', 1);

            await RecoveryMethodService.resetTwoFactorRequest(ACCOUNT_ID);
            [twoFactorRecoveryMethod] = await RecoveryMethodService.listAllRecoveryMethods(ACCOUNT_ID);
            expect(twoFactorRecoveryMethod).property('requestId', -1);
        });
    });
});
