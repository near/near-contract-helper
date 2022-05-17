#!/usr/bin/env node
const Koa = require('koa');
const app = new Koa();
const body = require('koa-json-body');
const cors = require('@koa/cors');

const constants = require('./constants');
const AccountService = require('./services/account');
const IdentityVerificationMethodService = require('./services/identity_verification_method');
const RecoveryMethodService = require('./services/recovery_method');

const {
    RECOVERY_METHOD_KINDS,
    SERVER_EVENTS,
} = constants;

const accountService = new AccountService();
const identityVerificationMethodService = new IdentityVerificationMethodService();
const recoveryMethodService = new RecoveryMethodService();

// render.com passes requests through a proxy server; we need the source IPs to be accurate for `koa-ratelimit`
app.proxy = true;

app.use(require('koa-logger')());
app.use(body({ limit: '500kb', fallback: true }));
app.use(cors({ credentials: true }));

let reportException = () => {
};

const SENTRY_DSN = process.env.SENTRY_DSN;
if (SENTRY_DSN && !module.parent) {
    const { requestHandler, tracingMiddleware: tracingMiddleWare, captureException } = require('./middleware/sentry');
    app.use(requestHandler);
    app.use(tracingMiddleWare);
    reportException = captureException;
}

// Middleware to passthrough HTTP errors from node
app.use(async function (ctx, next) {
    try {
        await next();
    } catch (e) {
        reportException(e);

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

router.get('/health', (ctx) => {
    ctx.status = 200;
});

const {
    withNear,
    checkAccountOwnership,
    createCheckAccountDoesNotExistMiddleware,
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

const ratelimit = require('koa-ratelimit');
const accountCreateRatelimitMiddleware = ratelimit({
    driver: 'memory',
    db: new Map(),
    duration: 15 * 60000,
    max: 10,
    whitelist: () => process.env.NODE_ENV === 'test'
});

const { createAccount } = require('./middleware/createAccount');
router.post('/account', accountCreateRatelimitMiddleware, createAccount);

const fundedAccountCreateRatelimitMiddleware = ratelimit({
    driver: 'memory',
    db: new Map(),
    duration: 15 * 60000,
    max: 5,
    whitelist: () => process.env.NODE_ENV === 'test'
});

const {
    checkFundedAccountAvailable,
    clearFundedAccountNeedsDeposit,
    createFundedAccount,
    createIdentityVerifiedFundedAccount,
} = require('./middleware/fundedAccount');
router.post(
    '/fundedAccount',
    fundedAccountCreateRatelimitMiddleware,
    createCheckAccountDoesNotExistMiddleware({ source: 'body', fieldName: 'newAccountId' }),
    createFundedAccount
);

router.post(
    '/identityFundedAccount',
    fundedAccountCreateRatelimitMiddleware,
    createCheckAccountDoesNotExistMiddleware({ source: 'body', fieldName: 'newAccountId' }),
    createIdentityVerifiedFundedAccount
);

router.get('/checkFundedAccountAvailable', checkFundedAccountAvailable);
router.post(
    '/fundedAccount/clearNeedsDeposit',
    (ctx, next) => verifyAccountExists(ctx, next, ctx.request.body),
    clearFundedAccountNeedsDeposit,
);

const {
    createIdentityVerificationMethod,
    validateEmail,
} = require('./middleware/identityVerificationMethod');
router.post(
    '/identityVerificationMethod',
    createIdentityVerificationMethod
);

/********************************
 Top up integration helpers
 ********************************/
const moonpay = require('./middleware/moonpay');
router.get('/moonpay/signURL', moonpay.signURL);

const nearpay = require('./middleware/nearpay');
router.get('/nearpay/signParams', nearpay.signParams);

const {
    findAccountsByPublicKey,
    findStakingDeposits,
    findReceivers,
    findLikelyTokens,
    findLikelyNFTs,
    findStakingPools,
} = require('./middleware/indexer');
router.get('/publicKey/:publicKey/accounts', findAccountsByPublicKey);
router.get('/staking-deposits/:accountId', findStakingDeposits);
router.get('/account/:accountId/activity', (ctx) => (ctx.body = []));
router.get('/account/:accountId/callReceivers', findReceivers);
router.get('/account/:accountId/likelyTokens', findLikelyTokens);
router.get('/account/:accountId/likelyNFTs', findLikelyNFTs);
router.get('/stakingPools', findStakingPools);

const password = require('secure-random-password');
const SECURITY_CODE_DIGITS = 6;

const { sendSms } = require('./utils/sms');

router.post('/account/recoveryMethods', checkAccountOwnership, async ctx => {
    const { accountId } = ctx.request.body;
    ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
});

async function verifyAccountExists(ctx, next, { accountId }) {
    if (!accountId) {
        throw new Error('invalid accountId provided');
    }

    const account = await accountService.getAccount(accountId);
    if (!account) {
        ctx.throw(404, `Could not find account with accountId: '${accountId}'`);
    }

    return next();
}

const deletableRecoveryMethods = Object.values(RECOVERY_METHOD_KINDS);
router.post(
    '/account/deleteRecoveryMethod',
    async function checkDeletableRecoveryMethod(ctx, next) {
        const { kind } = ctx.request.body;
        if (deletableRecoveryMethods.includes(kind)) {
            await next();
            return;
        }
        ctx.throw(400, `Given recoveryMethod '${kind}' invalid; must be one of: ${deletableRecoveryMethods.join(', ')}`);
    },
    (ctx, next) => verifyAccountExists(ctx, next, ctx.request.body),
    checkAccountOwnership,
    withPublicKey,
    async ctx => {
        const { accountId, kind, publicKey } = ctx.request.body;
        await recoveryMethodService.deleteRecoveryMethod({ accountId, kind, publicKey });
        ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
    },
);

const { sendMail } = require('./utils/email');
const { getNewAccountMessageContent, getSecurityCodeMessageContent } = require('./accountRecoveryMessageContent');

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
    async (ctx) => {
        const { publicKey, request: { body: { accountId } } } = ctx;
        await accountService.getOrCreateAccount(accountId);
        await recoveryMethodService.createRecoveryMethod({
            accountId,
            kind: RECOVERY_METHOD_KINDS.PHRASE,
            publicKey,
        });
        ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
    }
);

router.post(
    '/account/ledgerKeyAdded',
    checkAccountOwnership,
    withPublicKey,
    async (ctx) => {
        const { publicKey, request: { body: { accountId } } } = ctx;
        await accountService.getOrCreateAccount(accountId);
        await recoveryMethodService.createRecoveryMethod({
            accountId,
            kind: RECOVERY_METHOD_KINDS.LEDGER,
            publicKey,
        });
        ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
    }
);

const {
    BN_UNLOCK_FUNDED_ACCOUNT_BALANCE
} = require('./middleware/fundedAccount');
router.get(
    '/account/walletState/:accountId',
    (ctx, next) => verifyAccountExists(ctx, next, ctx.params),
    async (ctx) => {
        const { accountId } = ctx.params;
        const { fundedAccountNeedsDeposit } = await accountService.getAccount(accountId);
        ctx.body = {
            accountId,
            fundedAccountNeedsDeposit,
            requiredUnlockBalance: BN_UNLOCK_FUNDED_ACCOUNT_BALANCE.toString(),
        };
    },
);

const sendSecurityCode = async ({ ctx, securityCode, method, accountId, seedPhrase }) => {
    let html, subject, text;
    if (seedPhrase) {
        const recoverUrl = getRecoveryUrl(accountId, seedPhrase);
        ({ html, subject, text } = getNewAccountMessageContent({ accountId, recoverUrl, securityCode }));
    } else {
        ({ html, subject, text } = getSecurityCodeMessageContent({ accountId, securityCode }));
    }

    if (method.kind === RECOVERY_METHOD_KINDS.PHONE) {
        await sendSms(
            { to: method.detail, text },
            (smsContent) => ctx.app.emit(SERVER_EVENTS.SENT_SMS, smsContent) // For test harness
        );
    } else if (method.kind === RECOVERY_METHOD_KINDS.EMAIL) {
        await sendMail(
            {
                to: method.detail,
                text,
                html,
                subject,
            },
            (emailContent) => ctx.app.emit(SERVER_EVENTS.SENT_EMAIL, emailContent) // For test harness
        );
    }
};

const completeRecoveryInit = async ctx => {
    const { accountId, method, seedPhrase } = ctx.request.body;

    await accountService.getOrCreateAccount(accountId);

    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    const { publicKey } = parseSeedPhrase(seedPhrase);
    const { detail, kind } = method;

    await recoveryMethodService.updateRecoveryMethod({
        accountId,
        detail,
        kind,
        publicKey,
        securityCode,
    });

    // For test harness
    ctx.app.emit(SERVER_EVENTS.SECURITY_CODE, { accountId, securityCode });

    await sendSecurityCode({ ctx, securityCode, method, accountId, seedPhrase });

    ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
};

const DISABLE_PHONE_RECOVERY = process.env.DISABLE_PHONE_RECOVERY === 'true';

const createableRecoveryMethods = Object.values(RECOVERY_METHOD_KINDS)
    .filter((method) => {
        if (DISABLE_PHONE_RECOVERY === true) {
            return method !== RECOVERY_METHOD_KINDS.PHONE;
        }

        return true;
    });

async function checkCreateableRecoveryMethod(ctx, next) {
    const { kind } = ctx.request.body.method;
    const methods = createableRecoveryMethods;
    if (methods.includes(kind)) {
        await next();
        return;
    }
    ctx.throw(400, `Given recoveryMethod '${kind}' invalid; must be one of: ${methods.join(', ')}`);
}

router.post('/account/initializeRecoveryMethodForTempAccount',
    checkCreateableRecoveryMethod,
    createCheckAccountDoesNotExistMiddleware({ source: 'body', fieldName: 'accountId' }),
    completeRecoveryInit
);

router.post('/account/initializeRecoveryMethod',
    checkCreateableRecoveryMethod,
    checkAccountOwnership,
    completeRecoveryInit
);

const recaptchaValidator = require('./RecaptchaValidator');

const completeRecoveryValidation = ({ isNew } = {}) => async (ctx) => {
    const {
        accountId,
        method,
        securityCode,
        enterpriseRecaptchaToken,
        publicKey,
        recaptchaAction,
        recaptchaSiteKey
    } = ctx.request.body;

    if (!securityCode || isNaN(parseInt(securityCode, 10)) || securityCode.length !== 6) {
        ctx.throw(401, 'valid securityCode required');
    }

    const account = await accountService.getAccount(accountId);
    if (!account) {
        ctx.throw(401, 'account does not exist');
    }

    const isValidRecoveryMethod = await recoveryMethodService.validateSecurityCode({
        accountId,
        detail: method.detail,
        kind: method.kind,
        publicKey,
        securityCode,
    });

    if (!isValidRecoveryMethod) {
        ctx.throw(401, 'recoveryMethod does not exist');
    }

    // for new accounts, clear all other recovery methods that may have been created
    if (isNew) {
        await recoveryMethodService.deleteOtherRecoveryMethods({ accountId, detail: method.detail });
    }

    await recoveryMethodService.updateRecoveryMethod({
        accountId,
        detail: method.detail,
        kind: method.kind,
        publicKey,
        securityCode: null,
    });

    if (isNew && enterpriseRecaptchaToken) {
        // Implicitly reserve a funded account for the same identity to allow the user to get a funded account without receiving 2 e-mails
        const { valid, score } = await recaptchaValidator.createEnterpriseAssessment({
            token: enterpriseRecaptchaToken,
            siteKey: recaptchaSiteKey,
            userIpAddress: ctx.ip,
            userAgent: ctx.header['user-agent'],
            expectedAction: recaptchaAction
        });

        if (valid && score > 0.6) {
            if (await validateEmail({ ctx, email: method.detail, kind: method.kind })) {
                const isIdentityRecoverable = await identityVerificationMethodService.recoverIdentity({
                    identityKey: method.detail,
                    kind: method.kind,
                    securityCode,
                });

                if (!isIdentityRecoverable) {
                    console.error('failed to recover identity');
                }
            }
        } else {
            console.log('Skipping implicit identityVerificationMethod creation due to low score', {
                userAgent: ctx.header['user-agent'],
                userIpAddress: ctx.ip,
                expectedAction: recaptchaAction,
                score,
                valid
            });
        }
    }

    ctx.status = 200;
    ctx.body = await recoveryMethodService.listAllRecoveryMethods(accountId);
};

router.post('/account/validateSecurityCode',
    checkCreateableRecoveryMethod,
    checkAccountOwnership,
    completeRecoveryValidation(),
);

router.post('/account/validateSecurityCodeForTempAccount',
    checkCreateableRecoveryMethod,
    createCheckAccountDoesNotExistMiddleware({ source: 'body', fieldName: 'accountId' }),
    completeRecoveryValidation({ isNew: true })
);

const createFiatValueMiddleware = require('./middleware/fiat');
router.get('/fiat', createFiatValueMiddleware());

if (process.env.NODE_ENV === 'development') {
    app.on(SERVER_EVENTS.SECURITY_CODE, ({ accountId, securityCode }) => {
        console.log(`Security code for ${accountId}: ${securityCode}`);
    });
}

app
    .use(router.routes())
    .use(router.allowedMethods());

if (!module.parent) {
    if (SENTRY_DSN) {
        const { setupErrorHandler } = require('./middleware/sentry');
        setupErrorHandler(app, SENTRY_DSN);
    }

    app.listen(process.env.PORT);
} else {
    module.exports = app;
}
