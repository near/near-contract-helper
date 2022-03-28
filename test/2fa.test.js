require('dotenv').config({ path: 'test/.env.test' });

const nearAPI = require('near-api-js');
const { parseSeedPhrase } = require('near-seed-phrase');
const sinon = require('sinon');

const constants = require('../constants');
const AccountService = require('../services/account');
const RecoveryMethodService = require('../services/recovery_method');
const attachEchoMessageListeners = require('./attachEchoMessageListeners');
const expectRequestHelpers = require('./expectRequestHelpers');
const chai = require('./chai');
const createTestServerInstance = require('./createTestServerInstance');
const initLocalDynamo = require('./local_dynamo');
const TestAccountHelper = require('./TestAccountHelper');

const { expect } = chai;
const {
    expectJSONResponse,
    expectFailedWithCode
} = expectRequestHelpers;

const accountService = new AccountService();
const recoveryMethodService = new RecoveryMethodService();

const { RECOVERY_METHOD_KINDS, TWO_FACTOR_AUTH_KINDS } = constants;

const REQUEST_ID_FOR_INITIALIZING_2FA = -1;

const twoFactorMethods = {
    email: { kind: TWO_FACTOR_AUTH_KINDS.EMAIL, detail: 'hello@example.com', publicKey: 'pkemail2fa' },
    phone: { kind: TWO_FACTOR_AUTH_KINDS.PHONE, detail: '+1 717 555 0101', publicKey: 'pkphone2fa' },
};

const SEED_PHRASE = 'table island position soft burden budget tooth cruel issue economy destroy above';

const VERBOSE_OUTPUT = process.env.VERBOSE_OUTPUT;

const VERBOSE_OUTPUT_CONFIG = {
    ECHO_SECURITY_CODES: VERBOSE_OUTPUT || false,
    ECHO_MESSAGE_CONTENT: VERBOSE_OUTPUT || false
};

describe('2fa method management', function () {
    this.timeout(15000);

    let app, request, testAccountHelper;
    let terminateLocalDynamo;

    before(async () => {
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        const keyPair = nearAPI.KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);

        ({ request, app } = createTestServerInstance());
        attachEchoMessageListeners({ app, ECHO_MESSAGE_CONTENT: VERBOSE_OUTPUT_CONFIG.ECHO_MESSAGE_CONTENT });

        testAccountHelper = new TestAccountHelper({
            app,
            ECHO_SECURITY_CODES: VERBOSE_OUTPUT_CONFIG.ECHO_SECURITY_CODES,
            keyPair,
            keyStore,
            request,
        });

        ({ terminateLocalDynamo } = await initLocalDynamo());
    });

    after(async () => {
        await terminateLocalDynamo();
    });

    describe('setting up 2fa method', () => {
        let accountId;
        const expect2faCodeSentResponse = ({ body }) =>
            expect(body).property('message', '2fa initialized and code sent to verify method');

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                accountId = await testAccountHelper.createNEARAccount();
            }
        });

        it('prevents initialisation of phone based 2FA methods', async () => {
            const { result } = await testAccountHelper.init2faMethod({
                accountId,
                method: twoFactorMethods.phone
            });

            expectFailedWithCode(401, 'invalid 2fa method 2fa-phone')(result);
        });

        it('should generate a deterministic public key for an account', async () => {
            const { body } = await testAccountHelper.getAccessKey({ accountId })
                .then(expectJSONResponse);

            expect(body)
                .property('publicKey')
                .a('string').satisfy((key) => key.startsWith('ed25519:'))
                .length.within(50, 60);
        });

        it('should return a 200 with appropriate message for the requested 2fa method when we post to initCode', async () => {
            const { result } = await testAccountHelper.init2faMethod({
                accountId,
                method: twoFactorMethods.email
            });

            expectJSONResponse(result);
            expect2faCodeSentResponse(result);
        });

        it('sends a code when the 2FA email address is already being used with an email recovery method', async () => {
            await accountService.getOrCreateAccount(accountId);
            await recoveryMethodService.createRecoveryMethod({
                ...twoFactorMethods.email,
                accountId,
                kind: RECOVERY_METHOD_KINDS.EMAIL,
                requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
            });

            const { result } = await testAccountHelper.init2faMethod({
                accountId,
                method: twoFactorMethods.email
            });

            expectJSONResponse(result);
            expect2faCodeSentResponse(result);
        });
    });

    describe('completing an already requested 2fa method', () => {
        let accountId;
        let initialSecurityCode;

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                ({
                    accountId,
                    securityCode: initialSecurityCode
                } = await testAccountHelper.create2faEnabledNEARAccount({ method: twoFactorMethods.email }));
            }

            expect(initialSecurityCode).length(6);
            const securityCodeAsNumber = parseInt(initialSecurityCode, 10);
            expect(securityCodeAsNumber).not.NaN;
        });

        it('should allow verification using the code generated by the second request', async () => {
            const { result, securityCode: newSecurityCode } = await testAccountHelper.init2faMethod({
                accountId,
                method: twoFactorMethods.email
            });

            expectJSONResponse(result);

            expect(newSecurityCode)
                .a('string')
                .length(6)
                .not.equal(initialSecurityCode);

            const { body } = await testAccountHelper.verify2faMethod({
                accountId,
                requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                securityCode: newSecurityCode
            })
                .then(expectJSONResponse);

            expect(body).property('message', '2fa code verified');
            expect(body).property('requestId', REQUEST_ID_FOR_INITIALIZING_2FA);
        });
    });

    describe('contract already deployed', () => {
        const testContractDeployed = true;
        let accountId;

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                ({ accountId } = await testAccountHelper.create2faEnabledNEARAccount({ method: twoFactorMethods.email }));
            }
        });

        it('initCode for an account with contract deployed', async () => {
            const { result } = await testAccountHelper.init2faMethod({
                testContractDeployed,
                accountId,
                method: twoFactorMethods.email,
            });
            expectFailedWithCode(401, 'account with multisig contract already has 2fa method')(result);
        });
    });

    describe('/verify', function () {
        const invertSecurityCode = (code) => [...code].map((digit) => 9 - digit).join('');

        describe('validation', () => {
            let accountId;
            let securityCode;

            // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
            beforeEach(async () => {
                if (!accountId) {
                    ({
                        accountId,
                        securityCode
                    } = await testAccountHelper.create2faEnabledNEARAccount({ method: twoFactorMethods.email }));
                }
            });

            // FIXME: Cover service with unit tests for this case, so we don't need a mock global date
            describe('expired codes', () => {
                let clock;

                beforeEach(async function () {
                    clock = sinon.useFakeTimers({
                        now: new Date(2030, 1, 1, 0, 0),
                        shouldAdvanceTime: true,
                        advanceTimeDelta: 20
                    });
                });

                afterEach(function () {
                    clock.restore();
                });

                it('securityCode that is more than 5 minutes old should fail', async () => {
                    return testAccountHelper.verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode
                    })
                        .then(expectFailedWithCode(401, '2fa code expired'));
                });
            });

            describe('malformed security codes should be rejected', () => {
                const expectInvalid2faCodeProvidedError = expectFailedWithCode(401, 'invalid 2fa code provided');

                it('verify 2fa method should fail when given code that is too long', async () => {
                    return testAccountHelper.verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode: '1234567',

                    })
                        .then(expectInvalid2faCodeProvidedError);
                });

                it('verify 2fa method should fail when given code that is too short', async () => {
                    return testAccountHelper.verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode: '123',

                    })
                        .then(expectInvalid2faCodeProvidedError);
                });

                it('verify 2fa method should fail when given code that is not numeric', async () => {
                    return testAccountHelper.verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode: 'dsfasdsgah3y',
                    })
                        .then(expectInvalid2faCodeProvidedError);
                });

                it('verify 2fa method should fail when no code is provided', async () => {
                    return testAccountHelper.verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    })
                        .then(expectInvalid2faCodeProvidedError);
                });
            });
        });

        describe('email', () => {
            let accountId;
            let securityCode;

            // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
            beforeEach(async () => {
                if (!accountId) {
                    ({
                        accountId,
                        securityCode
                    } = await testAccountHelper.create2faEnabledNEARAccount({ method: twoFactorMethods.email }));
                }
            });

            it('fails when the provided code does not match', async () => {
                return testAccountHelper.verify2faMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode: invertSecurityCode(securityCode)
                })
                    .then(expectFailedWithCode(401, '2fa code not valid for request id'));
            });

            it('succeeds when code matches', async () => {
                const { body } = await testAccountHelper
                    .verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode: securityCode
                    })
                    .then(expectJSONResponse);

                expect(body).property('message', '2fa code verified');
                expect(body).property('requestId', REQUEST_ID_FOR_INITIALIZING_2FA);
            });
        });

        describe('phone', () => {
            let accountId;
            let securityCode;

            // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
            beforeEach(async () => {
                if (!accountId) {
                    ({
                        accountId,
                        securityCode
                    } = await testAccountHelper.create2faEnabledNEARAccount({ method: twoFactorMethods.phone, bypassEndpointCreation: true }));
                }
            });

            it('fails when the provided code does not match', async () => {
                const response = await testAccountHelper
                    .verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode: invertSecurityCode(securityCode)
                    });

                expectFailedWithCode(401, '2fa code not valid for request id')(response);
            });

            it('succeeds when code matches', async () => {
                const { body } = await testAccountHelper
                    .verify2faMethod({
                        accountId,
                        requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                        securityCode
                    })
                    .then(expectJSONResponse);

                expect(body).property('message', '2fa code verified');
                expect(body).property('requestId', REQUEST_ID_FOR_INITIALIZING_2FA);
            });
        });
    });
});
