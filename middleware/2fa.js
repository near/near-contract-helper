const nearAPI = require('near-api-js');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { creatorKeyJson } = require('../utils/near');
const { sendSms } = require('../utils/sms');
const { sendMail } = require('../utils/email');
/********************************
Contract Helper
********************************/
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
Multisig
********************************/
const viewMethods = ['get_request', 'list_request_ids', 'get_confirmations',
    'get_num_confirmations', 'get_request_nonce',
];
const changeMethods = ['new', 'add_request', 'delete_request', 'confirm', 'request_expired'];

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
@warning when you add this key to the account it will need an allowance to spend gas in order to confirm txs
********************************/
// http post http://localhost:3000/2fa/getWalletAccessKey accountId=mattlock
const getWalletAccessKey = async (ctx) => {
    const { accountId } = ctx.request.body;
    const keyPair = await getDetermKey(accountId);
    ctx.body = keyPair.publicKey;
};


/********************************
WIP
********************************/
// placeholder
const code = '938423';
const sendConfirmationCode = async (ctx) => {
    const { accountId, request } = ctx.request.body;
    
    // placeholder
    const method = {
        kind: 'email',
        detail: 'mattdlockyer@gmail.com'
    };

    if (method.kind === 'phone') {
        await sendSms({
            text: `Your NEAR Wallet ${accountId} wants to confirm a request: ${request}.\n\nThe confirmation code is ${code}`,
            to: method.detail
        });
    } else if (method.kind === 'email') {
        await sendMail({
            to: method.detail,
            subject: `Your NEAR Wallet ${accountId} wants to confirm a request.`,
            text: `The request is: ${request}.\n\nThe confirmation code is ${code}`
        });
    }

    ctx.body = { success: true };
};

const verifyConfirmationCode = async (ctx) => {
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

module.exports = {
    // done
    getWalletAccessKey,
    // WIP
    sendConfirmationCode,
    verifyConfirmationCode,
};
