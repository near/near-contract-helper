const nearAPI = require('near-api-js');
const nacl = require('tweetnacl');
const crypto = require('crypto');
const bs58 = require('bs58');

const VALID_BLOCK_AGE = 100;

const verifySignature = async (nearAccount, data, signature) => {
    try {

        
        const hash = crypto.createHash('sha256').update(data).digest();
        const accessKeys = (await nearAccount.getAccessKeys()).filter(({ access_key: { permission } }) =>
            permission === 'FullAccess' ||
            // wallet key
            (
                permission.FunctionCall &&
                permission.FunctionCall.receiver_id === nearAccount.accountId &&
                permission.FunctionCall.method_names.includes('__wallet__metadata')
            ) ||
            // multisig
            (
                permission.FunctionCall &&
                permission.FunctionCall.receiver_id === nearAccount.accountId &&
                permission.FunctionCall.method_names.includes('confirm') &&
                permission.FunctionCall.method_names.includes('add_request')
            )
        );
        return accessKeys.some(it => {
            const publicKey = it.public_key.replace('ed25519:', '');
            return nacl.sign.detached.verify(hash, Buffer.from(signature, 'base64'), bs58.decode(publicKey));
        });
    } catch (e) {
        console.error(e);
        return false;
    }
};

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


function getAccount(ctx, accountId) {
    return new nearAPI.Account(ctx.near.connection, accountId);
}

async function checkAccountDoesNotExist(ctx, next) {
    const { accountId } = ctx.request.body;
    let remoteAccount = null;
    try {
        remoteAccount = await getAccount(ctx, accountId).state();
    } catch (e) {
        return await next();
    }
    if (remoteAccount) {
        ctx.throw(403, 'Account ' + accountId + ' already exists.');
    }
}


const creatorKeyJson = (() => {
    try {
        return JSON.parse(process.env.ACCOUNT_CREATOR_KEY);
    } catch (e) {
        console.warn(`Account creation not available.\nError parsing ACCOUNT_CREATOR_KEY='${process.env.ACCOUNT_CREATOR_KEY}':`, e);
        return null;
    }
})();

const keyStore = {
    async getKey() {
        return nearAPI.KeyPair.fromString(creatorKeyJson.secret_key || creatorKeyJson.private_key);
    },
};

const nearPromise = (async () => {
    const near = await nearAPI.connect({
        deps: { keyStore },
        masterAccount: creatorKeyJson && creatorKeyJson.account_id,
        nodeUrl: process.env.NODE_URL
    });
    return near;
})();

const withNear = async (ctx, next) => {
    ctx.near = await nearPromise;
    await next();
};

module.exports = {
    creatorKeyJson,
    withNear,
    checkAccountOwnership,
    checkAccountDoesNotExist,
};
