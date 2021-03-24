const assert = require('assert');
const supertest = require('supertest');
const models = require('../models');
const MASTER_KEY_INFO = {
    account_id: 'test.near',
    secret_key: 'ed25519:2wyRcSwSuHtRVmkMCGjPwnzZmQLeXLzLLyED1NDMt4BjnKgQL6tF85yBx6Jr26D2dUNeC716RBoTxntVHsegogYw'
};
process.env = {
    ...process.env,
    ACCOUNT_CREATOR_KEY: JSON.stringify(MASTER_KEY_INFO),
    WALLET_URL: 'https://wallet.nearprotocol.com',
    NEW_ACCOUNT_AMOUNT: '500000001000000000000000000',
    NODE_URL: 'https://rpc.ci-testnet.near.org'
};
const app = require('../app');

const nearAPI = require('near-api-js');

const ctx = {};
const request = supertest(app.callback());

jest.setTimeout(15000);

beforeAll(async () => {
    await models.sequelize.sync({ force: true });
    ctx.near = await nearAPI.connect({
        deps: { keyStore },
        nodeUrl: process.env.NODE_URL
    });
});

afterAll(async () => {
    await models.sequelize.close();
});

beforeEach(() => {
    ctx.savedLog = console.log;
    ctx.logs = [];
    console.log = (...args) => ctx.logs.push(args);
});

afterEach(() => {
    console.log = ctx.savedLog;
});

const keyStore = new nearAPI.keyStores.InMemoryKeyStore();

const recoveryMethods = [
    { kind: 'email', detail: 'hello@example.com', publicKey: 'pkemail' },
    { kind: 'phone', detail: '+1 717 555 0101', publicKey: 'pkphone' },
    { kind: 'phrase', publicKey: 'pkphrase' },
];

const inMemorySigner = new nearAPI.InMemorySigner(keyStore);
async function signatureFor(accountId, valid = true) {
    let blockNumber = (await ctx.near.connection.provider.status()).sync_info.latest_block_height;
    if (!valid) blockNumber = blockNumber - 101;
    blockNumber = String(blockNumber);
    const message = Buffer.from(blockNumber);
    const signedHash = await inMemorySigner.signMessage(message, accountId);
    const blockNumberSignature = Buffer.from(signedHash.signature).toString('base64');
    return { blockNumber, blockNumberSignature };
}

const { parseSeedPhrase } = require('near-seed-phrase');
const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';
const keyPair = nearAPI.KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);
async function createNearAccount(accountId) {
    if (!accountId) {
        accountId = `helper-test-${Date.now()}`;
    }
    const response = await request.post('/account')
        .send({
            newAccountId: accountId,
            newAccountPublicKey: keyPair.publicKey.toString()
        });
    await keyStore.setKey(undefined, accountId, keyPair);
    assert.equal(response.status, 200);
    return accountId;
}

describe('/account/initializeRecoveryMethodForTempAccount', () => {

    let savedSecurityCode = '';
    let accountId = 'doesnotexistonchain' + Date.now();
    const method = recoveryMethods[0];

    test('send security code', async () => {
        const response = await request.post('/account/initializeRecoveryMethodForTempAccount')
            .send({
                accountId,
                method,
            });
        const [, { subject }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
        savedSecurityCode = /Your NEAR Wallet security code is:\s+(\d+)/.exec(subject)[1];
        assert.equal(response.status, 200);
    });

    test('validate security code (wrong code)', async () => {
        const response = await request.post('/account/validateSecurityCodeForTempAccount')
            .send({
                accountId,
                method,
                securityCode: '123123',
            });

        assert.equal(response.status, 401);
    });

    test('validate security code (no code)', async () => {
        const response = await request.post('/account/validateSecurityCodeForTempAccount')
            .send({
                accountId,
                method,
            });

        assert.equal(response.status, 401);
    });

    test('validate security code', async () => {
        const response = await request.post('/account/validateSecurityCodeForTempAccount')
            .send({
                accountId,
                method,
                securityCode: savedSecurityCode,
            });
        assert.equal(response.status, 200);
    });

});

describe('Two people send recovery methods for the same account before created', () => {
    // const method = recoveryMethods[0];
    let savedSecurityCode = '';
    let accountId = 'doesnotexistonchain' + Date.now();
    let alice = recoveryMethods[0];
    let bob = recoveryMethods[1];
    
    test('send security code alice', async () => {
        const response = await request.post('/account/initializeRecoveryMethodForTempAccount')
            .send({
                accountId,
                method: alice,
            });
        const [, { subject }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
        savedSecurityCode = /Your NEAR Wallet security code is:\s+(\d+)/.exec(subject)[1];
        assert.equal(response.status, 200);
    });

    test('send security code bob', async () => {
        const response = await request.post('/account/initializeRecoveryMethodForTempAccount')
            .send({
                accountId,
                method: bob,
            });
        assert.equal(response.status, 200);
    });

    test('validate security code alice (new account) and other methods should be removed leaving 1 recoveryMethod', async () => {
        const response = await request.post('/account/validateSecurityCodeForTempAccount')
            .send({
                accountId,
                method: alice,
                securityCode: savedSecurityCode,
            });
        assert.equal(response.status, 200);

        await createNearAccount(accountId);

        const response2 = await request.post('/account/recoveryMethods')
            .send({
                accountId,
                ...(await signatureFor(accountId))
            });
        assert.equal(response2.status, 200);
        const methods = await response2.body;
        assert.equal(methods.length, 1);
    });

});

describe('/account/initializeRecoveryMethod', () => {

    let savedSecurityCode = '';
    let accountId = '';
    let testing = true;
    const method = { kind: 'email', detail: 'test@dispostable.com' };

    test('send security code', async () => {
        accountId = await createNearAccount();

        const response = await request.post('/account/initializeRecoveryMethod')
            .send({
                accountId,
                method,
                testing,
                ...(await signatureFor(accountId))
            });

        const [, { subject }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
        savedSecurityCode = /Your NEAR Wallet security code is:\s+(\d+)/.exec(subject)[1];
        assert.equal(response.status, 200);
    });

    test('validate security code (wrong code)', async () => {
        const response = await request.post('/account/validateSecurityCode')
            .send({
                accountId,
                method,
                securityCode: '123123',
                ...(await signatureFor(accountId))
            });

        assert.equal(response.status, 401);
    });

    test('validate security code', async () => {
        const response = await request.post('/account/validateSecurityCode')
            .send({
                accountId,
                method,
                securityCode: savedSecurityCode,
                ...(await signatureFor(accountId))
            });

        assert.equal(response.status, 200);
    });

});

describe('/account/recoveryMethods', () => {
    test('returns 403 Forbidden (accountId not valid NEAR account)', async () => {
        const response = await request.post('/account/recoveryMethods')
            .send({ accountId: 'illegitimate' });
        expect(response.status).toBe(403);
    });

    test('returns 403 Forbidden (signature not from accountId owner)', async () => {
        const accountId = await createNearAccount();
        await models.Account.create({ accountId });

        const response = await request.post('/account/recoveryMethods')
            .send({ accountId, ...(await signatureFor(accountId, false)) });

        expect(response.status).toBe(403);
    });

    test('returns 403 Forbidden (signature from a key without FullAccess)', async () => {
        const accountId = await createNearAccount();
        const nearAccount = await ctx.near.account(accountId);
        const newKeyPair = nearAPI.KeyPair.fromRandom('ED25519');
        const publicKey = newKeyPair.publicKey.toString();
        await nearAccount.addKey(publicKey, 'fake-contract');
        await keyStore.setKey(undefined, accountId, newKeyPair);

        const response = await request.post('/account/recoveryMethods')
            .send({ accountId, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(403);
    });

    test('returns recovery methods (account found, verified ownership)', async () => {
        const accountId = await createNearAccount();
        const account = await models.Account.create({ accountId });
        await Promise.all(recoveryMethods.map(m =>
            account.createRecoveryMethod(m)
        ));

        const response = await request.post('/account/recoveryMethods')
            .send({ accountId, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(200);

        const email = response.body.find(m => m.kind === 'email');
        const phone = response.body.find(m => m.kind === 'phone');
        const phrase = response.body.find(m => m.kind === 'phrase');

        expect(email).toBeTruthy();
        expect(email.createdAt).toBeTruthy();
        expect(email.detail).toBeTruthy();
        expect(email.publicKey).toBeTruthy();

        expect(phone).toBeTruthy();
        expect(phone.createdAt).toBeTruthy();
        expect(phone.detail).toBeTruthy();
        expect(phone.publicKey).toBeTruthy();

        expect(phrase).toBeTruthy();
        expect(phone.createdAt).toBeTruthy();
        expect(phone.publicKey).toBeTruthy();
    });

    test('returns empty recovery methods if accountId in NEAR but not yet in DB', async () => {
        const accountId = await createNearAccount();

        const response = await request.post('/account/recoveryMethods')
            .send({ accountId, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(0);
    });
});

describe('/account/seedPhraseAdded', () => {
    test('returns 403 Forbidden (signature not from accountId owner)', async () => {
        const accountId = await createNearAccount();

        const response = await request.post('/account/seedPhraseAdded')
            .send({ accountId, signature: 'wut' });

        expect(response.status).toBe(403);
        const account = await models.Account.findOne({ where: { accountId } });
        expect(account).toBeFalsy();
    });

    test('requires a publicKey', async () => {
        const accountId = await createNearAccount();

        const response = await request.post('/account/seedPhraseAdded')
            .send({ accountId, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(400);
    });

    test('finds/creates account, adds phraseAddedAt; returns recovery methods', async () => {
        const accountId = await createNearAccount();
        const publicKey = nearAPI.KeyPair.fromRandom('ED25519').publicKey.toString();

        const response = await request.post('/account/seedPhraseAdded')
            .send({ accountId, publicKey, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0].kind).toBe('phrase');
        const account = await models.Account.findOne({ where: { accountId } });
        expect(account).toBeTruthy();
    });
});

// TODO: Refactor recovery methods endpoints to be more generic?
describe('/account/ledgerKeyAdded', () => {
    test('returns 403 Forbidden (signature not from accountId owner)', async () => {
        const accountId = await createNearAccount();

        const response = await request.post('/account/ledgerKeyAdded')
            .send({ accountId, signature: 'wut' });

        expect(response.status).toBe(403);
        const account = await models.Account.findOne({ where: { accountId } });
        expect(account).toBeFalsy();
    });

    test('requires a publicKey', async () => {
        const accountId = await createNearAccount();

        const response = await request.post('/account/ledgerKeyAdded')
            .send({ accountId, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(400);
    });

    test('finds/creates account, adds phraseAddedAt; returns recovery methods', async () => {
        const accountId = await createNearAccount();
        const publicKey = nearAPI.KeyPair.fromRandom('ED25519').publicKey.toString();

        const response = await request.post('/account/ledgerKeyAdded')
            .send({ accountId, publicKey, ...(await signatureFor(accountId)) });

        expect(response.status).toBe(200);
        expect(response.body.length).toBe(1);
        expect(response.body[0].kind).toBe('ledger');
        const account = await models.Account.findOne({ where: { accountId } });
        expect(account).toBeTruthy();
    });
});


describe('/account/deleteRecoveryMethod', () => {
    test('returns 400 (recoveryMethod invalid)', async () => {
        const accountId = `account-${Date.now()}`;
        await models.Account.create({ accountId });
        const response = await request.post('/account/deleteRecoveryMethod')
            .send({
                accountId,
                kind: 'illegitimate',
            });
        expect(response.status).toBe(400);
    });

    test('returns 404 (accountId not found)', async () => {
        const response = await request.post('/account/deleteRecoveryMethod')
            .send({
                accountId: 'illegitimate',
                kind: 'phone',
            });
        expect(response.status).toBe(404);
    });

    test('returns 403 Forbidden (signature not from accountId owner)', async () => {
        const accountId = await createNearAccount();
        await models.Account.create({ accountId });

        let response = await request.post('/account/deleteRecoveryMethod')
            .send({
                accountId,
                kind: 'phone',
                ...(await signatureFor(accountId, false))
            });

        expect(response.status).toBe(403);
    });

    test('returns 400 (public key not specified)', async () => {
        const accountId = await createNearAccount();
        const account = await models.Account.create({ accountId });
        await Promise.all(recoveryMethods.map(m =>
            account.createRecoveryMethod(m)
        ));
        const signature = await signatureFor(accountId);

        let response = await request.post('/account/deleteRecoveryMethod')
            .send({ accountId, kind: 'phone', ...signature });
        expect(response.status).toBe(400);
    });

    test('deletes specified recoveryMethod; returns recovery methods (account found, verified ownership, valid recoveryMethod)', async () => {
        const accountId = await createNearAccount();
        const account = await models.Account.create({ accountId });
        await Promise.all(recoveryMethods.map(m =>
            account.createRecoveryMethod(m)
        ));
        await account.createRecoveryMethod({ kind: 'email', detail: 'hello@example.com', publicKey: 'pkemail2' });
        const signature = await signatureFor(accountId);

        let response = await request.post('/account/deleteRecoveryMethod')
            .send({ accountId, kind: 'phone', publicKey: 'pkphone', ...signature });
        expect(response.status).toBe(200);
        await account.reload();
        expect(response.body.length).toBe(3);
        expect(response.body.map(m => m.kind).sort()).toEqual(['email', 'email', 'phrase']);

        response = await request.post('/account/deleteRecoveryMethod')
            .send({ accountId, kind: 'email', publicKey: 'pkemail', ...signature });
        expect(response.status).toBe(200);
        await account.reload();
        expect(response.body.length).toBe(2);
        expect(response.body.map(m => m.kind).sort()).toEqual(['email', 'phrase']);

        response = await request.post('/account/deleteRecoveryMethod')
            .send({ accountId, kind: 'phrase', publicKey: 'pkphrase', ...signature });
        expect(response.status).toBe(200);
        await account.reload();
        expect(response.body.length).toBe(1);
        expect(response.body.map(m => m.kind)).toEqual(['email']);
    });

    test('does not return 400 for old accounts with publicKey=NULL', async () => {
        const accountId = await createNearAccount();
        const account = await models.Account.create({ accountId });
        await account.createRecoveryMethod({ kind: 'phrase', publicKey: null });
        const signature = await signatureFor(accountId);

        let response = await request.post('/account/deleteRecoveryMethod')
            .send({ accountId, kind: 'phrase', publicKey: null, ...signature });
        expect(response.status).toBe(200);
    });
});
