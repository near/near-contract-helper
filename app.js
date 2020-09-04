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


const { findAccountsByPublicKey, findAccountsByPublicKeyIndexer } = require('./middleware/indexer');
// TODO: Remove kludge when indexer returns up to date data
router.get('/publicKey/:publicKey/accounts', findAccountsByPublicKey);
router.get('/publicKey/:publicKey/accountsIndexer', findAccountsByPublicKeyIndexer);

const password = require('secure-random-password');
const models = require('./models');
const SECURITY_CODE_DIGITS = 6;

const { sendSms } = require('./utils/sms');

async function recoveryMethodsFor(account) {
    if (!account) return [];

    return (await account.getRecoveryMethods({
        attributes: ['createdAt', 'detail', 'kind', 'publicKey', 'securityCode']
    })).map(method => {
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

// TODO: Do we need extra validation in addition to DB constraint?
const recoveryMethods = ['email', 'phone', 'phrase', 'ledger'];

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

const { sendMail, getNewAccountEmail, getSecurityCodeEmail } = require('./utils/email');

const WALLET_URL = process.env.WALLET_URL;
const getRecoveryUrl = (accountId, seedPhrase) => `${WALLET_URL}/recover-with-link/${encodeURIComponent(accountId)}/${encodeURIComponent(seedPhrase)}`;

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

router.post(
    '/account/ledgerKeyAdded',
    checkAccountOwnership,
    withPublicKey,
    async ctx => {
        const { accountId } = ctx.request.body;
        const [ account ] = await models.Account.findOrCreate({ where: { accountId } });
        await account.createRecoveryMethod({ kind: 'ledger', publicKey: ctx.publicKey });
        ctx.body = await recoveryMethodsFor(account);
    }
);

const sendSecurityCode = async (securityCode, method, accountId, seedPhrase) => {
    let text, html;
    if (seedPhrase) {
        const recoverUrl = getRecoveryUrl(accountId, seedPhrase);
        text = `\nWelcome to NEAR Wallet!\nThis message contains your account activation code and recovery link for ${accountId}. Keep this email safe, and DO NOT SHARE IT. We cannot resend this email.\n\n1. Confirm your activation code to finish creating your account:\n${securityCode}\n\n2. In the event that you need to recover your account, click the link below, and follow the directions in NEAR Wallet.\n${recoverUrl}\n\nKeep this message safe and DO NOT SHARE IT. We cannot resend this message.`;
        html = getNewAccountEmail(accountId, recoverUrl, securityCode);
    } else {
        text = `Your NEAR Wallet security code is:\n${securityCode}\nEnter this code to verify your device.`;
        html = getSecurityCodeEmail(accountId, securityCode);
    }
    if (method.kind === 'phone') {
        await sendSms({ to: method.detail, text});
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail, text, html,
            subject: seedPhrase ? 'Important: Near Wallet Recovery Email' : `Your NEAR Wallet security code is: ${securityCode}`,
        });
    }
};

const completeRecoveryInit = async ctx => {
    const { accountId, method, seedPhrase } = ctx.request.body;
    const [account] = await models.Account.findOrCreate({ where: { accountId } });

    let publicKey = null;
    if (seedPhrase) {
        ({ publicKey } = parseSeedPhrase(seedPhrase));
    }

    let [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: method.kind,
        detail: method.detail,
        publicKey
    }});

    if (!recoveryMethod) {
        recoveryMethod = await account.createRecoveryMethod({
            kind: method.kind,
            detail: method.detail,
            publicKey
        });
    }

    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    await recoveryMethod.update({ securityCode });
    await sendSecurityCode(securityCode, method, accountId, seedPhrase);

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

const completeRecoveryValidation = ({ isNew } = {}) => async ctx => {
    const { accountId, method, securityCode } = ctx.request.body;

    if (!securityCode || isNaN(parseInt(securityCode, 10)) || securityCode.length !== 6) {
        ctx.throw(401, 'valid securityCode required');
    }

    const account = await models.Account.findOne({ where: { accountId } });

    if (!account) {
        ctx.throw(401, 'account does not exist');
    }

    const [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: method.kind,
        detail: method.detail,
        securityCode: securityCode
    }});

    if (!recoveryMethod) {
        ctx.throw(401, 'recoveryMethod does not exist');
    }

    // for new accounts, clear all other recovery methods that may have been created
    if (isNew) {
        const allRecoveryMethods = await account.getRecoveryMethods();
        for (const rm of allRecoveryMethods) {
            if (rm.detail !== method.detail) {
                await rm.destroy();
            }
        }
    }
    
    await recoveryMethod.update({ securityCode: null });

    ctx.body = await recoveryMethodsFor(account);
};

router.post('/account/validateSecurityCode',
    checkAccountOwnership,
    completeRecoveryValidation()
);

router.post('/account/validateSecurityCodeForTempAccount',
    checkAccountDoesNotExist,
    completeRecoveryValidation({ isNew: true })
);

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT);
} else {
    module.exports = app;
}
