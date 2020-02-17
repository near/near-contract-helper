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
    ACCOUNT_RECOVERY_KEY: JSON.stringify(MASTER_KEY_INFO),
    NODE_URL: 'http://shared-test.nearprotocol.com:3030'
};
const app = require('../app');

const { KeyPair } = require('nearlib');
beforeAll(async () => {
    await models.sequelize.sync({ force: true });
});

afterAll(async () => {
    await models.sequelize.close();
});

let request = supertest(app.callback());

const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';

describe('/account/sendRecoveryMessage', () => {
    let ctx = {};
    beforeEach(async () => {
        ctx.savedLog = console.log;
        ctx.logs = [];
        console.log = (...args) => ctx.logs.push(args);

        ctx.near = await app.nearPromise;
        ctx.keyPair = KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);
        ctx.accountId = `helper-test-${Date.now()}`;
        const response =  await request.post('/account')
            .send({
                newAccountId: ctx.accountId,
                newAccountPublicKey: ctx.keyPair.publicKey.toString()
            });
        assert.equal(response.status, 200);
    });

    afterEach(() => {
        console.log = ctx.savedLog;
    });

    test('send email', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: ctx.accountId,
                email: 'test@dispostable.com',
                seedPhrase: SEED_PHRASE
            });

        assert.equal(response.status, 200);

        const [, { subject, text, to }] = ctx.logs.find(log => log[0].match(/^sendMail.+/));
        expect(subject).toEqual(`Important: Near Wallet Recovery Email for ${ctx.accountId}`);
        expect(to).toEqual('test@dispostable.com');
        expect(text).toMatch(new RegExp(`https://wallet.nearprotocol.com/recover-seed-phrase/${ctx.accountId}/${SEED_PHRASE.replace(/ /g, '%20')}`));
    });

    test('send email (wrong seed phrase)', async () => {
        const response = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: ctx.accountId,
                email: 'test@dispostable.com',
                seedPhrase: 'seed-phrase'
            });

        assert.equal(response.status, 403);
    });
});
