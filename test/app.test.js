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
    WALLET_URL: 'https://wallet.nearprotocol.com',
    NODE_URL: 'http://shared-test.nearprotocol.com:3030'
};
const app = require('../app');

const { KeyPair } = require('nearlib');

const SEED_PHRASE = 'shoot island position soft burden budget tooth cruel issue economy destroy above';
const keyPair = KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);
const ctx = {};
const request = supertest(app.callback());

beforeAll(async () => {
    await models.sequelize.sync({ force: true });
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

async function createNearAccount() {
    const accountId = `helper-test-${Date.now()}`;
    const response = await request.post('/account')
        .send({
            newAccountId: accountId,
            newAccountPublicKey: keyPair.publicKey.toString()
        });
    assert.equal(response.status, 200);
    return accountId;
}

describe('/account/sendRecoveryMessage', () => {
    beforeEach(async () => {
        ctx.accountId = await createNearAccount();
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
        expect(text).toMatch(new RegExp(`https://wallet.nearprotocol.com/recover-with-link/${ctx.accountId}/${SEED_PHRASE.replace(/ /g, '%20')}`));
    });

    test('setting multiple recovery methods', async () => {
        const email = 'test@dispostable.com';
        await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: ctx.accountId,
                email,
                seedPhrase: SEED_PHRASE
            });
        let account = await models.Account.findOne({
            where: { accountId: ctx.accountId }
        });
        await account.reload();
        expect(account.email).toBe(email);
        expect(account.emailAddedAt).toBeTruthy();


        const phoneNumber = '+1.800.867.5309';
        await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: ctx.accountId,
                phoneNumber,
                seedPhrase: SEED_PHRASE
            });
        account = await models.Account.findOne({
            where: { accountId: ctx.accountId }
        });
        await account.reload();
        expect(account.phoneNumber).toBe(phoneNumber);
        expect(account.phoneAddedAt).toBeTruthy();
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

describe('/account/:accountId/recoveryMethods', () => {
    test('returns 404 (accountId not found)', async () => {
        const response = await request.post('/account/illegitimate/recoveryMethods');
        expect(response.status).toBe(404);
    });

    test('returns recovery methods (account found, verified ownership)', async () => {
        const accountId = `account-${Date.now()}`;

        const attributes = {
            email: 'hello@example.com',
            emailAddedAt: new Date(),
            phoneAddedAt: new Date(),
            phoneNumber: '+180086753098',
            phraseAddedAt: new Date(),
        };

        await models.Account.create({ accountId, ...attributes });

        const response = await request.post(`/account/${accountId}/recoveryMethods`)
            .send({ signedStuff: 'lol' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual(JSON.parse(JSON.stringify(attributes)));
    });
});
