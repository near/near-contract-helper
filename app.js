const nearAPI = require('near-api-js');
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

const creatorKeyJson = JSON.parse(process.env.ACCOUNT_CREATOR_KEY);
const keyStore = {
    async getKey() {
        return nearAPI.KeyPair.fromString(creatorKeyJson.secret_key || creatorKeyJson.private_key);
    }
};

const nearPromise = (async () => {
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    return near;
})();
app.use(async (ctx, next) => {
    ctx.near = await nearPromise;
    await next();
});

const VALID_BLOCK_AGE = 100;

async function checkAccountOwnership(ctx, next) {
    const { accountId, blockNumber, blockNumberSignature } = ctx.request.body;
    if (!accountId || !blockNumber || !blockNumberSignature) {
        ctx.throw(403, 'You must provide an accountId, blockNumber, and blockNumberSignature');
    }

    const currentBlock = (await ctx.near.connection.provider.status()).sync_info.latest_block_height;
    const givenBlock = Number(blockNumber);

    if (givenBlock <= currentBlock - VALID_BLOCK_AGE || givenBlock > currentBlock) {
        ctx.throw(403, `You must provide a blockNumber within ${VALID_BLOCK_AGE} of the most recent block; provided: ${blockNumber}, current: ${currentBlock}`);
    }

    const nearAccount = await ctx.near.account(accountId);
    if (!(await verifySignature(nearAccount, blockNumber, blockNumberSignature))) {
        ctx.throw(403, `blockNumberSignature did not match a signature of blockNumber=${blockNumber} from accountId=${accountId}`);
    }

    return await next();
}

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

router.post('/account', async ctx => {
    const { newAccountId, newAccountPublicKey } = ctx.request.body;
    const masterAccount = await ctx.near.account(creatorKeyJson.account_id);
    ctx.body = await masterAccount.createAccount(newAccountId, newAccountPublicKey, NEW_ACCOUNT_AMOUNT);
});

const password = require('secure-random-password');
const models = require('./models');
const FROM_PHONE = process.env.TWILIO_FROM_PHONE;
const SECURITY_CODE_DIGITS = 6;

const sendSms = async ({ to, text }) => {
    if (process.env.NODE_ENV == 'production') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const client = require('twilio')(accountSid, authToken);
        await client.messages
            .create({
                body: text,
                from: FROM_PHONE,
                to
            });
    } else {
        console.log('sendSms:', { to, text });
    }
};

const nacl = require('tweetnacl');
const crypto = require('crypto');
const bs58 = require('bs58');
const verifySignature = async (nearAccount, data, signature) => {
    try {
        const hash = crypto.createHash('sha256').update(data).digest();
        const accessKeys = (await nearAccount.getAccessKeys())
            .filter(k => k.access_key.permission === 'FullAccess');
        return accessKeys.some(it => {
            const publicKey = it.public_key.replace('ed25519:', '');
            return nacl.sign.detached.verify(hash, Buffer.from(signature, 'base64'), bs58.decode(publicKey));
        });
    } catch (e) {
        console.error(e);
        return false;
    }
};

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
        const [account] = await models.Account.findOrCreate({ where: { accountId } });

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

const sendMail = async (options) => {
    if (process.env.NODE_ENV == 'production') {
        const nodemailer = require('nodemailer');
        const transport = nodemailer.createTransport({
            host: process.env.MAIL_HOST,
            port: process.env.MAIL_PORT,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASSWORD
            }
        });
        return transport.sendMail({
            from: 'wallet@nearprotocol.com',
            ...options
        });
    } else {
        console.log('sendMail:', options);
    }
};

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

router.post('/account/initializeRecoveryMethod',
    checkAccountOwnership,
    async ctx => {
        const { accountId, method, test } = ctx.request.body;
        const [account] = await models.Account.findOrCreate({ where: { accountId } });
        const where = { kind: method.kind, detail: method.detail };

        let [recoveryMethod] = await account.getRecoveryMethods({ where });

        if (!recoveryMethod) {
            recoveryMethod = await account.createRecoveryMethod(where);
        }

        const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
        await recoveryMethod.update({ securityCode });
        await sendSecurityCode(securityCode, method);

        if (test) {
            return ctx.body = securityCode;
        }

        ctx.body = await recoveryMethodsFor(account);
    }
);

router.post('/account/validateSecurityCode',
    checkAccountOwnership,
    async ctx => {
        const { accountId, method, securityCode } = ctx.request.body;

        const [account] = await models.Account.findOrCreate({ where: { accountId } });

        let [recoveryMethod] = await account.getRecoveryMethods({ 
            kind: method.kind,
            detail: method.detail,
            securityCode: securityCode
        });

        if (!recoveryMethod) {
            ctx.throw(401);
        }

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

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    app.listen(process.env.PORT);
} else {
    module.exports = app;
}