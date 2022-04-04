require('dotenv').config({ path: 'test/.env.test' });

const nearAPI = require('near-api-js');
const { parseSeedPhrase } = require('near-seed-phrase');

const constants = require('../constants');
const AccountService = require('../services/account');
const RecoveryMethodService = require('../services/recovery_method');
const attachEchoMessageListeners = require('./attachEchoMessageListeners');
const chai = require('./chai');
const initLocalDynamo = require('./local_dynamo');
const expectRequestHelpers = require('./expectRequestHelpers');
const createTestServerInstance = require('./createTestServerInstance');
const TestAccountHelper = require('./TestAccountHelper');

const { expect } = chai;
const {
    expectJSONResponse,
    expectFailedWithCode
} = expectRequestHelpers;

const accountService = new AccountService();
const recoveryMethodService = new RecoveryMethodService();

const { RECOVERY_METHOD_KINDS } = constants;

const recoveryMethods = {
    [RECOVERY_METHOD_KINDS.EMAIL]: {
        kind: RECOVERY_METHOD_KINDS.EMAIL,
        detail: 'hello@example.com',
        publicKey: 'pkemail'
    },
    [RECOVERY_METHOD_KINDS.PHONE]: {
        kind: RECOVERY_METHOD_KINDS.PHONE,
        detail: '+1 717 555 0101',
        publicKey: 'pkphone'
    },
    [RECOVERY_METHOD_KINDS.PHRASE]: {
        kind: RECOVERY_METHOD_KINDS.PHRASE,
        publicKey: 'pkphrase'
    },
};

const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';

const VERBOSE_OUTPUT = process.env.VERBOSE_OUTPUT || false;

const VERBOSE_OUTPUT_CONFIG = {
    ECHO_SECURITY_CODES: VERBOSE_OUTPUT || false,
    ECHO_MESSAGE_CONTENT: VERBOSE_OUTPUT || false
};

function createAllRecoveryMethods({ accountId }) {
    return Promise.all(
        Object.values(recoveryMethods).map((recoveryMethod) => recoveryMethodService.createRecoveryMethod({
            accountId,
            ...recoveryMethod,
        })),
    );
}

describe('app routes', function () {
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

    after(async function() {
        await terminateLocalDynamo();
    });

    describe('/account/initializeRecoveryMethodForTempAccount', () => {
        let savedSecurityCode = '', result;
        const accountId = 'doesnotexistonchain_1' + Date.now();
        const method = recoveryMethods[RECOVERY_METHOD_KINDS.EMAIL];

        it('send security code', async () => {
            ({ result, securityCode: savedSecurityCode } = await testAccountHelper.initRecoveryMethodForTempAccount({
                accountId,
                method,
                seedPhrase: SEED_PHRASE,
            }));

            expectJSONResponse(result);

            expect(savedSecurityCode)
                .a('string')
                .length(6);
        });

        it('validate security code (wrong code)', async () => {
            return request.post('/account/validateSecurityCodeForTempAccount')
                .send({
                    accountId,
                    method,
                    securityCode: '123123',
                })
                .then(expectFailedWithCode(401, 'recoveryMethod does not exist'));
        });

        it('validate security code (no code)', async () => {
            return request.post('/account/validateSecurityCodeForTempAccount')
                .send({
                    accountId,
                    method,
                })
                .then(expectFailedWithCode(401, 'valid securityCode required'));
        });

        it('validate security code', async () => {
            return request.post('/account/validateSecurityCodeForTempAccount')
                .send({
                    accountId,
                    method,
                    securityCode: savedSecurityCode,
                })
                .then(expectJSONResponse);
        });
    });

    describe('Two people send recovery methods for the same account before created', () => {
        let savedSecurityCode = '', result;
        const accountId = 'doesnotexistonchain_2' + Date.now();
        const alice = recoveryMethods[RECOVERY_METHOD_KINDS.EMAIL];
        const bob = recoveryMethods[RECOVERY_METHOD_KINDS.PHONE];
        const aliceSeedPhrase = 'any athlete that pudding ramp car pyramid share example day slab protect';
        const bobSeedPhrase = 'coach early mad link yard express that crack wheel valid armor laundry';

        it('send security code alice', async () => {
            ({ result, securityCode: savedSecurityCode } = await testAccountHelper.initRecoveryMethodForTempAccount({
                accountId,
                method: alice,
                seedPhrase: aliceSeedPhrase,
            }));

            expectJSONResponse(result);
        });

        it('send security code bob', async () => {
            const { result } = await testAccountHelper.initRecoveryMethodForTempAccount(({
                accountId,
                method: bob,
                seedPhrase: bobSeedPhrase,
            }));

            expectJSONResponse(result);
        });

        it('validate security code alice (new account) and other methods should be removed leaving 1 recoveryMethod', async () => {
            const { publicKey } = parseSeedPhrase(aliceSeedPhrase);
            await request.post('/account/validateSecurityCodeForTempAccount')
                .send({
                    accountId,
                    method: alice,
                    publicKey,
                    securityCode: savedSecurityCode,
                })
                .then(expectJSONResponse);

            await testAccountHelper.createNEARAccount(accountId);

            const { body: methods } = await testAccountHelper.getRecoveryMethods({ accountId })
                .then(expectJSONResponse);

            expect(methods).length(1);
        });

    });

    describe('/account/initializeRecoveryMethod', () => {
        let savedSecurityCode = '', result;
        let accountId = '';
        const testing = true;
        const method = { kind: RECOVERY_METHOD_KINDS.EMAIL, detail: 'test@dispostable.com' };

        it('send security code', async () => {
            accountId = await testAccountHelper.createNEARAccount();

            ({ result, securityCode: savedSecurityCode } = await testAccountHelper.initRecoveryMethod({
                accountId,
                method,
                seedPhrase: SEED_PHRASE,
                testing,
            }));

            expectJSONResponse(result);
        });

        it('validate security code (wrong code)', async () => {
            await testAccountHelper.validateSecurityCode({
                accountId,
                method,
                securityCode: '123123',
            })
                .then(expectFailedWithCode(401, 'recoveryMethod does not exist'));
        });

        it('validate security code', async () => {
            const { body: [result] } = await testAccountHelper.validateSecurityCode({
                accountId,
                method,
                securityCode: savedSecurityCode,
            })
                .then(expectJSONResponse);

            expect(result).property('detail', 'test@dispostable.com');
            expect(result).property('kind', RECOVERY_METHOD_KINDS.EMAIL);
        });

    });

    describe('/account/recoveryMethods', () => {
        it('returns 403 Forbidden (accountId not valid NEAR account)', async () => {
            // FIXME: This isn't testing what it thinks it is, it should have a blockNumber, blockNumberSignature
            return request.post('/account/recoveryMethods')
                .send({ accountId: 'illegitimate' })
                .then(expectFailedWithCode(403, 'You must provide an accountId, blockNumber, and blockNumberSignature'));
        });

        it('returns 403 Forbidden (signature not from accountId owner)', async () => {
            // FIXME: This is just testing incorrect blockNumber, *not* that the signature is from a different owner
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);

            await testAccountHelper.getRecoveryMethods({ accountId, valid: false })
                .then((res) => {
                    expect(res).property('statusCode', 403);
                });
            // .then(expectFailedWithCode(403, 'You must provide a blockNumber within 100 of the most recent block; provided: 681677, current: 681778'));
        });

        it('returns 403 Forbidden (signature from a key without FullAccess)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const nearAccount = await testAccountHelper.near.account(accountId);

            const newKeyPair = nearAPI.KeyPair.fromRandom('ED25519');
            const publicKey = newKeyPair.publicKey.toString();
            await nearAccount.addKey(publicKey, 'fake-contract');
            await testAccountHelper.keyStore.setKey(undefined, accountId, newKeyPair);

            return testAccountHelper.getRecoveryMethods({ accountId })
                .then((res) => {
                    expect(res).property('statusCode', 403);
                    expect(res)
                        .property('text')
                        .match(/^(?:blockNumberSignature did not match a signature of blockNumber=)\d+(?: from accountId=)/);
                });
        });

        it('returns recovery methods (account found, verified ownership)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);
            await createAllRecoveryMethods({ accountId });

            const { body: methods } = await testAccountHelper.getRecoveryMethods({ accountId })
                .then(expectJSONResponse);

            const email = methods.find(m => m.kind === RECOVERY_METHOD_KINDS.EMAIL);
            const phone = methods.find(m => m.kind === RECOVERY_METHOD_KINDS.PHONE);
            const phrase = methods.find(m => m.kind === RECOVERY_METHOD_KINDS.PHRASE);

            expect(email).property('detail', 'hello@example.com');
            expect(email).property('publicKey', 'pkemail');

            expect(phone).property('detail', '+1 717 555 0101');
            expect(phone).property('publicKey', 'pkphone');

            expect(phrase).property('publicKey', 'pkphrase');
        });

        it('returns empty recovery methods if accountId in NEAR but not yet in DB', async () => {
            const accountId = await testAccountHelper.createNEARAccount();

            const { body: methods } = await testAccountHelper.getRecoveryMethods({ accountId })
                .then(expectJSONResponse);
            expect(methods).length(0);
        });
    });

    describe('/account/seedPhraseAdded', () => {
        //FIXME: Not doing what it thinks it is; needs blockNumber and blockNumberSignature args
        it('returns 403 Forbidden (signature not from accountId owner)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();

            await request.post('/account/seedPhraseAdded')
                .send({ accountId, signature: 'wut' })
                .then(expectFailedWithCode(403, 'You must provide an accountId, blockNumber, and blockNumberSignature'));

            const account = await accountService.getAccount(accountId);
            expect(account).not.ok;
        });

        it('requires a publicKey', async () => {
            const accountId = await testAccountHelper.createNEARAccount();

            return request.post('/account/seedPhraseAdded')
                .send({
                    accountId,
                    ...(await testAccountHelper.signatureForLatestBlock({ accountId }))
                })
                .then(expectFailedWithCode(400, 'Must provide valid publicKey'));
        });

        it('finds/creates account, adds phraseAddedAt; returns recovery methods', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const publicKey = nearAPI.KeyPair.fromRandom('ED25519').publicKey.toString();

            const { body: [phrase] } = await request.post('/account/seedPhraseAdded')
                .send({
                    accountId,
                    publicKey,
                    ...(await testAccountHelper.signatureForLatestBlock({ accountId }))
                })
                .then(expectJSONResponse);

            expect(phrase).property('kind', RECOVERY_METHOD_KINDS.PHRASE);
            const account = await accountService.getAccount(accountId);
            expect(account).ok;
        });
    });

    // TODO: Refactor recovery methods endpoints to be more generic?
    describe('/account/ledgerKeyAdded', () => {
        // FIXME: This isn't testing what it thinks it is; needs blockNumber and blockNumberSignature args
        it('returns 403 Forbidden (signature not from accountId owner)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();

            await request.post('/account/ledgerKeyAdded')
                .send({ accountId, signature: 'wut' })
                .then(expectFailedWithCode(403, 'You must provide an accountId, blockNumber, and blockNumberSignature'));

            return expect(accountService.getAccount(accountId)).eventually.not.ok;
        });

        it('requires a publicKey', async () => {
            const accountId = await testAccountHelper.createNEARAccount();

            return request.post('/account/ledgerKeyAdded')
                .send({ accountId, ...(await testAccountHelper.signatureForLatestBlock({ accountId })) })
                .then(expectFailedWithCode(400, 'Must provide valid publicKey'));
        });

        it('finds/creates account, adds phraseAddedAt; returns recovery methods', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const publicKey = nearAPI.KeyPair.fromRandom('ED25519').publicKey.toString();

            const { body: [result] } = await request.post('/account/ledgerKeyAdded')
                .send({
                    accountId,
                    publicKey,
                    ...(await testAccountHelper.signatureForLatestBlock({ accountId }))
                })
                .then(expectJSONResponse);

            expect(result).property('kind', RECOVERY_METHOD_KINDS.LEDGER);

            return expect(accountService.getAccount(accountId)).eventually.ok;
        });
    });


    describe('/account/deleteRecoveryMethod', () => {
        it('returns 400 (recoveryMethod invalid)', async () => {
            const accountId = `account-${Date.now()}`;
            await accountService.createAccount(accountId);
            return request.post('/account/deleteRecoveryMethod')
                .send({
                    accountId,
                    kind: 'illegitimate',
                })
                .then(expectFailedWithCode(400, 'Given recoveryMethod \'illegitimate\' invalid; must be one of: email, phone, phrase, ledger'));
        });

        it('returns 404 (accountId not found)', async () => {
            return request.post('/account/deleteRecoveryMethod')
                .send({
                    accountId: 'illegitimate',
                    kind: RECOVERY_METHOD_KINDS.PHONE,
                })
                .then(expectFailedWithCode(404, 'Could not find account with accountId: \'illegitimate\''));
        });

        it('returns 403 Forbidden (signature not from accountId owner)', async () => {
            // FIXME: This is just testing incorrect blockNumber, *not* that the signature is from a different owner
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);

            return request.post('/account/deleteRecoveryMethod')
                .send({
                    accountId,
                    kind: RECOVERY_METHOD_KINDS.PHONE,
                    ...(await testAccountHelper.signatureForLatestBlock({ accountId, valid: false }))
                })
                .then((res) => {
                    expect(res).property('statusCode', 403);
                });
            // .then(expectFailedWithCode(403, 'You must provide a blockNumber within 100 of the most recent block; provided: 681677, current: 681778'));
        });

        it('returns 400 (public key not specified)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);
            await createAllRecoveryMethods({ accountId });

            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            return request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: RECOVERY_METHOD_KINDS.PHONE, ...signature })
                .then(expectFailedWithCode(400, 'Must provide valid publicKey'));
        });

        it('deletes specified recoveryMethod; returns recovery methods (account found, verified ownership, valid recoveryMethod)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);
            await createAllRecoveryMethods({ accountId });

            await recoveryMethodService.createRecoveryMethod({
                accountId,
                kind: RECOVERY_METHOD_KINDS.EMAIL,
                detail: 'hello@example.com',
                publicKey: 'pkemail2'
            });

            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            const { body: initialMethods } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: RECOVERY_METHOD_KINDS.PHONE, publicKey: 'pkphone', ...signature })
                .then(expectJSONResponse);
            expect(initialMethods).length(3);
            expect(initialMethods.map(m => m.kind).sort()).deep.equal([RECOVERY_METHOD_KINDS.EMAIL, RECOVERY_METHOD_KINDS.EMAIL, RECOVERY_METHOD_KINDS.PHRASE]);

            const { body: methodsAfterDeletingOne } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: RECOVERY_METHOD_KINDS.EMAIL, publicKey: 'pkemail', ...signature })
                .then(expectJSONResponse);

            expect(methodsAfterDeletingOne).length(2);
            expect(methodsAfterDeletingOne.map(m => m.kind).sort()).deep.equal([RECOVERY_METHOD_KINDS.EMAIL, RECOVERY_METHOD_KINDS.PHRASE]);

            const { body: methodsAfterDeletingTwo } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: RECOVERY_METHOD_KINDS.PHRASE, publicKey: 'pkphrase', ...signature })
                .then(expectJSONResponse);

            expect(methodsAfterDeletingTwo).length(1);
            expect(methodsAfterDeletingTwo.map(m => m.kind).sort()).deep.equal([RECOVERY_METHOD_KINDS.EMAIL]);
        });

        it('does not return 400 for old accounts with publicKey=NULL', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            await accountService.createAccount(accountId);
            await recoveryMethodService.createRecoveryMethod({
                accountId,
                kind: RECOVERY_METHOD_KINDS.PHRASE,
                publicKey: null,
            });

            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            return request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: RECOVERY_METHOD_KINDS.PHRASE, publicKey: null, ...signature })
                .then(expectJSONResponse);
        });
    });
});
