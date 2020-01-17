const supertest = require('supertest');
process.env = { ...process.env, ACCOUNT_CREATOR_KEY: '{}', ACCOUNT_RECOVERY_KEY: '{}' }
const app = require('../app');
const models = require('../models');

beforeAll(async () => {
    await models.sequelize.sync({ force: true });
});

afterAll(async () => {
    await models.sequelize.close();
});

let request = supertest(app.callback());

describe('/account/sendRecoveryMessage', () => {
    let savedLog;
    let logs;
    beforeEach(() => {
        savedLog = console.log;
        logs = [];
        console.log = (...args) => logs.push(args);
    });
    afterEach(() => {
        console.log = savedLog;
    });

    test('send email', async () => {
        const createResponse = await request.post('/account/sendRecoveryMessage')
            .send({
                accountId: 'test',
                email: 'test@dispostable.com',
                seedPhrase: 'seed-phrase',
                //phoneNumber: null,
                publicKey: 'public-key'
            });
        expect(createResponse.status).toBe(200);
        const [, { subject, text, to }] = logs.find(log => log[0].match(/^sendMail.+/))
        expect(subject).toEqual('Important: Near Wallet Recovery Email for test');
        expect(to).toEqual('test@dispostable.com');
        expect(text).toMatch(new RegExp('https://wallet.nearprotocol.com/recover-seed-phrase/test/seed-phrase'));
    });
});