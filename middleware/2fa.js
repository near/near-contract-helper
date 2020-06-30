const nearAPI = require('near-api-js');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { creatorKeyJson } = require('./near');
const { sendSms } = require('../utils/sms');
const { sendMail } = require('../utils/email');
const models = require('../models');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
//lots of repetition from app.js
const password = require('secure-random-password');
const SECURITY_CODE_DIGITS = 6;
/********************************
Contract Helper
********************************/
const viewMethods = [];
const changeMethods = ['confirm'];
const getContract = async (contractName, viewMethods, changeMethods, secretKey) => {
    const keyStore = {
        async getKey() {
            return nearAPI.KeyPair.fromString(secretKey);
        },
    };
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    const contractAccount = new nearAPI.Account(near.connection, contractName);
    const contract = new nearAPI.Contract(contractAccount, contractName, {
        viewMethods,
        changeMethods,
    });
    return contract;
};
/********************************
2FA Key
********************************/
// helper: generates a deterministic key based on the accountId
const getDetermKey = async (accountId) => {
    const hash = crypto.createHash('sha256').update(accountId + creatorKeyJson.private_key).digest();
    const keyPair = nacl.sign.keyPair.fromSeed(hash);//nacl.sign.keyPair.fromSecretKey(hash)
    return {
        publicKey: `ed25519:${nearAPI.utils.serialize.base_encode(keyPair.publicKey)}`,
        secretKey: nearAPI.utils.serialize.base_encode(keyPair.secretKey)
    };
};
/********************************
Sending Codes
method.kind = ['2fa-email', '2fa-phone']
********************************/
const sendCode = async (method, recoveryMethod) => {
    const securityCode = password.randomPassword({ length: SECURITY_CODE_DIGITS, characters: password.digits });
    await recoveryMethod.update({ securityCode });
    if (method.kind === '2fa-phone') {
        await sendSms({
            text: `Near Wallet\n\nUse this code to confirm your transaction: ${securityCode}`,
            to: method.detail
        });
    } else if (method.kind === '2fa-email') {
        await sendMail({
            to: method.detail,
            subject: `Near Wallet - Confirm Your Transaction`,
            text: `Use this code to confirm your transaction: ${securityCode}`
        });
    }
    return securityCode;
};
/********************************
Routes
********************************/
// http post http://localhost:3000/2fa/getAccessKey accountId=mattlock
// http post https://helper.testnet.near.org/2fa/getAccessKey accountId=mattlock
// Call this to get the public key of the access key that contract-helper will be using to confirm multisig requests
const getAccessKey = async (ctx) => {
    const { accountId } = ctx.request.body;
    const keyPair = await getDetermKey(accountId);
    ctx.body = keyPair.publicKey;
};
// http post http://localhost:3000/2fa/init accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// Call ONCE to enable 2fa on this account. Adds a recovery method (passed in body) where kind should start with '2fa-'
// This WILL send the initial code to the method specified ['2fa-email', '2fa-phone']
const initCode = async (ctx) => {
    const { accountId, method } = ctx.request.body;
    const [account] = await models.Account.findOrCreate({ where: { accountId } });
    if (!account) {
        console.warn('account should be created');
        ctx.throw(401);
    }
    let [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
    if (recoveryMethod) {
        console.warn('account should not have 2fa method yet');
        ctx.throw(401);
    }
    console.log(method);
    if (!recoveryMethod) {
        recoveryMethod = await account.createRecoveryMethod({
            kind: method.kind,
            detail: method.detail
        });
    }
    sendCode(method, recoveryMethod)
    ctx.body = {
        success: true, message: '2fa initialized and first code sent'
    }
};
// http post http://localhost:3000/2fa/send accountId=mattlock method:='{"kind":"2fa-email","detail":"matt@near.org"}'
// Call anytime after calling initCode to resend a new code, the new code will overwrite the old code
const sendNewCode = async (ctx) => {
    const { accountId, method } = ctx.request.body;
    const [account] = await models.Account.findOrCreate({ where: { accountId } });
    if (!account) {
        console.warn('account should be created');
        ctx.throw(401);
    }
    let [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
    }});
    if (!recoveryMethod) {
        console.warn('2fa not enabled');
        ctx.throw(401);
    }
    const code = await sendCode(method, recoveryMethod)
    ctx.body = {
        success: true, code, message: '2fa code sent'
    }
};
// http post http://localhost:3000/2fa/verify accountId=mattlock securityCode=430888
// call when you want to verify the "current" securityCode
const verifyCode = async (ctx) => {
    const { accountId, securityCode } = ctx.request.body
    const account = await models.Account.findOne({ where: { accountId } });
    const [recoveryMethod] = await account.getRecoveryMethods({ where: {
        kind: {
            [Op.startsWith]: '2fa-'
        },
        securityCode
    }});
    if (!recoveryMethod) {
        console.warn('2fa code invalid');
        ctx.throw(401);
    }
    await recoveryMethod.update({ securityCode: null });
    ctx.body = {
        success: true, message: '2fa code verified'
    }
};

module.exports = {
    getAccessKey,
    initCode,
    sendNewCode,
    verifyCode,
};



/********************************
WIP
********************************/
const confirmTransaction = async (ctx) => {
    const { code: userCode, accountId, requestId } = ctx.request.body;
    if (code !== userCode) {
        ctx.body = { success: false, message: 'codes is invalid' };
    }
    const key = await getDetermKey(accountId);
    const contract = await getContract(accountId, viewMethods, changeMethods, key.secretKey);
    const res = await contract.confirm({ request_id: parseInt(requestId) }).catch((e) => {
        ctx.body = { success: false, error: e };
    });
    ctx.body = { success: !!res };
};