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
        if (e.response) {
            ctx.throw(e.response.status, e.response.text);
        }

        switch (e.status) {
        case 400:
        case 401:
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

const Router = require('koa-router');
const router = new Router();

const {
    creatorKeyJson,
    withNear,
    checkAccountOwnership,
    checkAccountDoesNotExist,
} = require('./middleware/near');

app.use(withNear);

/********************************
2fa routes
********************************/
const {
    getAccessKey,
    initCode,
    sendNewCode,
    verifyCode,
} = require('./middleware/2fa');
router.post('/2fa/getAccessKey', checkAccountOwnership, getAccessKey);
router.post('/2fa/init', checkAccountOwnership, initCode);
router.post('/2fa/send', checkAccountOwnership, sendNewCode);
router.post('/2fa/verify', checkAccountOwnership, verifyCode);

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

router.post('/account', async ctx => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(404);
    }

    const { newAccountId, newAccountPublicKey } = ctx.request.body;
    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
});

const password = require('secure-random-password');
const models = require('./models');
const SECURITY_CODE_DIGITS = 6;

const { sendSms } = require('./utils/sms');



async function recoveryMethodsFor(account) {
    if (!account) return [];

    return await account.getRecoveryMethods({
        attributes: ['createdAt', 'detail', 'kind', 'publicKey', 'securityCode']
    }).map(method => {
        const json = method.toJSON();
        json.confirmed = !method.securityCode;
        delete json.securityCode;
        return json;
    });
}

router.post('/account/recoveryMethods', checkAccountOwnership, async ctx => {
    const { accountId } = ctx.request.body;
    const account = await models.Account.findOne({ where: { accountId } });
    ctx.body = await recoveryMethodsFor(account);
});

async function withAccount(ctx, next) {
    const { accountId } = ctx.request.body;
    ctx.account = await models.Account.findOne({ where: { accountId } });
    if (ctx.account) {
        await next();
        return;
    }
    ctx.throw(404, `Could not find account with accountId: '${accountId}'`);
}

const recoveryMethods = ['email', 'phone', 'phrase'];

async function checkRecoveryMethod(ctx, next) {
    const { kind } = ctx.request.body;
    if (recoveryMethods.includes(kind)) {
        await next();
        return;
    }
    ctx.throw(400, `Given recoveryMethod '${kind}' invalid; must be one of: ${recoveryMethods.join(', ')}`);
}

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

const { sendMail } = require('./utils/email');

const WALLET_URL = process.env.WALLET_URL;
const sendRecoveryMessage = async ({ accountId, method, seedPhrase }) => {
    const recoverUrl = `${WALLET_URL}/recover-with-link/${encodeURIComponent(accountId)}/${encodeURIComponent(seedPhrase)}`;
    if (method.kind === 'phone') {
        await sendSms({
            text: `Your NEAR Wallet (${accountId}) recovery link is: ${recoverUrl}\nSave this message in a secure place to allow you to recover account.`,
            to: method.detail
        });
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail,
            subject: `Important: Near Wallet Recovery Email for ${accountId}`,
            text:
`Hi ${accountId},

This email contains your NEAR Wallet account recovery link.

Keep this email safe, and DO NOT SHARE IT! We cannot resend this email.

Click below to recover your account.

${recoverUrl}
`,
            html:
`<p>Hi ${accountId},</p>

<p>This email contains your NEAR Wallet account recovery link.</p>

<p>Keep this email safe, and DO NOT SHARE IT! We cannot resend this email.</p>

<p>Click below to recover your account.</p>

<a href="${recoverUrl}">Recover Account</a>
`

        });
    } else {
        throw new Error(`Account ${accountId} has no contact information`);
    }
};

const { parseSeedPhrase } = require('near-seed-phrase');

async function withPublicKey(ctx, next) {
    ctx.publicKey = ctx.request.body.publicKey;
    if (ctx.publicKey !== undefined) {
        await next();
        return;
    }
    ctx.throw(400, 'Must provide valid publicKey');
}

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

const sendSecurityCode = async (securityCode, method) => {

    if (method.kind === 'phone') {
        await sendSms({
            text: `Your NEAR Wallet security code is: ${securityCode}`,
            to: method.detail
        });
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail,
            subject: `Your NEAR Wallet security code is: ${securityCode}`,
            text: `Use this code to confirm your email address: ${securityCode}`
        });
    }
};

const completeRecoveryInit = async ctx => {
    const { accountId, method} = ctx.request.body;
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

    ctx.body = await recoveryMethodsFor(account);
};

router.post('/account/initializeRecoveryMethodForTempAccount',
    checkAccountDoesNotExist,
    completeRecoveryInit
);

router.post('/account/initializeRecoveryMethod',
    checkAccountOwnership,
    completeRecoveryInit
);

const completeRecoveryValidation = async ctx => {
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
    ctx.body = await recoveryMethodsFor(account);
};

router.post('/account/validateSecurityCode',
    checkAccountOwnership,
    completeRecoveryValidation
);

router.post('/account/validateSecurityCodeForTempAccount',
    checkAccountDoesNotExist,
    completeRecoveryValidation
);

router.post('/account/sendRecoveryMessage', async ctx => {
    const { accountId, method, seedPhrase, isNew } = ctx.request.body;
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
    if (isNew) {
        // clear all methods that may have been added by other users attempting to set up the same accountId
        const allRecoveryMethods = await account.getRecoveryMethods();
        for (const rm of allRecoveryMethods) {
            if (rm.publicKey !== publicKey) {
                await rm.destroy();
            }
        }
    }
    await sendRecoveryMessage({
        accountId,
        method,
        seedPhrase
    });
    ctx.body = await recoveryMethodsFor(account);
});

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT);
} else {
    module.exports = app;
}
