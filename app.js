const Koa = require('koa');
const app = new Koa();

const body = require('koa-json-body');
const cors = require('@koa/cors');

app.use(require('koa-logger')());
// TODO: Check what limit means and set appropriate limit
app.use(body({ limit: '500kb', fallback: true }));
// TODO: Don't use CORS in production on studio.nearprotocol.com
app.use(cors({ credentials: true }));

// Middleware to passthrough HTTP errors from node
app.use(async function(ctx, next) {
    try {
        await next();
    } catch(e) {
        console.log('Error: ', e);
        if (e.response) {
            ctx.throw(e.response.status, e.response.text);
        }
        throw e;
    }
});

const Router = require('koa-router');
const router = new Router();

const { KeyPair, InMemoryKeyStore, SimpleKeyStoreSigner, LocalNodeConnection, NearClient, Near, Account } = require('nearlib');
const defaultSender = process.env.NEAR_CONTRACT_HELPER_DEFAULT_SENDER || 'alice.near';
let publicKey, secretKey;
if (process.env.NEAR_CONTRACT_HELPER_PUBLIC_KEY && process.env.NEAR_CONTRACT_HELPER_SECRET_KEY) {
    publicKey = process.env.NEAR_CONTRACT_HELPER_PUBLIC_KEY;
    secretKey = process.env.NEAR_CONTRACT_HELPER_SECRET_KEY;
} else {
    const rawKey = JSON.parse(require('fs').readFileSync(`./keystore/${defaultSender}.json`));
    publicKey = rawKey.public_key;
    secretKey = rawKey.secret_key;
}
const defaultKey = new KeyPair(publicKey, secretKey);
const keyStore = new InMemoryKeyStore();
keyStore.setKey(defaultSender, defaultKey);
const localNodeConnection = new LocalNodeConnection(process.env.INTERNAL_NODE_HOST || 'http://localhost:3030');
const nearClient = new NearClient(new SimpleKeyStoreSigner(keyStore), localNodeConnection);
const near = new Near(nearClient);

const accountApi = new Account(nearClient);
const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT || 10000000000;

router.post('/account', async ctx => {
    const body = ctx.request.body;
    const newAccountId = body.newAccountId;
    const newAccountPublicKey = body.newAccountPublicKey;
    await near.waitForTransactionResult(
        await accountApi.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT, defaultSender));
    const response = {
        account_id: newAccountId
    };
    ctx.body = response;
});

const password = require('secure-random-password');
const models = require('./models');
const FROM_PHONE = process.env.TWILIO_FROM_PHONE || '+14086179592';
const SECURITY_CODE_DIGITS = 6;

const sendMessage = async ({ accountId, phoneNumber, securityCode }) => {
    if (process.env.NODE_ENV == 'production') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = require('twilio')(accountSid, authToken);
        await client.messages
            .create({
                body: `Your NEAR Wallet security code is: ${securityCode}`,
                from: FROM_PHONE,
                to: phoneNumber
            });
    } else {
        console.log(`Security code: ${securityCode} for: ${accountId}`);
    }
};

router.post('/account/:phoneNumber/:accountId/requestCode', async ctx => {
    const accountId = ctx.params.accountId;
    const phoneNumber = ctx.params.phoneNumber;

    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    const [account] = await models.Account.findOrCreate({ where: { accountId, phoneNumber } });
    await account.update({ securityCode });
    // TODO: Add code expiration for improved security
    await sendMessage(account);

    ctx.body = {};
});

const nacl = require('tweetnacl');
const crypto = require('crypto');
const bs58 = require('bs58');
const verifySignature = (nearAccount, securityCode, signature) => {
    const hasher = crypto.createHash('sha256');
    hasher.update(securityCode);
    const hash = hasher.digest();
    const publicKeys = nearAccount.public_keys.map(key => Buffer.from(key));
    const helperPublicKey = bs58.decode(defaultKey.publicKey);
    if (!publicKeys.some(publicKey => publicKey.equals(helperPublicKey))) {
        throw Error(`Account ${nearAccount.account_id} doesn't have helper key`);
    }
    return publicKeys.some(publicKey => nacl.sign.detached.verify(hash, Buffer.from(signature), publicKey));
}

// TODO: Different endpoints for setup and recovery
router.post('/account/:phoneNumber/:accountId/validateCode', async ctx => {
    const { phoneNumber, accountId } = ctx.params;
    const { securityCode, signature, publicKey } = ctx.request.body;

    const account = await models.Account.findOne({ where: { accountId, phoneNumber } });
    if (!account || !account.securityCode || account.securityCode != securityCode) {
        ctx.throw(401);
    }
    if (!account.confirmed) {
        const nearAccount = await accountApi.viewAccount(accountId)
        if (!verifySignature(nearAccount, securityCode, signature)) {
            ctx.throw(401);
        }
        await account.update({ securityCode: null, confirmed: true });
    } else {
        const keyStore = new InMemoryKeyStore();
        keyStore.setKey(accountId, defaultKey);
        const nearClient = new NearClient(new SimpleKeyStoreSigner(keyStore), localNodeConnection);
        const accountApi = new Account(nearClient);
        await accountApi.addAccessKey(accountId, publicKey);

        await account.update({ securityCode: null });
    }

    ctx.body = {};
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.INTERNAL_CONTRACT_HELPER_PORT || process.env.PORT || 3000);
} else {
    module.exports = app;
}
