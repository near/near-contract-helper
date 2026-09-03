const crypto = require('crypto');
const { Account, JsonRpcProvider, KeyPair, KeyPairSigner, PublicKey, baseEncode } = require('near-api-js');
const { AccountDoesNotExistError } = require('near-api-js/rpc-errors');

const VALID_BLOCK_AGE = 100;

const verifySignature = async (nearAccount, data, signature) => {
    try {
        const hash = crypto.createHash('sha256').update(data).digest();
        const signatureBytes = Buffer.from(signature, 'base64');
        const { keys } = await nearAccount.getAccessKeyList();
        const accessKeys = keys.filter(({ access_key: { permission } }) =>
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
        return accessKeys.some(({ public_key }) => {
            try {
                return PublicKey.from(public_key).verify(hash, signatureBytes);
            } catch (e) {
                // e.g. the signature length does not match this key's type
                return false;
            }
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

    const currentBlock = (await ctx.near.provider.viewNodeStatus()).sync_info.latest_block_height;
    const givenBlock = Number(blockNumber);

    if (givenBlock <= currentBlock - VALID_BLOCK_AGE || givenBlock > currentBlock) {
        ctx.throw(403, `You must provide a blockNumber within ${VALID_BLOCK_AGE} of the most recent block; provided: ${blockNumber}, current: ${currentBlock}`);
    }

    const nearAccount = ctx.near.account(accountId);
    if (!(await verifySignature(nearAccount, blockNumber, blockNumberSignature))) {
        ctx.throw(403, `blockNumberSignature did not match a signature of blockNumber=${blockNumber} from accountId=${accountId}`);
    }

    return await next();
}

async function getAccountExists(near, accountId) {
    try {
        await near.provider.viewAccount({ accountId, blockQuery: { finality: 'optimistic' } });
    } catch (e) {
        if (e instanceof AccountDoesNotExistError) {
            return false;
        }
        throw e;
    }

    return true;
}

async function accountAuthMiddleware(ctx, next) {
    const { accountId } = ctx.request.body;

    if (await getAccountExists(ctx.near, accountId)) {
        return checkAccountOwnership(ctx, next);
    }

    if (!isImplicitAccount(accountId)) {
        ctx.throw(403, `Named account ${accountId} does not exist`);
    }

    return next();
}

const isImplicitAccount = (accountId) =>
    accountId && accountId.length === 64 && !accountId.includes('.');

function createCheckAccountDoesNotExistMiddleware({ source, fieldName }) {
    if (source !== 'body' && source !== 'params') {
        throw new Error('invalid source for accountId provided');
    }

    if (!fieldName) {
        throw new Error('Must provide a field to look for accountId in');
    }

    return async function checkAccountDoesNotExist(ctx, next) {
        let accountId;

        if (source === 'body') {
            accountId = ctx.request.body[fieldName];
        } else {
            accountId = ctx.params[fieldName];
        }

        if (await getAccountExists(ctx.near, accountId)) {
            ctx.throw(403, 'Account ' + accountId + ' already exists.');
        }

        return next();
    };
}

const creatorKeyJson = (() => {
    try {
        return JSON.parse(process.env.ACCOUNT_CREATOR_KEY);
    } catch (e) {
        console.warn(`Account creation not available.\nError parsing ACCOUNT_CREATOR_KEY='${process.env.ACCOUNT_CREATOR_KEY}':`, e);
        return null;
    }
})();

const creatorKeysJson = (() => {
    let result;
    try {
        result = JSON.parse(process.env.ACCOUNT_CREATOR_KEYS);
        console.log('Round-robin account creation enabled. Yeee HAWWWW :)');
    } catch (e) {
        console.warn(`Round-robin account creation not available.\nError parsing ACCOUNT_CREATOR_KEYS='${process.env.ACCOUNT_CREATOR_KEYS}':`, e);
        return null;
    }

    return result;
})();

const fundedCreatorKeyJson = (() => {
    try {
        return JSON.parse(process.env.FUNDED_ACCOUNT_CREATOR_KEY);
    } catch (e) {
        console.warn(`Funded account creation not available.\nError parsing FUNDED_ACCOUNT_CREATOR_KEY='${process.env.FUNDED_ACCOUNT_CREATOR_KEY}':`, e);
        return null;
    }
})();

const DETERM_KEY_SEED = process.env.DETERM_KEY_SEED || creatorKeyJson.private_key;

// Older near-api-js releases accepted a bare base58 ed25519 secret key; keep accepting that format for configured keys
const parseKeyPair = (encodedKey) => KeyPair.fromString(encodedKey.includes(':') ? encodedKey : `ed25519:${encodedKey}`);

function getKeyPairForAccount(accountId) {
    // Standard account (un-funded) creation using the master creator account directly
    if (creatorKeyJson && accountId == creatorKeyJson.account_id) {
        return parseKeyPair(creatorKeyJson.secret_key || creatorKeyJson.private_key);
    }

    // To create new accounts funded from a source account, by way of `near.create_account` function call
    if (fundedCreatorKeyJson && accountId === fundedCreatorKeyJson.account_id) {
        return parseKeyPair(fundedCreatorKeyJson.secret_key || fundedCreatorKeyJson.private_key);
    }

    // 2FA confirm key for account, derived deterministically from the account id
    const seed = crypto.createHash('sha256').update(accountId + DETERM_KEY_SEED).digest();
    return KeyPair.fromString(`ed25519:${baseEncode(seed)}`);
}

const provider = new JsonRpcProvider({ url: process.env.NODE_URL });

const near = {
    provider,
    account: (accountId) => new Account(accountId, provider, new KeyPairSigner(getKeyPairForAccount(accountId))),
    getPublicKey: (accountId) => getKeyPairForAccount(accountId).getPublicKey(),
};

const withNear = async (ctx, next) => {
    ctx.near = near;
    await next();
};

module.exports = {
    parseSeedPhrase: require('near-seed-phrase').parseSeedPhrase,
    parseKeyPair,
    creatorKeyJson,
    creatorKeysJson,
    fundedCreatorKeyJson,
    withNear,
    checkAccountOwnership,
    createCheckAccountDoesNotExistMiddleware,
    accountAuthMiddleware,
};
