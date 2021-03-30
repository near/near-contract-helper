require('dotenv').config({ path: 'test/.env.test' });

const nearAPI = require('near-api-js');
const { parseSeedPhrase } = require('near-seed-phrase');
const sinon = require('sinon');

const models = require('../../models');
const chai = require('../chai');
const createTestServerInstance = require('./createTestServerInstance');
const expectRequestHelpers = require('./expectRequestHelpers');
const TestAccountHelper = require('../TestAccountHelper');

const { expect } = chai;
const {
    expectJSONResponse,
    expectFailedWithCode
} = expectRequestHelpers;

const REQUEST_ID_FOR_INITIALIZING_2FA = -1;

const twoFactorMethods = {
    email: { kind: '2fa-email', detail: 'hello@example.com', publicKey: 'pkemail2fa' },
    phone: { kind: '2fa-phone', detail: '+1 717 555 0101', publicKey: 'pkphone2fa' },
};

const SEED_PHRASE = 'table island position soft burden budget tooth cruel issue economy destroy above';

const config = {
    ECHO_SECURITY_CODES: process.env.VERBOSE || false,
    ECHO_MESSAGE_CONTENT: process.env.VERBOSE || false
};

function extractValueFromHash(hash, key) {
    const value = hash[key];
    delete hash[key];

    return value;
}

describe('2fa method management', function () {
    this.timeout(15000);

    const securityCodesByAccountId = {};
    // const messageContentByAccountId = {};

    let app, request, testAccountHelper;

    before(async () => {
        const keyStore = new nearAPI.keyStores.InMemoryKeyStore();
        const keyPair = nearAPI.KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);

        ({ request, app } = createTestServerInstance());

        app.on('SECURITY_CODE', ({ accountId, securityCode, requestId }) => {
            if (config.ECHO_SECURITY_CODES) {
                console.info('Got security code', { accountId, securityCode, requestId });
            }
            securityCodesByAccountId[accountId] = securityCode;
        });

        app.on('SENT_SMS', (smsContent) => {
            if (config.ECHO_MESSAGE_CONTENT) {
                console.info('Got SMS content', smsContent);
            }
        });

        app.on('SENT_EMAIL', (emailContent) => {
            if (config.ECHO_MESSAGE_CONTENT) {
                console.warn('Got Email content', emailContent);
            }
        });

        testAccountHelper = new TestAccountHelper({
            keyPair,
            keyStore,
            request
        });

        await models.sequelize.sync({ force: true });
    });

    describe('setting up 2fa method', () => {
        let accountId;

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                accountId = await testAccountHelper.createNEARAccount();
            }
        });

        // TODO: Should we be cleaning up accounts just in case this is running against e.g. testnet?
        // afterAll(async () => {
        //     console.log('cleaning up account', accountId);
        //     const account = await testAccountHelper.near.account(accountId);
        //     try {
        //         const result = await account.deleteAccount('example.testnet');
        //         console.log('deleted account!', result);
        //     } catch (e) {
        //         console.warn('failed to delete test account!', e);
        //     }
        // });

        it('should generate a deterministic public key for an account', async () => {
            const { body } = await testAccountHelper.getAccessKey({ accountId })
                .then(expectJSONResponse);

            expect(body)
                .property('publicKey')
                .a('string').satisfy((key) => key.startsWith('ed25519:'))
                .length.within(50, 60);
        });

        it('should return a 200 with appropriate message for the requested 2fa method when we post to initCode', async () => {
            const { body } = await testAccountHelper.init2FAMethod({
                accountId,
                method: twoFactorMethods.email
            })
                .then(expectJSONResponse);

            expect(body).property('message', '2fa initialized and code sent to verify method');
        });
    });

    describe('changing an already requested 2fa method', () => {
        const initialMethod = twoFactorMethods.email;
        const secondMethod = twoFactorMethods.phone;

        let accountId;
        let initialSecurityCode;

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                accountId = await testAccountHelper.create2FAEnabledNEARAccount({ method: initialMethod });
            }

            initialSecurityCode = extractValueFromHash(securityCodesByAccountId, accountId);

            expect(initialSecurityCode).length(6);
            const securityCodeAsNumber = parseInt(initialSecurityCode, 10);
            expect(securityCodeAsNumber).not.NaN;
        });

        it('should allow verification using the code generated by the second request', async () => {
            await testAccountHelper.init2FAMethod({ accountId, method: secondMethod })
                .then(expectJSONResponse);

            const newSecurityCode = extractValueFromHash(securityCodesByAccountId, accountId);
            expect(newSecurityCode)
                .a('string')
                .length(6)
                .not.equal(initialSecurityCode);

            const { body } = await testAccountHelper.verify2FAMethod({
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
                accountId = await testAccountHelper.create2FAEnabledNEARAccount({ method: twoFactorMethods.email });
            }
        });

        it('initCode for an account with contract deployed', async () => {
            return testAccountHelper.init2FAMethod({
                testContractDeployed,
                accountId,
                method: twoFactorMethods.email,
            })
                .then(expectFailedWithCode(401, 'account with multisig contract already has 2fa method'));
        });
    });

    describe('/verify', function () {
        let accountId;
        let securityCode;

        // Would prefer beforeAll, but `testContext.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if (!accountId) {
                accountId = await testAccountHelper.create2FAEnabledNEARAccount({ method: twoFactorMethods.email });
                securityCode = extractValueFromHash(securityCodesByAccountId, accountId);
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
                return testAccountHelper.verify2FAMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode
                })
                    .then(expectFailedWithCode(401, '2fa code expired'));
            });
        });

        describe('malformed security codes should be rejected', () => {
            const expectInvalid2FACodeProvidedError = expectFailedWithCode(401, 'invalid 2fa code provided');

            it('verify 2fa method should fail when given code that is too long', async () => {
                return testAccountHelper.verify2FAMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode: '1234567',

                })
                    .then(expectInvalid2FACodeProvidedError);
            });

            it('verify 2fa method should fail when given code that is too short', async () => {
                return testAccountHelper.verify2FAMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode: '123',

                })
                    .then(expectInvalid2FACodeProvidedError);
            });

            it('verify 2fa method should fail when given code that is not numeric', async () => {
                return testAccountHelper.verify2FAMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode: 'dsfasdsgah3y',
                })
                    .then(expectInvalid2FACodeProvidedError);
            });

            it('verify 2fa method should fail when no code is provided', async () => {
                return testAccountHelper.verify2FAMethod({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                })
                    .then(expectInvalid2FACodeProvidedError);
            });
        });
    });
});