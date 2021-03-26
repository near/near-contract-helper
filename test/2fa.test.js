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

const getCodeFromLogs = () => {
    const sendLog = ctx.logs.find((log) => log[0] == 'sendSms:' || log[0] == 'sendMail:');
    if (sendLog) {
        const { text } = sendLog[1];
        return /NEAR Wallet security code: (\d+)/.exec(text)[1];
    }
};

const keyStore = new nearAPI.keyStores.InMemoryKeyStore();

const twoFactorMethods = {
    email: { kind: '2fa-email', detail: 'hello@example.com', publicKey: 'pkemail2fa' },
    phone: { kind: '2fa-phone', detail: '+1 717 555 0101', publicKey: 'pkphone2fa' },
};

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
const SEED_PHRASE = 'table island position soft burden budget tooth cruel issue economy destroy above';
const keyPair = nearAPI.KeyPair.fromString(parseSeedPhrase(SEED_PHRASE).secretKey);

async function createNearAccount(requestedAccountId) {
    const accountId = requestedAccountId ? requestedAccountId : `helper-test-${Date.now()}`;

    const response = await request.post('/account')
        .send({
            newAccountId: accountId,
            newAccountPublicKey: keyPair.publicKey.toString()
        });

    await keyStore.setKey(undefined, accountId, keyPair);

    assert.equal(response.status, 200);

    return accountId;
}

async function create2FAEnabledNEARAccount(method) {
    // Create new account and initialize 2fa method
    const accountId = await createNearAccount();
    let securityCode = '';

    await request.post('/2fa/init')
        .send({
            accountId,
            method,
            ...(await signatureFor(accountId))
        })
        .expect('Content-Type', /json/)
        .expect((res) => {
            assert.ok(res.ok);
            securityCode = getCodeFromLogs();
        })
        .expect(200);

    return { accountId, securityCode };
}

const REQUEST_ID_FOR_INITIALIZING_2FA = -1;

describe('2fa method management', () => {
    jest.setTimeout(15000);

    beforeAll(async () => {
        await models.sequelize.sync({ force: true });
        ctx.near = await nearAPI.connect({
            deps: { keyStore },
            nodeUrl: process.env.NODE_URL
        });
        // ctx.accountId = 'testing' + Date.now();
        // ctx.signature = await signatureFor(ctx.accountId);
    });

    beforeEach(() => {
        ctx.savedLog = console.log;
        ctx.logs = [];
        console.log = (...args) => ctx.logs.push(args);
    });

    afterEach(() => {
        console.log = ctx.savedLog;
    });

    afterAll(async () => {
        await models.sequelize.close();
    });

    describe('setting up 2fa method', () => {
        let accountId;

        // Would prefer beforeAll, but `ctx.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if(!accountId) {
                accountId = await createNearAccount();
            }
        });

        test('generate a deterministic public key for an account', async () => {
            return request.post('/2fa/getAccessKey')
                .send({
                    accountId,
                    ...(await signatureFor(accountId))
                })
                .expect('Content-Type', /json/)
                .expect((res) => {
                    assert(res.body.publicKey.length > 80);
                })
                .expect(200);
        });


        test('initCode for a new account should return a securityCode for the requested 2fa method', async () => {
            return request.post('/2fa/init')
                .send({
                    accountId,
                    method: twoFactorMethods.email,
                    ...(await signatureFor(accountId))
                })
                .expect('Content-Type', /json/)
                .expect((res) => {
                    assert.ok(res.ok);
                })
                .expect(200, {
                    emailContent: {
                        html: '\n<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta content="width=device-width, user-scalable=yes, initial-scale=1.0" name="viewport">\n    <title>NEAR Wallet</title>\n    <style>\n      html {\n        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;\n        -webkit-text-size-adjust: 100%;\n        -ms-text-size-adjust: 100%;\n      }\n  \n      body {\n        width: 100% !important;\n        height: 100% !important;\n        margin: 0;\n        padding: 0;\n        -webkit-font-smoothing: antialiased;\n        -webkit-text-size-adjust: none;\n        background: #25272A url(\'https://storage.googleapis.com/near-contract-helper/email-background.png\') no-repeat;\n        background-size: contain;\n      }\n  \n      a {\n        color: #0B70CE;\n      }\n  \n      a:hover,\n      a:active {\n        opacity: .9;\n      }\n  \n      img {\n        border: 0;\n        height: auto;\n        line-height: 100%;\n        outline: none;\n        text-decoration: none;\n        -ms-interpolation-mode: bicubic;\n      }\n  \n      table {\n        border-collapse: collapse !important;\n      }\n  \n      #outlook a {\n        padding: 0; /* Force Outlook to provide a "view in browser" message */\n      }\n  \n      .ReadMsgBody {\n        width: 100%;\n      }\n  \n      .ExternalClass {\n        width: 100%; /* Force Hotmail to display emails at full width */\n      }\n  \n      .ExternalClass,\n      .ExternalClass p,\n      .ExternalClass span,\n      .ExternalClass font,\n      .ExternalClass td,\n      .ExternalClass div {\n        line-height: 100%; /* Force Hotmail to display normal line spacing */\n      }\n  \n      body, table, td, p, a, li, blockquote {\n        -webkit-text-size-adjust: 100%;\n        -ms-text-size-adjust: 100%;\n      }\n  \n      table, td {\n        mso-table-lspace: 0pt;\n        mso-table-rspace: 0pt;\n      }\n  \n      a img {\n        border: none;\n      }\n  \n      table td {\n        border-collapse: collapse;\n        padding: 0;\n      }\n  \n      /* Page style */\n      .normal-font-family {\n        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;\n      }\n  \n      h1,\n      h2,\n      h3,\n      h4 {\n        font-weight: 700;\n        margin: 30px 0 16px;\n      }\n  \n      h1 {\n        font-size: 24px;\n      }\n  \n      h2 {\n        font-size: 20px;\n      }\n  \n      h3, h4 {\n        font-size: 16px;\n      }\n  \n      ol {\n        margin: 1em 0;\n        padding-left: 40px;\n        list-style: decimal;\n      }\n  \n      .md-content a {\n        color: #0b70ce !important;\n      }\n  \n      .table-container {\n        width: 640px;\n      }\n  \n      .main-container-sidebar-column {\n        width: 80px;\n      }\n  \n      .table-container + div > div {\n        border: none !important;\n        padding-top: 0 !important;\n      }\n  \n      /* Responsive */\n      @media only screen and (max-width: 640px) {\n        .table-container {\n          width: 96%;\n        }\n  \n        .main-container-sidebar-column {\n          width: 20px;\n        }\n\n        .email-action {\n          width: 100%;\n        }\n      }\n    </style>\n  </head>\n  <body style="width: 100% !important;\n      height: 100% !important;\n      margin: 0;\n      padding: 0;\n      -webkit-font-smoothing: antialiased;\n      -webkit-text-size-adjust: none;\n      background: #25272A url(\'https://storage.googleapis.com/near-contract-helper/email-background.png\') no-repeat;\n      background-size: contain;"\n  >\n    <!-- The Email client preview part goes here -->\n    <div style="display:none; font-size:1px; color:#333; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">\n      NEAR Wallet transaction request code: 969936\n    </div>\n    <table class="table-container" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">\n      <tr>\n        <td height="40"></td>\n      </tr>\n      <tr>\n        <td align="center">\n          <a href="https://near.org/" target="_blank" title="NEAR Protocol">\n            <img src="https://storage.googleapis.com/near-contract-helper/near-wallet-logo.png" height="40" width="140">\n          </a>\n        </td>\n      </tr>\n      <tr>\n        <td height="20"></td>\n      </tr>\n    </table>\n    <table class="table-container" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">\n      <tr>\n        <td height="20"></td>\n      </tr>\n      <tr>\n        <td>\n          <table style="background-color:#fff; border-radius:8px;">\n            <tr>\n              <td class="main-container-sidebar-column"></td>\n              <td>\n                <table>\n                  <tr>\n                    <td height="60"></td>\n                  </tr>\n                  <tr>\n                    <td align="center">\n                      <img src="https://storage.googleapis.com/near-contract-helper/near-phone-icon.png" alt="Phone Icon" width="72">\n                    </td>\n                  </tr>\n                  <tr>\n                    <td height="20"></td>\n                  </tr>\n                  <tr>\n                    <td align="center" style="font-size:28px; color:#25272A; font-weight:700;"\n                        class="normal-font-family">\n                      <!-- The title goes here -->\n                      <span>NEAR Wallet Transaction Request</span>\n                    </td>\n                  </tr>\n                  <tr>\n                    <td height="20"></td>\n                  </tr>\n                  <tr>\n                    <!-- The content goes here -->\n                    <td style="font-size:16px; color:#3b3b3b; line-height:24px;" class="normal-font-family md-content">\n                        <p>Important: By entering this code, you are authorizing the following transaction:</p>\n<p>Verify hello@example.com as the 2FA method for account </p>\n<p><span style="background:#F6F6F6; border-radius:5px; color:#0B70CE; display:block; font-size:18px; font-weight:700; margin:30px 0; padding:10px 20px; text-align:center; ">969936</span></p>\n                    </td>\n                  </tr>\n                  \n                  <tr>\n                    <td height="60"></td>\n                  </tr>\n                </table>\n              </td>\n              <td class="main-container-sidebar-column"></td>\n            </tr>\n          </table>\n        </td>\n      </tr>\n      <tr>\n        <td height="40"></td>\n      </tr>\n      <tr>\n        <td align="center">\n          <a href="https://near.org/" target="_blank" title="NEAR Protocol">\n            <img src="https://storage.googleapis.com/near-contract-helper/near-logo.png" height="40" width="133">\n          </a>\n        </td>\n      </tr>\n      <tr>\n        <td height="40"></td>\n      </tr>\n      <tr>\n        <td align="center" style="font-size: 14px;color:#A7A9AA;">\n          &copy; 2020 NEAR Inc. All Rights Reserved.\n        </td>\n      </tr>\n      <tr>\n        <td height="10"></td>\n      </tr>\n      <tr>\n        <td align="center">\n          <a href="https://www.iubenda.com/terms-and-conditions/44958041" title="Terms of Service" target="_blank" style="font-size: 14px;color: #A7A9AA;text-decoration: none;">Terms of Service</a>\n          <span style="color: #A7A9AA;margin: 0 4px;">|</span>\n          <a href="https://www.iubenda.com/privacy-policy/44958041" title="Privacy Policy" target="_blank" style="font-size: 14px;color: #A7A9AA;text-decoration: none;">Privacy Policy</a>\n        </td>\n      </tr>\n      <tr>\n        <td height="40"></td>\n      </tr>\n    </table>\n  </body>\n</html>\n',
                        subject: 'Confirm 2FA for ',
                        text: '\nNEAR Wallet security code: 969936\n\n\nImportant: By entering this code, you are authorizing the following transaction:\n\n\nVerify hello@example.com as the 2FA method for account \n',
                        to: 'hello@example.com'
                    },
                    message: '2fa initialized and code sent to verify method',
                    smsContent: {}
                });
        });
    });

    describe('changing an already configured 2fa method', () => {
        const initialMethod = twoFactorMethods.email;
        const secondMethod = twoFactorMethods.phone;

        let accountId;
        let securityCode;


        // Would prefer beforeAll, but `ctx.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if(!accountId) {
                const accountDetails = await create2FAEnabledNEARAccount(initialMethod);
                accountId = accountDetails.accountId;
                securityCode = accountDetails.securityCode;
            }
        });

        test('should have a securityCode from initial configuration', () => {
            assert.notStrictEqual(securityCode, '');
        });

        test('should be able to call init again with different method', async () => {
            return request.post('/2fa/init')
                .send({
                    accountId,
                    method: secondMethod,
                    ...(await signatureFor(accountId))
                })
                .expect('Content-Type', /json/)
                .expect(() => {
                    const newSecurityCode = getCodeFromLogs();
                    assert.notStrictEqual(securityCode, newSecurityCode);

                    securityCode = newSecurityCode;
                })
                .expect(200, {
                    message: '2fa initialized and code sent to verify method',
                    smsContent: {
                        text: '\nNEAR Wallet security code: 568532\n\n\nImportant: By entering this code, you are authorizing the following transaction:\n\n\nVerify +1 717 555 0101 as the 2FA method for account \n',
                        to: '+1 717 555 0101'
                    }
                });
        });

        test('verify 2fa method should work with the code from the second method requested', async () => {
            await request.post('/2fa/verify')
                .send({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode,
                    ...(await signatureFor(accountId))
                })
                .expect(200, {message: '2fa code verified', requestId: REQUEST_ID_FOR_INITIALIZING_2FA});
        });

    });

    describe('contract already deployed', () => {
        const testContractDeployed = true;
        let accountId;

        // Would prefer beforeAll, but `ctx.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            if(!accountId) {
                const accountDetails = await create2FAEnabledNEARAccount(twoFactorMethods.email);
                accountId = accountDetails.accountId;
            }
        });

        test('initCode for an account with contract deployed', async () => {
            return request.post('/2fa/init')
                .send({
                    testContractDeployed,
                    accountId,
                    method: twoFactorMethods.email,
                    ...(await signatureFor(accountId))
                })
                .expect(401, 'account with multisig contract already has 2fa method');
        });
    });

    describe('code older than 5min should fail', () => {
        let accountId;
        let securityCode;
        let mockDate;

        // Would prefer beforeAll, but `ctx.logs` is cleared in the global beforeEach() that would run after beforeAll here
        beforeEach(async () => {
            const accountDetails = await create2FAEnabledNEARAccount(twoFactorMethods.email);

            accountId = accountDetails.accountId;
            securityCode = accountDetails.securityCode;

            // Only mock the date impl after we've created the account so that the account we create uses unique timestamp
            mockDate = jest.spyOn(Date, 'now').mockImplementation(() => Date.parse('2030-01-01'));
        });

        afterEach(() => {
            mockDate.mockRestore();
        });

        test('verify 2fa method', async () => {
            const result = await request.post('/2fa/verify')
                .send({
                    accountId,
                    requestId: REQUEST_ID_FOR_INITIALIZING_2FA,
                    securityCode,
                    ...(await signatureFor(accountId))
                })
                .expect(401, '2fa code expired');
        });
    });
});