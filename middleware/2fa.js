const nearAPI = require('near-api-js');
const { utils: { serialize: { base_encode } } } = nearAPI;
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { creatorKeyJson } = require('./near');
const { sendSms } = require('../utils/sms');
const { sendMail, get2faHtml } = require('../utils/email');
const models = require('../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const password = require('secure-random-password');
const escape = require('escape-html');
// constants
const SECURITY_CODE_DIGITS = 6;
const twoFactorMethods = ['2fa-email', '2fa-phone'];
const viewMethods = ['get_request'];
const changeMethods = ['confirm'];
const DETERM_KEY_SEED = process.env.DETERM_KEY_SEED || creatorKeyJson.private_key;
const MULTISIG_CONTRACT_HASHES = process.env.MULTISIG_CONTRACT_HASHES ? process.env.MULTISIG_CONTRACT_HASHES.split() :['7GQStUCd8bmCK43bzD8PRh7sD2uyyeMJU5h8Rj3kXXJk','AEE3vt6S3pS2s7K6HXnZc46VyMyJcjygSMsaafFh67DF', '45gayUD7tUKFc3vvGwzoPEeFS6RjdQWu7SHGpxAJe13F'];
const CODE_EXPIRY = 300000;
const GAS_2FA_CONFIRM = '100000000000000';

const fmtNear = (amount) => nearAPI.utils.format.formatNearAmount(amount, 4) + 'Ⓝ';

// generates a deterministic key based on the accountId
const getKeyStore = (accountId) => ({
    async getKey() {
        const hash = crypto.createHash('sha256').update(accountId + DETERM_KEY_SEED).digest();
        const keyPair = nacl.sign.keyPair.fromSeed(hash);
        return nearAPI.KeyPair.fromString(base_encode(keyPair.secretKey));
    },
});

// get the accountId's multisig contract instance
const getContract = async (accountId) => {
    const keyStore = getKeyStore(accountId);
    const near = await nearAPI.connect({
        deps: { keyStore },
        nodeUrl: process.env.NODE_URL
    });
    const contractAccount = new nearAPI.Account(near.connection, accountId);
    const contract = new nearAPI.Contract(contractAccount, accountId, {
        viewMethods,
        changeMethods,
    });
    return contract;
};

// confirms a multisig request
const confirmRequest = async (accountId, request_id) => {
    const contract = await getContract(accountId);
    try {
        const res = await contract.confirm({ request_id }, GAS_2FA_CONFIRM);
        return { success: true, res };
    } catch (e) {
        return { success: false, error: JSON.stringify(e) };
    }
};

const sendCode = async (ctx, method, twoFactorMethod, requestId = -1, accountId = '') => {
    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    await twoFactorMethod.update({ securityCode, requestId });
    // get request data from chain
    let request;
    if (requestId !== -1) {
        const contract = await getContract(accountId);
        try {
            request = await contract.get_request({ request_id: parseInt(requestId) });
        } catch (e) {
            const message = `could not find request id ${requestId} for account ${accountId}. ${e}`;
            console.warn(message);
            ctx.throw(401, message);
        }
    }
    method.detail = escape(method.detail);
    let isAddingFAK = false;
    let requestDetails = `Verify ${method.detail} as your 2FA method`;
    if (request) {
        const { receiver_id, actions } = request;
        requestDetails = [];
        actions.forEach((a) => {
            switch (a.type) {
            case 'FunctionCall': requestDetails += escape(`Calling method: ${ a.method_name } with args ${ Buffer.from(a.args, 'base64').toString() } in contract: @${ receiver_id }`); break;
            case 'Transfer': requestDetails += escape(`Transferring ${ fmtNear(a.amount) } to: @${ receiver_id }`); break;
            case 'Stake': requestDetails += escape(`Staking: ${ fmtNear(a.amount) } to validator: ${ receiver_id }`); break;
            case 'AddKey': requestDetails += escape(`Adding key ${ a.public_key }`); break;
            case 'DeleteKey': requestDetails += escape(`Deleting key ${ a.public_key }`); break;
            }
            requestDetails += '<br/>';
        });
    }
    let subject = `Confirm Transaction from: ${ accountId }${ request ? ` to: ${ request.receiver_id }` : ''}`;
    let text = `
NEAR Wallet security code: ${securityCode}\n\n
Important: By entering this code, you are authorizing the following transaction:\n\n
${ requestDetails.replace('<br/>', '\n') }
`;

    // check if adding full access key to account (AddKey with no permission)
    if (request && request.receiver_id === accountId && request.actions.length && request.actions.some((a) => a.type === 'AddKey' && !a.permission)) {
        isAddingFAK = true;
        subject = 'Confirm Transaction - Warning Adding Full Access Key';
        text = `
WARNING: Entering the code below will authorize full access to your NEAR account. If you did not initiate this action, please DO NOT continue.

This should only be done if you are adding a new seed phrase to your account. In all other cases, this is very dangerous.

If you'd like to proceed, enter this security code: ${securityCode}
`;
    }

    const html = get2faHtml(isAddingFAK, securityCode, requestDetails);

    if (method.kind === '2fa-phone') {
        await sendSms({
            to: method.detail,
            text,
        });
    } else if (method.kind === '2fa-email') {
        await sendMail({
            to: method.detail,
            subject,
            text,
            html,
        });
    }
    console.log(securityCode);
    return securityCode;
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
    ctx.body = { publicKey: (await getKeyStore(accountId).getKey()).publicKey.toString() };
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
            success: true, confirmed: true, message: '2fa initialized and set up using recovery method verification'
        };
        return;
    }
    // client waits to deploy contract until code is verified
    await sendCode(ctx, method, twoFactorMethod);
    ctx.body = {
        success: true,
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
        success: true, message: '2fa code sent'
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
    // console.log(twoFactorMethod.updatedAt, Date.now() - CODE_EXPIRY, twoFactorMethod);
    if (twoFactorMethod.updatedAt < Date.now() - CODE_EXPIRY) {
        console.warn(`2fa code expired for: ${accountId}`);
        ctx.throw(401, '2fa code expired');
    }
    //security code valid
    await twoFactorMethod.update({ requestId: -1, securityCode: null });
    if (requestId !== -1) {
        ctx.body = await confirmRequest(accountId, parseInt(requestId, 10));
        return;
    }
    ctx.body = {
        success: true, message: '2fa code verified', requestId: twoFactorMethod.requestId,
    };
};

module.exports = {
    getAccessKey,
    initCode,
    sendNewCode,
    verifyCode,
};


