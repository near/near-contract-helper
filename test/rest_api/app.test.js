require('dotenv').config({ path: 'test/.env.test' });
const nearAPI = require('near-api-js');
const { parseSeedPhrase } = require('near-seed-phrase');

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

const recoveryMethods = {
    email: { kind: 'email', detail: 'hello@example.com', publicKey: 'pkemail' },
    phone: { kind: 'phone', detail: '+1 717 555 0101', publicKey: 'pkphone' },
    phrase: { kind: 'phrase', publicKey: 'pkphrase' },
};

const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';

const config = {
    ECHO_SECURITY_CODES: process.env.VERBOSE || false,
    ECHO_MESSAGE_CONTENT: process.env.VERBOSE || false
};

function createAllRecoveryMethods(account) {
    return Promise.all(
        Object.values(recoveryMethods).map((m) => account.createRecoveryMethod(m))
    );
}

function extractValueFromHash(hash, key) {
    const value = hash[key];
    delete hash[key];

    return value;
}

describe('app routes', function () {
    this.timeout(15000);

    const securityCodesByAccountId = {};
    // const messageContentByAccountId = {};

    let app, request, testAccountHelper;

    before(async () => {
        await models.sequelize.sync({ force: true });

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
                console.info('Got Email content', emailContent);
            }
        });

        testAccountHelper = new TestAccountHelper({
            keyPair,
            keyStore,
            request
        });

    });

    describe('/account/initializeRecoveryMethodForTempAccount', () => {
        let savedSecurityCode = '';
        const accountId = 'doesnotexistonchain' + Date.now();
        const method = recoveryMethods.email;

        it('send security code', async () => {
            await testAccountHelper.initRecoveryMethodForTempAccount({ accountId, method })
                .then(expectJSONResponse);

            savedSecurityCode = extractValueFromHash(securityCodesByAccountId, accountId);

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
        // const method = recoveryMethods.email;
        let savedSecurityCode = '';
        const accountId = 'doesnotexistonchain' + Date.now();
        const alice = recoveryMethods.email;
        const bob = recoveryMethods.phone;

        it('send security code alice', async () => {
            await request.post('/account/initializeRecoveryMethodForTempAccount')
                .send({
                    accountId,
                    method: alice,
                })
                .then(expectJSONResponse);

            savedSecurityCode = extractValueFromHash(securityCodesByAccountId, accountId);
        });

        it('send security code bob', async () => {
            return request.post('/account/initializeRecoveryMethodForTempAccount')
                .send({
                    accountId,
                    method: bob,
                })
                .then(expectJSONResponse);
        });

        it('validate security code alice (new account) and other methods should be removed leaving 1 recoveryMethod', async () => {
            await request.post('/account/validateSecurityCodeForTempAccount')
                .send({
                    accountId,
                    method: alice,
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
        let savedSecurityCode = '';
        let accountId = '';
        const testing = true;
        const method = { kind: 'email', detail: 'test@dispostable.com' };

        it('send security code', async () => {
            accountId = await testAccountHelper.createNEARAccount();

            await testAccountHelper.initRecoveryMethod({ accountId, method, testing })
                .then(expectJSONResponse);

            savedSecurityCode = extractValueFromHash(securityCodesByAccountId, accountId);
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
            expect(result).property('kind', 'email');
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
            await models.Account.create({ accountId });

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
            const account = await models.Account.create({ accountId });
            await createAllRecoveryMethods(account);

            const { body: methods } = await testAccountHelper.getRecoveryMethods({ accountId })
                .then(expectJSONResponse);

            const email = methods.find(m => m.kind === 'email');
            const phone = methods.find(m => m.kind === 'phone');
            const phrase = methods.find(m => m.kind === 'phrase');

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

            const account = await models.Account.findOne({ where: { accountId } });
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

            expect(phrase).property('kind', 'phrase');
            const account = await models.Account.findOne({ where: { accountId } });
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

            return expect(models.Account.findOne({ where: { accountId } })).eventually.not.ok;
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

            expect(result).property('kind', 'ledger');

            return expect(models.Account.findOne({ where: { accountId } })).eventually.ok;
        });
    });


    describe('/account/deleteRecoveryMethod', () => {
        it('returns 400 (recoveryMethod invalid)', async () => {
            const accountId = `account-${Date.now()}`;
            await models.Account.create({ accountId });
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
                    kind: 'phone',
                })
                .then(expectFailedWithCode(404, 'Could not find account with accountId: \'illegitimate\''));
        });

        it('returns 403 Forbidden (signature not from accountId owner)', async () => {
            // FIXME: This is just testing incorrect blockNumber, *not* that the signature is from a different owner
            const accountId = await testAccountHelper.createNEARAccount();
            await models.Account.create({ accountId });

            return request.post('/account/deleteRecoveryMethod')
                .send({
                    accountId,
                    kind: 'phone',
                    ...(await testAccountHelper.signatureForLatestBlock({ accountId, valid: false }))
                })
                .then((res) => {
                    expect(res).property('statusCode', 403);
                });
            // .then(expectFailedWithCode(403, 'You must provide a blockNumber within 100 of the most recent block; provided: 681677, current: 681778'));
        });

        it('returns 400 (public key not specified)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const account = await models.Account.create({ accountId });

            await createAllRecoveryMethods(account);

            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            return request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: 'phone', ...signature })
                .then(expectFailedWithCode(400, 'Must provide valid publicKey'));
        });

        it('deletes specified recoveryMethod; returns recovery methods (account found, verified ownership, valid recoveryMethod)', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const account = await models.Account.create({ accountId });
            await createAllRecoveryMethods(account);

            await account.createRecoveryMethod({ kind: 'email', detail: 'hello@example.com', publicKey: 'pkemail2' });
            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            const { body: initialMethods } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: 'phone', publicKey: 'pkphone', ...signature })
                .then(expectJSONResponse);
            expect(initialMethods).length(3);
            expect(initialMethods.map(m => m.kind).sort()).deep.equal(['email', 'email', 'phrase']);

            await account.reload();

            const { body: methodsAfterDeletingOne } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: 'email', publicKey: 'pkemail', ...signature })
                .then(expectJSONResponse);

            expect(methodsAfterDeletingOne).length(2);
            expect(methodsAfterDeletingOne.map(m => m.kind).sort()).deep.equal(['email', 'phrase']);

            await account.reload();

            const { body: methodsAfterDeletingTwo } = await request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: 'phrase', publicKey: 'pkphrase', ...signature })
                .then(expectJSONResponse);

            await account.reload();
            expect(methodsAfterDeletingTwo).length(1);
            expect(methodsAfterDeletingTwo.map(m => m.kind).sort()).deep.equal(['email']);
        });

        it('does not return 400 for old accounts with publicKey=NULL', async () => {
            const accountId = await testAccountHelper.createNEARAccount();
            const account = await models.Account.create({ accountId });
            await account.createRecoveryMethod({ kind: 'phrase', publicKey: null });

            const signature = await testAccountHelper.signatureForLatestBlock({ accountId });

            return request.post('/account/deleteRecoveryMethod')
                .send({ accountId, kind: 'phrase', publicKey: null, ...signature })
                .then(expectJSONResponse);
        });
    });
});
