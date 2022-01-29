const Constants = require('../../constants');
const IdentityVerificationMethodService = require('../../services/identity_verification_method');
const IdentityVerificationMethodSequelize = require('../../services/sequelize/identity_verification_method');
const chai = require('../chai');
const { deleteAllRows } = require('../db');

const { IDENTITY_VERIFICATION_METHOD_KINDS } = Constants;
const { expect } = chai;

const EMAIL = 'test@near.org';
const SECURITY_CODE = 123456;

describe('IdentityVerificationMethodService', function () {
    before(async function() {
        await deleteAllRows();
    });

    describe('claimIdentityVerificationMethod', function () {
        beforeEach(async function () {
            await deleteAllRows();
        });

        it('updates an unclaimed identity verification method to be claimed', async function () {
            const params = {
                identityKey: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                ...params,
                securityCode: SECURITY_CODE,
            });
            await IdentityVerificationMethodService().claimIdentityVerificationMethod(params);

            const identityVerificationMethod = await IdentityVerificationMethodService().getIdentityVerificationMethod(params);
            expect(identityVerificationMethod).property('securityCode', null);
            expect(identityVerificationMethod).property('claimed', true);
        });
    });

    describe('getIdentityVerificationMethod', function () {
        beforeEach(async function () {
            await deleteAllRows();
        });

        it('returns null for non-existent records', async function () {
            const identityVerificationMethod = await IdentityVerificationMethodService().getIdentityVerificationMethod({
                identityKey: 'fake@gmail.com',
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            });

            expect(identityVerificationMethod).null;
        });

        it('gets the identity verification method based on identityKey and kind', async function () {
            const params = {
                identityKey: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                ...params,
                securityCode: SECURITY_CODE,
            });

            const identityVerificationMethod = await IdentityVerificationMethodService().getIdentityVerificationMethod(params);
            expect(identityVerificationMethod).property('identityKey', EMAIL);
            expect(identityVerificationMethod).property('kind', IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL);
        });
    });

    describe('getUniqueEmail', function () {
        it('returns empty string for email addresses without @', async function () {
            expect(IdentityVerificationMethodService().getUniqueEmail('xyz')).equal('');
        });

        it('returns the same value for googlemail addresses', async function () {
            const gmailAddress = IdentityVerificationMethodService().getUniqueEmail('test@gmail.com');
            const googleMailAddress = IdentityVerificationMethodService().getUniqueEmail('test@googlemail.com');
            expect(gmailAddress).equal(googleMailAddress);
        });

        it('considers email addresses with + characters to be equivalent', async function () {
            const gmailAddress = IdentityVerificationMethodService().getUniqueEmail('test@gmail.com');
            const subAddress = IdentityVerificationMethodService().getUniqueEmail('test+tessst@gmail.com');
            expect(gmailAddress).equal(subAddress);
        });

        it('ignores special characters in email username', async function () {
            const gmailAddress = IdentityVerificationMethodService().getUniqueEmail('test@gmail.com');
            const invalidCharAddress = IdentityVerificationMethodService().getUniqueEmail('t|(e)#s>t@gmail.com');
            expect(gmailAddress).equal(invalidCharAddress);
        });
    });

    describe('recoverIdentity', function () {
        beforeEach(async function () {
            await deleteAllRows();
        });

        it('returns false for already-claimed identity verification methods', async function () {
            const params = {
                identityKey: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                ...params,
                securityCode: SECURITY_CODE,
            });
            await IdentityVerificationMethodService().claimIdentityVerificationMethod(params);

            const isRecovered = await IdentityVerificationMethodService().recoverIdentity({
                ...params,
                securityCode: SECURITY_CODE,
            });

            expect(isRecovered).false;
        });

        it('updates unclaimed identity verification methods', async function () {
            const params = {
                identityKey: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal(params);
            const isRecovered = await IdentityVerificationMethodService().recoverIdentity({
                ...params,
                securityCode: SECURITY_CODE,
            });
            const identityVerificationMethod = await IdentityVerificationMethodService().getIdentityVerificationMethod(params);

            expect(isRecovered).true;
            expect(identityVerificationMethod).property('securityCode', SECURITY_CODE.toString());
        });

        it('returns false when the identityKey exists for a different value for kind', async function () {
            const params = {
                identityKey: EMAIL,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal(params);
            const isRecovered = await IdentityVerificationMethodService().recoverIdentity({
                ...params,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.PHONE,
                securityCode: SECURITY_CODE,
            });

            expect(isRecovered).false;
        });

        it('returns false when no row with identityKey exists but a matching uniqueIdentityKey does', async function () {
            const params = {
                identityKey: 'test@gmail.com',
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                ...params,
                identityKey: 'test+test@gmail.com',
            });
            const isRecovered = await IdentityVerificationMethodService().recoverIdentity({
                ...params,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
            });

            expect(isRecovered).false;
        });
    });
});
