const dotenv = require('dotenv');
dotenv.config('../.env');
const assert = require('assert');
const supertest = require('supertest');
const { parseSeedPhrase } = require('near-seed-phrase');
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

const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';
const keyPair = nearAPI.KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);
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
const inMemorySigner = new nearAPI.InMemorySigner(keyStore);

async function createNearAccount() {
    const accountId = `helper-test-${Date.now()}`;
    const response = await request.post('/account')
        .send({
            newAccountId: accountId,
            newAccountPublicKey: keyPair.publicKey.toString()
        });
    await keyStore.setKey(undefined, accountId, keyPair);
    assert.equal(response.status, 200);
    return accountId;
}

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

        savedSecurityCode = response.text;
        assert.equal(response.status, 200);
        assert.equal(savedSecurityCode, response.text);
    });

    test('validate security code (wrong code)', async () => {
        const response = await request.post('/account/validateSecurityCode')
            .send({
                accountId,
                method,
                securityCode: '123123',
                ...(await signatureFor(accountId))
            });

        assert.equal(response.status, 400);
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

    test('send email (wrong seed phrase)', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId,
                method,
                seedPhrase: 'seed-phrase'
            });

        assert.equal(response.status, 403);
    });

    test('send email (wrong accountId)', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: 'wrong-id',
                method,
                seedPhrase: SEED_PHRASE
            });

        assert.equal(response.status, 400);
    });

    test('send email (wrong email)', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId,
                method: {kind: 'email', detail: 'asdada@g.com'},
                seedPhrase: SEED_PHRASE
            });

        assert.equal(response.status, 400);
    });

    test('send email', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId,
                method,
                seedPhrase: SEED_PHRASE
            });

        assert.equal(response.status, 200);

        const [, { subject, text, to }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
        expect(subject).toEqual(`Important: Near Wallet Recovery Email for ${accountId}`);
        expect(to).toEqual('test@dispostable.com');
        expect(text).toMatch(new RegExp(`https://wallet.nearprotocol.com/recover-with-link/${accountId}/${SEED_PHRASE.replace(/ /g, '%20')}`));
    });

});

const recoveryMethods = [
    { kind: 'email', detail: 'hello@example.com', publicKey: 'pkemail' },
    { kind: 'phone', detail: '+1 717 555 0101', publicKey: 'pkphone' },
    { kind: 'phrase', publicKey: 'pkphrase' },
];

async function signatureFor(accountId, valid = true) {
    let blockNumber = (await ctx.near.connection.provider.status()).sync_info.latest_block_height;
    if (!valid) blockNumber = blockNumber - 101;
    blockNumber = String(blockNumber);
    const message = Buffer.from(blockNumber);
    const signedHash = await inMemorySigner.signMessage(message, accountId);
    const blockNumberSignature = Buffer.from(signedHash.signature).toString('base64');
    return { blockNumber, blockNumberSignature };
}

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
            .send({ accountId, securityCode: 'lol', signature: 'wut' });

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
