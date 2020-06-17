/********************************
Koa
********************************/
const Koa = require('koa');
const body = require('koa-json-body');
const cors = require('@koa/cors');
const Router = require('koa-router');
const app = new Koa();
const router = new Router();
app.use(require('koa-logger')());
app.use(body({ limit: '500kb', fallback: true }));
app.use(cors({ credentials: true }));
// Middleware to passthrough HTTP errors from node
app.use(async function(ctx, next) {
    try {
        await next();
    } catch(e) {
        if (e.response) {
            ctx.throw(e.response.status, e.response.text);
        }
        switch (e.status) {
        case 400:
        case 403:
        case 404:
            ctx.throw(e);
            break;
        default:
            // TODO: Figure out which errors should be exposed to user
            console.error('Error: ', e, JSON.stringify(e));
            ctx.throw(400, e.toString());
        }
    }
});
/********************************
NearAPI
********************************/
const nearAPI = require('near-api-js');
const { parseSeedPhrase } = require('near-seed-phrase');
const {
    creatorKeyJson,
    keyStore,
    nearPromise
} = require('./utils/near')

app.use(async (ctx, next) => {
    ctx.near = await nearPromise;
    await next();
});

/********************************
Models and Middleware
********************************/
const SECURITY_CODE_DIGITS = 6;
const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;
const password = require('secure-random-password');
const models = require('./models');
const {
    sendRecoveryMessage,
    sendSecurityCode,
    recoveryMethodsFor,
    checkRecoveryMethod
} = require('./middleware/recovery.js');
const {
    withAccount,
    withPublicKey,
    checkAccountOwnership
} = require('./middleware/account.js');
const {
    sendConfirmationCode,
    getWalletAccessKey,
    verifyConfirmationCode
} = require('./middleware/2fa.js');
/********************************
2FA Routes
********************************/
router.post('/2fa/verifyConfirmationCode', verifyConfirmationCode);
router.post('/2fa/sendConfirmationCode', sendConfirmationCode);
router.post('/2fa/getWalletAccessKey', getWalletAccessKey);

/********************************
Other routes
********************************/
router.post('/account', async ctx => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(404);
    }
    const { newAccountId, newAccountPublicKey } = ctx.request.body;
    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
});

router.post('/account/recoveryMethods', checkAccountOwnership, async ctx => {
    const { accountId } = ctx.request.body;
    const account = await models.Account.findOne({ where: { accountId } });
    ctx.body = await recoveryMethodsFor(account);
});

router.post(
    '/account/deleteRecoveryMethod',
    withAccount,
    checkRecoveryMethod,
    checkAccountOwnership,
    withPublicKey,
    async ctx => {
        const { kind, publicKey } = ctx.request.body;
        const [recoveryMethod] = await ctx.account.getRecoveryMethods({ where: {
            kind: kind,
            publicKey: publicKey,
        }});
        await recoveryMethod.destroy();
        ctx.body = await recoveryMethodsFor(ctx.account);
    }
);

router.post(
    '/account/resendRecoveryLink',
    checkAccountOwnership,
    async ctx => {
        const { accountId, seedPhrase, publicKey, method } = ctx.request.body;
        const account = await models.Account.findOne({ where: { accountId } });

        const [recoveryMethod] = await account.getRecoveryMethods({ where: {
            kind: method.kind,
            detail: method.detail,
            publicKey: method.publicKey
        }});

        await recoveryMethod.update({ publicKey });

        await sendRecoveryMessage({
            accountId,
            method,
            seedPhrase
        });

        ctx.body = await recoveryMethodsFor(account);
    }
);

router.post(
    '/account/seedPhraseAdded',
    checkAccountOwnership,
    withPublicKey,
    async ctx => {
        const { accountId } = ctx.request.body;
        const [ account ] = await models.Account.findOrCreate({ where: { accountId } });
        await account.createRecoveryMethod({ kind: 'phrase', publicKey: ctx.publicKey });
        ctx.body = await recoveryMethodsFor(account);
    }
);

router.post('/account/initializeRecoveryMethod',
    checkAccountOwnership,
    async ctx => {
        const { accountId, method, testing } = ctx.request.body;
        const [account] = await models.Account.findOrCreate({ where: { accountId } });

        let [recoveryMethod] = await account.getRecoveryMethods({ where: {
            kind: method.kind,
            detail: method.detail
        }});

        if (!recoveryMethod) {
            recoveryMethod = await account.createRecoveryMethod({
                kind: method.kind,
                detail: method.detail
            });
        }

        const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
        await recoveryMethod.update({ securityCode });
        await sendSecurityCode(securityCode, method);

        if (testing) {
            return ctx.body = securityCode;
        }

        ctx.body = await recoveryMethodsFor(account);
    }
);

router.post('/account/validateSecurityCode',
    checkAccountOwnership,
    async ctx => {
        const { accountId, method, securityCode } = ctx.request.body;

        const account = await models.Account.findOne({ where: { accountId } });

        const [recoveryMethod] = await account.getRecoveryMethods({ where: {
            kind: method.kind,
            detail: method.detail,
            securityCode: securityCode
        }});

        if (!recoveryMethod) {
            ctx.throw(401);
        }
        console.log(securityCode);
        ctx.body = await recoveryMethodsFor(account);
    }
);

router.post('/account/sendRecoveryMessage', async ctx => {
    const { accountId, method, seedPhrase } = ctx.request.body;

    // Verify that seed phrase is added to the account
    const { publicKey } = parseSeedPhrase(seedPhrase);
    const nearAccount = await ctx.near.account(accountId);
    const keys = await nearAccount.getAccessKeys();
    if (!keys.some(key => key.public_key === publicKey)) {
        ctx.throw(403, 'seed phrase doesn\'t match any access keys');
    }

    const account = await models.Account.findOne({ where: { accountId } });
    const [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: method.kind,
        detail: method.detail
    }});

    await recoveryMethod.update({ publicKey, securityCode: null });

    await sendRecoveryMessage({
        accountId,
        method,
        seedPhrase
    });

    ctx.body = await recoveryMethodsFor(account);
});

/********************************
Start App
********************************/
app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    console.log(process.env.PORT)
    app.listen(process.env.PORT);
} else {
    module.exports = app;
}