const {
    PublicKey,
    actions: {
        addFullAccessKey,
        createAccount: createAccountAction,
        transfer,
    },
} = require('near-api-js');

const MultiKeyAccountCreator = require('./MultiKeyAccountCreator');
const { creatorKeyJson, creatorKeysJson } = require('./near');

const NEW_ACCOUNT_AMOUNT = process.env.NEW_ACCOUNT_AMOUNT;

let accountCreator;

if (creatorKeysJson && creatorKeysJson.private_keys.length > 0) {
    accountCreator = new MultiKeyAccountCreator({
        sourceAccount: {
            accountId: creatorKeysJson.account_id,
            signingPrivKeys: creatorKeysJson.private_keys
        }
    });
}

const createAccount = async (ctx) => {
    if (!creatorKeyJson) {
        console.warn('ACCOUNT_CREATOR_KEY is not set up, cannot create accounts.');
        ctx.throw(500, 'Service misconfigured; account creation is not available.');
    }

    const { newAccountId, newAccountPublicKey } = ctx.request.body;
    if (!newAccountId || !newAccountPublicKey) {
        ctx.throw(400, 'Must provide newAccountId and newAccountPublicKey');
    }

    // Prevent test-*.testnet accounts draining the faucet and transferring tokens to `applebear.testnet`
    // https://testnet.nearblocks.io/address/temp-1761748222018.testnet
    if (newAccountId.startsWith('temp-')) {
        ctx.throw(403, 'Please, do not drain testnet faucet.');
    }

    // Reject keys we cannot parse up front, instead of retrying a transaction that can never be built
    let publicKey;
    try {
        publicKey = PublicKey.from(newAccountPublicKey);
    } catch (e) {
        ctx.throw(400, `Invalid newAccountPublicKey: ${e.message}`);
    }

    if (accountCreator) {
        if (!accountCreator.initialized) {
            await accountCreator.initialize();
        }

        ctx.body = await accountCreator.createAccount({
            accountId: newAccountId,
            publicKey,
            amount: NEW_ACCOUNT_AMOUNT
        });
    } else {
        const masterAccount = ctx.near.account(creatorKeyJson.account_id);
        ctx.body = await masterAccount.signAndSendTransaction({
            receiverId: newAccountId,
            actions: [
                createAccountAction(),
                transfer(BigInt(NEW_ACCOUNT_AMOUNT)),
                addFullAccessKey(publicKey),
            ],
        });
    }

};


module.exports = {
    createAccount,
};
