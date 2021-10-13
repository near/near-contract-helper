const nearAPI = require('near-api-js');
const escapeHtml = require('escape-html');
const password = require('secure-random-password');

const constants = require('../constants');
const messageContentUtils2fa = require('./2faMessageContent');
const AccountService = require('../services/account');
const RecoveryMethodService = require('../services/recovery_method');
const emailHelper = require('../utils/email');
const smsHelper = require('../utils/sms');

const { sendSms } = smsHelper;
const { sendMail, get2faHtml } = emailHelper;
const { SERVER_EVENTS, TWO_FACTOR_AUTH_KINDS } = constants;

const SECURITY_CODE_DIGITS = 6;
const twoFactorMethods = Object.values(TWO_FACTOR_AUTH_KINDS);

const {
    getVerify2faMethodMessageContent,
    getConfirmTransactionMessageContent,
    getAddingFullAccessKeyMessageContent,
} = messageContentUtils2fa;

const MULTISIG_CONTRACT_HASHES = process.env.MULTISIG_CONTRACT_HASHES ? process.env.MULTISIG_CONTRACT_HASHES.split() : [
    // https://github.com/near/core-contracts/blob/fa3e2c6819ef790fdb1ec9eed6b4104cd13eb4b7/multisig/src/lib.rs
    '7GQStUCd8bmCK43bzD8PRh7sD2uyyeMJU5h8Rj3kXXJk',
    // https://github.com/near/core-contracts/blob/fb595e6ec09014d392e9874c2c5d6bbc910362c7/multisig/src/lib.rs
    'AEE3vt6S3pS2s7K6HXnZc46VyMyJcjygSMsaafFh67DF',
    // https://github.com/near/core-contracts/blob/636e7e43f1205f4d81431fad0be39c5cb65455f1/multisig/src/lib.rs
    '8DKTSceSbxVgh4ANXwqmRqGyPWCuZAR1fCqGPXUjD5nZ',
    // https://github.com/near/core-contracts/blob/f93c146d87a779a2063a30d2c1567701306fcae4/multisig/res/multisig.wasm
    '55E7imniT2uuYrECn17qJAk9fLcwQW4ftNSwmCJL5Di',
];

const GAS_2FA_CONFIRM = process.env.GAS_2FA_CONFIRM || '100000000000000';

// confirms a multisig request
const confirmRequest = async (near, accountId, request_id) => {
    const account = await near.account(accountId);

    return await account.functionCall(accountId, 'confirm', { request_id }, GAS_2FA_CONFIRM);
};


const sendMessageTo2faDestination = async ({
    ctx,
    deliveryOpts: { kind, destination },
    contentData: { securityCode, publicKey, accountId, messageContent }
}) => {
    if (kind === TWO_FACTOR_AUTH_KINDS.PHONE) {
        const { text } = messageContent;

        await sendSms(
            {
                to: destination,
                text,
            },
            (smsContent) => ctx.app.emit(SERVER_EVENTS.SENT_SMS, smsContent) // For test harness
        );
    } else if (kind === TWO_FACTOR_AUTH_KINDS.EMAIL) {
        const { requestDetails, subject, text } = messageContent;

        const html = get2faHtml(securityCode, requestDetails, {
            public_key: publicKey,
            accountId
        });

        await sendMail(
            {
                to: destination,
                subject,
                text,
                html,
            },
            (emailContent) => ctx.app.emit(SERVER_EVENTS.SENT_EMAIL, emailContent) // For test harness
        );
    } else {
        // FIXME: Should we throw an error if we get a request for an unsupported kind?
    }
};

const getRequestDataFromChain = async ({ requestId, ctx, accountId }) => {
    let request;

    // What if this throws? Why catch all failures to account.viewFunction() but not errors for this call?
    const account = await ctx.near.account(accountId);

    try {
        request = await account.viewFunction(accountId, 'get_request', { request_id: parseInt(requestId) });
    } catch (e) {
        // Should this really be a generic catch()? This will fire due to e.g. network transport errors
        const message = `could not find request id ${requestId} for account ${accountId}. ${e}`;
        console.warn(message);
        ctx.throw(401, message);
    }

    return request;
};

const sendCode = async (ctx, method, requestId = -1, accountId = '') => {
    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });

    // Emit an event so that any listening test harnesses can use the security code without needing a full
    // integration test with e.g. SMS, e-mail.
    ctx.app.emit(SERVER_EVENTS.SECURITY_CODE, { accountId, requestId, securityCode }); // For test harness

    await RecoveryMethodService.updateTwoFactorRecoveryMethod({
        accountId,
        requestId,
        securityCode,
    });

    // Safe: assumes anything other than SMS should be HTML escaped, and that args should be shortened for SMS
    const isForSmsDelivery = method.kind === TWO_FACTOR_AUTH_KINDS.PHONE;

    const deliveryOpts = {
        kind: method.kind,
        destination: escapeHtml(method.detail)
    };

    if (requestId === -1) {
        // No requestId means this is a brand new 2fa verification, not transactions being approved
        return sendMessageTo2faDestination({
            ctx,
            deliveryOpts,
            contentData: {
                accountId,
                securityCode,
                messageContent: getVerify2faMethodMessageContent({
                    accountId,
                    destination: deliveryOpts.destination,
                    securityCode,
                })
            }
        });
    }

    // Could be either confirming 'generic' transactions, or might be a request for adding full access key (special warning case)
    const request = await getRequestDataFromChain({ requestId, ctx, accountId });
    const addingFakAction = request && request.actions && request.actions.find((a) => a.type === 'AddKey' && !a.permission);

    if (addingFakAction && request.receiver_id === accountId) {
        const publicKey = addingFakAction.public_key;

        // adding full access key to account (AddKey with no permission)
        return sendMessageTo2faDestination({
            ctx,
            deliveryOpts,
            contentData: {
                accountId,
                securityCode,
                publicKey,
                messageContent: getAddingFullAccessKeyMessageContent({
                    accountId,
                    publicKey,
                    isForSmsDelivery,
                    request,
                    securityCode,
                })
            }
        });

    }

    // confirming 'normal' transactions
    return sendMessageTo2faDestination({
        ctx,
        deliveryOpts,
        contentData: {
            accountId,
            securityCode,
            messageContent: getConfirmTransactionMessageContent({
                accountId,
                request,
                securityCode,
                isForSmsDelivery
            })
        }
    });
};

/********************************
 Checking code_hash (is multisig deployed)
 ********************************/
const isContractDeployed = async (accountId) => {
    const keyStore = {
        async getKey() {
            return nearAPI.KeyPair.fromString('bs');
        },
    };
    // check account code_hash
    const near = await nearAPI.connect({
        deps: { keyStore },
        nodeUrl: process.env.NODE_URL
    });
    const nearAccount = new nearAPI.Account(near.connection, accountId);
    const state = await nearAccount.state();
    return MULTISIG_CONTRACT_HASHES.includes(state.code_hash);
};

const getTwoFactorRecoveryMethod = async (ctx, accountId) => {
    const account = await AccountService.getAccount(accountId);
    if (!account) {
        console.warn(`account: ${accountId} should already exist when sending new code`);
        ctx.throw(401);
        return;
    }

    return RecoveryMethodService.getTwoFactorRecoveryMethod(accountId);
};

/********************************
 @warn protect these routes using checkAccountOwnership middleware from app.js
 @warn Requires refactor
 ********************************/
// http post http://localhost:3000/2fa/getAccessKey accountId=mattlock
// Call this to get the public key of the access key that contract-helper will be using to confirm multisig requests
const getAccessKey = async (ctx) => {
    const { accountId } = ctx.request.body;
    ctx.body = { publicKey: (await ctx.near.connection.signer.getPublicKey(accountId, 'default')).toString() };
};

// http post http://localhost:3000/2fa/init accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// Call ONCE to enable 2fa on this account. Adds a twoFactorMethod (passed in body) where kind should start with '2fa-'
// This WILL send the initial code to the method specified ['2fa-email', '2fa-phone']
const initCode = async (ctx) => {
    const { accountId, method, testContractDeployed = false } = ctx.request.body;
    if (!method || !method.kind || !method.detail) {
        ctx.throw(401, 'method arguments invalid');
        return;
    }

    const { kind, detail } = method;
    if (!twoFactorMethods.includes(kind)) {
        ctx.throw(401, 'invalid 2fa method ' + kind);
        return;
    }

    const hasContractDeployed = await isContractDeployed(accountId);
    const twoFactorMethod = await getTwoFactorRecoveryMethod(ctx, accountId);
    if (twoFactorMethod) {
        // check if multisig contract is already deployed
        if (hasContractDeployed || testContractDeployed) {
            ctx.throw(401, 'account with multisig contract already has 2fa method');
        }

        await RecoveryMethodService.updateTwoFactorRecoveryMethod({
            accountId,
            // FIXME: Should this be escaped?
            detail,
            kind,
        });
    } else {
        await RecoveryMethodService.createRecoveryMethod({
            accountId,
            detail,
            kind,
            requestId: -1,
        });
    }

    // check if 2fa method matches existing recovery method
    const recoveryMethod = await RecoveryMethodService.getRecoveryMethod({
        where: {
            accountId,
            detail,
            kind: kind.split('2fa-')[1],
        }
    });

    if (recoveryMethod) {
        // client should deploy contract
        ctx.body = {
            confirmed: true, message: '2fa initialized and set up using recovery method verification'
        };
        return;
    }

    // client waits to deploy contract until code is verified
    await sendCode(ctx, method, -1, accountId);
    ctx.body = {
        message: '2fa initialized and code sent to verify method',
    };
};

// http post http://localhost:3000/2fa/send accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}' requestId=0
// Call anytime after calling initCode to resend a new code, the new code will overwrite the old code
const sendNewCode = async (ctx) => {
    const { accountId, method, requestId } = ctx.request.body;
    const twoFactorMethod = await getTwoFactorRecoveryMethod(ctx, accountId);
    if (!twoFactorMethod) {
        console.warn(`account: ${accountId} does not have 2fa enabled`);
        ctx.throw(401);
    }

    await sendCode(ctx, method, requestId, accountId);
    ctx.body = {
        message: '2fa code sent'
    };
};

// http post http://localhost:3000/2fa/verify accountId=mattlock securityCode=430888
// call when you want to verify the "current" securityCode
const verifyCode = async (ctx) => {
    const { accountId, securityCode, requestId } = ctx.request.body;
    if (!securityCode || isNaN(parseInt(securityCode, 10)) || securityCode.length !== 6) {
        console.warn('invalid 2fa code provided');
        ctx.throw(401, 'invalid 2fa code provided');
    }

    const twoFactorMethod = await RecoveryMethodService.getTwoFactorRecoveryMethod(accountId);
    if (!twoFactorMethod) {
        console.warn(`${accountId} has no 2fa method for the provided security code`);
        ctx.throw(401, '2fa code not valid for request id');
    }

    // cannot test for requestId equality with negative integer???
    // checking requestId here with weak equality (no type match)
    if (twoFactorMethod.requestId != requestId) {
        console.warn(`2fa code not valid for request id: ${requestId} and account: ${accountId}`);
        ctx.throw(401, '2fa code not valid for request id');
    }

    // only verify codes that are 5 minutes old (if testing make this impossible)
    if (RecoveryMethodService.isTwoFactorRequestExpired(twoFactorMethod)) {
        console.warn(`2fa code expired for: ${accountId}`);
        ctx.throw(401, '2fa code expired');
    }

    // security code valid
    await RecoveryMethodService.resetTwoFactorRequest(accountId);
    if (requestId !== -1) {
        ctx.body = await confirmRequest(ctx.near, accountId, parseInt(requestId, 10));
        return;
    }

    ctx.body = {
        message: '2fa code verified', requestId: twoFactorMethod.requestId,
    };
};

module.exports = {
    getAccessKey,
    initCode,
    sendNewCode,
    verifyCode,
};


