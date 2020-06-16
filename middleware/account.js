
const models = require('./../models');
const nacl = require('tweetnacl');
const crypto = require('crypto');
const bs58 = require('bs58');

const verifySignature = async (nearAccount, data, signature) => {
    try {
        const hash = crypto.createHash('sha256').update(data).digest();
        const accessKeys = (await nearAccount.getAccessKeys())
            .filter(({ access_key: { permission } }) => permission === 'FullAccess' ||
                permission.FunctionCall &&
                    permission.FunctionCall.receiver_id === nearAccount.accountId &&
                    permission.FunctionCall.method_names.includes('__wallet__metadata')
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

async function withPublicKey(ctx, next) {
    ctx.publicKey = ctx.request.body.publicKey;
    if (ctx.publicKey !== undefined) {
        await next();
        return;
    }
    ctx.throw(400, 'Must provide valid publicKey');
}

async function withAccount(ctx, next) {
    const { accountId } = ctx.request.body;
    ctx.account = await models.Account.findOne({ where: { accountId } });
    if (ctx.account) {
        await next();
        return;
    }
    ctx.throw(404, `Could not find account with accountId: '${accountId}'`);
}


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

module.exports = {
    withAccount,
    withPublicKey,
    checkAccountOwnership
};