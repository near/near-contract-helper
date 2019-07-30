const Koa = require('koa');
const app = new Koa();

const body = require('koa-json-body');
const cors = require('@koa/cors');

app.use(require('koa-logger')());
app.use(body({ limit: '500kb', fallback: true }));
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
        // TODO: Figure out which errors should be exposed to user
        ctx.throw(400, e.toString());
    }
});

const Router = require('koa-router');
const router = new Router();

const creatorKeyJson = JSON.parse(process.env.ACCOUNT_CREATOR_KEY);
const recoveryKeyJson = JSON.parse(process.env.ACCOUNT_RECOVERY_KEY);
const keyStore = {
    // For account recovery purposes use default sender when updating any account
    async getKey() {
        return KeyPair.fromString(recoveryKeyJson.private_key);
    }
};
const { connect, KeyPair } = require('nearlib');
const nearPromise = (async () => {
    const near = await connect({
        deps: { keyStore },
        nodeUrl: process.env.NODE_URL || 'https://studio.nearprotocol.com/devnet'
    });
    return near;
})();
app.use(async (ctx, next) => {
    ctx.near = await nearPromise;
    await next();
});

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT || 10000000000;

router.post('/account', async ctx => {
    const { newAccountId, newAccountPublicKey } = ctx.request.body;
    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
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
const verifySignature = async (nearAccount, securityCode, signature) => {
    const hasher = crypto.createHash('sha256');
    hasher.update(securityCode);
    const hash = hasher.digest();
    const helperPublicKey = (await keyStore.getKey(recoveryKeyJson.account_id)).publicKey;
    if (nearAccount.public_keys.indexOf(helperPublicKey) < 0) {
        throw Error(`Account ${nearAccount.account_id} doesn't have helper key`);
    }
    return nearAccount.public_keys.some(publicKey => nacl.sign.detached.verify(hash, Buffer.from(signature, 'base64'), bs58.decode(publicKey)));
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
        const nearAccount = await (await ctx.near.account(accountId)).state()
        const isSignatureValid = await verifySignature(nearAccount, securityCode, signature);
        if (!isSignatureValid) {
            ctx.throw(401);
        }
        await account.update({ securityCode: null, confirmed: true });
    } else {
        await (await ctx.near.account(accountId)).addKey(publicKey);
        await account.update({ securityCode: null });
    }

    ctx.body = {};
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT || 3000);
} else {
    module.exports = app;
}
