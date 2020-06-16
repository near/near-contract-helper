
const nearAPI = require('near-api-js');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const { getContract, creatorKeyJson } = require('../utils/near')

// placeholder
const sendcode = async ctx => {
    const { tx } = ctx.request.body;
    ctx.body = { tx };
};

// generates a deterministic key based on the accountId
const getDetermKey = async (accountId) => {
    const hash = crypto.createHash('sha256').update(accountId + creatorKeyJson.private_key).digest();
    const keyPair = nacl.sign.keyPair.fromSeed(hash)//nacl.sign.keyPair.fromSecretKey(hash)
    return {
        publicKey: `ed25519:${nearAPI.utils.serialize.base_encode(keyPair.publicKey)}`,
        secretKey: nearAPI.utils.serialize.base_encode(keyPair.secretKey)
    }
}

/********************************
Multisig
********************************/
const viewMethods = ['get_request', 'list_request_ids', 'get_confirmations',
    'get_num_confirmations', 'get_request_nonce',
]
const changeMethods = ['new', 'add_request', 'delete_request', 'confirm', 'request_expired']

/********************************
Routes
********************************/
const getWalletAccessKey = async (ctx) => {
    const { accountId } = ctx.request.body
    const keyPair = await getDetermKey(accountId)
    ctx.body = keyPair.publicKey
}

module.exports = {
    sendcode,
    //routes
    getWalletAccessKey
};
