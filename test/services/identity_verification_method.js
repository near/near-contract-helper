require('dotenv').config({ path: 'test/.env.test' });

const Constants = require('../../constants');
const IdentityVerificationMethodService = require('../../services/identity_verification_method');
const IdentityVerificationMethodSequelize = require('../../services/sequelize/identity_verification_method');
const chai = require('../chai');
const { deleteAllRows } = require('../db');
const { USE_DYNAMODB } = require('../../features');
const initLocalDynamo = require('../local_dynamo');
const { generateEmailAddress } = require('../utils');

const { IDENTITY_VERIFICATION_METHOD_KINDS } = Constants;
const { expect } = chai;

const SECURITY_CODE = '123456';

const identityVerificationMethodService = new IdentityVerificationMethodService();

describe('IdentityVerificationMethodService', function () {
    let terminateLocalDynamo;
    before(async function() {
        if (USE_DYNAMODB) {
            this.timeout(10000);
            ({ terminateLocalDynamo } = await initLocalDynamo());
        } else {
            await deleteAllRows();
        }
    });

    after(async function() {
        if (USE_DYNAMODB) {
            await terminateLocalDynamo();
        }
    });

    describe('claimIdentityVerificationMethod', function () {
        beforeEach(async function () {
            if (!USE_DYNAMODB) {
                await deleteAllRows();
            }
        });

        it('updates an unclaimed identity verification method to be claimed', async function () {
            const params = {
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            }

            await identityVerificationMethodService.claimIdentityVerificationMethod(params);

            const identityVerificationMethod = await identityVerificationMethodService.getIdentityVerificationMethod(params);
            if (USE_DYNAMODB) {
                expect(identityVerificationMethod).not.have.property('securityCode');
            } else {
                expect(identityVerificationMethod).property('securityCode', null);
            }

            expect(identityVerificationMethod).property('claimed', true);
        });
    });

    describe('getIdentityVerificationMethod', function () {
        beforeEach(async function () {
            if (!USE_DYNAMODB) {
                await deleteAllRows();
            }
        });

        it('returns null for non-existent records', async function () {
            const identityVerificationMethod = await identityVerificationMethodService.getIdentityVerificationMethod({
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            });

            expect(identityVerificationMethod).null;
        });

        it('gets the identity verification method based on identityKey and kind', async function () {
            const params = {
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            }

            const identityVerificationMethod = await identityVerificationMethodService.getIdentityVerificationMethod(params);
            expect(identityVerificationMethod).property('identityKey', params.identityKey);
            expect(identityVerificationMethod).property('kind', params.kind);
        });
    });

    describe('getUniqueEmail', function () {
        it('returns empty string for email addresses without @', async function () {
            expect(identityVerificationMethodService.getUniqueEmail('xyz')).equal('');
        });

        it('returns the same value for googlemail addresses', async function () {
            const gmailAddress = identityVerificationMethodService.getUniqueEmail('test@gmail.com');
            const googleMailAddress = identityVerificationMethodService.getUniqueEmail('test@googlemail.com');
            expect(gmailAddress).equal(googleMailAddress);
        });

        it('considers email addresses with + characters to be equivalent', async function () {
            const gmailAddress = identityVerificationMethodService.getUniqueEmail('test@gmail.com');
            const subAddress = identityVerificationMethodService.getUniqueEmail('test+tessst@gmail.com');
            expect(gmailAddress).equal(subAddress);
        });

        it('ignores special characters in email username', async function () {
            const gmailAddress = identityVerificationMethodService.getUniqueEmail('test@gmail.com');
            const invalidCharAddress = identityVerificationMethodService.getUniqueEmail('t|(e)#s>t@gmail.com');
            expect(gmailAddress).equal(invalidCharAddress);
        });
    });

    describe('recoverIdentity', function () {
        beforeEach(async function () {
            if (!USE_DYNAMODB) {
                await deleteAllRows();
            }
        });

        it('returns false for already-claimed identity verification methods', async function () {
            const params = {
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                    ...params,
                    securityCode: SECURITY_CODE,
                });
            }

            await identityVerificationMethodService.claimIdentityVerificationMethod(params);

            const isRecovered = await identityVerificationMethodService.recoverIdentity({
                ...params,
                securityCode: SECURITY_CODE,
            });

            expect(isRecovered).false;
        });

        it('updates unclaimed identity verification methods', async function () {
            const params = {
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity(params);
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal(params);
            }

            const isRecovered = await identityVerificationMethodService.recoverIdentity({
                ...params,
                securityCode: SECURITY_CODE,
            });
            const identityVerificationMethod = await identityVerificationMethodService.getIdentityVerificationMethod(params);

            expect(isRecovered).true;
            expect(identityVerificationMethod).property('securityCode', SECURITY_CODE.toString());
        });

        it('returns false when the identityKey exists for a different value for kind', async function () {
            const params = {
                identityKey: generateEmailAddress(),
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
            };

            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity(params);
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal(params);
            }

            const isRecovered = await identityVerificationMethodService.recoverIdentity({
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


            if (USE_DYNAMODB) {
                await identityVerificationMethodService.recoverIdentity({
                    ...params,
                    identityKey: 'test+test@gmail.com',
                });
            } else {
                await IdentityVerificationMethodSequelize.createIdentityVerificationMethod_internal({
                    ...params,
                    identityKey: 'test+test@gmail.com',
                });
            }

            const isRecovered = await identityVerificationMethodService.recoverIdentity({
                ...params,
                kind: IDENTITY_VERIFICATION_METHOD_KINDS.EMAIL,
                securityCode: SECURITY_CODE,
            });

            expect(isRecovered).false;
        });
    });
});
