const nearAPI = require('near-api-js');
const escapeHtml = require('escape-html');
const password = require('secure-random-password');
const Sequelize = require('sequelize');

const constants = require('../constants');
const models = require('../models');
const emailHelper = require('../utils/email');
const smsHelper = require('../utils/sms');

const Op = Sequelize.Op;
const { sendSms } = smsHelper;
const { sendMail, get2faHtml } = emailHelper;
const { SERVER_EVENTS, TWO_FACTOR_AUTH_KINDS } = constants;

const SECURITY_CODE_DIGITS = 6;
const twoFactorMethods = Object.values(TWO_FACTOR_AUTH_KINDS);

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

const CODE_EXPIRY = 30 * 60000;
const GAS_2FA_CONFIRM = process.env.GAS_2FA_CONFIRM || '100000000000000';

const fmtNear = (amount) => nearAPI.utils.format.formatNearAmount(amount, 4) + 'Ⓝ';

// confirms a multisig request
const confirmRequest = async (near, accountId, request_id) => {
    const account = await near.account(accountId);

    return await account.functionCall(accountId, 'confirm', { request_id }, GAS_2FA_CONFIRM);
};

const hex = require('hexer');
const formatArgs = (args) => {
    const argsBuffer = Buffer.from(args, 'base64');
    try {
        const jsonString = argsBuffer.toString('utf-8');
        const json = JSON.parse(jsonString);
        if (json.amount) json.amount = fmtNear(json.amount);
        if (json.deposit) json.deposit = fmtNear(json.deposit);
        return JSON.stringify(json);
    } catch(e) {
        // Cannot parse JSON, do hex dump
        return hex(argsBuffer);
    }
};

const formatAction = (receiver_id, { type, method_name, args, deposit, amount, public_key, permission }) => {
    switch (type) {
    case 'FunctionCall':
        return escapeHtml(`Calling method: ${ method_name } in contract: ${ receiver_id } with amount ${ deposit ? fmtNear(deposit) : '0' } and with args ${formatArgs(args)}`);
    case 'Transfer':
        return escapeHtml(`Transferring ${ fmtNear(amount) } to: ${ receiver_id }`);
    case 'Stake':
        return escapeHtml(`Staking: ${ fmtNear(amount) } to validator: ${ receiver_id }`);
    case 'AddKey':
        if (permission) {
            const { allowance, receiver_id, method_names } = permission;
            const methodsMessage = method_names && method_names.length > 0 ? `${method_names.join(', ')} methods` : 'any method';
            return escapeHtml(`Adding key ${ public_key } limited to call ${methodsMessage} on ${receiver_id} and spend up to ${fmtNear(allowance)} on gas`);
        }
        return escapeHtml(`Adding key ${ public_key } with FULL ACCESS to account`);
    case 'DeleteKey':
        return escapeHtml(`Deleting key ${ public_key }`);
    }
};

const sendCode = async (ctx, method, twoFactorMethod, requestId = -1, accountId = '') => {
    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });

    // Emit an event so that any listening test harnesses can use the security code without needing a full
    // integration test with e.g. SMS, e-mail.
    ctx.app.emit(SERVER_EVENTS.SECURITY_CODE, { accountId, requestId, securityCode }); // For test harness

    await twoFactorMethod.update({ securityCode, requestId });
    // get request data from chain
    let request;
    if (requestId !== -1) {
        const account = await ctx.near.account(accountId);
        try {
            request = await account.viewFunction(accountId, 'get_request', { request_id: parseInt(requestId) });
        } catch (e) {
            const message = `could not find request id ${requestId} for account ${accountId}. ${e}`;
            console.warn(message);
            ctx.throw(401, message);
        }
    }
    method.detail = escapeHtml(method.detail);
    let subject = `Confirm 2FA for ${ accountId }`;
    let requestDetails = [`Verify ${method.detail} as the 2FA method for account ${ accountId }`];
    if (request) {
        const { receiver_id, actions } = request;
        requestDetails = actions.map(a => formatAction(receiver_id, a));
        subject = `Confirm Transaction from: ${ accountId }${ request ? ` to: ${ request.receiver_id }` : ''}`;
    }
    let text = `
NEAR Wallet security code: ${securityCode}\n\n
Important: By entering this code, you are authorizing the following transaction:\n\n
${ requestDetails.join('\n') }
`;

    // check if adding full access key to account (AddKey with no permission)
    const addingFakAction = request && request.actions.find((a) => a.type === 'AddKey' && !a.permission);
    if (addingFakAction && request.receiver_id === accountId) {
        subject = 'Confirm Transaction - Warning Adding Full Access Key to Account: ' + accountId;
        text = `
WARNING: Entering the code below will authorize full access to your NEAR account: "${ accountId }". If you did not initiate this action, please DO NOT continue.

This should only be done if you are adding a new seed phrase to your account. In all other cases, this is very dangerous.

The public key you are adding is: ${ addingFakAction.public_key }

If you'd like to proceed, enter this security code: ${securityCode}
`;
    }

    const html = get2faHtml(securityCode, requestDetails.join('<br>'), {
        public_key: addingFakAction && addingFakAction.public_key,
        accountId
    });

    if (method.kind === TWO_FACTOR_AUTH_KINDS.PHONE) {
        await sendSms(
            {
                to: method.detail,
                text,
            },
            (smsContent) => ctx.app.emit(SERVER_EVENTS.SENT_SMS, smsContent) // For test harness
        );
    } else if (method.kind === TWO_FACTOR_AUTH_KINDS.EMAIL) {
        await sendMail({
            to: method.detail,
            subject,
            text,
            html,
        },
        (emailContent) => ctx.app.emit(SERVER_EVENTS.SENT_EMAIL, emailContent) // For test harness
        );
    }
};

/********************************
Checking code_hash (is multisig deployed)
********************************/
const isContractDeployed = async(accountId) => {
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

const getAccountAndMethod = async(ctx, accountId) => {
    const [account] = await models.Account.findOrCreate({ where: { accountId } });
    if (!account) {
        console.warn(`account: ${accountId} should already exist when sending new code`);
        ctx.throw(401);
        return;
    }
    let [twoFactorMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
    return { account, twoFactorMethod };
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
    let { account, twoFactorMethod } = await getAccountAndMethod(ctx, accountId);
    if (twoFactorMethod) {
        // check if multisig contract is already deployed
        if (hasContractDeployed || testContractDeployed) {
            ctx.throw(401, 'account with multisig contract already has 2fa method');
        }
        await twoFactorMethod.update({
            kind: method.kind,
            detail: method.detail,
            requestId: -1
        });
    } else {
        twoFactorMethod = await account.createRecoveryMethod({ kind, detail, requestId: -1 });
    }
    // check if 2fa method matches existing recovery method
    const [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: kind.split('2fa-')[1],
        detail,
    }});
    if (recoveryMethod) {
        // client should deploy contract
        ctx.body = {
            confirmed: true, message: '2fa initialized and set up using recovery method verification'
        };
        return;
    }
    // client waits to deploy contract until code is verified
    await sendCode(ctx, method, twoFactorMethod);
    ctx.body = {
        message: '2fa initialized and code sent to verify method',
    };
};
// http post http://localhost:3000/2fa/send accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}' requestId=0
// Call anytime after calling initCode to resend a new code, the new code will overwrite the old code
const sendNewCode = async (ctx) => {
    const { accountId, method, requestId } = ctx.request.body;
    const { twoFactorMethod } = await getAccountAndMethod(ctx, accountId);
    if (!twoFactorMethod) {
        console.warn(`account: ${accountId} does not have 2fa enabled`);
        ctx.throw(401);
    }
    await sendCode(ctx, method, twoFactorMethod, requestId, accountId);
    ctx.body = {
        message: '2fa code sent'
    };
};
// http post http://localhost:3000/2fa/verify accountId=mattlock securityCode=430888
// call when you want to verify the "current" securityCode
const verifyCode = async (ctx) => {
    const { accountId, securityCode, requestId } = ctx.request.body;

    const account = await models.Account.findOne({ where: { accountId } });
    if (!securityCode || isNaN(parseInt(securityCode, 10)) || securityCode.length !== 6) {
        console.warn('invalid 2fa code provided');
        ctx.throw(401, 'invalid 2fa code provided');
    }
    const [twoFactorMethod] = await account.getRecoveryMethods({ where: {
        securityCode,
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
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
    if (twoFactorMethod.updatedAt < Date.now() - CODE_EXPIRY) {
        console.warn(`2fa code expired for: ${accountId}`);
        ctx.throw(401, '2fa code expired');
    }
    //security code valid
    await twoFactorMethod.update({ requestId: -1, securityCode: null });
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


