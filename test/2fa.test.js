const dotenv = require('dotenv');
dotenv.config('../.env');
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
    NODE_URL: 'https://rpc.ci-testnet.near.org',
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
// const [, { subject }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
const getCodeFromLogs = () => ctx.logs.find((log) => log[0].length === 6)[0];

const keyStore = new nearAPI.keyStores.InMemoryKeyStore();

const twoFactorMethods = [
    { kind: '2fa-email', detail: 'hello@example.com', publicKey: 'pkemail' },
    { kind: '2fa-phone', detail: '+1 717 555 0101', publicKey: 'pkphone' },
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

describe('setting up 2fa method', () => {
    let accountId = 'testing' + Date.now();
    let method = twoFactorMethods[0];
    let securityCode = '';
    let requestId = -1;

    test('generate a deterministic public key for an account', async () => {
        await createNearAccount(accountId);

        await request.post('/2fa/getAccessKey')
            .send({
                accountId,
                ...(await signatureFor(accountId))
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.equal(res.body.success, true);
                assert(res.body.publicKey.length > 80);
            })
            .expect(200);
    });

    test('initCode for an account, sets up 2fa method', async () => {

        await request.post('/2fa/init')
            .send({
                accountId,
                method,
                ...(await signatureFor(accountId))
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.equal(res.body.success, true);
                securityCode = getCodeFromLogs();
            })
            .expect(200);
    });

    test('should be able to call init again with different method', async () => {

        method = twoFactorMethods[1];

        await request.post('/2fa/init')
            .send({
                accountId,
                method,
                ...(await signatureFor(accountId))
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.equal(res.body.success, true);
                securityCode = getCodeFromLogs();
            })
            .expect(200);
    });

    test('verify 2fa method', async () => {

        await request.post('/2fa/verify')
            .send({
                accountId,
                requestId,
                securityCode,
                ...(await signatureFor(accountId))
            })
            .expect((res) => {
                assert.equal(res.body.success, true);
            })
            .expect(200);
    });

});

describe('after deploying contract', () => {
    let accountId = 'testing' + Date.now();
    let method = twoFactorMethods[0];
    let securityCode = '';
    let requestId = -1;
    let testContractDeployed = true;

    test('initCode for an account, sets up 2fa method', async () => {
        await createNearAccount(accountId);

        await request.post('/2fa/init')
            .send({
                accountId,
                method,
                ...(await signatureFor(accountId))
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.equal(res.body.success, true);
                securityCode = getCodeFromLogs();
            })
            .expect(200);
    });

    test('initCode for an account with contract deployed', async () => {

        await request.post('/2fa/init')
            .send({
                testContractDeployed,
                accountId,
                method,
                ...(await signatureFor(accountId))
            })
            .expect(401);
    });

    test('verify 2fa method', async () => {

        await request.post('/2fa/verify')
            .send({
                accountId,
                requestId,
                securityCode,
                ...(await signatureFor(accountId))
            })
            .expect('Content-Type', /json/)
            .expect((res) => {
                assert.equal(res.body.success, true);
            })
            .expect(200);
    });

});

/********************************
TBD if we need to test with env vars need to figure out how to reset modules
********************************/
// describe('code older than 5min should fail', () => {
//     let accountId = 'testing' + Date.now();
//     let method = twoFactorMethods[0];
//     let securityCode = '';
//     let requestId = -1;

//     test('initCode for an account, sets up 2fa method', async () => {
//         await createNearAccount(accountId);

//         await request.post('/2fa/init')
//             .send({
//                 accountId,
//                 method,
//                 ...(await signatureFor(accountId))
//             })
//             .expect('Content-Type', /json/)
//             .expect((res) => {
//                 assert.equal(res.body.success, true);
//                 securityCode = getCodeFromLogs();
//             })
//             .expect(200);
//     });

//     test('verify 2fa method', async () => {

//         await request.post('/2fa/verify')
//             .send({
//                 accountId,
//                 requestId,
//                 securityCode,
//                 ...(await signatureFor(accountId))
//             })
//             .expect(401);
//     });

// });